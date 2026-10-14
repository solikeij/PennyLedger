import ErrorForm, { FieldError } from "./ErrorForm";
import CategoryField from "./CategoryField";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { api } from "../lib/api";
import { localDate, monthlyIncome } from "../lib/format";
import { projectedMonthlyBudget } from "../lib/monthly-budget";
import { walletLabel } from "../lib/wallet-label";
import { Field, FormActions, Modal } from "./UI";

// Add or edit a transaction with validation and a monthly-budget reminder.
export function TransactionModal({ transaction, onClose }) {
  const { createTransaction, updateTransaction, notify, currency, budgets = [], money } = useApp();
  const [draftAmount, setDraftAmount] = useState(transaction ? Math.abs(transaction.amount) : "");
  const [draftDate, setDraftDate] = useState(transaction?.date || localDate());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [types, setTypes] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(
    transaction?.paymentMethodId || "",
  );
  const [type, setType] = useState(
    transaction ? (transaction.amount > 0 ? "income" : "expense") : "expense",
  );
  const [draftCategories, setDraftCategories] = useState({
    expense: transaction?.amount < 0 ? transaction.category : "",
    income: transaction?.amount > 0 ? transaction.category : "",
  });
  const selectedMethodId = paymentMethod || methods[0]?.id || "";
  const selectedMethod = methods.find((item) => item.id === Number(selectedMethodId));
  const requiredCategory = type === "expense" && selectedMethod?.expenseType !== "Other"
    ? selectedMethod?.expenseType || ""
    : "";
  const category = draftCategories[type];
  const categoryConflict = requiredCategory && category !== requiredCategory;
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [loadingChoices, setLoadingChoices] = useState(true);
  const budgetWarning = projectedMonthlyBudget(budgets, {
    amount: draftAmount, date: draftDate, type, transaction,
  });
  useEffect(() => {
    // Use database IDs in the request; the old static category names could
    // not satisfy the PHP controller's category_id foreign key.
    Promise.all([
      api("/lookups/categories"),
      api("/lookups/payment-methods"),
      api("/lookups/transaction-types"),
    ])
      .then(([cats, payments, transactionTypes]) => {
        setCategories(cats);
        setMethods(payments);
        setTypes(transactionTypes);
        // Default new expenses to the first wallet's category; preserve existing records.
        if (!transaction && payments[0]?.expenseType && payments[0].expenseType !== "Other") {
          setDraftCategories((previous) => ({ ...previous, expense: payments[0].expenseType }));
        }
      })
      .catch((failure) => setError(failure))
      .finally(() => setLoadingChoices(false));
  }, []);

  // Validate the form and persist its record before closing the dialog.
  async function submit(event) {
    event.preventDefault();
    if (saving.current || error?.uncertain) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const category = form.get("category").trim();
    if (categoryConflict)
      return setError(`This wallet only accepts ${requiredCategory} expenses. Use that category or choose another wallet.`);
    if (!category) return setError("Enter a category name.");
    if (/\p{N}/u.test(category))
      return setError("Category cannot contain numbers.");
    if (
      category.length > 100 ||
      !/^[\p{L}\p{M} &'\-]+$/u.test(category) ||
      !/\p{L}/u.test(category)
    ) {
      return setError(
        "Category must contain letters; only spaces, apostrophes, hyphens, and & are allowed.",
      );
    }
    const selectedType = types.find((item) => item.code === type);
    const amount = Number(form.get("amount"));
    if (!category || !selectedType || !Number.isFinite(amount) || amount <= 0)
      return setError(
        "Enter a category, transaction type, and positive amount.",
      );
    const methodId = Number(form.get("payment_method"));
    if (!methods.some((item) => item.id === methodId))
      return setError("Choose an active payment method.");
    if (!form.get("description").trim())
      return setError("Enter a transaction description.");
    if (amount > 99999999.99)
      return setError("Amount must not exceed 99,999,999.99.");
    try {
      // Wait for the saved server row. Failed requests stay visible in the form.
      saving.current = true;
      setBusy(true);
      const values = {
        category_name: category,
        transaction_type_id: selectedType.id,
        payment_method_id: Number(form.get("payment_method")),
        amount,
        description: form.get("description").trim(),
        transaction_date: form.get("date"),
      };
      if (transaction) await updateTransaction(transaction.id, values);
      else await createTransaction(values);
      notify(transaction ? "Transaction saved" : "Transaction added");
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      title={transaction ? "Edit Transaction" : "Add Transaction"}
      onClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <ErrorForm failure={error} onSubmit={submit}>
        <fieldset disabled={busy || loadingChoices} className="transaction-fieldset">
          <Field
            label="Description"
            name="description"
            defaultValue={transaction?.description || ""}
            placeholder="e.g. Coffee Shop"
            required
            maxLength={150}
          />
          <div className="field">
            <label htmlFor="tx-type">Transaction type</label>
            <FieldError name="transaction_type_id" />
            <div className="aligned-select">
              <select
                id="tx-type"
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setType(nextType);
                  if (nextType === "expense" && selectedMethod?.expenseType && selectedMethod.expenseType !== "Other") {
                    setDraftCategories((previous) => ({ ...previous, expense: selectedMethod.expenseType }));
                  }
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
          {requiredCategory ? (
            <>
              <Field label="Category" name="category" value={category} readOnly />
              <p className="report-caption" role="status">
                {walletLabel(selectedMethod, methods).label} only accepts {requiredCategory} expenses.
                Choose a wallet with expense type Other to use any expense category.
              </p>
              {categoryConflict && (
                <div className="data-notice" role="alert">
                  <p>This transaction is currently categorized as {category}. Choose another wallet to keep it, or change the category below.</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setDraftCategories((previous) => ({ ...previous, expense: requiredCategory }))}
                  >
                    Use {requiredCategory} category
                  </button>
                </div>
              )}
            </>
          ) : (
            <CategoryField
              key={type}
              value={category}
              onChange={(value) => setDraftCategories((previous) => ({ ...previous, [type]: value }))}
              categories={categories.filter((item) => item.type === type)}
            />
          )}
          <div className="field">
            <label htmlFor="tx-payment">Payment method</label>
            <FieldError name="payment_method" />
            <div className="aligned-select">
              <select
                name="payment_method"
                id="tx-payment"
                value={selectedMethodId}
                onChange={(event) => {
                  const method = methods.find((item) => item.id === Number(event.target.value));
                  setPaymentMethod(event.target.value);
                  if (type === "expense" && method?.expenseType && method.expenseType !== "Other") {
                    setDraftCategories((previous) => ({ ...previous, expense: method.expenseType }));
                  }
                }}
                required
                disabled={loadingChoices || !methods.length}
              >
                {!methods.length && (
                  <option value="">
                    {loadingChoices
                      ? "Loading payment methods…"
                      : "No wallets — add one on Dashboard"}
                  </option>
                )}
                {methods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {walletLabel(item, methods).label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
          <Field
            label={`Amount (${currency})`}
            name="amount"
            value={draftAmount}
            onChange={(event) => setDraftAmount(event.target.value)}
            type="number"
            min="0.01"
            max="99999999.99"
            step="0.01"
            required
          />
          <Field
            label="Date"
            name="date"
            type="date"
            value={draftDate}
            onChange={(event) => setDraftDate(event.target.value)}
            required
          />
          {budgetWarning && (
            <p role="status" className="transaction-budget-warning">
              Budget reminder: this expense would bring spending for {draftDate.slice(0, 7)} to {money(budgetWarning.projected)},
              exceeding your monthly budget of {money(budgetWarning.limit)} by {money(budgetWarning.excess)}.
              You can still save this transaction.
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={
              busy
                ? "Saving..."
                : transaction
                  ? "Save Changes"
                  : "Add Transaction"
            }
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}

// Create or edit an overall spending limit for a selected month.
export function BudgetModal({ budget, initialMonth, initialLimit, onClose }) {
  const { budgets, createBudget, updateBudget, currency, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Validate the form and persist its record before closing the dialog.
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const month = form.get("month");
    const limit = Number(form.get("limit"));
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month < "1900-01" ||
      month > "2100-12"
    )
      return setError("Choose a valid month.");
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1_000_000)
      return setError("Enter a limit between 0.01 and 1,000,000.");
    if (
      budgets.some(
        (item) =>
          item.id !== budget?.id &&
          (item.isMonthlyPlan || item.category === "Monthly budget") &&
          item.startDate?.slice(0, 7) === month,
      )
    )
      return setError(
        "A budget process already exists for this month. Edit its limit instead.",
      );
    const [year, monthNumber] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0")}`;
    setBusy(true);
    setError("");
    try {
      // Compatibility with the existing API; this reserved category denotes an overall month plan.
      const values = {
        category_name: "Monthly budget",
        budget_amount: limit,
        budget_period: "monthly",
        start_date: `${month}-01`,
        end_date: end,
      };
      if (budget) await updateBudget(budget.id, values);
      else await createBudget(values);
      notify(budget ? "Budget updated" : "Budget created");
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={budget ? "Edit Budget Process" : "Add Budget Process"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ErrorForm failure={error} onSubmit={submit}>
        <fieldset disabled={busy} className="admin-fieldset">
          <Field
            label="Month"
            name="month"
            type="month"
            min="1900-01"
            max="2100-12"
            defaultValue={
              budget?.startDate?.slice(0, 7) ||
              initialMonth ||
              localDate().slice(0, 7)
            }
            required
          />
          <Field
            label={`Monthly limit (${currency})`}
            name="limit"
            type="number"
            defaultValue={budget?.limit ?? initialLimit ?? ""}
            min="0.01"
            max="1000000"
            step="0.01"
            required
          />
          <p className="report-caption">
            One spending limit for all expenses in the selected month.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={
              busy ? "Saving…" : budget ? "Save Changes" : "Add Budget Process"
            }
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}
// Create or edit a savings goal and its target details.
export function GoalModal({ goal, onClose }) {
  const { saveGoal, addGoalContribution, currency, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const savedGoalId = useRef(null);
  const [statusId, setStatusId] = useState(goal?.statusId || null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/lookups/goal-statuses")
      .then((items) => {
        setStatusId(
          goal?.statusId ||
            items.find((item) => item.code === "active")?.id ||
            null,
        );
      })
      .catch((failure) => setError(failure));
  }, [goal?.statusId]);

  // Validate the form and persist its record before closing the dialog.
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    const target = Number(form.get("target"));
    const contribution = goal ? 0 : Number(form.get("contribution"));
    if (
      !name ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(contribution) ||
      contribution < 0 ||
      !statusId
    ) {
      return setError(
        "Enter a name, positive target, and nonnegative contribution.",
      );
    }
    setBusy(true);
    setError("");
    try {
      const saved = await saveGoal(
        {
          goal_name: name,
          target_amount: target,
          target_date: form.get("date"),
          status_id: statusId,
        },
        goal?.id || savedGoalId.current,
      );
      savedGoalId.current = saved.id;
      // "Saved" is now a contribution, not a local number that overwrites
      // the balance. The backend sums persisted contributions for each goal.
      if (contribution > 0)
        await addGoalContribution({
          goal_id: saved.id,
          amount: contribution,
          contribution_date: localDate(),
          description: "Goal form contribution",
        });
      notify(goal ? "Goal updated" : "Goal added");
      onClose();
    } catch (failure) {
      if (savedGoalId.current && !goal)
        failure.message = `Goal saved, but the contribution could not be confirmed. ${failure.message}`;
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={goal ? "Edit Goal" : "Add Goal"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ErrorForm failure={error} onSubmit={submit}>
        <fieldset disabled={busy} className="admin-fieldset">
          <Field
            label="Goal name"
            name="name"
            defaultValue={goal?.name || ""}
            required
            maxLength={100}
          />
          <Field
            label={`Target amount (${currency})`}
            name="target"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={goal?.target || ""}
            required
          />
          {!goal && (
            <Field
              label={`Initial saved amount (${currency})`}
              name="contribution"
              type="number"
              min="0"
              step="0.01"
              defaultValue={0}
              required
            />
          )}
          <Field
            label="Target date"
            name="date"
            type="date"
            defaultValue={goal?.date || localDate()}
            required
          />
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={busy ? "Saving…" : goal ? "Save Changes" : "Add Goal"}
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}

// Record a new contribution toward an existing savings goal.
export function GoalContributionModal({ goal, onClose }) {
  const { addGoalContribution, currency, money, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title={`Add money to ${goal.name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="report-caption">
        {money(goal.saved)} saved of {money(goal.target)}. Adding money
        increases your saved progress.
      </p>
      <ErrorForm
        failure={error}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const amount = Number(form.get("amount"));
          if (!Number.isFinite(amount) || amount <= 0)
            return setError("Enter an amount greater than zero.");
          setBusy(true);
          setError("");
          try {
            await addGoalContribution({
              goal_id: goal.id,
              amount,
              contribution_date: form.get("date"),
              description: form.get("description").trim(),
            });
            notify("Money added to goal");
            onClose();
          } catch (failure) {
            setError(failure);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="admin-fieldset">
          <Field
            label={`Amount (${currency})`}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
          <Field
            label="Contribution date"
            name="date"
            type="date"
            defaultValue={localDate()}
            required
          />
          <Field label="Note (optional)" name="description" maxLength={200} />
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={busy ? "Saving…" : "Add Money"}
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}

// Convert the entered pay frequency into an expected monthly income.
export function IncomeModal({ onClose }) {
  const {
    income: expectedIncome,
    saveIncomeEstimate,
    currency,
    notify,
  } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  // Validate the form and persist its record before closing the dialog.
  async function submit(event) {
    event.preventDefault();
    if (saving.current || error?.uncertain) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const monthly = monthlyIncome(amount, form.get("frequency"));
    if (
      !Number.isFinite(monthly) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      monthlyIncome(amount, form.get("frequency")) > 99999999.99
    )
      return setError(
        "Enter a valid amount with a monthly total no greater than 99,999,999.99.",
      );
    saving.current = true;
    setBusy(true);
    try {
      // Save the estimate to the user's profile; it is distinct from actual
      // income transactions used by the reports.
      await saveIncomeEstimate(monthly);
      notify("Monthly income estimate updated");
      onClose();
    } catch (failure) {
      setError(failure);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Edit Expected Monthly Income"
      onClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <ErrorForm failure={error} onSubmit={submit}>
        <fieldset disabled={busy} className="transaction-fieldset">
          <Field
            label={`Pay amount (${currency})`}
            name="amount"
            defaultValue={expectedIncome || 0}
            type="number"
            min="0"
            max="99999999.99"
            step="0.01"
            required
          />
          <div className="field">
            <label htmlFor="income-frequency">Pay Frequency</label>
            <select
              id="income-frequency"
              name="frequency"
              defaultValue="monthly"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 Weeks</option>
              <option value="monthly">Monthly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <p className="report-caption">
            Weekly pay uses 52 payments per year; biweekly uses 26. This is your
            expected monthly income for planning. Record received money as an
            income transaction to update actual income.
          </p>
          <FormActions
            onClose={onClose}
            label={busy ? "Saving..." : "Save Expected Income"}
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}

// Display the placeholder savings dialog.
export function SavingsModal({ onClose }) {
  return (
    <Modal title="Savings" onClose={onClose}>
      <p>Savings details go here.</p>
    </Modal>
  );
}
