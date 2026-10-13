import { afterEach, describe, expect, it, vi } from "vitest";
import { api, getToken, setToken } from "../src/lib/api";

afterEach(() => {
  setToken(null);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('preserves the session on a server failure and expires it on an authenticated 401', async () => {
  setToken('session');
  const expired = vi.fn();
  window.addEventListener('penny-session-expired', expired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ message: 'Unavailable' }) })
    .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) }));
  await expect(api('/profile')).rejects.toMatchObject({ status: 503 });
  expect(getToken()).toBe('session');
  await expect(api('/profile')).rejects.toMatchObject({ status: 401 });
  expect(getToken()).toBeNull();
  expect(expired).toHaveBeenCalledTimes(1);
  window.removeEventListener('penny-session-expired', expired);
});

it('marks a timed-out write uncertain and reuses its idempotency key', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })).mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ status: 'success', data: { id: 4 } }) });
  vi.stubGlobal('fetch', fetchMock);
  const request = api('/wallets', { method: 'POST', body: { name: 'Timeout test' }, timeoutMs: 100 });
  const rejected = expect(request).rejects.toMatchObject({ uncertain: true, timedOut: true, requestKey: expect.any(String) });
  await vi.advanceTimersByTimeAsync(101);
  await rejected;
  await api('/wallets', { method: 'POST', body: { name: 'Timeout test' } });
  expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetchMock.mock.calls[1][1].headers['Idempotency-Key']);
});

it('does not expire a newer session when an older request returns 401', async () => {
  setToken('new-session');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) }));
  await expect(api('/profile', { token: 'old-session' })).rejects.toMatchObject({ status: 401 });
  expect(getToken()).toBe('new-session');
});

describe("React-to-PHP API contract", () => {
  it("sends the bearer token and unwraps the PHP data envelope", async () => {
    setToken("test-session-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", message: null, data: [{ id: 7 }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await api("/transactions")).toEqual([{ id: 7 }]);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/public\/index\.php\/transactions$/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-session-token");
  });

  it("rejects a failed write so the UI cannot claim it was saved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ status: "error", message: "Validation failed",
        errors: { amount: "Must be greater than zero" } }),
    }));
    await expect(api("/transactions", { method: "POST", body: { amount: -1 } }))
      .rejects.toMatchObject({ message: "Validation failed",
        fields: { amount: "Must be greater than zero" } });
  });
});
