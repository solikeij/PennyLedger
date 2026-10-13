import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TransactionModal, BudgetModal } from "../src/components/Forms";

const { createTransaction, createBudget, saved } = vi.hoisted(() => ({ createTransaction: vi.fn().mockResolvedValue({}), createBudget: vi.fn().mockResolvedValue({}), saved: [] }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => ({ createTransaction, createBudget, budgets: [], notify: vi.fn(), currency: "PHP" }) }));
vi.mock("../src/lib/api", () => ({ api: async (path) => {
  if (path.endsWith("payment-methods")) return [{ id: 1, name: "Cash" }];
  if (path.endsWith("transaction-types")) return [{ id: 2, code: "expense" }, { id: 1, code: "income" }];
  return saved;
} }));

it("starts with no category suggestions and saves a typed category with the chosen type", async () => {
  render(<TransactionModal onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cash" });
  expect(screen.getByLabelText("Category")).toHaveValue("");
  fireEvent.click(screen.getByLabelText("Choose a saved category"));
  expect(screen.getByText(/No saved categories yet/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Weekend work" } });
  fireEvent.change(screen.getByLabelText("Transaction type"), { target: { value: "income" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: " Freelance " } });
  fireEvent.change(screen.getByLabelText("Amount (PHP)"), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Transaction" }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ category_name: "Freelance", transaction_type_id: 1, amount: 500 })));
});

it("creates an overall budget for the selected month", async () => {
  render(<BudgetModal onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2028-02" } });
  fireEvent.change(screen.getByLabelText("Monthly limit (PHP)"), { target: { value: "750" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Budget Process" }));
  await waitFor(() => expect(createBudget).toHaveBeenCalledWith(expect.objectContaining({ category_name: "Monthly budget", budget_amount: 750, start_date: "2028-02-01", end_date: "2028-02-29" })));
});

it("fills the transaction category from the saved-category dropdown", async () => {
  saved.push({ id: 9, name: "Pet care", type: "expense" });
  render(<TransactionModal onClose={vi.fn()} />);
  await screen.findByRole("option", { name: "Cash" });
  fireEvent.click(screen.getByLabelText("Choose a saved category"));
  await screen.findByRole("option", { name: "Pet care" });
  fireEvent.click(screen.getByRole("option", { name: "Pet care" }));
  expect(screen.getByLabelText("Category")).toHaveValue("Pet care");
  saved.length = 0;
});

it('keeps the selected value, closes outside and on Escape without closing the modal, and portals the list', async () => {
  saved.push({ id: 9, name: 'Pet care', type: 'expense' });
  const onClose = vi.fn();
  render(<TransactionModal onClose={onClose} />);
  await screen.findByRole('option', { name: 'Cash' });
  const input = screen.getByLabelText('Category');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(screen.getByRole('listbox').parentElement).toBe(document.body);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveValue('Pet care');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.click(input);
  fireEvent.pointerDown(screen.getByLabelText('Description'));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveValue('Pet care');
  saved.length = 0;
});
