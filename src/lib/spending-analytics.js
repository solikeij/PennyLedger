import { localDate } from "./format";

// Move a month key backward or forward for spending comparisons.
export function shiftMonth(month, offset) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Analyze completed-month history and current spending to suggest planning adjustments.
export function spendingAnalytics(
  transactions = [],
  budgets = [],
  today = localDate(),
) {
  const month = today.slice(0, 7);
  const valid = transactions.filter(
    (tx) =>
      /^\d{4}-\d{2}-\d{2}$/.test(tx.date || "") &&
      tx.date <= today &&
      Number.isFinite(Number(tx.amount)),
  );
  const months = [...new Set(valid.map((tx) => tx.date.slice(0, 7)))]
    .filter((key) => key < month)
    .sort()
    .reverse()
    .slice(0, 3);
  // Summarize a month's recorded income, expenses, and expense categories.
  function totals(key) {
    const items = valid.filter((tx) => tx.date.startsWith(key));
    const categories = new Map();
    for (const tx of items)
      if (tx.amount < 0)
        categories.set(
          tx.category || "Other",
          (categories.get(tx.category || "Other") || 0) - Number(tx.amount),
        );
    return {
      month: key,
      income: items.reduce(
        (sum, tx) => sum + Math.max(0, Number(tx.amount)),
        0,
      ),
      expense: items.reduce(
        (sum, tx) => sum + Math.max(0, -Number(tx.amount)),
        0,
      ),
      categories: [...categories]
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount),
      count: items.reduce((sum, item) => sum + (item.recordCount ?? 1), 0),
    };
  }
  const history = months.map(totals);
  const current = totals(month);
  const averageExpense = history.length
    ? history.reduce((sum, item) => sum + item.expense, 0) / history.length
    : 0;
  const averageIncome = history.length
    ? history.reduce((sum, item) => sum + item.income, 0) / history.length
    : 0;
  const suggestedLimit =
    // Estimate from completed-month expenses, with a ten-percent planning buffer.
    history.length && averageExpense > 0
      ? Math.ceil((averageExpense * 110) / 100)
      : null;
  const matching = budgets.filter(
    (b) => b.period === "monthly" && b.startDate?.startsWith(month),
  );
  const overall = matching.filter(
    (b) => b.isMonthlyPlan || b.category === "Monthly budget",
  );
  const limit = (overall.length ? overall : matching).reduce(
    (sum, item) => sum + Number(item.limit),
    0,
  );
  const [year, number] = month.split("-").map(Number);
  const days = new Date(year, number, 0).getDate();
  const projectedExpense =
    (current.expense / Number(today.slice(8, 10))) * days;
  const adjustments = [];
  if (limit && current.expense > limit)
    adjustments.push({ kind: "over", amount: current.expense - limit });
  else if (limit && projectedExpense > limit)
    adjustments.push({ kind: "pace", amount: projectedExpense - limit });
  if (history.length && averageExpense > averageIncome && averageIncome > 0)
    adjustments.push({
      kind: "income",
      amount: averageExpense - averageIncome,
    });
  if (history.length) {
    for (const category of current.categories) {
      const baseline =
        history.reduce(
          (sum, item) =>
            sum +
            (item.categories.find((c) => c.name === category.name)?.amount ||
              0),
          0,
        ) / history.length;
      const projected = (category.amount / Number(today.slice(8, 10))) * days;
      if (baseline > 0 && projected > baseline * 1.2)
        adjustments.push({
          kind: "category",
          name: category.name,
          amount: projected - baseline,
        });
    }
  }
  const previous = totals(shiftMonth(month, -1));
  const previousLimits = budgets.filter(
    (b) => b.period === "monthly" && b.startDate?.startsWith(previous.month),
  );
  const previousOverall = previousLimits.filter(
    (b) => b.isMonthlyPlan || b.category === "Monthly budget",
  );
  previous.limit = (
    previousOverall.length ? previousOverall : previousLimits
  ).reduce((sum, item) => sum + Number(item.limit), 0);
  return {
    month,
    nextMonth: shiftMonth(month, 1),
    history,
    current,
    previous,
    averageExpense,
    averageIncome,
    suggestedLimit,
    projectedExpense,
    limit,
    adjustments,
  };
}
