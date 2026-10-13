import { useEffect, useState } from "react";
import { useApp } from "../state/AppContext";
import { api } from "../lib/api";
import { download, localDate, toCsv } from "../lib/format";
import { budgetPerformanceCsvRows } from "../lib/budget-performance";
import { Icon } from "./UI";

function AuditTable({ transactions }) {
  const { money, date } = useApp();
  if (!transactions.length)
    return (
      <p className="bp-empty">
        No expenses recorded for this budget in the selected period.
      </p>
    );
  return (
    <div className="table-scroll">
      <table className="bp-audit">
        <caption>All contributing expenses, including archived records</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Payment method</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>{date(tx.date)}</td>
              <td>
                {tx.description || "No description"}
                {tx.archived && <span className="bp-archived">Archived</span>}
              </td>
              <td>{tx.category}</td>
              <td>{tx.payment_method || "Not recorded"}</td>
              <td>{money(tx.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BudgetPerformance() {
  const { money, transactions, budgets } = useApp();
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setReport(null);
    const [year, number] = month.split("-");
    api(`/reports/budget-performance?year=${year}&month=${Number(number)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((failure) => {
        if (active) setError(failure.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [month, refresh, transactions, budgets]);
  useEffect(() => {
    const cleanup = () =>
      document.body.classList.remove("budget-performance-print");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);
  const period = report
    ? new Date(`${report.period}-01T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : month;
  return (
    <section
      className="card budget-performance"
      aria-labelledby="bp-title"
      aria-busy={loading}
    >
      <div className="bp-heading">
        <div>
          <span className="bp-eyebrow">Monthly spending review</span>
          <h2 id="bp-title">Budget Performance &amp; Limit Tracking</h2>
          <p>See where your money went and which limits need attention.</p>
        </div>
        <div className="bp-controls">
          <label htmlFor="bp-month">Report month</label>
          <input
            id="bp-month"
            type="month"
            min="1900-01"
            max="9998-12"
            value={month}
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.target.value))
                setMonth(event.target.value);
            }}
          />
          <button
            className="btn btn-outline btn-sm"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh
          </button>
        </div>
      </div>
      {loading && <p role="status">Loading budget performance…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {report && (
        <>
          <h3 className="bp-period">{period}</h3>
          <div className="bp-summary">
            <article>
              <span>Total budget allocated</span>
              <strong>{money(report.summary.total_allocated)}</strong>
              <small>
                {report.summary.uses_monthly_plan
                  ? "Overall monthly plan; category limits shown separately"
                  : "Combined category limits"}
              </small>
            </article>
            <article>
              <span>Total spent</span>
              <strong>{money(report.summary.total_spent)}</strong>
              <small>
                {report.summary.remaining_balance < 0
                  ? `Over allocated limit by ${money(-report.summary.remaining_balance)}`
                  : `${money(report.summary.remaining_balance)} remaining`}
              </small>
            </article>
            <article>
              <span>Categories on track</span>
              <strong className="bp-green">
                {report.summary.on_track_count}
              </strong>
              <small>{report.summary.warning_count} near the limit</small>
            </article>
            <article>
              <span>Categories over budget</span>
              <strong className="bp-red">
                {report.summary.over_budget_count}
              </strong>
              <small>
                {report.summary.category_count} category budgets evaluated
              </small>
            </article>
          </div>
          <p className="bp-note">
            Warning starts at 80% used. Total spent includes all expenses in
            this month, including archived records.{" "}
            {money(report.summary.unbudgeted_spent)} falls outside an active
            budget. Each budget uses expenses within its dates; limits are not
            prorated.
          </p>
          {!report.budgets.length && (
            <p className="bp-empty">
              No budgets cover this month. Add a budget to track your limits;
              recorded expenses still appear in the summary.
            </p>
          )}
          <div className="bp-list">
            {report.budgets.map((b) => {
              const tone =
                b.status_flag === "Exceeded"
                  ? "red"
                  : b.status_flag === "Warning"
                    ? "warning"
                    : "green";
              return (
                <article className="bp-budget" key={b.budget_id}>
                  <div className="bp-budget-heading">
                    <div>
                      <h3>{b.category}</h3>
                      <small>
                        {b.is_monthly_plan
                          ? "Overall plan · all expense categories"
                          : "Category budget"}{" "}
                        · {b.start_date} – {b.end_date}
                      </small>
                    </div>
                    <span className={`bp-tag bp-${tone}`}>
                      {b.status_flag === "Exceeded"
                        ? "Over Budget"
                        : b.status_flag}
                    </span>
                  </div>
                  <div
                    className="bp-progress"
                    role="progressbar"
                    aria-label={`${b.category} budget usage`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(
                      100,
                      Math.max(0, b.percent_used ?? 0),
                    )}
                    aria-valuetext={`${b.percent_used ?? 0}% used, ${money(b.total_spent)} of ${money(b.allocated_limit)}`}
                  >
                    <span
                      className={`bp-fill bp-fill-${tone}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, b.percent_used ?? 0))}%`,
                      }}
                    />
                  </div>
                  <div className="bp-usage">
                    <strong>
                      {b.percent_used == null
                        ? "No allocated limit"
                        : `${b.percent_used}% Used`}{" "}
                      ({money(b.total_spent)} / {money(b.allocated_limit)})
                    </strong>
                    <span className={`bp-${tone}`}>
                      {b.remaining_balance < 0
                        ? `Over Budget by ${money(b.over_budget_by)}`
                        : `${money(b.remaining_balance)} remaining`}
                    </span>
                  </div>
                  <details className="bp-details">
                    <summary>
                      Inspect transactions ({b.transactions.length})
                    </summary>
                    <AuditTable transactions={b.transactions} />
                  </details>
                  <div className="bp-print-audit">
                    <AuditTable transactions={b.transactions} />
                  </div>
                </article>
              );
            })}
          </div>
          <div className="bp-actions">
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                download(
                  toCsv(budgetPerformanceCsvRows(report)),
                  `pennyledger-budget-performance-${report.period}.csv`,
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Icon name="download" />
              Export budget CSV
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                document.body.classList.add("budget-performance-print");
                try {
                  window.print();
                } catch {
                  document.body.classList.remove("budget-performance-print");
                }
              }}
            >
              <Icon name="print" />
              Print budget report
            </button>
          </div>
        </>
      )}
    </section>
  );
}
