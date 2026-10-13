import { reportTypes } from "../state/data";
import { progress } from "./format";

// NEW calculation: report screens use authenticated transactions loaded from
// PHP rather than the sample monthlySeries and hardcoded category percentages.
export function buildReportRanges(transactions, budgets = []) {
  const months = [
    ...new Set(
      [
        ...transactions.map((tx) => tx.date?.slice(0, 7)),
        ...budgets.flatMap((b) => [
          b.startDate?.slice(0, 7),
          b.endDate?.slice(0, 7),
        ]),
      ].filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  const current = new Date();
  const thisMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  if (!months.includes(thisMonth)) months.unshift(thisMonth);
  return [
    ...months.map((key) => ({
      key,
      label: new Date(`${key}-01T12:00:00`).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
    })),
    { key: "this-year", label: `This Year (${current.getFullYear()})` },
  ];
}

// Check whether a transaction falls inside the selected report dates.
function inRange(tx, range) {
  if (range === "this-year")
    return tx.date?.startsWith(String(new Date().getFullYear()));
  return tx.date?.startsWith(range);
}

// Build a report snapshot from transactions, budgets, and savings goals.
export function createReport(type, range, transactions, budgets, goals) {
  const period =
    buildReportRanges(transactions).find((item) => item.key === range)?.label ||
    range;
  const selected = transactions.filter((tx) => inRange(tx, range));
  const income = selected.reduce(
    (sum, tx) => sum + Math.max(0, Number(tx.amount)),
    0,
  );
  const expense = selected.reduce(
    (sum, tx) => sum + Math.max(0, -Number(tx.amount)),
    0,
  );
  const months = [...new Set(selected.map((tx) => tx.date.slice(0, 7)))].sort();
  const series = months.map((key) => {
    const rows = selected.filter((tx) => tx.date.startsWith(key));
    return {
      key,
      label: new Date(`${key}-01T12:00:00`).toLocaleString("en-US", {
        month: "short",
      }),
      income: rows.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount)), 0),
      expense: rows.reduce(
        (sum, tx) => sum + Math.max(0, -Number(tx.amount)),
        0,
      ),
    };
  });
  const shares = new Map();
  for (const tx of selected.filter((row) => row.amount < 0)) {
    shares.set(tx.category, (shares.get(tx.category) || 0) - Number(tx.amount));
  }
  const colors = [
    "var(--blue)",
    "var(--success)",
    "#1F63AC",
    "#7EB8EA",
    "#C3CDC7",
  ];
  const categories = [...shares].map(([name, amount], index) => ({
    name,
    amount,
    pct: expense ? Math.round((amount / expense) * 100) : 0,
    color: colors[index % colors.length],
  }));
  return {
    type,
    range,
    period,
    income,
    expense,
    series,
    name: reportTypes.find((item) => item.id === type)?.name || "Report",
    ...reportSnapshotDetails(range, transactions),
    categories,
    budgets: budgets
      .filter((item) => {
        const prefix =
          range === "this-year" ? String(new Date().getFullYear()) : range;
        const periodStart =
          range === "this-year" ? prefix + "-01-01" : prefix + "-01";
        const periodEnd =
          range === "this-year" ? prefix + "-12-31" : prefix + "-31";
        const inPeriod =
          item.startDate <= periodEnd && item.endDate >= periodStart;
        const replacedByMonthlyPlan =
          !item.isMonthlyPlan &&
          budgets.some(
            (plan) =>
              plan.isMonthlyPlan &&
              plan.startDate?.slice(0, 7) === item.startDate?.slice(0, 7),
          );
        return inPeriod && !replacedByMonthlyPlan;
      })
      .map((item) => ({
        ...item,
        spent: selected
          .filter(
            (tx) =>
              tx.amount < 0 &&
              (item.isMonthlyPlan || tx.categoryId === item.categoryId) &&
              tx.date >= item.startDate &&
              tx.date <= item.endDate,
          )
          .reduce((sum, tx) => sum - tx.amount, 0),
      })),
    goals: goals.map((item) => ({ ...item })),
  };
}

// Convert a report snapshot into rows for CSV export.
export function reportCsvRows(report) {
  switch (report.type) {
    case "category":
      return [
        ["Category", "Share (%)", "Amount"],
        ...report.categories.map((item) => [
          item.name,
          item.pct,
          Number(item.amount.toFixed(2)),
        ]),
      ];
    case "budget":
      return [
        ["Category", "Spent", "Limit", "Remaining"],
        ...report.budgets.map((item) => [
          item.category,
          item.spent,
          item.limit,
          item.limit - item.spent,
        ]),
      ];
    case "goals":
      return [
        ["Goal", "Saved", "Target", "Progress (%)"],
        ...report.goals.map((item) => [
          item.name,
          item.saved,
          item.target,
          progress(item.saved, item.target),
        ]),
      ];
    default:
      return [
        ["Period", "Income", "Expenses", "Net Savings"],
        [
          report.period,
          report.income,
          report.expense,
          Number((report.income - report.expense).toFixed(2)),
        ],
      ];
  }
}

// Calculate detailed report breakdowns, trends, and prior-period comparisons.
export function reportSnapshotDetails(range, transactions) {
  const yearView = range === "this-year";
  const base = yearView
    ? new Date(new Date().getFullYear(), 11, 1)
    : new Date(range + "-01T12:00:00");
  const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const previousKey = yearView
    ? String(base.getFullYear() - 1)
    : previous.getFullYear() +
      "-" +
      String(previous.getMonth() + 1).padStart(2, "0");
  const selected = transactions.filter((tx) => inRange(tx, range));
  const previousRows = transactions.filter((tx) =>
    tx.date?.startsWith(previousKey),
  );
  // Sum either income or expenses for a report comparison.
  const total = (rows, income) =>
    Math.round(
      rows.reduce(
        (sum, tx) =>
          sum +
          Math.round(
            Math.max(0, income ? Number(tx.amount) : -Number(tx.amount)) * 100,
          ),
        0,
      ),
    ) / 100;
  const income = total(selected, true),
    expense = total(selected, false);
  const oldIncome = total(previousRows, true),
    oldExpense = total(previousRows, false);
  // Calculate absolute and percentage changes between report periods.
  const change = (now, old) => ({
    amount: Math.round((now - old) * 100) / 100,
    percent: old ? Math.round(((now - old) / old) * 1000) / 10 : null,
  });
  const groups = new Map();
  for (const tx of selected.filter((tx) => Number(tx.amount) > 0))
    groups.set(
      tx.category,
      (groups.get(tx.category) || 0) + Math.round(Number(tx.amount) * 100),
    );
  const colors = ["#7acb98", "#ef9dba", "#7ab5de", "#e7c274", "#b9a0e6"];
  return {
    incomeBreakdown: [...groups].map(([name, cents], index) => ({
      name,
      amount: cents / 100,
      pct: income ? cents / income : 0,
      color: colors[index % colors.length],
    })),
    comparison: {
      period: previousKey,
      income: change(income, oldIncome),
      expense: change(expense, oldExpense),
      savings: change(income - expense, oldIncome - oldExpense),
      savingsRateChange:
        income > 0 && oldIncome > 0
          ? Math.round(
              ((income - expense) / income -
                (oldIncome - oldExpense) / oldIncome) *
                1000,
            ) / 10
          : null,
    },
    trend: Array.from({ length: yearView ? 12 : 6 }, (_, index) => {
      const date = new Date(
        base.getFullYear(),
        base.getMonth() - ((yearView ? 12 : 6) - 1) + index,
        1,
      );
      const key =
        date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      const rows = transactions.filter((tx) => tx.date?.startsWith(key));
      return {
        key,
        label: date.toLocaleDateString("en-US", { month: "short" }),
        income: total(rows, true),
        expense: total(rows, false),
        net: total(rows, true) - total(rows, false),
      };
    }),
  };
}
