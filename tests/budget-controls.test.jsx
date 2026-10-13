import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import Budget from "../src/pages/Budget";
import { localDate } from "../src/lib/format";

const mocks = vi.hoisted(() => ({ useApp: vi.fn(), api: vi.fn() }));
vi.mock("../src/state/AppContext", () => ({ useApp: mocks.useApp }));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
let updateBudget, deleteBudget;
beforeEach(() => {
  updateBudget = vi.fn().mockResolvedValue({});
  deleteBudget = vi.fn().mockResolvedValue(null);
  mocks.api.mockResolvedValue([{ id: 3, name: "Groceries", type: "expense" }]);
  mocks.useApp.mockReturnValue({
    budgets: [{ id: 9, category: "Groceries", categoryId: 3, limit: 500, spent: 50,
      period: "monthly", startDate: `${localDate().slice(0, 7)}-01`, endDate: `${localDate().slice(0, 7)}-28` }],
    transactions: [], wallets: [], money: (amount) => `PHP ${amount}`, date: (date) => date,
    currency: "PHP", notify: vi.fn(), updateBudget, deleteBudget,
  });
});

it("prefills month-based budget editing and saves the changed monthly limit", async () => {
  render(<Budget />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Groceries budget" }));
  expect(screen.getByLabelText("Month")).toHaveValue(localDate().slice(0, 7));
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Monthly limit (PHP)"), { target: { value: "650" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(updateBudget).toHaveBeenCalledWith(9, expect.objectContaining({ budget_amount: 650, category_name: "Monthly budget" })));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("requires confirmation and leaves deletion errors visible", async () => {
  deleteBudget.mockRejectedValue(new Error("Budget could not be deleted"));
  render(<Budget />);
  fireEvent.click(screen.getByRole("button", { name: "Delete Groceries budget" }));
  expect(deleteBudget).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete Budget" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Budget could not be deleted");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
