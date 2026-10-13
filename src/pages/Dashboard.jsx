import ErrorForm from "../components/ErrorForm";
import DataSection from "../components/DataSection";
import { api } from "../lib/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import {
  BudgetRow,
  Field,
  FormActions,
  Icon,
  Modal,
  PasswordField,
  ProgressBar,
} from "../components/UI";
import {
  BudgetModal,
  GoalContributionModal,
  TransactionModal,
  IncomeModal,
} from "../components/Forms";
import { progress, localDate } from "../lib/format";
import { ledgerTotals } from "../lib/ledger-totals";
import SpendingInsights from "../components/SpendingInsights";

// Add, edit, or delete a named wallet and its expense type.
function WalletModal({ wallet, onClose }) {
  const { createWallet, updateWallet, deleteWallet, notify } = useApp();
  const [expenseTypes, setExpenseTypes] = useState([
    ...new Set(["Other", ...(wallet?.expenseType ? [wallet.expenseType] : [])]),
  ]);
  const [lookupError, setLookupError] = useState("");
  useEffect(() => {
    let alive = true;
    api("/lookups/categories")
      .then((rows) => {
        if (alive)
          setExpenseTypes([
            ...new Set([
              "Other",
              ...rows
                .filter((row) => row.type === "expense")
                .map((row) => row.name),
              ...(wallet?.expenseType ? [wallet.expenseType] : []),
            ]),
          ]);
      })
      .catch(() => {
        if (alive)
          setLookupError(
            "Saved categories could not load. You can choose Other and edit this wallet later.",
          );
      });
    return () => {
      alive = false;
    };
  }, [wallet?.expenseType]);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        deleting ? "Delete wallet?" : wallet ? "Edit wallet" : "Add wallet"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ErrorForm
        failure={error}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            if (deleting) {
              await deleteWallet(wallet.id, form.get("password"));
            } else {
              const values = {
                name: form.get("name").trim(),
                expense_type: form.get("expense_type"),
              };
              if (!values.name) {
                setError("Enter a wallet name.");
                return;
              }
              if (wallet) await updateWallet(wallet.id, values);
              else await createWallet(values);
            }
            notify(
              deleting
                ? "Wallet deleted"
                : wallet
                  ? "Wallet updated"
                  : "Wallet added",
            );
            onClose();
          } catch (failure) {
            setError(failure);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="admin-fieldset wallet-fieldset">
          {deleting ? (
            <>
              <p className="report-caption">
                Delete {wallet.name}? Existing transactions will be kept.
              </p>
              <PasswordField
                label="Confirm your password"
                name="password"
                autoComplete="current-password"
                required
              />
            </>
          ) : (
            <>
              <Field
                label="Wallet name"
                name="name"
                readOnly={wallet?.isDefault}
                defaultValue={wallet?.name || ""}
                placeholder="e.g. GCash, Bank card, Cash"
                maxLength={50}
                required
              />
              <div className="field">
                <label htmlFor="wallet-expense-type">Expense type</label>
                <select
                  id="wallet-expense-type"
                  name="expense_type"
                  defaultValue={wallet?.expenseType || "Other"}
                  required
                >
                  {expenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {lookupError && (
                  <p role="status" className="report-caption">
                    {lookupError}
                  </p>
                )}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          {wallet && !wallet.isDefault && !deleting && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                setDeleting(true);
                setError("");
              }}
            >
              Delete wallet
            </button>
          )}
          <FormActions
            onClose={onClose}
            label={
              busy
                ? "Please wait…"
                : deleting
                  ? "Confirm deletion"
                  : wallet
                    ? "Save changes"
                    : "Add wallet"
            }
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}

// Display account totals, wallets, recent transactions, budgets, and savings goals.
export default function Dashboard() {
  const {
    transactions,
    analyticsTransactions = transactions,
    budgets: allBudgets,
    wallets,
    goals,
    profile,
    income: expectedIncome,
    money,
    date,
  } = useApp();
  const [modal, setModal] = useState(null);
  const [walletModal, setWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [editingBudget, setEditingBudget] = useState(null);
  const [contributingGoal, setContributingGoal] = useState(null);
  // Every saved transaction contributes to the totals; the old demo-only
  // calculation ignored records loaded from MySQL.
  const {
    income,
    expenses,
    budgeted,
    remaining,
    monthlyBudgets: budgets,
  } = ledgerTotals(analyticsTransactions, allBudgets);
  const overBudget = budgets.some((budget) => budget.spent > budget.limit);
  const categorySpending = new Map();
  for (const tx of analyticsTransactions.filter(
    (tx) => tx.amount < 0 && tx.date.startsWith(localDate().slice(0, 7)),
  )) {
    categorySpending.set(
      tx.category,
      (categorySpending.get(tx.category) || 0) - tx.amount,
    );
  }
  const spending = [...categorySpending].map(([name, amount]) => ({
    name,
    amount,
  }));
  const total = spending.reduce((sum, item) => sum + item.amount, 0);
  const colors = [
    "var(--success)",
    "var(--danger)",
    "#1F63AC",
    "#7EB8EA",
    "var(--blue)",
    "#C3CDC7",
  ];
  let angle = 0;
  const gradient = spending
    .map((item, index) => {
      const start = angle;
      angle += total ? (item.amount / total) * 100 : 0;
      return `${colors[index % colors.length]} ${start}% ${angle}%`;
    })
    .join(",");
  const stats = [
    [
      "Monthly Income",
      money(income),
      "",
      "flat",
      `Recorded this month; expected monthly income: ${money(expectedIncome || 0)}`,
    ],
    [
      "Monthly Expenses",
      money(expenses),
      "",
      "flat",
      "Expense transactions recorded this month",
    ],
    [
      "Total Budgeted",
      money(budgeted),
      "",
      "flat",
      "Spending limit for this month",
    ],
    [
      "Remaining Budget",
      money(remaining),
      overBudget || remaining < 0 ? "Over budget" : "On track",
      overBudget || remaining < 0 ? "down" : "flat",
      "This month’s budget limit minus recorded spending",
    ],
  ];
  return (
    <>
      <div className="greeting page-heading">
        <div>
          <h1>Good afternoon, {profile.name.split(" ")[0]}</h1>
          <p>Here's what's happening with your money</p>
        </div>
        <div className="quick-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setModal("income")}
          >
            Edit expected income
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setWalletModal(true)}
          >
            <Icon name="wallet" />
            Add Wallet
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setModal("budget")}
          >
            <Icon name="budget" />
            Add Budget Process
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setModal("transaction")}
          >
            <Icon name="plus" />
            Add Transaction
          </button>
        </div>
      </div>
      <div className="stat-grid dashboard-stat-grid">
        {stats.map(([label, value, delta, tone, description], index) => (
          <div
            className="stat-card"
            key={label}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="stat-top">
              <div
                className="stat-dot"
                style={{ background: "var(--blue-50)" }}
              >
                <i style={{ background: "var(--blue)" }} />
              </div>
              <span className={`stat-delta ${tone}`}>{delta}</span>
            </div>
            <p className="stat-label">{label}</p>
            <DataSection
              sections={
                label.includes("Budget")
                  ? ["budgets", "analyticsTransactions"]
                  : ["analyticsTransactions"]
              }
            >
              <p className="stat-value">{value}</p>
            </DataSection>
            <p className="report-caption">{description}</p>
          </div>
        ))}
      </div>
      <section className="card wallet-section">
        <DataSection sections={["wallets"]}>
          <div className="card-head">
            <h2>Wallets</h2>
          </div>
          <div className="wallet-grid">
            {wallets.map((wallet) => (
              <article className="wallet-card" key={wallet.id}>
                <button
                  className="btn btn-outline btn-sm wallet-edit"
                  aria-label={`Edit ${wallet.name}`}
                  onClick={() => setEditingWallet(wallet)}
                >
                  Edit
                </button>
                <h3>{wallet.name}</h3>
                <span className="report-caption">
                  Expense type: {wallet.expenseType || "Other"}
                </span>
              </article>
            ))}
          </div>
          {!wallets.length && (
            <div className="empty-state">
              <p>No wallets yet. Add a wallet to organize your transactions.</p>
              <button
                className="btn btn-primary"
                onClick={() => setWalletModal(true)}
              >
                Add Wallet
              </button>
            </div>
          )}
        </DataSection>
      </section>
      <div className="dash-grid">
        <SpendingInsights compact />
        <div className="dash-col">
          <section className="card">
            <DataSection sections={["budgets", "analyticsTransactions"]}>
              <div className="card-head">
                <h2>Budget Progress</h2>
                <span className="muted-tag">This Month</span>
              </div>
              {budgets.map((budget) => (
                <div key={budget.id}>
                  <BudgetRow budget={budget} />
                  <button
                    className="btn btn-outline btn-sm"
                    aria-label={`Edit ${budget.category} budget progress`}
                    onClick={() => setEditingBudget(budget)}
                  >
                    Edit Budget Process
                  </button>
                </div>
              ))}
            </DataSection>
          </section>
          <section className="card">
            <DataSection sections={["transactions"]}>
              <div className="card-head">
                <h2>Recent Transactions</h2>
                <Link to="/transactions" className="link">
                  View All
                </Link>
              </div>
              <div className="tx-list">
                {!transactions.some((tx) => !tx.archived) && (
                  <p className="report-caption">
                    No transactions yet. Add income or an expense to get
                    started.
                  </p>
                )}
                {transactions
                  .filter((tx) => !tx.archived)
                  .slice(0, 5)
                  .map((tx) => (
                    <div className="tx-row" key={tx.id}>
                      <div className="tx-left">
                        <span
                          className="tx-dot"
                          style={{
                            background:
                              tx.amount > 0 ? "var(--success)" : "var(--blue)",
                          }}
                        />
                        <div>
                          <p className="tx-name">{tx.description}</p>
                          <p className="tx-meta">
                            {tx.category} ·{" "}
                            {tx.paymentMethod || "Payment method not recorded"}{" "}
                            · {date(tx.date)}
                          </p>
                        </div>
                      </div>
                      <span className={`tx-amt${tx.amount > 0 ? " pos" : tx.amount < 0 ? " neg" : ""}`}>
                        {money(tx.amount, true)}
                      </span>
                    </div>
                  ))}
              </div>
            </DataSection>
          </section>
        </div>
        <div className="dash-col">
          <section className="card">
            <DataSection sections={["analyticsTransactions"]}>
              <div className="card-head">
                <h2>Spending Categories</h2>
              </div>
              <div className="donut-wrap">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(${gradient || "var(--line) 0% 100%"})`,
                  }}
                >
                  <div className="donut-center">
                    <strong>{money(total)}</strong>
                    <span>Total</span>
                  </div>
                </div>
                <ul className="donut-legend">
                  {spending.map((item, index) => (
                    <li key={item.name}>
                      <span className="dl-left">
                        <i
                          style={{ background: colors[index % colors.length] }}
                        />
                        {item.name}
                      </span>
                      <b>{Math.round((item.amount / total) * 100)}%</b>
                    </li>
                  ))}
                </ul>
              </div>
            </DataSection>
          </section>
          <section className="card">
            <DataSection sections={["goals"]}>
              <div className="card-head">
                <h2>Financial Goals</h2>
                <Link to="/goals" className="link">
                  + Add Goal
                </Link>
              </div>
              {goals.slice(0, 3).map((goal) => (
                <div className="goal-row" key={goal.id}>
                  <div className="grow-top">
                    <span>{goal.name}</span>
                    <b>{progress(goal.saved, goal.target)}%</b>
                  </div>
                  <ProgressBar value={progress(goal.saved, goal.target)} />
                  <p className="grow-sub">
                    {money(goal.saved)} of {money(goal.target)}
                  </p>
                  <button
                    className="btn btn-outline btn-sm"
                    aria-label={`Add money to ${goal.name}`}
                    onClick={() => setContributingGoal(goal)}
                  >
                    Add Money
                  </button>
                </div>
              ))}
            </DataSection>
          </section>
        </div>
      </div>
      {modal === "income" && <IncomeModal onClose={() => setModal(null)} />}
      {modal === "transaction" && (
        <TransactionModal onClose={() => setModal(null)} />
      )}
      {modal === "budget" && <BudgetModal onClose={() => setModal(null)} />}
      {editingBudget && (
        <BudgetModal
          budget={editingBudget}
          onClose={() => setEditingBudget(null)}
        />
      )}
      {contributingGoal && (
        <GoalContributionModal
          goal={contributingGoal}
          onClose={() => setContributingGoal(null)}
        />
      )}
      {walletModal && <WalletModal onClose={() => setWalletModal(false)} />}
      {editingWallet && (
        <WalletModal
          wallet={editingWallet}
          onClose={() => setEditingWallet(null)}
        />
      )}
    </>
  );
}
