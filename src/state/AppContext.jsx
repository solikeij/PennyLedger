import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, assetUrl } from "../lib/api";
import { isArchived } from "../lib/report-archive";
import { monthlyBudgetProgress } from "../lib/monthly-budget";
import { DATE_FORMATS, formatDate, money } from "../lib/format";
import { useAuth } from "./AuthContext";

const AppContext = createContext(null);
export const STORAGE_KEY = "pennyledger_react_v1";

// Read a browser preference while handling unavailable storage.
function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

const emptyLedger = {
  transactions: [],
  analyticsTransactions: [],
  budgets: [],
  wallets: [],
  goals: [],
  reports: [],
  income: 0,
  profile: { name: "", email: "", phone: "", photo: null },
};

// Load and share account data, preferences, notifications, and mutation actions.
export function AppProvider({ children }) {
  const { account } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toastTimer = useRef(null);
  const [data, setData] = useState(emptyLedger);
  const [loading, setLoading] = useState(false);
  const [sectionState, setSectionState] = useState({});
  const [dataVersion, setDataVersion] = useState(0);
  const generation = useRef(0);
  const loadVersions = useRef({});
  const [toast, setToast] = useState("");
  const [activities, setActivities] = useState([]);
  // Activity is loaded from committed server writes; preferences remain local.
  async function refreshActivity() {
    setDataVersion((value) => value + 1);
    await refreshSection("activities");
  }
  const [theme, setThemeState] = useState(() =>
    readPreference("pennyledger_theme", "light"),
  );
  const currency = "PHP";
  const [dateFormat, setDateFormatState] = useState(() =>
    readPreference("pennyledger_dateformat", DATE_FORMATS[0]),
  );

  const sectionPaths = {
    transactions: "/transactions?archived=false&per_page=25",
    budgets: "/budgets",
    goals: "/goals",
    reports: "/report-logs?per_page=25",
    profile: "/profile",
    wallets: "/wallets",
    analyticsTransactions: "/reports?type=ledger",
    activities: "/activity-logs",
  };
  // Reload one data section and track its loading or failure state.
  async function refreshSection(section) {
    const epoch = generation.current;
    const version = (loadVersions.current[section] || 0) + 1;
    loadVersions.current[section] = version;
    setSectionState((old) => ({
      ...old,
      [section]: { ...old[section], loading: true, error: "" },
    }));
    try {
      const result = await api(sectionPaths[section]);
      if (
        epoch !== generation.current ||
        version !== loadVersions.current[section]
      )
        return false;
      if (section === "activities") setActivities(result.items || result);
      else
        setData((old) =>
          section === "profile"
            ? {
                ...old,
                income: result.monthlyIncomeEstimate || 0,
                profile: { ...result, photo: assetUrl(result.photoUrl) },
              }
            : { ...old, [section]: result.items || result },
        );
      setSectionState((old) => ({
        ...old,
        [section]: { loaded: true, loading: false, error: "" },
      }));
      return true;
    } catch (failure) {
      if (
        epoch !== generation.current ||
        version !== loadVersions.current[section]
      )
        return false;
      setSectionState((old) => ({
        ...old,
        [section]: { ...old[section], loading: false, error: failure.message },
      }));
      return false;
    }
  }
  useEffect(() => {
    ++generation.current;
    setData(emptyLedger);
    setActivities([]);
    setSectionState({});
    if (!account || account.role !== "user") {
      setLoading(false);
      return;
    }
    setLoading(true);
    const epoch = generation.current;
    Promise.allSettled(Object.keys(sectionPaths).map(refreshSection)).finally(
      () => {
        if (epoch === generation.current) setLoading(false);
      },
    );
    return () => {
      ++generation.current;
    };
  }, [account?.id, account?.role]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pennyledger_theme", theme);
      localStorage.setItem("pennyledger_currency", currency);
      localStorage.setItem("pennyledger_dateformat", dateFormat);
    } catch {
      /* Display preferences still work in memory. */
    }
  }, [theme, currency, dateFormat]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Show a temporary status message after an account action.
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message); // Fixed the old undefined setToasting call.
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }

  // Update a display preference and preserve it in the route query.
  function preference(key, value, setter) {
    setter(value);

    const query = new URLSearchParams(location.search);
    query.set(key, value);
    navigate(
      { pathname: location.pathname, search: `?${query}` },
      { replace: true },
    );
  }

  // Save a transaction and refresh the affected ledger, budgets, and activity.
  async function createTransaction(values) {
    // PHP validates and creates the record. Use its numeric ID and saved data.
    const saved = await api("/transactions", { method: "POST", body: values });
    setData((old) => ({ ...old, transactions: [saved, ...old.transactions] }));
    await refreshActivity();
    await Promise.allSettled([
      refreshBudgets(),
      refreshSection("analyticsTransactions"),
    ]);
    return saved;
  }

  // Save transaction edits and refresh the dependent financial totals.
  async function updateTransaction(id, values) {
    const saved = await api(`/transactions/${id}`, {
      method: "PUT",
      body: values,
    });
    setData((old) => ({
      ...old,
      transactions: old.transactions.map((tx) => (tx.id === id ? saved : tx)),
    }));
    await refreshActivity();
    await Promise.allSettled([
      refreshSection("transactions"),
      refreshBudgets(),
      refreshSection("analyticsTransactions"),
    ]);
    return saved;
  }

  // Delete a transaction and refresh ledger totals and activity.
  async function deleteTransaction(id) {
    await api(`/transactions/${id}`, { method: "DELETE" });
    setData((old) => ({
      ...old,
      transactions: old.transactions.filter((tx) => tx.id !== id),
    }));
    await refreshActivity();
    await Promise.allSettled([
      refreshSection("transactions"),
      refreshBudgets(),
      refreshSection("analyticsTransactions"),
    ]);
  }

  // Archive or restore a transaction and refresh the affected account data.
  async function archiveTransaction(id, archived) {
    const action = archived ? "restore" : "archive";
    await api(`/transactions/${id}/${action}`, { method: "PATCH" });
    await refreshActivity();
    setData((old) => ({
      ...old,
      transactions: old.transactions.map((tx) =>
        tx.id === id ? { ...tx, archived: !archived } : tx,
      ),
    }));
    // Archiving changes visibility, not historical financial totals.
  }

  // Reload saved budgets after ledger or budget changes.
  async function refreshBudgets() {
    return refreshSection("budgets");
  }

  // Save a new budget and add its server-confirmed record to shared state.
  async function createBudget(values) {
    const saved = await api("/budgets", { method: "POST", body: values });
    setData((old) => ({ ...old, budgets: [saved, ...old.budgets] }));
    await refreshActivity();
    return saved;
  }

  // Save budget edits and replace the matching shared record.
  async function updateBudget(id, values) {
    const saved = await api(`/budgets/${id}`, { method: "PUT", body: values });
    setData((old) => ({
      ...old,
      budgets: old.budgets.map((item) => (item.id === id ? saved : item)),
    }));
    await refreshActivity();
    return saved;
  }

  // Delete a budget and remove its shared record after server confirmation.
  async function deleteBudget(id) {
    await api(`/budgets/${id}`, { method: "DELETE" });
    setData((old) => ({
      ...old,
      budgets: old.budgets.filter((item) => item.id !== id),
    }));
    await refreshActivity();
  }

  // Save a wallet and update shared wallet data.
  async function createWallet(values) {
    const saved = await api("/wallets", { method: "POST", body: values });
    setData((old) => ({ ...old, wallets: [...old.wallets, saved] }));
    await refreshActivity();
    return saved;
  }

  // Save wallet details and update the matching shared record.
  async function updateWallet(id, values) {
    const saved = await api(`/wallets/${id}`, { method: "PUT", body: values });
    setData((old) => ({
      ...old,
      wallets: old.wallets.map((wallet) => (wallet.id === id ? saved : wallet)),
    }));
    await refreshActivity();
    return saved;
  }

  // Delete a wallet with password confirmation and refresh the wallet list.
  async function deleteWallet(id, password) {
    await api(`/wallets/${id}`, { method: "DELETE", body: { password } });
    await refreshActivity();
    setData((old) => ({
      ...old,
      wallets: old.wallets.filter((wallet) => wallet.id !== id),
    }));
  }

  // Create or update a savings goal and refresh its shared data.
  async function saveGoal(values, id = null) {
    const saved = await api(id ? `/goals/${id}` : "/goals", {
      method: id ? "PUT" : "POST",
      body: values,
    });
    setData((old) => ({
      ...old,
      goals: id
        ? old.goals.map((goal) => (goal.id === id ? saved : goal))
        : [saved, ...old.goals],
    }));
    await refreshActivity();
    return saved;
  }

  // Save a contribution and refresh the affected savings totals.
  async function addGoalContribution(values) {
    await api("/goal-contributions", { method: "POST", body: values });
    await refreshActivity();
    // Once the contribution is saved, a failed refresh must not invite a second payment.
    setData((old) => ({
      ...old,
      goals: old.goals.map((goal) =>
        goal.id === values.goal_id
          ? { ...goal, saved: goal.saved + Number(values.amount) }
          : goal,
      ),
    }));
    await refreshSection("goals");
  }

  // Persist a generated report snapshot and update the report list.
  async function addReport(values) {
    const saved = await api("/report-logs", { method: "POST", body: values });
    setData((old) => ({ ...old, reports: [saved, ...old.reports] }));
    await refreshActivity();
    return saved;
  }

  // Archive or restore a report after server confirmation.
  async function archiveReport(id, archived) {
    archived = isArchived(archived);
    const saved = await api(
      `/report-logs/${id}/${archived ? "restore" : "archive"}`,
      { method: "PATCH" },
    );
    await refreshActivity();
    setData((old) => ({
      ...old,
      reports: old.reports.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(saved || {}),
              archived:
                saved?.archived !== undefined
                  ? isArchived(saved.archived)
                  : !archived,
            }
          : item,
      ),
    }));
  }

  // Update shared profile details after the server saves them.
  function updateProfile(profile) {
    void refreshActivity();
    setData((old) => ({
      ...old,
      profile: { ...profile, photo: assetUrl(profile.photoUrl) },
    }));
  }

  // Save the expected monthly income without creating a ledger transaction.
  async function saveIncomeEstimate(amount) {
    const result = await api("/profile/income-estimate", {
      method: "PUT",
      body: { amount },
    });
    setData((old) => ({ ...old, income: result.monthlyIncomeEstimate }));
    await refreshActivity();
  }

  return (
    <AppContext.Provider
      value={{
        ...data,
        budgets: monthlyBudgetProgress(
          data.budgets,
          data.analyticsTransactions,
        ),
        activities,
        loading,
        notify,
        sectionState,
        refreshSection,
        dataVersion,
        serverPagination: true,
        createTransaction,
        updateTransaction,
        deleteTransaction,
        archiveTransaction,
        createBudget,
        updateBudget,
        deleteBudget,
        createWallet,
        updateWallet,
        deleteWallet,
        saveGoal,
        addGoalContribution,
        addReport,
        archiveReport,
        updateProfile,
        saveIncomeEstimate,
        theme,
        currency,
        dateFormat,
        setTheme: (value) => preference("theme", value, setThemeState),
        setDateFormat: (value) =>
          preference("dateformat", value, setDateFormatState),
        money: (value, signed = false) => money(value, currency, signed),
        date: (value) => formatDate(value, dateFormat),
      }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`toast${toast ? " show" : ""}`}
      >
        {toast}
      </div>
    </AppContext.Provider>
  );
}

// Read the shared application state and actions from its provider.
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be inside AppProvider");
  return value;
}
