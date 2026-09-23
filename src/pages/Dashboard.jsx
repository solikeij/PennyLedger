import { useAuth } from "../state/AuthContext";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { BudgetRow, Icon, ProgressBar } from "../components/UI";
import {
  BudgetModal,
  IncomeModal,
  TransactionModal,
} from "../components/Forms";
import { progress } from "../lib/format";

export default function Dashboard() {
  const { transactions, budgets, goals, income, profile, money, date } =
    useApp();
  const [modal, setModal] = useState(null);
  const { account } = useAuth();
  const demo = account.id === "alex-demo";
  const added = transactions.filter((tx) => tx.added);
  const balance =
    (demo ? 18420.5 : 0) + added.reduce((sum, tx) => sum + tx.amount, 0);
  const expenses =
    (demo ? 3840.25 : 0) +
    added.reduce((sum, tx) => sum + (tx.amount < 0 ? -tx.amount : 0), 0);
  const remaining = budgets.reduce(
    (sum, budget) => sum + budget.limit - budget.spent,
    0,
  );
  const spending = budgets
    .map((budget) => ({ name: budget.category, amount: budget.spent }))
    .filter((item) => item.amount > 0);
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
    ["Total Balance", money(balance), "+4.2%", "up"],
    ["Monthly Income", money(income), "+2.1%", "up"],
    ["Monthly Expenses", money(expenses), "-1.4%", "down"],
    [
      "Remaining Budget",
      money(remaining),
      remaining >= 0 ? "On track" : "Over budget",
      remaining >= 0 ? "flat" : "down",
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
            <Icon name="budget" />
            Estimate Monthly Income
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setModal("budget")}
          >
            <Icon name="budget" />
            Add Budget
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
      <div className="stat-grid">
        {stats.map(([label, value, delta, tone], index) => (
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
            <p className="stat-value">{value}</p>
          </div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="dash-col">
          <section className="card">
            <div className="card-head">
              <h2>Budget Progress</h2>
              <span className="muted-tag">This Month</span>
            </div>
            {budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} />
            ))}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent Transactions</h2>
              <Link to="/transactions" className="link">
                View All
              </Link>
            </div>
            <div className="tx-list">
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
                          {tx.category} · {date(tx.date)}
                        </p>
                      </div>
                    </div>
                    <span className={`tx-amt${tx.amount > 0 ? " pos" : ""}`}>
                      {money(tx.amount, true)}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <div className="dash-col">
          <section className="card">
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
          </section>
          <section className="card">
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
              </div>
            ))}
          </section>
        </div>
      </div>
      {modal === "transaction" && (
        <TransactionModal onClose={() => setModal(null)} />
      )}
      {modal === "budget" && <BudgetModal onClose={() => setModal(null)} />}
      {modal === "income" && <IncomeModal onClose={() => setModal(null)} />}
    </>
  );
}
