import DataSection from './DataSection';
import { useApp } from "../state/AppContext";
import { spendingAnalytics } from "../lib/spending-analytics";
import { download } from "../lib/format";

export default function SpendingInsights({ onUseBudget, reviewOnly = false, compact = false }) {
  const { transactions: recentTransactions = [], analyticsTransactions: transactions = recentTransactions, budgets = [], money } = useApp();
  const analysis = spendingAnalytics(transactions, budgets);
  const monthName = (month) => new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const describe = (item) => item.kind === "over" ? `You are ${money(item.amount)} over this month’s limit. Review purchases before adding more expenses.`
    : item.kind === "pace" ? `At your current pace, spending may exceed this month’s limit by ${money(item.amount)}. Slow spending or review your limit.`
    : item.kind === "income" ? `Past recorded monthly expenses exceed income by ${money(item.amount)} on average. Review nonessential spending.`
    : `${item.name} spending is on pace to exceed its historical monthly average by ${money(item.amount)}. Review this category.`;
  const previous = analysis.previous;
  const reviewLines = [
    `PennyLedger month-end review: ${monthName(previous.month)}`,
    `Recorded income: ${money(previous.income)}`, `Recorded expenses: ${money(previous.expense)}`,
    `Net income: ${money(previous.income - previous.expense)}`,
    ...(previous.limit ? [`Budget limit: ${money(previous.limit)}`, `Remaining: ${money(previous.limit - previous.expense)}`] : ["No overall monthly budget was recorded."]),
    ...(previous.expense > previous.income ? ["Adjustment: recorded expenses exceeded income. Review nonessential purchases and recurring costs."] : ["Adjustment: keep reviewing recurring costs and plan a savings contribution within your remaining funds."]),
    ...(previous.categories.length ? [`Largest expense category: ${previous.categories[0].name} (${money(previous.categories[0].amount)}). Review this category first.`] : []),
    `Next-month estimate: ${analysis.suggestedLimit === null ? "Not enough completed-month history" : money(analysis.suggestedLimit)}`,
    "Estimate uses up to 3 completed months with records, plus a 10% buffer. Missing records can affect the result. This is a planning estimate, not a spending commitment.",
  ];
  return <section className="card spending-insights"><DataSection sections={["analyticsTransactions", "budgets"]}>
    <div className="card-head"><h2>{reviewOnly ? "Month-end spending review" : "Spending insights"}</h2></div>
    {!reviewOnly && <>
      <div aria-live="polite" className="analytics-alerts">
        {analysis.adjustments.slice(0, compact ? 2 : 5).map((item, index) => <p className="analytics-notice" key={`${item.kind}-${item.name || index}`}>{describe(item)}</p>)}
        {!analysis.adjustments.length && <p className="report-caption">{analysis.current.count ? "No adjustment alerts from your recorded spending so far." : "Record your income and expenses to see spending insights."}</p>}
      </div>
      {!compact && <>
        <h3>Estimated budget for {monthName(analysis.nextMonth)}</h3>
        {analysis.suggestedLimit === null ? <p>Record at least one completed month of transactions to get a budget estimate.</p> : <>
          <p className="analytics-estimate">{money(analysis.suggestedLimit)}</p>
          <p className="report-caption">Based on {analysis.history.length} completed month(s) with records: average expenses of {money(analysis.averageExpense)} plus a 10% buffer. Incomplete history can affect the estimate.</p>
          {analysis.averageIncome > 0 && analysis.suggestedLimit > analysis.averageIncome && <p className="analytics-notice">This estimate is above average recorded income of {money(analysis.averageIncome)}. Choose a lower limit if that better fits your available funds.</p>}
          {onUseBudget && <button className="btn btn-primary btn-sm" onClick={() => onUseBudget({ month: analysis.nextMonth, limit: analysis.suggestedLimit })}>Use estimate in budget form</button>}
        </>}
        <p className="report-caption">Recommendations update from saved transactions. You choose and confirm your budget limit.</p>
      </>}
    </>}
    {reviewOnly && <>
      <h3>{monthName(previous.month)}</h3>
      {!previous.count ? <p>No transactions recorded for this completed month.</p> : <>
        <div className="analytics-review">{reviewLines.slice(1, -2).map((line, index) => <p key={index}>{line}</p>)}</div>
        <button className="btn btn-outline btn-sm" onClick={() => download(reviewLines.join("\n\n"), `pennyledger-review-${previous.month}.txt`, "text/plain;charset=utf-8")}>Download month-end review</button>
        <p className="report-caption">Available when the month has ended. This review updates when records change; it is not emailed automatically.</p>
      </>}
    </>}
  </DataSection></section>;
}
