import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { useAuth } from "../state/AuthContext";
import { progress } from "../lib/format";
import { budgetStatus } from "../lib/budget-status";
import { useFieldError } from "./ErrorForm";
import logoBlack from "../assets/logo-black.svg";
import logoWhite from "../assets/logo-white.svg";

// Render a shared SVG icon selected by name.
export function Icon({ name, ...props }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    transactions: (
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </>
    ),
    budget: (
      <>
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <circle cx="17" cy="15" r="1" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M4 7h13a3 3 0 0 1 3 3v1h-5a2 2 0 0 0 0 4h5v2" />
        <path d="M16 13h.01" />
      </>
    ),
    goals: <path d="M5 21V4h13l-3 4 3 4H5" />,
    reports: <path d="M5 20V10M12 20V4M19 20v-6" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2 3-1 2 4 3-2 1-3 4-1 1-3-3-2V6l-4-1-2-2Z" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
      </>
    ),
    moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-5-5" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    archive: (
      <>
        <path d="M3 8h18v12H3zM2 3h20v5H2zM10 12h4" />
      </>
    ),
    restore: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    download: <path d="M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6" />,
    print: (
      <>
        <path d="M6 9V3h12v6M6 18H3V9h18v9h-3" />
        <path d="M6 14h12v7H6z" />
      </>
    ),
    pie: (
      <>
        <path d="M12 3v9h9A9 9 0 0 0 12 3Z" />
        <path d="M8 3a9 9 0 1 0 13 13H8Z" />
      </>
    ),
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.transactions}
    </svg>
  );
}

// Link the theme-aware logo to the appropriate account landing page.
export function Logo() {
  const { account } = useAuth();
  return (
    <Link
      to={account ? (account.role === "admin" ? "/admin" : "/dashboard") : "/"}
      className="logo"
    >
      <img className="logo-img logo-light" src={logoBlack} alt="PennyLedger" />
      <img className="logo-img logo-dark" src={logoWhite} alt="PennyLedger" />
    </Link>
  );
}

// Toggle the shared light or dark appearance preference.
export function ThemeSwitch() {
  const { theme, setTheme } = useApp();
  return (
    <div className="theme-switch">
      <Icon name="sun" />
      <label className="switch">
        <input
          type="checkbox"
          aria-label="Toggle dark mode"
          checked={theme === "dark"}
          onChange={(event) =>
            setTheme(event.target.checked ? "dark" : "light")
          }
        />
        <span className="switch-track">
          <span className="switch-thumb" />
        </span>
      </label>
      <Icon name="moon" />
    </div>
  );
}

// Render a consistent page heading, description, and optional actions.
export function PageTitle({ title, description, children }) {
  return (
    <div className="page-title page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

// Render a dialog with focus handling, keyboard dismissal, and background scroll locking.
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input,select,button")?.focus();
    // Handle Escape and keep keyboard focus inside the open dialog.
    function keydown(event) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll(
            "button,input,select,textarea,a[href]",
          ) || [],
        ).filter((el) => !el.disabled);
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1).focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0].focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = originalOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Render a labelled input with its local or server validation message.
export function Field({ label, error, children, ...props }) {
  const serverError = useFieldError(props.name);
  error = error || serverError;
  const generatedId = useId();
  const id = props.id || generatedId;
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children || (
        <div className="input-wrap">
          <input
            {...props}
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
      )}
      {error && (
        <small className="hint" role="alert" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

// Render a password input with a visibility toggle and validation feedback.
export function PasswordField({
  label = "Password",
  name = "password",
  error,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const serverError = useFieldError(name);
  error = error || serverError;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          {...props}
          id={id}
          name={name}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          type={visible ? "text" : "password"}
        />
        <button
          className="toggle-visibility"
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          <Icon name="eye" />
        </button>
      </div>
      {error && (
        <small className="hint form-error" role="alert" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}

// Render reusable cancel and submit buttons for modal forms.
export function FormActions({ onClose, label = "Save Changes" }) {
  return (
    <div className="modal-actions">
      <button type="button" className="btn btn-outline" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" className="btn btn-primary">
        {label}
      </button>
    </div>
  );
}

// Show bounded progress with accessible percentage information.
export function ProgressBar({ value, fill = "green" }) {
  return (
    <div
      className="prog-track"
      role="progressbar"
      aria-label="Progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.max(0, Math.min(100, value))}
    >
      <div
        className={`prog-fill fill-${fill}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// Display a budget limit, spending progress, and status.
export function BudgetRow({ budget }) {
  const { money } = useApp();
  const over = budget.spent > budget.limit;
  const status = budgetStatus(budget);
  return (
    <div className="prog-row">
      <div className="prow-top">
        <span>{budget.category}</span>
        <span style={over ? { color: "var(--danger)", fontWeight: 700 } : {}}>
          {money(budget.spent)} / {money(budget.limit)}
        </span>
      </div>
      <ProgressBar
        value={progress(budget.spent, budget.limit)}
        fill={over ? "red" : budget.category === "Groceries" ? "green" : "blue"}
      />
      <p className={over ? "budget-overage" : "report-caption"}>
        {status.label} · {status.percent.toFixed(1)}% used
        {over ? ` · Exceeded by ${money(status.exceeded)}` : ""}
      </p>
    </div>
  );
}

// Render an accessible set of mutually exclusive filter buttons.
export function Segments({ value, onChange, label, options }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={`seg-btn${value === option.value ? " active" : ""}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="seg-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Render a compact group of labelled summary values.
export function Summary({ items }) {
  return (
    <div className="budget-summary">
      {items.map((item) => (
        <div className="summary-cell" key={item.label}>
          <p className="sc-label">{item.label}</p>
          {item.action}
          <p className={`sc-value ${item.tone || ""}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}
