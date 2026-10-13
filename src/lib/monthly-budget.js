export function monthlyBudgetProgress(budgets, transactions) {
  return budgets.map((budget) => {
    if (budget.category !== "Monthly budget") return { ...budget, spent: transactions.reduce((sum, tx) => sum + (tx.amount < 0 && (budget.categoryId != null ? tx.categoryId === budget.categoryId : tx.category === budget.category) && tx.date >= budget.startDate && tx.date <= budget.endDate ? -Number(tx.amount) : 0), 0) };
    const month = budget.startDate?.slice(0, 7);
    const spent = transactions.reduce((sum, tx) => sum + (tx.date?.startsWith(month) && tx.amount < 0 ? -Number(tx.amount) : 0), 0);
    return { ...budget, isMonthlyPlan: true,
      category: new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }), spent };
  });
}
