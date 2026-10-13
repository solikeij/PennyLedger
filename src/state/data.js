// REVISED: only UI report labels remain here. Transactions, budgets, goals,
// reports, categories, and payment methods now come from the PHP API.
export const reportTypes = [
  { id: "income-expense", name: "Income vs Expense",
    description: "Cash flow trend over time", icon: "reports" },
  { id: "category", name: "Category Breakdown",
    description: "Where your money goes", icon: "pie" },
  { id: "budget", name: "Budget Performance",
    description: "Spent vs. limit by category", icon: "budget" },
  { id: "goals", name: "Goal Progress",
    description: "How close you are to each goal", icon: "goals" },
];
