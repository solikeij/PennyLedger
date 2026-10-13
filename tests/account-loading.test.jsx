import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../src/state/AppContext";
import DataSection from "../src/components/DataSection";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({ account: { id: 1, role: "user" } }),
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api, assetUrl: () => null }));
// Provide the component and shared state needed for this integration test.
function Harness() {
  const { wallets, goals, money, currency, createWallet } = useApp();
  return (
    <>
      <p>
        {currency} {money(20)}
      </p>
      <DataSection sections={["wallets"]}>
        <p>{wallets.length} wallets</p>
      </DataSection>
      <DataSection sections={["goals"]}>
        <p>{goals.length} goals</p>
      </DataSection>
      <button onClick={() => createWallet({ name: "Cash", balance: 20 })}>
        Save wallet
      </button>
    </>
  );
}
it("shows successful sections, distinguishes failures from empty data, and retries only the failed section", async () => {
  localStorage.setItem("pennyledger_currency", "EUR");
  let attempts = 0;
  mocks.api.mockImplementation(async (path) => {
    if (path === "/profile") return { name: "User" };
    if (path === "/wallets") {
      if (++attempts === 1) throw new Error("Wallet server unavailable");
      return [{ id: 1 }];
    }
    return [];
  });
  render(
    <MemoryRouter>
      <AppProvider>
        <Harness />
      </AppProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText("0 goals")).toBeInTheDocument();
  expect(screen.queryByText("0 wallets")).not.toBeInTheDocument();
  expect(screen.getByText("PHP ₱20.00")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Retry wallets" }));
  expect(await screen.findByText("1 wallets")).toBeInTheDocument();
  expect(
    mocks.api.mock.calls.filter(([path]) => path === "/goals"),
  ).toHaveLength(1);
});

it("keeps a saved wallet visible when the activity refresh fails", async () => {
  let saved = false;
  mocks.api.mockImplementation(async (path, options) => {
    if (path === "/profile") return { name: "User" };
    if (path === "/wallets" && options?.method === "POST") {
      saved = true;
      return { id: 1, name: "Cash", balance: 20 };
    }
    if (path === "/activity-logs" && saved) throw new Error("Refresh failed");
    return [];
  });
  render(
    <MemoryRouter>
      <AppProvider>
        <Harness />
      </AppProvider>
    </MemoryRouter>,
  );
  await screen.findByText("0 wallets");
  fireEvent.click(screen.getByRole("button", { name: "Save wallet" }));
  await waitFor(() =>
    expect(screen.getByText("1 wallets")).toBeInTheDocument(),
  );
});
