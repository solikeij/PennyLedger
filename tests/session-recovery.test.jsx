import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/state/AuthContext';
import { api, getToken, setToken } from '../src/lib/api';
vi.mock('../src/lib/api', () => ({ api: vi.fn(), getToken: vi.fn(), setToken: vi.fn() }));
function Harness() { const { account } = useAuth(); return <p>{account?.name || 'Signed out'}</p>; }
beforeEach(() => { vi.clearAllMocks(); getToken.mockReturnValue('saved-token'); });
it('offers Retry after a profile outage without clearing the token', async () => {
  let attempts = 0;
  api.mockImplementation(async (path) => {
    if (path !== '/profile') return { registrationOpen: true };
    if (++attempts === 1) throw Object.assign(new Error('Server unavailable'), { status: 503 });
    return { id: 1, name: 'Recovered User', role: 'user' };
  });
  render(<AuthProvider><Harness /></AuthProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Recovered User')).toBeInTheDocument();
  expect(setToken).not.toHaveBeenCalled();
});
it('clears an invalid initial session', async () => {
  api.mockImplementation(async (path) => {
    if (path === '/profile') throw Object.assign(new Error('Expired'), { status: 401 });
    return { registrationOpen: true };
  });
  render(<AuthProvider><Harness /></AuthProvider>);
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
  expect(setToken).toHaveBeenCalledWith(null);
});
