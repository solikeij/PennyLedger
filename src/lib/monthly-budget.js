// Budget spending already includes archived expenses. Replace the original
// expense when editing instead of counting it twice.
export function projectedMonthlyBudget(budgets, { amount, date, type, transaction }) {
  if (type !== "expense" || !date || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return null;
  const month = date.slice(0, 7);
  const budget = budgets.find((item) =>
    (item.isMonthlyPlan || item.category === "Monthly budget") &&
    item.startDate?.slice(0, 7) === month,
  );
  if (!budget) return null;
  const previous = transaction?.amount < 0 && transaction.date?.startsWith(month)
    ? Math.round(-transaction.amount * 100) : 0;
  const projected = Math.round(Number(budget.spent) * 100) - previous + Math.round(Number(amount) * 100);
  const limit = Math.round(Number(budget.limit) * 100);
  return projected > limit ? { limit: limit / 100, projected: projected / 100, excess: (projected - limit) / 100 } : null;
}

export function monthlyBudgetProgress(budgets, transactions) {
  return budgets.map((budget) => {
    if (budget.category !== "Monthly budget")
      return {
        ...budget,
        spent: transactions.reduce(
          (sum, tx) =>
            sum +
            (tx.amount < 0 &&
            (budget.categoryId != null
              ? tx.categoryId === budget.categoryId
              : tx.category === budget.category) &&
            tx.date >= budget.startDate &&
            tx.date <= budget.endDate
              ? -Number(tx.amount)
              : 0),
          0,
        ),
      };
    const month = budget.startDate?.slice(0, 7);
    const spent = transactions.reduce(
      (sum, tx) =>
        sum +
        (tx.date?.startsWith(month) && tx.amount < 0 ? -Number(tx.amount) : 0),
      0,
    );
    return {
      ...budget,
      isMonthlyPlan: true,
      category: new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      spent,
    };
  });
}
