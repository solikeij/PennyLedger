import { useState } from "react";
import { useApp } from "../state/AppContext";
import {
  Icon,
  PageTitle,
  ProgressBar,
  Summary,
  Modal,
  FormActions,
} from "../components/UI";
import { BudgetModal } from "../components/Forms";
import { progress } from "../lib/format";
import { budgetStatus } from "../lib/budget-status";
import { ledgerTotals } from "../lib/ledger-totals";
import SpendingInsights from "../components/SpendingInsights";

export default function Budget() {
  const {
    budgets: allBudgets,
    transactions,
    analyticsTransactions = transactions,
    money,
    date,
    deleteBudget,
    notify,
  } = useApp();
  const [modal, setModal] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { budgeted: limit, spent } = ledgerTotals(
    analyticsTransactions,
    allBudgets,
  );
  return (
    <>
      <PageTitle
        title="Budget"
        description="Set spending limits and stay on track"
      >
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setModal(true)}
        >
          <Icon name="plus" />
          Add Budget Process
        </button>
      </PageTitle>
      <div className="budget-overview-summary">
        <Summary
          items={[
            { label: "Total Budgeted", value: money(limit) },
            { label: "Total Spent", value: money(spent) },
            {
              label: "Remaining",
              value: money(limit - spent),
              tone: limit < spent ? "red" : "green",
            },
          ]}
        />
      </div>
      <SpendingInsights
        onUseBudget={(value) => {
          setSuggestion(value);
          setModal(true);
        }}
      />
      <h2 className="budget-savings-title">Budget Progress</h2>
      <div className="budget-grid">
        {!allBudgets.length && (
          <p className="report-caption">
            No budgets yet. Add a spending limit to get started.
          </p>
        )}
        {allBudgets.map((budget) => {
          const status = budgetStatus(budget);
          const over = budget.spent > budget.limit;
          const full = budget.spent === budget.limit;
          return (
            <div className="budget-card" key={budget.id}>
              <div className="bc-top">
                <h3>{budget.category}</h3>
                <span
                  className={`pill ${over ? "pill-red" : full ? "pill-gray" : "pill-green"}`}
                >
                  {status.label}
                </span>
              </div>
              <ProgressBar
                value={progress(budget.spent, budget.limit)}
                fill={
                  over
                    ? "red"
                    : full
                      ? "navy"
                      : budget.category === "Groceries"
                        ? "green"
                        : "blue"
                }
              />
              <div className="bc-foot">
                <span className={over ? "budget-overage" : undefined}>
                  {money(budget.spent)} spent
                </span>
                <span>of {money(budget.limit)} limit</span>
              </div>
              <div className="budget-card-actions">
                <button
                  className="btn btn-outline btn-sm"
                  aria-label={`Edit ${budget.category} budget`}
                  onClick={() => setEditing(budget)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  aria-label={`Delete ${budget.category} budget`}
                  onClick={() => {
                    setDeleting(budget);
                    setError("");
                  }}
                >
                  Delete
                </button>
              </div>
              <p className="report-caption">
                {date(budget.startDate)} – {date(budget.endDate)}
              </p>
              {over && (
                <div className="budget-overage-details">
                  <p className="budget-overage">
                    You have exceeded your budget by {money(status.exceeded)}.
                  </p>
                  <p className="budget-overage">
                    Remaining budget: {money(status.remaining)}
                  </p>
                  <p>{status.percent.toFixed(1)}% used</p>
                  <p className="report-caption">
                    Review your expenses or adjust your budget. You can continue
                    recording expenses.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {modal && (
        <BudgetModal
          initialMonth={suggestion?.month}
          initialLimit={suggestion?.limit}
          onClose={() => {
            setModal(false);
            setSuggestion(null);
          }}
        />
      )}
      {editing && (
        <BudgetModal budget={editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <Modal
          title="Delete Budget"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                await deleteBudget(deleting.id);
                notify("Budget deleted");
                setDeleting(null);
              } catch (failure) {
                setError(failure.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy} className="admin-fieldset">
              <p>
                Delete the {deleting.category} budget with a limit of{" "}
                {money(deleting.limit)}?
              </p>
              <p className="report-caption">
                Your expense transactions will be kept.
              </p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <FormActions
                onClose={() => setDeleting(null)}
                label={busy ? "Deleting…" : "Delete Budget"}
              />
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
