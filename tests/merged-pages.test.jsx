import { beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Transactions from "../src/pages/Transactions";
import Admin from "../src/pages/Admin";
import { localDate } from "../src/lib/format";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  createUser: vi.fn(),
  saveIncomeEstimate: vi.fn(),
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({
    transactions: [],
    analyticsTransactions: [
      { date: localDate(), amount: 3000, category: "Salary" },
    ],
    income: 2500,
    currency: "PHP",
    money: (n) => `PHP ${n}`,
    date: String,
    dateFormat: "MMM D, YYYY",
    notify: vi.fn(),
    saveIncomeEstimate: mocks.saveIncomeEstimate,
  }),
}));
vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    users: [],
    activity: [
      {
        user: "Sample User",
        eventType: "LOGIN",
        timestamp: "2026-10-13T10:00:00",
      },
    ],
    account: { name: "Administrator" },
    registrationOpen: true,
    createUser: mocks.createUser,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue([]);
  mocks.createUser.mockResolvedValue({ id: 1 });
});
it("shows complete-ledger income without transaction-entry buttons in history", () => {
  render(
    <MemoryRouter>
      <Transactions />
    </MemoryRouter>,
  );
  expect(
    screen.getByText("Recorded income this month: PHP 3000"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Expected monthly income: PHP 2500"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit expected income" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Add Transaction" }),
  ).not.toBeInTheDocument();
  expect(mocks.saveIncomeEstimate).not.toHaveBeenCalled();
});
it("retains main admin account creation controls", async () => {
  render(
    <MemoryRouter>
      <Admin section="users" />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Create User" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Full name"), {
    target: { value: "New Member" },
  });
  fireEvent.change(dialog.getByLabelText("Email"), {
    target: { value: "member@example.test" },
  });
  fireEvent.change(dialog.getByLabelText("Temporary password"), {
    target: { value: "ExamplePassword123!" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Create User" }));
  await waitFor(() =>
    expect(mocks.createUser).toHaveBeenCalledWith({
      name: "New Member",
      email: "member@example.test",
      password: "ExamplePassword123!",
    }),
  );
});
it("uses latest authentication-event fields in the main admin layout", () => {
  render(
    <MemoryRouter>
      <Admin section="activity" />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Authentication Events" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Sample User")).toBeInTheDocument();
  expect(screen.getByText("LOGIN")).toBeInTheDocument();
  expect(
    screen.queryByRole("columnheader", { name: "Subject" }),
  ).not.toBeInTheDocument();
});
