import ErrorForm from "../components/ErrorForm";
import DataSection from "../components/DataSection";
import PagedList from "../components/PagedList";
import { usePagedResource } from "../lib/use-paged-resource";
import SpendingInsights from "../components/SpendingInsights";
import BudgetPerformance from "../components/BudgetPerformance";
import ReportSnapshot from "../components/ReportSnapshot";
import { api } from "../lib/api";
import { monthlyBudgetProgress } from "../lib/monthly-budget";
import { useEffect, useRef, useState } from "react";
import { isArchived } from "../lib/report-archive";
import { useApp } from "../state/AppContext";
import { reportTypes } from "../state/data";
import { buildReportRanges, createReport, reportCsvRows } from "../lib/reports";
import { download, localDate, progress, toCsv } from "../lib/format";
import {
  BudgetRow,
  Icon,
  PageTitle,
  ProgressBar,
  Segments,
  Summary,
} from "../components/UI";

export function ReportTable({ records, onView }) {
  const { date, archiveReport, notify } = useApp();
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  return (
    <div className="table-scroll">
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <table className="archive-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Type</th>
            <th>Period</th>
            <th>Generated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((report) => (
            <tr
              key={report.id}
              className={isArchived(report.archived) ? "is-archived-row" : ""}
            >
              <td className="td-name">{report.name}</td>
              <td className="td-type">
                <span className="pill pill-blue">
                  {reportTypes.find((type) => type.id === report.type)?.name}
                </span>
              </td>
              <td className="td-period">{report.period}</td>
              <td className="td-gen">{date(report.generated)}</td>
              <td className="td-actions">
                <div className="arch-actions">
                  {onView && (
                    <button
                      className="icon-btn"
                      aria-label={`View ${report.name}`}
                      onClick={() => onView(report)}
                    >
                      <Icon name="eye" />
                    </button>
                  )}
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={pending !== null}
                    aria-label={`${isArchived(report.archived) ? "Restore" : "Archive"} ${report.name}`}
                    onClick={async () => {
                      setPending(report.id);
                      setError("");
                      try {
                        await archiveReport(
                          report.id,
                          isArchived(report.archived),
                        );
                        notify(
                          isArchived(report.archived)
                            ? "Report restored"
                            : "Report archived",
                        );
                      } catch (failure) {
                        setError(failure.message);
                      } finally {
                        setPending(null);
                      }
                    }}
                  >
                    <Icon
                      name={isArchived(report.archived) ? "restore" : "archive"}
                    />
                    {pending === report.id
                      ? "Saving…"
                      : isArchived(report.archived)
                        ? "Restore"
                        : "Archive"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!records.length && (
            <tr>
              <td className="td-empty" colSpan={5}>
                No reports in this view. Generate a report to save it here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ReportPreview({ report }) {
  const { money } = useApp();
  if (report.type === "income-expense" && report.comparison)
    return <ReportSnapshot report={report} />;
  if (report.type === "income-expense") {
    const max = Math.max(
      ...report.series.map((month) => Math.max(month.income, month.expense)),
      1,
    );
    return (
      <>
        <Summary
          items={[
            {
              label: "Total Income",
              value: money(report.income),
              tone: "green",
            },
            { label: "Total Expenses", value: money(report.expense) },
            {
              label: "Net Savings",
              value: money(report.income - report.expense),
            },
          ]}
        />
        <p className="report-caption">
          {report.period} · cash flow from saved transactions
        </p>
        <div
          className="bar-chart"
          role="img"
          aria-label="Income and expenses by month"
        >
          {report.series.map((month) => (
            <div
              className={`bc-col${month.key === report.range ? " selected" : ""}`}
              key={month.key}
            >
              <div className="bc-bars">
                <div
                  className="bc-bar income"
                  title={`${month.label} income: ${money(month.income)}`}
                  style={{ height: `${(month.income / max) * 100}%` }}
                />
                <div
                  className="bc-bar expense"
                  title={`${month.label} expenses: ${money(month.expense)}`}
                  style={{ height: `${(month.expense / max) * 100}%` }}
                />
              </div>
              <span className="bc-label">{month.label}</span>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span>
            <i style={{ background: "#219653" }} />
            Income
          </span>
          <span>
            <i style={{ background: "#E1473E" }} />
            Expenses
          </span>
        </div>
      </>
    );
  }
  if (report.type === "category") {
    let angle = 0;
    const gradient = report.categories
      .map((item) => {
        const start = angle;
        angle += item.pct;
        return `${item.color} ${start}% ${angle}%`;
      })
      .join(",");
    return (
      <>
        <p className="report-caption">{report.period} · spending by category</p>
        <div className="donut-wrap">
          <div
            className="donut"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <div className="donut-center">
              <strong>{money(report.expense)}</strong>
              <span>Total</span>
            </div>
          </div>
          <ul className="donut-legend">
            {report.categories.map((item) => (
              <li key={item.name}>
                <span className="dl-left">
                  <i style={{ background: item.color }} />
                  {item.name}
                </span>
                <b>{item.pct}%</b>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }
  if (report.type === "budget") {
    const spent =
      report.budgetPerformance?.summary.total_spent ??
      report.budgets
        .filter(
          (b) =>
            !report.budgets.some((plan) => plan.isMonthlyPlan) ||
            b.isMonthlyPlan,
        )
        .reduce((sum, item) => sum + item.spent, 0);
    const limit =
      report.budgetPerformance?.summary.total_allocated ??
      report.budgets
        .filter(
          (b) =>
            !report.budgets.some((plan) => plan.isMonthlyPlan) ||
            b.isMonthlyPlan,
        )
        .reduce((sum, item) => sum + item.limit, 0);
    return (
      <>
        <Summary
          items={[
            { label: "Total Budgeted", value: money(limit) },
            { label: "Total Spent", value: money(spent) },
            { label: "Remaining", value: money(limit - spent), tone: "green" },
          ]}
        />
        <p className="report-caption">
          {report.period} · current budget snapshot
        </p>
        {report.budgets.map((budget) => (
          <BudgetRow key={budget.id} budget={budget} />
        ))}
      </>
    );
  }
  const saved = report.goals.reduce((sum, item) => sum + item.saved, 0);
  const target = report.goals.reduce((sum, item) => sum + item.target, 0);
  const percent = progress(saved, target);
  return (
    <>
      <Summary
        items={[
          { label: "Total Saved", value: money(saved), tone: "green" },
          { label: "Combined Target", value: money(target) },
          { label: "Overall Progress", value: `${percent}%` },
        ]}
      />
      <p className="report-caption">
        {report.period} · current goal progress snapshot
      </p>
      <div className="prog-row overall-goal-row">
        <div className="prow-top">
          <span>Overall Goal Progress</span>
          <span>{percent}%</span>
        </div>
        <ProgressBar value={percent} />
      </div>
      {report.goals.map((goal) => (
        <div className="prog-row" key={goal.id}>
          <div className="prow-top">
            <span>{goal.name}</span>
            <span>{progress(goal.saved, goal.target)}%</span>
          </div>
          <ProgressBar value={progress(goal.saved, goal.target)} />
        </div>
      ))}
    </>
  );
}

export default function Reports() {
  const {
    transactions: recentTransactions,
    analyticsTransactions: transactions = recentTransactions,
    budgets,
    goals,
    reports,
    addReport,
    notify,
  } = useApp();
  const [type, setType] = useState("income-expense");
  const [range, setRange] = useState(() => localDate().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const generatingRef = useRef(false);
  useEffect(() => {
    const cleanup = () =>
      document.body.classList.remove("generated-report-print");
    window.addEventListener("afterprint", cleanup);
    return () => {
      cleanup();
      window.removeEventListener("afterprint", cleanup);
    };
  }, []);
  const [view, setView] = useState("active");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPending, setHistoryPending] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const preview = useRef(null);
  const reportRanges = buildReportRanges(transactions, budgets);
  if (!reportRanges.some((item) => item.key === range))
    reportRanges.unshift({ key: range, label: snapshot?.period || range });
  const report =
    snapshot || createReport(type, range, transactions, budgets, goals);
  const records = reports.filter(
    (report) => isArchived(report.archived) === (view === "archived"),
  );
  const list = usePagedResource(
    "/report-logs",
    { archived: String(view === "archived") },
    records,
  );
  async function generate(event) {
    event.preventDefault();
    if (generatingRef.current || generationError?.uncertain) return;
    generatingRef.current = true;
    setGenerating(true);
    setGenerationError("");
    try {
      const [freshTransactions, freshBudgets, freshGoals] = await Promise.all([
        api("/reports?type=ledger"),
        api("/budgets"),
        api("/goals"),
      ]);
      const value = createReport(
        type,
        range,
        freshTransactions,
        monthlyBudgetProgress(freshBudgets, freshTransactions),
        freshGoals,
      );
      if (type === "budget" && range !== "this-year") {
        const [year, month] = range.split("-");
        const performance = await api(
          "/reports/budget-performance?year=" +
            year +
            "&month=" +
            Number(month),
        );
        value.budgetPerformance = performance;
        value.budgets = performance.budgets.map((b) => ({
          id: b.budget_id,
          category: b.category,
          limit: b.allocated_limit,
          spent: b.total_spent,
          isMonthlyPlan: b.is_monthly_plan,
        }));
      }
      await addReport({
        name: value.name + " - " + value.period,
        type,
        range,
        period: value.period,
        snapshot: value,
      });
      setSnapshot(value);
      setView("active");
      setHistoryOpen(true);
      preview.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      notify("Report generated and added to logs");
    } catch (failure) {
      setGenerationError(failure);
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }
  return (
    <>
      <PageTitle
        title="Reports"
        description="Generate insights from your data and browse past reports"
      />
      <section className="card report-card" style={{ marginBottom: 18 }}>
        <DataSection sections={["analyticsTransactions", "budgets", "goals"]}>
          <ErrorForm failure={generationError} onSubmit={generate}>
            <div className="card-head">
              <h2>Generate a Report</h2>
            </div>
            <div className="report-types">
              {reportTypes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`report-type${type === item.id ? " active" : ""}`}
                  disabled={generating}
                  aria-pressed={type === item.id}
                  onClick={() => {
                    setType(item.id);
                    setSnapshot(null);
                  }}
                >
                  <Icon name={item.icon} />
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
            <div className="report-controls">
              <div className="field">
                <label htmlFor="report-range">Period</label>
                <select
                  id="report-range"
                  disabled={generating}
                  value={range}
                  onChange={(event) => {
                    setRange(event.target.value);
                    setSnapshot(null);
                  }}
                >
                  {reportRanges.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={generating || !!generationError?.uncertain}
              >
                <Icon name="reports" />
                {generating ? "Generating..." : "Generate Report"}
              </button>
            </div>
            <div
              className="report-actions report-action-toolbar"
              role="toolbar"
              aria-label="Report export actions"
            >
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  download(
                    toCsv(reportCsvRows(report)),
                    `pennyledger-${report.type}-${report.range}.csv`,
                    "text/csv;charset=utf-8",
                  );
                  notify("CSV downloaded");
                }}
              >
                <Icon name="download" />
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  document.body.classList.add("generated-report-print");
                  try {
                    window.print();
                  } catch {
                    document.body.classList.remove("generated-report-print");
                  }
                }}
              >
                <Icon name="print" />
                Print Report
              </button>
            </div>
            {generationError && (
              <p role="alert" className="form-error">
                {generationError.message || generationError}
              </p>
            )}
            <p className="report-caption" role="status">
              {generating
                ? "Refreshing records and saving report..."
                : snapshot
                  ? "Saved report snapshot - ready to export or print"
                  : "Live preview - click Generate Report to save this snapshot"}
            </p>
            <div className="report-preview" ref={preview}>
              <h2 className="print-title">
                {report.name} — {report.period}
              </h2>
              <ReportPreview report={report} />
            </div>
          </ErrorForm>
        </DataSection>
      </section>
      <BudgetPerformance />
      <SpendingInsights reviewOnly />
      <details
        className="card report-logs report-history"
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary>
          Saved report history ({list.loading || list.error ? "?" : list.total}{" "}
          {view})
        </summary>
        <div className="card-head">
          <h2>Report Logs</h2>
          <button
            className="btn btn-outline btn-sm"
            disabled={historyPending}
            onClick={async () => {
              setHistoryPending(true);
              setHistoryError("");
              try {
                list.retry();
              } catch (failure) {
                setHistoryError(failure.message);
              } finally {
                setHistoryPending(false);
              }
            }}
          >
            {historyPending ? "Refreshing..." : "Refresh logs"}
          </button>
          <span className="muted-tag">
            {list.loading || list.error ? "?" : list.total} {view} reports
          </span>
        </div>
        <div className="filter-toolbar">
          <Segments
            label="Active or archived logs"
            value={view}
            onChange={setView}
            options={[
              { value: "active", label: "Active" },
              {
                value: "archived",
                label: "Archived",
                count: reports.filter((report) => isArchived(report.archived))
                  .length,
              },
            ]}
          />
        </div>
        {historyError && (
          <p role="alert" className="form-error">
            {historyError}
          </p>
        )}
        <PagedList list={list}>
          <ReportTable
            records={list.items}
            onView={async (record) => {
              if (generating || historyPending) return;
              setHistoryPending(true);
              setHistoryError("");
              try {
                const saved = record.snapshot
                  ? record
                  : await api("/report-logs/" + record.id);
                const value = saved.snapshot;
                if (
                  !value ||
                  !Array.isArray(value.series) ||
                  !Array.isArray(value.categories) ||
                  !Array.isArray(value.budgets) ||
                  !Array.isArray(value.goals)
                ) {
                  throw new Error(
                    "This report has no valid saved snapshot. Generate a new report for this period.",
                  );
                }
                setType(saved.type);
                setRange(saved.range);
                setSnapshot(value);
                preview.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                notify("Loaded saved report: " + saved.name);
              } catch (failure) {
                setHistoryError(failure.message);
              } finally {
                setHistoryPending(false);
              }
            }}
          />
        </PagedList>
      </details>
    </>
  );
}
