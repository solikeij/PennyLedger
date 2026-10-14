import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import Budget from "../src/pages/Budget";
import Goals from "../src/pages/Goals";
import { localDate } from "../src/lib/format";

const mocks = vi.hoisted(() => ({ app: {} }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("../src/lib/api", () => ({
  api: async () => [{ id: 1, code: "active" }],
}));
vi.mock("../src/components/SpendingInsights", () => ({ default: () => null }));
beforeEach(() => {
  mocks.app = {
    budgets: Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      category: `Budget ${String(index + 1).padStart(2, "0")}`,
      startDate: `${localDate().slice(0, 7)}-01`,
      endDate: localDate(),
      period: "monthly",
      limit: 100,
      spent: index < 3 ? 120 : 0,
    })),
    goals: Array.from({ length: 15 }, (_, index) => ({
      id: index + 1,
      name: `Goal ${String(index + 1).padStart(2, "0")}`,
      date: "2027-01-01",
      target: 100,
      saved: index < 3 ? 100 : 0,
      statusId: 1,
    })),
    transactions: [],
    money: (n) => `PHP ${n}`,
    date: String,
    currency: "PHP",
    notify: vi.fn(),
  };
});

it("pages budget cards, searches older records, and preserves full financial totals", () => {
  const { container } = render(<Budget />);
  expect(container.querySelectorAll(".budget-card")).toHaveLength(6);
  expect(
    screen.getByText("Total Budgeted").closest(".summary-cell"),
  ).toHaveTextContent("PHP 1500");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search budgets"), {
    target: { value: "Budget 02" },
  });
  expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
  expect(container.querySelectorAll(".budget-card")).toHaveLength(1);
  expect(
    screen.getByText("Total Budgeted").closest(".summary-cell"),
  ).toHaveTextContent("PHP 1500");
  fireEvent.click(
    screen.getByRole("button", { name: "Edit Budget 02 budget" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByLabelText("Monthly limit (PHP)"),
  ).toHaveValue(100);
});

it("filters budgets by status and resets to six per page without month or size controls", () => {
  const { container } = render(<Budget />);
  expect(screen.queryByLabelText("Budget month")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("budgets per page")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter budgets"), {
    target: { value: "over" },
  });
  expect(container.querySelectorAll(".budget-card")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(container.querySelectorAll(".budget-card")).toHaveLength(6);
  expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
});

it("finds goals across pages, filters progress, and clamps the last page after deletion", () => {
  const view = render(<Goals />);
  expect(screen.queryByLabelText("goals per page")).not.toBeInTheDocument();
  expect(view.container.querySelectorAll(".goal-card")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Goal 15")).toBeInTheDocument();
  mocks.app.goals = mocks.app.goals.slice(0, 12);
  view.rerender(<Goals />);
  expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter goals"), {
    target: { value: "reached" },
  });
  expect(view.container.querySelectorAll(".goal-card")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(view.container.querySelectorAll(".goal-card")).toHaveLength(6);
  fireEvent.change(screen.getByLabelText("Search goals"), {
    target: { value: "Goal 12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Edit Goal 12" }));
  expect(screen.getByLabelText("Goal name")).toHaveValue("Goal 12");
});

it("marks completed and overdue goals while keeping today's deadline in progress", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  mocks.app.goals = [
    {
      id: 1,
      name: "Finished",
      target: 100,
      saved: 100,
      date: localDate(yesterday),
    },
    { id: 2, name: "Late", target: 100, saved: 99, date: localDate(yesterday) },
    { id: 3, name: "Due today", target: 100, saved: 0, date: localDate() },
  ];
  const view = render(<Goals />);
  const card = (name) => within(screen.getByText(name).closest(".goal-card"));
  expect(card("Finished").getByText("Completed")).toHaveClass("pill-green");
  expect(card("Late").getByText("Deadline missed")).toHaveClass("pill-red");
  expect(card("Due today").getByText("In progress")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter goals"), {
    target: { value: "overdue" },
  });
  expect(view.container.querySelectorAll(".goal-card")).toHaveLength(1);
  expect(screen.getByText("Late")).toBeInTheDocument();
  // Reaching the target clears the missed-deadline indicator and filter result.
  mocks.app.goals = mocks.app.goals.map((goal) =>
    goal.id === 2 ? { ...goal, saved: 110 } : goal,
  );
  view.rerender(<Goals />);
  expect(screen.getByText(/No goals match these filters/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
  expect(card("Late").getByText("Completed")).toHaveClass("pill-green");
});
