// All React-to-PHP requests pass through this file. Require an explicit URL:
// a guessed fallback can silently talk to an older project in XAMPP.
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const TOKEN_KEY = "penny_api_token";
const pendingWrites = new Map();

// Read the session token used to authenticate API requests.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Store or clear the current session token.
export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

// Build an API endpoint URL from the configured PHP base URL.
export function apiUrl(path) {
  if (!baseUrl)
    throw new Error("Set VITE_API_BASE_URL in .env.local and restart React.");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

// Resolve an uploaded asset path relative to PHP's public folder.
export function assetUrl(path) {
  if (!path || !baseUrl) return null;
  // Uploaded photo paths are relative to PHP's public/ folder.
  return `${baseUrl.replace(/index\.php$/, "")}${path.replace(/^\//, "")}`;
}

// Send an authenticated request with timeouts, save replay keys, and structured errors.
export async function api(
  path,
  { method = "GET", body, token = getToken(), signal, timeoutMs = 15000 } = {},
) {
  method = method.toUpperCase();
  const headers = {};
  const signature =
    method === "POST" && !(body instanceof FormData)
      ? JSON.stringify([path, body, token])
      : null;
  if (signature) {
    // Reuse the key after an uncertain save so a retry cannot create a duplicate.
    if (!pendingWrites.has(signature))
      pendingWrites.set(signature, crypto.randomUUID());
    headers["Idempotency-Key"] = pendingWrites.get(signature);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  // Forward an external cancellation request to the pending API call.
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(apiUrl(path), {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
    });

    // PHP wraps successful data in { status, data }. Check for failure before
    // any page updates its state or shows a success message.
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== "success") {
      if (signature && response.status < 500 && response.status !== 409)
        pendingWrites.delete(signature);
      const error = new Error(
        result?.message || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.fields = result?.errors || {};
      if (response.status === 401 && token && token === getToken()) {
        setToken(null);
        window.dispatchEvent(new Event("penny-session-expired"));
      }
      if (
        (response.status >= 500 || (response.ok && !result)) &&
        method !== "GET"
      )
        error.uncertain = true;
      throw error;
    }
    if (signature) pendingWrites.delete(signature);
    return result.data;
  } catch (failure) {
    if (signal?.aborted && !timedOut) throw failure;
    const connectionFailure = timedOut || !failure.status;
    if (connectionFailure) {
      failure = Object.assign(
        new Error(
          timedOut
            ? "The request timed out. Check your connection and try again."
            : "Could not reach the server. Check your connection and retry.",
        ),
        {
          cause: failure,
          timedOut,
          uncertain: method !== "GET",
        },
      );
    }
    if (failure.uncertain) {
      failure.message =
        "The save could not be confirmed. It may have completed. Check the saved records before submitting again.";
      failure.requestKey = signature ? pendingWrites.get(signature) : null;
    }
    throw failure;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
