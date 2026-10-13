import { TransactionModal, IncomeModal } from "../components/Forms";
import { localDate } from "../lib/format";
import { usePagedResource } from "../lib/use-paged-resource";
import PagedList from "../components/PagedList";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { Icon, Modal, PageTitle, Segments } from "../components/UI";

// List transactions with signed amount colors and edit, delete, and archive actions.
export function TransactionTable({ records, restoreOnly = false }) {
  const { money, date, archiveTransaction, deleteTransaction, notify } =
    useApp();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <div className="table-scroll">
        <table className="tx-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Payment Method</th>
              <th>Date</th>
              <th className="th-amount">Amount</th>
              <th className="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((tx) => (
              <tr key={tx.id}>
                <td className="td-desc">{tx.description}</td>
                <td className="td-category">
                  <span
                    className={`pill ${tx.category === "Income" || tx.category === "Groceries" ? "pill-green" : tx.category === "Dining Out" ? "pill-red" : "pill-blue"}`}
                  >
                    {tx.category}
                  </span>
                </td>
                <td className="td-payment">
                  {tx.paymentMethod || "Not recorded"}
                </td>
                <td className="td-date">{date(tx.date)}</td>
                <td className={`td-amount${tx.amount > 0 ? " amt-pos" : tx.amount < 0 ? " amt-neg" : ""}`}>
                  {money(tx.amount, true)}
                </td>
                <td className="td-actions">
                  <button
                    className="btn btn-outline btn-sm"
                    aria-label={`Edit ${tx.description}`}
                    onClick={() => setEditing(tx)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    aria-label={`Delete ${tx.description}`}
                    onClick={() => {
                      setDeleting(tx);
                      setError("");
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="btn-archive"
                    aria-label={`${tx.archived || restoreOnly ? "Restore" : "Archive"} ${tx.description}`}
                    onClick={async () => {
                      try {
                        // PHP saves the archive state before React changes it.
                        await archiveTransaction(tx.id, tx.archived);
                        notify(
                          tx.archived
                            ? "Transaction restored"
                            : "Transaction archived",
                        );
                      } catch (failure) {
                        notify(failure.message);
                      }
                    }}
                  >
                    <Icon name={tx.archived ? "restore" : "archive"} />
                    <span>
                      {tx.archived || restoreOnly ? "Restore" : "Archive"}
                    </span>
                  </button>
                </td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td className="td-empty" colSpan={6}>
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <TransactionModal
          transaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Delete Transaction"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            Delete {deleting.description} ({money(deleting.amount, true)})? This
            permanently removes the record and recalculates actual income,
            expenses, budget spending, and report totals.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await deleteTransaction(deleting.id);
                  notify("Transaction deleted");
                  setDeleting(null);
                } catch (failure) {
                  setError(failure.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Deleting..." : "Confirm deletion"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// Display searchable, filtered transaction history and transaction-entry actions.
export default function Transactions() {
  const {
    transactions,
    analyticsTransactions = transactions,
    income: expectedIncome,
    money,
  } = useApp();
  const [adding, setAdding] = useState(false);
  const [editingIncome, setEditingIncome] = useState(false);
  const monthlyActual = analyticsTransactions
    .filter(
      (tx) => tx.amount > 0 && tx.date.startsWith(localDate().slice(0, 7)),
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState("active");
  useEffect(() => {
    setSearch(params.get("q") || "");
  }, [params]);
  const categories = [
    ...new Set(analyticsTransactions.map((tx) => tx.category)),
  ].sort();
  const months = [
    ...new Set(analyticsTransactions.map((tx) => tx.date.slice(0, 7))),
  ]
    .sort()
    .reverse();
  const inView = transactions.filter(
    (tx) => tx.archived === (view === "archived"),
  );
  const records = inView.filter(
    (tx) =>
      (!category || tx.category === category) &&
      (!month || tx.date.startsWith(month)) &&
      (type === "all" || (type === "income" ? tx.amount > 0 : tx.amount < 0)) &&
      `${tx.description} ${tx.category}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const filters = {
    archived: String(view === "archived"),
    q: search.trim(),
    category,
    ...(type !== "all" ? { type } : {}),
    ...(month
      ? {
          start_date: month + "-01",
          end_date:
            month +
            "-" +
            new Date(
              Number(month.slice(0, 4)),
              Number(month.slice(5, 7)),
              0,
            ).getDate(),
        }
      : {}),
  };
  const list = usePagedResource("/transactions", filters, records);
  return (
    <>
      <PageTitle
        title="Transaction history"
        description="All your income and expenses in one place"
      />
      <div className="transaction-summary-toolbar">
        <div>
          <strong>Recorded income this month: {money(monthlyActual)}</strong>
          <p>Expected monthly income: {money(expectedIncome || 0)}</p>
        </div>
        <div className="quick-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setEditingIncome(true)}
          >
            Edit expected income
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAdding(true)}
          >
            Add Transaction
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-box">
          <Icon name="search" />
          <input
            aria-label="Search by name or category"
            placeholder="Search by name or category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="filter-select"
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <select
          className="filter-select"
          aria-label="Filter by month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          <option value="">All Months</option>
          {months.map((month) => (
            <option value={month} key={month}>
              {new Date(`${month}-01T12:00:00`).toLocaleString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </option>
          ))}
        </select>
        <button
          className="filter-reset"
          onClick={() => {
            setSearch("");
            setCategory("");
            setMonth("");
            setType("all");
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="filter-toolbar">
        <Segments
          label="Filter by type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All" },
            { value: "income", label: "Income" },
            { value: "expense", label: "Expenses" },
          ]}
        />
        <Segments
          label="Active or archived"
          value={view}
          onChange={setView}
          options={[
            { value: "active", label: "Active" },
            {
              value: "archived",
              label: "Archived",
            },
          ]}
        />
        <span className="muted-tag">
          Showing {list.loading || list.error ? "?" : list.items.length} of{" "}
          {list.loading || list.error ? "?" : list.total}{" "}
          {view === "archived" ? "archived " : ""}transactions
        </span>
      </div>
      <div className="card">
        <PagedList list={list}>
          <TransactionTable records={list.items} />
        </PagedList>
      </div>
      {adding && <TransactionModal onClose={() => setAdding(false)} />}
      {editingIncome && <IncomeModal onClose={() => setEditingIncome(false)} />}
    </>
  );
}
