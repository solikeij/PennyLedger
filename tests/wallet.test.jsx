import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { localDate } from "../src/lib/format";
import { MemoryRouter } from "react-router-dom";
vi.mock("../src/lib/api", () => ({
  api: async () => [{ id: 9, name: "Groceries", type: "expense" }],
}));
import Dashboard from "../src/pages/Dashboard";
const fixture = vi.hoisted(() => ({
  empty: false,
  duplicates: false,
  overBudget: false,
}));
const { createWallet, updateWallet, deleteWallet } = vi.hoisted(() => ({
  createWallet: vi.fn().mockResolvedValue({}),
  updateWallet: vi.fn().mockResolvedValue({}),
  deleteWallet: vi.fn().mockResolvedValue({}),
}));
vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({
    transactions: fixture.overBudget
      ? [
          {
            id: 1,
            amount: 500,
            date: localDate(),
            category: "Salary",
            description: "Pay",
          },
          {
            id: 2,
            amount: -250,
            date: localDate(),
            category: "Food",
            description: "Shopping",
          },
        ]
      : [],
    budgets: [
      {
        id: 1,
        category: "Food",
        limit: 200,
        spent: fixture.overBudget ? 250 : 10,
        period: "monthly",
        startDate: localDate().slice(0, 7) + "-01",
      },
    ],
    wallets: fixture.empty
      ? []
      : [
          {
            id: 2,
            name: "Physical money",
            expenseType: "Other",
            isDefault: true,
          },
          { id: 1, name: "GCash", expenseType: "Groceries" },
          ...(fixture.duplicates
            ? [{ id: 3, name: "GCash", expenseType: "Travel" }]
            : []),
        ],
    goals: [],
    profile: { name: "Admin User" },
    date: (d) => d,
    money: (value) => `$${value}`,
    currency: "USD",
    createWallet,
    updateWallet,
    deleteWallet,
    notify: vi.fn(),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.empty = false;
  fixture.duplicates = false;
  fixture.overBudget = false;
});
it("removes balance totals and submits name and expense type", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Total Budgeted").closest(".stat-card"),
  ).toHaveTextContent("$200");
  expect(screen.queryByText("$700")).not.toBeInTheDocument();
  expect(screen.getByText("$190")).toBeInTheDocument();
  expect(screen.getByText("GCash")).toBeInTheDocument();
  expect(screen.queryByText("Total Balance")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Add Wallet/ }));
  fireEvent.change(screen.getByLabelText("Wallet name"), {
    target: { value: "Bank savings" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Choose expense type" }));
  fireEvent.click(await screen.findByRole("option", { name: "Groceries" }));
  expect(screen.queryByLabelText(/balance/i)).not.toBeInTheDocument();
  const buttons = screen.getAllByRole("button", { name: "Add wallet" });
  fireEvent.click(buttons.at(-1));
  await waitFor(() =>
    expect(createWallet).toHaveBeenCalledWith({
      name: "Bank savings",
      expense_type: "Groceries",
    }),
  );
});

it("edits an existing wallet", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Manage GCash" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit GCash" }));
  expect(screen.getByLabelText("Wallet name")).toHaveValue("GCash");
  expect(screen.getByLabelText("Expense type")).toHaveValue("Groceries");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(updateWallet).toHaveBeenCalledWith(1, {
      name: "GCash",
      expense_type: "Groceries",
    }),
  );
});

it("allows classifying physical money while preserving its default identity", async () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Manage Physical money" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit Physical money" }));
  expect(
    screen.queryByRole("button", { name: "Delete wallet" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Wallet name")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Expense type")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(updateWallet).toHaveBeenCalledWith(2, {
      name: "Physical money",
      expense_type: "Other",
    }),
  );
});

it("asks for a password before deleting and shows a rejected password", async () => {
  deleteWallet.mockRejectedValueOnce(new Error("Incorrect password"));
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Manage GCash" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit GCash" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete wallet" }));
  expect(deleteWallet).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm your password"), {
    target: { value: "wrong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Incorrect password",
  );
  expect(deleteWallet).toHaveBeenCalledWith(1, "wrong-password");
});

it("opens the same form from the empty-state action and preserves values after a failed save", async () => {
  fixture.empty = true;
  createWallet.mockRejectedValueOnce(new Error("Save unavailable"));
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  fixture.empty = false;
  fireEvent.click(screen.getAllByRole("button", { name: "Add Wallet" }).at(-1));
  fireEvent.change(screen.getByLabelText("Wallet name"), {
    target: { value: "Travel wallet" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Choose expense type" }));
  fireEvent.click(await screen.findByRole("option", { name: "Groceries" }));
  fireEvent.click(screen.getByRole("button", { name: "Add wallet" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Save unavailable",
  );
  expect(screen.getByLabelText("Wallet name")).toHaveValue("Travel wallet");
  expect(screen.getByLabelText("Expense type")).toHaveValue("Groceries");
});

it("tags duplicate wallets and deletes the selected wallet directly from its card", async () => {
  fixture.duplicates = true;
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Travel", { selector: ".wallet-type-tag" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Groceries", { selector: ".wallet-type-tag" }),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Manage GCash · Travel" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit GCash · Travel" }));
  expect(screen.getByLabelText("Expense type")).toHaveValue("Travel");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(updateWallet).toHaveBeenCalledWith(3, {
      name: "GCash",
      expense_type: "Travel",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Delete GCash · Travel" }),
  );
  expect(screen.getByText(/Delete GCash · Travel\?/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Confirm your password"), {
    target: { value: "confirmed-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() =>
    expect(deleteWallet).toHaveBeenCalledWith(3, "confirmed-password"),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("button", { name: "Delete Physical money" }),
  ).not.toBeInTheDocument();
});

it("shows signed income and expenses and marks a negative remaining budget red", () => {
  fixture.overBudget = true;
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  const amount = (label) =>
    screen.getByText(label).closest(".stat-card").querySelector(".stat-value");
  expect(amount("Monthly Income")).toHaveTextContent("+$500");
  expect(amount("Monthly Income")).toHaveClass("amt-pos");
  expect(amount("Monthly Expenses")).toHaveTextContent("-$250");
  expect(amount("Monthly Expenses")).toHaveClass("amt-neg");
  expect(amount("Remaining Budget")).toHaveClass("amt-neg");
  expect(amount("Remaining Budget")).toHaveTextContent("$-50");
});
