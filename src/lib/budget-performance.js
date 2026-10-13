export function budgetPerformanceCsvRows(report) {
  const rows = [
    ["Budget Performance & Limit Tracking", report.period],
    ["Total allocated", report.summary.total_allocated],
    ["Total expenses", report.summary.total_spent],
    ["Unbudgeted expenses", report.summary.unbudgeted_spent],
    [],
    [
      "Budget ID",
      "Category / plan",
      "Scope",
      "Start",
      "End",
      "Allocated limit",
      "Total spent",
      "Remaining",
      "Status",
      "Used (%)",
    ],
  ];
  for (const b of report.budgets)
    rows.push([
      b.budget_id,
      b.category,
      b.is_monthly_plan ? "Overall monthly plan" : "Category",
      b.start_date,
      b.end_date,
      b.allocated_limit,
      b.total_spent,
      b.remaining_balance,
      b.status_flag,
      b.percent_used ?? "N/A",
    ]);
  rows.push(
    [],
    [
      "Budget ID",
      "Budget category / plan",
      "Transaction ID",
      "Date",
      "Transaction category",
      "Description",
      "Amount",
      "Payment method",
      "Archived",
    ],
  );
  for (const b of report.budgets)
    for (const tx of b.transactions)
      rows.push([
        b.budget_id,
        b.category,
        tx.id,
        tx.date,
        tx.category,
        tx.description,
        tx.amount,
        tx.payment_method,
        tx.archived ? "Yes" : "No",
      ]);
  return rows;
}
