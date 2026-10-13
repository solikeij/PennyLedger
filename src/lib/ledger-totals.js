import { localDate } from "./format";
// Calculate this month's income, expenses, and applicable budget totals.
export function ledgerTotals(transactions, budgets, today = localDate()) {
  const month = today.slice(0, 7);
  const matchingBudgets = budgets.filter(
    (b) => b.period === "monthly" && b.startDate?.slice(0, 7) === month,
  );
  const overallBudgets = matchingBudgets.filter(
    (b) => b.isMonthlyPlan || b.category === "Monthly budget",
  );
  const monthlyBudgets = overallBudgets.length
    ? overallBudgets
    : matchingBudgets;
  const monthly = transactions.filter((t) => t.date.startsWith(month));
  const budgeted = monthlyBudgets.reduce((sum, b) => sum + b.limit, 0);
  const spent = monthlyBudgets.reduce((sum, b) => sum + b.spent, 0);
  return {
    monthlyBudgets,
    budgeted,
    spent,
    remaining: budgeted - spent,
    income: monthly.reduce((sum, t) => sum + Math.max(0, t.amount), 0),
    expenses: monthly.reduce((sum, t) => sum + Math.max(0, -t.amount), 0),
  };
}
