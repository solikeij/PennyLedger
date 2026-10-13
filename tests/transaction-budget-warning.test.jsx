import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TransactionModal } from "../src/components/Forms";
vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({
    currency: "USD", money: (value) => `$${value}`,
    budgets: [{ isMonthlyPlan: true, startDate: "2026-10-01", limit: 100, spent: 90 }],
  }),
}));
vi.mock("../src/lib/api", () => ({
  api: async (path) => path.endsWith("transaction-types")
    ? [{ id: 1, code: "income" }, { id: 2, code: "expense" }]
    : path.endsWith("payment-methods") ? [{ id: 1, name: "Cash" }] : [],
}));
it("updates the budget reminder when the amount, type, or date changes without blocking saving", async () => {
  render(<TransactionModal transaction={{ amount: -20, date: "2026-10-02", category: "Food", paymentMethodId: 1 }} onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cash" });
  expect(screen.queryByText(/Budget reminder:/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "40" } });
  expect(screen.getByRole("status")).toHaveTextContent("exceeding your monthly budget of $100 by $10");
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "income" } });
  expect(screen.queryByText(/Budget reminder:/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "expense" } });
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-11-02" } });
  expect(screen.queryByText(/Budget reminder:/)).not.toBeInTheDocument();
});
