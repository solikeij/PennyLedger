import { useApp } from "../state/AppContext";

export default function ReportSnapshot({ report }) {
  const { money } = useApp();
  const expensePercent = report.income > 0 ? report.expense / report.income * 100 : null;
  const net = report.income - report.expense;
  const breakdown = report.incomeBreakdown || [];
  let angle = 0;
  const gradient = breakdown.map(item => { const start = angle; angle += item.pct; return `${item.color} ${start}% ${angle}%`; }).join(",");
  const categories = [...report.categories].sort((a,b) => b.amount - a.amount).slice(0, 5);
  const maxExpense = Math.max(...categories.map(item => item.amount), 1);
  const values = report.trend.map(item => item.net);
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  const points = report.trend.map((item, index) => `${20 + index * 280 / Math.max(1, report.trend.length - 1)},${110 - (item.net - min) / (max - min) * 90}`).join(" ");
  const changeLabel = (change) => `${change.percent == null ? "No percentage baseline" : `${change.percent > 0 ? "+" : ""}${change.percent}%`} (${change.amount >= 0 ? "+" : "-"}${money(Math.abs(change.amount))})`;
  const hasMonthly = report.budgets.some(b => b.isMonthlyPlan);
  const summaryBudgets = report.budgets.filter(b => !hasMonthly || b.isMonthlyPlan);
  const allocated = summaryBudgets.reduce((sum,b) => sum + b.limit, 0);
  const spent = summaryBudgets.reduce((sum,b) => sum + b.spent, 0);
  const previousLabel = /^\d{4}-\d{2}$/.test(report.comparison.period) ? new Date(`${report.comparison.period}-01T12:00:00`).toLocaleDateString("en-US", {month:"long",year:"numeric"}) : report.comparison.period;
  return <div className="snapshot-dashboard">
    <h3>{report.period} Snapshot</h3>
    <div className="snapshot-grid">
      <article className="snapshot-panel"><h4>Income vs Expenses</h4>
        <div className="snapshot-totals"><div><span>Income</span><strong className="snapshot-green">{money(report.income)}</strong></div><div><span>Expenses</span><strong>{money(report.expense)}</strong></div></div>
        <div className="snapshot-meter"><span style={{width: `${Math.min(100, expensePercent ?? (report.expense > 0 ? 100 : 0))}%`}} /></div>
        <p>{expensePercent == null ? "No income recorded for this period" : `${expensePercent.toFixed(1)}% of income spent`}</p>
        <div className="snapshot-net"><span>Net savings</span><strong className={net < 0 ? "snapshot-red" : "snapshot-green"}>{money(net)}</strong></div>
      </article>
      <article className="snapshot-panel"><h4>Income Breakdown</h4>
        {<><div className="snapshot-donut" role="img" aria-label="Income by category" style={{background: gradient ? `conic-gradient(${gradient})` : "#344b3b"}}><div><strong>{money(report.income)}</strong><span>Income</span></div></div><ul className="snapshot-legend">{breakdown.map(item => <li key={item.name}><i style={{background:item.color}} /><span>{item.name}</span><b className="snapshot-badge">{item.pct.toFixed(1)}%</b></li>)}</ul>{!breakdown.length && <p>No income recorded.</p>}</>}
      </article>
      <article className="snapshot-panel"><h4>Top Expense Categories</h4>{categories.length ? categories.map(item => <div className="snapshot-category" key={item.name}><div><span>{item.name}</span><b>{money(item.amount)}</b></div><div className="snapshot-category-bar"><span style={{width:`${item.amount / maxExpense * 100}%`}} /></div></div>) : <p>No expenses recorded.</p>}</article>
      <article className="snapshot-panel"><h4>Budget Performance</h4>{report.budgets.length ? <><div className="snapshot-net"><span>Allocated limit</span><strong>{money(allocated)}</strong></div><p>{money(spent)} spent · {money(allocated - spent)} remaining</p>{report.budgets.map(b => <div className="snapshot-budget" key={b.id}><span>{b.category}</span><b className={`snapshot-badge ${b.spent > b.limit ? "snapshot-red" : b.spent >= b.limit * .8 ? "snapshot-warning" : "snapshot-green"}`}>{b.spent > b.limit ? "Over Budget" : b.spent >= b.limit * .8 ? "Warning" : "On Track"}{b.limit > 0 ? ` ? ${Math.round(b.spent / b.limit * 100)}%` : ""}</b></div>)}</> : <p>No budgets cover this period.</p>}</article>
      <article className="snapshot-panel snapshot-trend"><h4>Cash Flow Trend</h4><p>Monthly net income (income minus expenses)</p><svg viewBox="0 0 320 140" role="img" aria-label="Monthly net income trend"><line x1="20" y1="110" x2="300" y2="110" stroke="#3a5143" /><polyline points={points} fill="none" stroke="#8be0a5" strokeWidth="3" />{report.trend.map((item,index) => <g key={item.key}><circle cx={20 + index * 280 / Math.max(1,report.trend.length - 1)} cy={110 - (item.net - min) / (max - min) * 90} r="4" fill="#8be0a5"><title>{item.key}: {money(item.net)}</title></circle><text x={20 + index * 280 / Math.max(1,report.trend.length - 1)} y="132" textAnchor="middle" fill="#c3d2c8" fontSize="10">{item.label}</text></g>)}</svg><div className="snapshot-trend-values">{report.trend.map(item => <span key={item.key}>{item.label}: {money(item.net)}</span>)}</div></article>
    </div>
    <h3>Comparative Performance ({report.period} vs {previousLabel})</h3>
    <div className="snapshot-comparison">
      <article><span>Income change</span><strong className={report.comparison.income.amount < 0 ? "snapshot-red" : "snapshot-green"}>{changeLabel(report.comparison.income)}</strong></article>
      <article><span>Expense change</span><strong className={report.comparison.expense.amount > 0 ? "snapshot-red" : "snapshot-green"}>{changeLabel(report.comparison.expense)}</strong></article>
      <article><span>Savings rate change</span><strong>{report.comparison.savingsRateChange == null ? "Needs income in both periods" : `${report.comparison.savingsRateChange > 0 ? "+" : ""}${report.comparison.savingsRateChange} percentage points`}</strong><small>Net savings change: {money(report.comparison.savings.amount)}</small></article>
    </div>
  </div>;
}