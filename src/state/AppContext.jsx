import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { initialData } from "./data";
import { CURRENCIES, DATE_FORMATS, formatDate, money } from "../lib/format";

import { useAuth } from "./AuthContext";

const AppContext = createContext(null);
export const STORAGE_KEY = "pennyledger_react_v1";

function read(key, fallback, json = false) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : json ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
}

function loadData(account) {
  const key = account ? `${STORAGE_KEY}_${account.id}` : STORAGE_KEY;
  const saved =
    read(key, null, true) ||
    (account?.id === "alex-demo" ? read(STORAGE_KEY, null, true) : null);
  if (
    saved &&
    ["transactions", "budgets", "goals", "reports"].every((key) =>
      Array.isArray(saved[key]),
    ) &&
    saved.profile
  ) {
    return {
      ...initialData,
      ...saved,
      profile: {
        ...saved.profile,
        name: account?.name || saved.profile.name,
        email: account?.email || saved.profile.email,
      },
    };
  }
  if (account && account.id !== "alex-demo")
    return {
      transactions: [],
      budgets: [],
      goals: [],
      reports: [],
      income: 0,
      profile: { name: account.name, email: account.email, phone: "" },
    };
  const txArchive = read("pennyledger_archived_transactions", [], true);
  const reportArchive = read("pennyledger_archived_reports", [], true);
  return {
    ...initialData,
    transactions: initialData.transactions.map((tx) => ({
      ...tx,
      archived:
        Array.isArray(txArchive) && txArchive.some((item) => item.id === tx.id),
    })),
    reports: initialData.reports.map((report) => ({
      ...report,
      archived:
        Array.isArray(reportArchive) &&
        reportArchive.some((item) => item.id === report.id),
    })),
  };
}

export function ledgerReducer(state, action) {
  switch (action.type) {
    case "add-transaction":
      return {
        ...state,
        transactions: [action.value, ...state.transactions],
        budgets: state.budgets.map((budget) =>
          budget.category === action.value.category && action.value.amount < 0
            ? { ...budget, spent: budget.spent + Math.abs(action.value.amount) }
            : budget,
        ),
      };
    case "archive-transaction":
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.id ? { ...tx, archived: !tx.archived } : tx,
        ),
      };
    case "add-budget":
      return { ...state, budgets: [action.value, ...state.budgets] };
    case "save-goal":
      return {
        ...state,
        goals: state.goals.some((goal) => goal.id === action.value.id)
          ? state.goals.map((goal) =>
              goal.id === action.value.id ? action.value : goal,
            )
          : [action.value, ...state.goals],
      };
    case "add-report":
      return { ...state, reports: [action.value, ...state.reports] };
    case "archive-report":
      return {
        ...state,
        reports: state.reports.map((report) =>
          report.id === action.id
            ? { ...report, archived: !report.archived }
            : report,
        ),
      };
    case "profile":
      return { ...state, profile: action.value };
    case "income":
      return { ...state, income: action.value };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const { account } = useAuth();
  const storageKey = account ? `${STORAGE_KEY}_${account.id}` : null;
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [theme, setThemeState] = useState(() =>
    (params.get("theme") || read("pennyledger_theme", "light")) === "dark"
      ? "dark"
      : "light",
  );
  const [currency, setCurrencyState] = useState(() => {
    const value = params.get("currency") || read("pennyledger_currency", "USD");
    return CURRENCIES[value] ? value : "USD";
  });
  const [dateFormat, setDateFormatState] = useState(() => {
    const value =
      params.get("dateformat") ||
      read("pennyledger_dateformat", DATE_FORMATS[0]);
    return DATE_FORMATS.includes(value) ? value : DATE_FORMATS[0];
  });
  const [data, dispatch] = useReducer(ledgerReducer, account, loadData);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    try {
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* In-memory operation remains available. */
    }
  }, [data, storageKey]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pennyledger_theme", theme);
      localStorage.setItem("pennyledger_currency", currency);
      localStorage.setItem("pennyledger_dateformat", dateFormat);
    } catch {
      /* Preferences still work without browser storage. */
    }
  }, [theme, currency, dateFormat]);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has("theme"))
      setThemeState(query.get("theme") === "dark" ? "dark" : "light");
    if (CURRENCIES[query.get("currency")])
      setCurrencyState(query.get("currency"));
    if (DATE_FORMATS.includes(query.get("dateformat")))
      setDateFormatState(query.get("dateformat"));
  }, [location.search]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function preference(key, value, setter) {
    setter(value);
    const query = new URLSearchParams(location.search);
    query.set(key, value);
    navigate(
      { pathname: location.pathname, search: "?" + query.toString() },
      { replace: true },
    );
  }
  function notify(message) {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }
  const value = {
    ...data,
    dispatch,
    theme,
    currency,
    dateFormat,
    notify,
    setTheme: (value) => preference("theme", value, setThemeState),
    setCurrency: (value) => preference("currency", value, setCurrencyState),
    setDateFormat: (value) =>
      preference("dateformat", value, setDateFormatState),
    money: (value, signed = false) => money(value, currency, signed),
    date: (value) => formatDate(value, dateFormat),
  };
  return (
    <AppContext.Provider value={value}>
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

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be inside AppProvider");
  return value;
}
