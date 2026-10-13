import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BudgetPerformance from "../src/components/BudgetPerformance";
import { budgetPerformanceCsvRows } from "../src/lib/budget-performance";
import { toCsv } from "../src/lib/format";
const mocks = vi.hoisted(() => ({ api: vi.fn(), download: vi.fn(), transactions: [], budgets: [] }));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/lib/format", async (original) => ({ ...await original(), download: mocks.download }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => ({ money: (n) => `$${Number(n).toFixed(2)}`, date: String, transactions: mocks.transactions, budgets: mocks.budgets }) }));
const report = { period: "2026-10", summary: { total_allocated: 400, total_spent: 550, remaining_balance: -150, unbudgeted_spent: 0, on_track_count: 0, warning_count: 0, over_budget_count: 1, category_count: 1 }, budgets: [{ budget_id: 1, category: "Food", allocated_limit: 400, total_spent: 550, remaining_balance: -150, over_budget_by: 150, percent_used: 137.5, status_flag: "Exceeded", start_date: "2026-10-01", end_date: "2026-10-31", transactions: [{ id: 3, date: "2026-10-12", category: "Food", description: "=Dinner", amount: 550, archived: true }] }] };
beforeEach(() => { vi.clearAllMocks(); mocks.api.mockResolvedValue(report); });
it("shows overspend, caps the progress bar, and exports the complete audit", async () => {
  render(<BudgetPerformance />);
  expect(await screen.findByText("Over Budget by $150.00")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  fireEvent.click(screen.getByText("Inspect transactions (1)"));
  expect(screen.getAllByText("=Dinner")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Export budget CSV" }));
  expect(mocks.download).toHaveBeenCalledWith(expect.stringContaining("'=Dinner"), "pennyledger-budget-performance-2026-10.csv", "text/csv;charset=utf-8");
  expect(toCsv(budgetPerformanceCsvRows(report))).toContain('"Yes"');
});
it("reloads the selected month and prints with all audit rows", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<BudgetPerformance />);
  await screen.findByText("Over Budget by $150.00");
  fireEvent.change(screen.getByLabelText("Report month"), { target: { value: "2026-02" } });
  await waitFor(() => expect(mocks.api).toHaveBeenLastCalledWith("/reports/budget-performance?year=2026&month=2", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  await screen.findByText("Over Budget by $150.00");
  fireEvent.click(screen.getByRole("button", { name: "Print budget report" }));
  expect(print).toHaveBeenCalled();
  expect(document.body).toHaveClass("budget-performance-print");
  window.dispatchEvent(new Event("afterprint"));
  expect(document.body).not.toHaveClass("budget-performance-print");
});
it("reports failures and supports retry", async () => {
  mocks.api.mockRejectedValueOnce(new Error("Report unavailable"));
  render(<BudgetPerformance />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Report unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Over Budget by $150.00")).toBeInTheDocument();
});
it("explains an empty month while retaining expense totals", async () => {
  mocks.api.mockResolvedValue({ ...report, budgets: [] });
  render(<BudgetPerformance />);
  expect(await screen.findByText(/No budgets cover this month/)).toBeInTheDocument();
});
it("ignores an older response after a month change", async () => {
  let resolveOld;
  mocks.api.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  render(<BudgetPerformance />);
  fireEvent.change(screen.getByLabelText("Report month"), { target: { value: "2025-02" } });
  await screen.findByText("Over Budget by $150.00");
  resolveOld({ ...report, period: "2024-01" });
  await waitFor(() => expect(screen.queryByText("January 2024")).not.toBeInTheDocument());
});
it("renders the warning and on-track states with uncapped usage text", async () => {
  mocks.api.mockResolvedValue({ ...report, budgets: [
    { ...report.budgets[0], budget_id: 2, category: "Travel", total_spent: 320, remaining_balance: 80, percent_used: 80, status_flag: "Warning", transactions: [] },
    { ...report.budgets[0], budget_id: 3, category: "Utilities", total_spent: 100, remaining_balance: 300, percent_used: 25, status_flag: "On Track", transactions: [] },
  ] });
  render(<BudgetPerformance />);
  expect(await screen.findByText("Warning")).toBeInTheDocument();
  expect(screen.getByText("On Track")).toBeInTheDocument();
  expect(screen.getByText("80% Used ($320.00 / $400.00)")).toBeInTheDocument();
  expect(screen.getByText("$80.00 remaining")).toBeInTheDocument();
});