import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TransactionModal } from "../src/components/Forms";

const { createTransaction, updateTransaction } = vi.hoisted(() => ({
  createTransaction: vi.fn().mockResolvedValue({}),
  updateTransaction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({ createTransaction, updateTransaction, notify: vi.fn(), currency: "PHP", budgets: [] }),
}));
vi.mock("../src/lib/api", () => ({
  api: async (path) => {
    if (path.endsWith("payment-methods")) return [
      { id: 1, name: "GCash Food", expenseType: "Food" },
      { id: 2, name: "Cash", expenseType: "Other" },
      { id: 3, name: "Travel wallet", expenseType: "Travel" },
    ];
    if (path.endsWith("transaction-types")) return [{ id: 1, code: "income" }, { id: 2, code: "expense" }];
    return [{ id: 10, name: "Food", type: "expense" }, { id: 11, name: "Travel", type: "expense" }];
  },
}));

beforeEach(() => vi.clearAllMocks());

// Supply the required fields so each test exercises category behavior on a valid form.
function fillTransaction() {
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Test purchase" } });
  fireEvent.change(screen.getByLabelText("Amount (PHP)"), { target: { value: "100" } });
}

it("prefills and locks a Food wallet's expense category, including the submitted value", async () => {
  render(<TransactionModal onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "GCash Food" });
  expect(screen.getByLabelText("Category")).toHaveValue("Food");
  expect(screen.getByLabelText("Category")).toHaveAttribute("readonly");
  expect(screen.queryByLabelText("Choose a saved category")).not.toBeInTheDocument();
  fillTransaction();
  fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ category_name: "Food", payment_method_id: 1 })));
});

it("allows any category on Other and updates the category when switching restricted wallets", async () => {
  render(<TransactionModal onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cash" });
  fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "3" } });
  expect(screen.getByLabelText("Category")).toHaveValue("Travel");
  fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "2" } });
  expect(screen.getByLabelText("Category")).not.toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Entertainment" } });
  fillTransaction();
  fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ category_name: "Entertainment", payment_method_id: 2 })));
});

it("keeps income categories independent and restores the restriction when switching to expenses", async () => {
  render(<TransactionModal onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "GCash Food" });
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "income" } });
  expect(screen.getByLabelText("Category")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Salary" } });
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "expense" } });
  expect(screen.getByLabelText("Category")).toHaveValue("Food");
  expect(screen.getByLabelText("Category")).toHaveAttribute("readonly");
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "income" } });
  expect(screen.getByLabelText("Category")).toHaveValue("Salary");
  fillTransaction();
  fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ category_name: "Salary", transaction_type_id: 1, payment_method_id: 1 })));
});

const conflictingTransaction = { id: 4, category: "Travel", paymentMethodId: 1, description: "Bus ticket", amount: -30, date: "2026-10-14" };

it("requires an explicit correction when editing an older conflicting transaction", async () => {
  render(<TransactionModal transaction={conflictingTransaction} onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "GCash Food" });
  expect(screen.getByLabelText("Category")).toHaveValue("Travel");
  expect(screen.getByRole("alert")).toHaveTextContent("currently categorized as Travel");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(updateTransaction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use Food category" }));
  expect(screen.getByLabelText("Category")).toHaveValue("Food");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(updateTransaction).toHaveBeenCalledWith(4, expect.objectContaining({ category_name: "Food" })));
});

it("lets an older conflicting transaction keep its category by selecting an Other wallet", async () => {
  render(<TransactionModal transaction={conflictingTransaction} onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cash" });
  fireEvent.change(screen.getByLabelText("Payment method"), { target: { value: "2" } });
  expect(screen.getByLabelText("Category")).toHaveValue("Travel");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(updateTransaction).toHaveBeenCalledWith(4, expect.objectContaining({ category_name: "Travel", payment_method_id: 2 })));
});
