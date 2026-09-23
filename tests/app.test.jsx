import { describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ACCOUNTS_KEY, SESSION_KEY } from "../src/state/AuthContext";
import { monthlyIncome, formatDate, progress, toCsv } from "../src/lib/format";
import { createReport, reportCsvRows } from "../src/lib/reports";
import { initialData } from "../src/state/data";

function open(path) {
  if (!["/", "/login", "/signup"].includes(path))
    sessionStorage.setItem(SESSION_KEY, JSON.stringify("alex-demo"));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
const nav = () =>
  within(screen.getByRole("navigation", { name: "Main navigation" }));

describe("pages and compatibility", () => {
  it.each([
    ["/", "Take control of your money, one penny at a time."],
    ["/login", "Welcome Back!"],
    ["/signup", "Manage your Money Securely with trust."],
    ["/dashboard", "Good afternoon, Alex"],
    ["/transactions", "Transactions"],
    ["/budget", "Budget"],
    ["/goals", "Financial Goals"],
    ["/reports", "Reports"],
    ["/settings", "Settings"],
    ["/archive", "Archive"],
  ])("renders %s", (path, title) => {
    open(path);
    expect(
      screen.getByRole("heading", { name: title, level: 1 }),
    ).toBeInTheDocument();
  });
  it("redirects a legacy HTML URL and accepts preference parameters", () => {
    open(
      "/transactions.html?theme=dark&currency=PHP&dateformat=DD%2FMM%2FYYYY",
    );
    expect(
      screen.getByRole("heading", { name: "Transactions" }),
    ).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByText("-₱84.32")).toBeInTheDocument();
    expect(screen.getByText("14/03/2026")).toBeInTheDocument();
  });
});

describe("connected React workflows", () => {
  it("adds a transaction on the dashboard, updates its budget, and persists across remount", async () => {
    const user = userEvent.setup();
    const app = open("/dashboard");
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(
      dialog.getByLabelText("Description"),
      "React test groceries",
    );
    await user.type(dialog.getByLabelText("Amount (USD)"), "25.50");
    await user.click(dialog.getByRole("button", { name: "Add Transaction" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("React test groceries")).toBeInTheDocument();
    expect(screen.getByText("$445.50 / $500.00")).toBeInTheDocument();
    await user.click(nav().getByRole("link", { name: "Transactions" }));
    expect(screen.getByText("React test groceries")).toBeInTheDocument();
    expect(screen.getByText("-$25.50")).toBeInTheDocument();
    app.unmount();
    open("/transactions");
    expect(screen.getByText("React test groceries")).toBeInTheDocument();
  });
  it("filters and restores a transaction from the shared archive", async () => {
    const user = userEvent.setup();
    open("/transactions");
    await user.type(
      screen.getByRole("textbox", { name: "Search by name or category" }),
      "Whole Foods",
    );
    expect(
      screen.getByText("Showing 1 of 10 transactions"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Netflix Subscription")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Archive Whole Foods Market" }),
    );
    expect(screen.queryByText("Whole Foods Market")).not.toBeInTheDocument();
    await user.click(nav().getByRole("link", { name: "Settings" }));
    await user.click(screen.getByRole("link", { name: "Open Archive" }));
    await user.click(
      screen.getByRole("button", { name: "Restore Whole Foods Market" }),
    );
    expect(screen.queryByText("Whole Foods Market")).not.toBeInTheDocument();
    await user.click(nav().getByRole("link", { name: "Transactions" }));
    expect(screen.getByText("Whole Foods Market")).toBeInTheDocument();
  });
  it("rejects duplicate budgets and safely renders a new category", async () => {
    const user = userEvent.setup();
    open("/budget");
    await user.click(screen.getByRole("button", { name: "Create Budget" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Category"), "groceries");
    await user.type(dialog.getByLabelText("Monthly limit (USD)"), "100");
    await user.click(dialog.getByRole("button", { name: "Create Budget" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
    await user.clear(dialog.getByLabelText("Category"));
    await user.type(dialog.getByLabelText("Category"), "<b>Books</b>");
    await user.click(dialog.getByRole("button", { name: "Create Budget" }));
    expect(
      screen.getByRole("heading", { name: "<b>Books</b>" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$2,700.00")).toBeInTheDocument();
  });
  it("adds and edits a goal with its progress visible in reports", async () => {
    const user = userEvent.setup();
    open("/goals");
    await user.click(screen.getByRole("button", { name: "Add Goal" }));
    let dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Goal name"), "New Camera");
    await user.type(dialog.getByLabelText("Target amount (USD)"), "1000");
    await user.clear(dialog.getByLabelText("Amount saved (USD)"));
    await user.type(dialog.getByLabelText("Amount saved (USD)"), "250");
    await user.click(dialog.getByRole("button", { name: "Add Goal" }));
    expect(screen.getByText("25%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit New Camera" }));
    dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Amount saved (USD)"));
    await user.type(dialog.getByLabelText("Amount saved (USD)"), "500");
    await user.click(dialog.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByText("50%")).toBeInTheDocument();
    await user.click(nav().getByRole("link", { name: "Reports" }));
    await user.click(
      screen.getByRole("button", { name: /Goal Progress How close/ }),
    );
    expect(screen.getByText("New Camera")).toBeInTheDocument();
  });
  it("generates reports and restores them through settings archive", async () => {
    const user = userEvent.setup();
    open("/reports");
    await user.click(
      screen.getByRole("button", { name: /Budget Performance Spent/ }),
    );
    await user.click(screen.getByRole("button", { name: "Generate Report" }));
    const name = "Budget Performance — August 2026";
    expect(screen.getByRole("cell", { name })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Archive ${name}` }));
    expect(screen.queryByRole("cell", { name })).not.toBeInTheDocument();
    await user.click(nav().getByRole("link", { name: "Settings" }));
    await user.click(screen.getByRole("link", { name: "Open Archive" }));
    await user.click(screen.getByRole("button", { name: `Restore ${name}` }));
    await user.click(nav().getByRole("link", { name: "Reports" }));
    await user.click(screen.getByRole("button", { name: `View ${name}` }));
    expect(screen.getByText("Total Budgeted")).toBeInTheDocument();
  });
  it("retains currency and date preferences after navigation and reload", async () => {
    const user = userEvent.setup();
    const app = open("/settings");
    await user.selectOptions(screen.getByLabelText("Currency"), "PHP");
    await user.selectOptions(
      screen.getByLabelText("Date format"),
      "DD/MM/YYYY",
    );
    await user.click(nav().getByRole("link", { name: "Transactions" }));
    expect(screen.getByText("-₱84.32")).toBeInTheDocument();
    expect(screen.getByText("14/03/2026")).toBeInTheDocument();
    app.unmount();
    open("/transactions");
    expect(screen.getByText("-₱84.32")).toBeInTheDocument();
    expect(screen.getByText("14/03/2026")).toBeInTheDocument();
  });
  it("validates signup and never stores passwords", async () => {
    const user = userEvent.setup();
    open("/signup");
    await user.type(screen.getByLabelText("Name"), "Test User");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "secret123",
    );
    await user.type(
      screen.getByLabelText("Verify Password", { exact: true }),
      "mismatch",
    );
    await user.click(screen.getByRole("checkbox", { name: /I understand/ }));
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Passwords don't match",
    );
    await user.clear(screen.getByLabelText("Verify Password", { exact: true }));
    await user.type(
      screen.getByLabelText("Verify Password", { exact: true }),
      "secret123",
    );
    await user.click(screen.getByRole("button", { name: "Sign Up" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Good afternoon, Test" }),
      ).toBeInTheDocument(),
    );
    expect(localStorage.getItem(ACCOUNTS_KEY)).not.toContain("secret123");
  });
  it("supports old archive storage on the same origin", () => {
    localStorage.setItem(
      "pennyledger_archived_transactions",
      JSON.stringify([{ id: "tx-1" }]),
    );
    open("/archive");
    expect(screen.getByText("Whole Foods Market")).toBeInTheDocument();
  });
});

describe("financial display and exports", () => {
  it("formats dates without timezone shifts and caps progress", () => {
    expect(formatDate("2026-03-14", "DD/MM/YYYY")).toBe("14/03/2026");
    expect(formatDate("2026-03-14")).toBe("Mar 14, 2026");
    expect(progress(200, 100)).toBe(100);
    expect(progress(1, 0)).toBe(0);
    expect(monthlyIncome(1000, "weekly")).toBe(4330);
  });
  it("exports each selected report type and quotes CSV safely", () => {
    const report = createReport(
      "goals",
      "2026-08",
      initialData.budgets,
      initialData.goals,
    );
    const rows = reportCsvRows(report);
    expect(rows[0]).toEqual(["Goal", "Saved", "Target", "Progress (%)"]);
    expect(rows[1]).toEqual(["Emergency Fund", 4200, 6000, 70]);
    expect(toCsv([["=SUM(A1)", 'A,"B"', -12]])).toBe(
      '"\'=SUM(A1)","A,""B""","-12"',
    );
  });
});
