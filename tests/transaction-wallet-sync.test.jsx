import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../src/state/AppContext";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/state/AuthContext", () => ({ useAuth: () => ({ account: { id: 10, role: "user" } }) }));
vi.mock("../src/lib/api", () => ({ api: mocks.api, assetUrl: () => null }));
function Harness() {
  const { wallets, transactions, loading, createTransaction } = useApp();
  return <><button disabled={loading} onClick={() => createTransaction({ payment_method_id: 3 })}>Save transaction</button>
    {wallets.map((wallet) => <p key={wallet.id}>{wallet.name}: {wallet.balance}</p>)}<p>{transactions.length} transactions</p></>;
}
it("does not change or refresh wallet metadata when a transaction is saved", async () => {
  let saved = false;
  mocks.api.mockImplementation(async (path, options) => {
    if (path === "/profile") return { name: "Test", email: "test@example.com" };
    if (path === "/wallets") return [{ id: 1, name: "GCash", paymentMethodId: 3, balance: saved ? 400 : 500 }, { id: 2, name: "Cash", paymentMethodId: 4, balance: 100 }];
    if (path === "/transactions" && options?.method === "POST") {
      saved = true;
      return { id: 5, description: "Food", date: "2026-10-11", amount: -100, paymentMethodId: 3 };
    }
    return [];
  });
  render(<MemoryRouter><AppProvider><Harness /></AppProvider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText("GCash: 500")).toBeInTheDocument();
  await waitFor(() => expect(mocks.api.mock.calls.filter(([path]) => path === "/wallets")).toHaveLength(1));
  expect(screen.getByText("GCash: 500")).toBeInTheDocument();
  expect(screen.getByText("Cash: 100")).toBeInTheDocument();
  expect(screen.getByText("1 transactions")).toBeInTheDocument();
});
