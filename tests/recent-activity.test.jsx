import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../src/state/AppContext";

const mocks = vi.hoisted(() => ({ account: { id: 7, role: "user" }, api: vi.fn() }));
vi.mock("../src/state/AuthContext", () => ({ useAuth: () => ({ account: mocks.account }) }));
vi.mock("../src/lib/api", () => ({ api: mocks.api, assetUrl: () => null }));
function Harness() {
  const { activities, createWallet, loading } = useApp();
  return <><button disabled={loading} onClick={() => createWallet({ name: "GCash", balance: 100 }).catch(() => {})}>Add wallet</button>
    {activities.map((item) => <p key={item.id}>{item.description}: {item.amount}</p>)}</>;
}
function mount() { return render(<MemoryRouter><AppProvider><Harness /></AppProvider></MemoryRouter>); }
it("records successful wallet creation, persists on reload, isolates users, and ignores failed writes", async () => {
  let saved = false;
  mocks.account = { id: 7, role: "user" };
  mocks.api.mockImplementation(async (path, options) => {
    if (options?.method === "POST") { saved = true; return { id: 1, name: "GCash", balance: 100 }; }
    if (path === "/activity-logs") return saved && mocks.account.id === 7 ? [{ id: 1, description: "Wallet added: GCash", amount: 100, date: "2026-10-11T10:00:00" }] : [];
    if (path === "/profile") return { name: "Test", email: "test@example.com" };
    return [];
  });
  let view = mount();
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("Wallet added: GCash: 100")).toBeInTheDocument();
  view.unmount();
  localStorage.clear();
  view = mount();
  expect(await screen.findByText("Wallet added: GCash: 100")).toBeInTheDocument();
  view.unmount();
  mocks.account = { id: 8, role: "user" };
  view = mount();
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  expect(screen.queryByText("Wallet added: GCash: 100")).not.toBeInTheDocument();
  mocks.api.mockRejectedValueOnce(new Error("Network failure"));
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(mocks.api).toHaveBeenLastCalledWith("/wallets", expect.objectContaining({ method: "POST" })));
  expect(localStorage.getItem("pennyledger_activity_v1_8")).toBeNull();
});
