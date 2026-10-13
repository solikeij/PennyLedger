import { expect, it } from "vitest";
import { monthlyBudgetProgress } from "../src/lib/monthly-budget";
import { ledgerTotals } from "../src/lib/ledger-totals";
import { createReport } from "../src/lib/reports";
it("counts all monthly expenses including archived records, without counting income or double-counting legacy category limits", () => {
  const transactions = [
    { date: "2026-10-01", amount: -100, category: "Food" },
    { date: "2026-10-02", amount: -200, category: "Travel", archived: true },
    { date: "2026-10-03", amount: 900 },
    { date: "2026-09-30", amount: -500 },
  ];
  const budgets = monthlyBudgetProgress([
    { category: "Monthly budget", period: "monthly", startDate: "2026-10-01", endDate: "2026-10-31", limit: 1000, spent: 0 },
    { category: "Food", period: "monthly", startDate: "2026-10-01", limit: 400, spent: 100 },
  ], transactions);
  expect(budgets[0]).toMatchObject({ category: "October 2026", spent: 300, isMonthlyPlan: true });
  expect(ledgerTotals(transactions, budgets, "2026-10-11")).toMatchObject({ budgeted: 1000, spent: 300, remaining: 700 });
  expect(createReport("budget", "2026-10", transactions, budgets, []).budgets).toHaveLength(1);
  expect(createReport("budget", "2026-10", transactions, budgets, []).budgets[0].spent).toBe(300);
});
