import { useAuth } from "../state/AuthContext";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { DATE_FORMATS, download } from "../lib/format";
import {
  Field,
  Modal,
  PageTitle,
  PasswordField,
  ThemeSwitch,
} from "../components/UI";

function SettingRow({ title, description, children, danger = false }) {
  return (
    <div className="settings-row">
      <div className={`sr-text${danger ? " danger" : ""}`}>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="sr-control">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { updateIdentity } = useAuth();
  const app = useApp();
  const {
    profile,
    dispatch,
    currency,
    setCurrency,
    dateFormat,
    setDateFormat,
    notify,
  } = app;
  const [passwordError, setPasswordError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const photoInput = useRef(null);
  function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name").trim();
    if (!name) return notify("Please enter your name.");
    try {
      updateIdentity(name, form.get("email"));
    } catch (error) {
      return notify(error.message);
    }
    dispatch({
      type: "profile",
      value: {
        ...profile,
        name,
        email: form.get("email").trim(),
        phone: form.get("phone").trim(),
      },
    });
    notify("Profile updated");
  }
  function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("new-password").length < 6)
      return setPasswordError("Password should be at least 6 characters.");
    if (form.get("new-password") !== form.get("confirm-password"))
      return setPasswordError("Passwords don't match.");
    setPasswordError("");
    event.currentTarget.reset();
    notify("Demo only — password validation passed. No password was saved.");
  }
  function photo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1000000
    )
      return notify("Choose a JPG, PNG, or WebP image under 1 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      dispatch({
        type: "profile",
        value: { ...profile, photo: reader.result },
      });
      notify("Profile photo updated");
    };
    reader.readAsDataURL(file);
  }
  return (
    <>
      <PageTitle
        title="Settings"
        description="Manage your profile, preferences, and account security"
      />
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="card-head">
            <h2>Profile</h2>
            <p>This is how you appear across PennyLedger.</p>
          </div>
          <div className="profile-row">
            <div className="avatar-lg">
              {profile.photo ? (
                <img
                  className="profile-photo"
                  src={profile.photo}
                  alt="Profile"
                />
              ) : (
                profile.name
                  .split(" ")
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join("")
              )}
            </div>
            <div className="pr-actions">
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={photo}
              />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => photoInput.current?.click()}
              >
                Change Photo
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ color: "var(--danger)" }}
                onClick={() => {
                  dispatch({
                    type: "profile",
                    value: { ...profile, photo: undefined },
                  });
                  notify("Photo removed");
                }}
              >
                Remove
              </button>
            </div>
          </div>
          <form onSubmit={saveProfile}>
            <div className="settings-fields">
              <Field
                label="Full Name"
                name="name"
                defaultValue={profile.name}
                required
              />
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={profile.email}
                required
              />
              <Field
                label="Phone"
                name="phone"
                type="tel"
                defaultValue={profile.phone}
                placeholder="+63 900 000 0000"
              />
              <div className="field">
                <label htmlFor="currency">Currency</label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(event) => {
                    setCurrency(event.target.value);
                    notify("Currency changed");
                  }}
                >
                  <option value="PHP">₱ Philippine Peso (PHP)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                  <option value="EUR">€ Euro (EUR)</option>
                </select>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm settings-save"
              type="submit"
            >
              Save Changes
            </button>
          </form>
        </section>
        <section className="card settings-card">
          <div className="card-head">
            <h2>Appearance</h2>
            <p>Choose how PennyLedger looks on your screen.</p>
          </div>
          <SettingRow
            title="Dark mode"
            description="Switch between light and dark themes"
          >
            <ThemeSwitch />
          </SettingRow>
          <SettingRow
            title="Date format"
            description="How dates are displayed throughout the app"
          >
            <select
              aria-label="Date format"
              className="filter-select"
              value={dateFormat}
              onChange={(event) => {
                setDateFormat(event.target.value);
                notify("Date format changed");
              }}
            >
              {DATE_FORMATS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </SettingRow>
        </section>
        <section className="card settings-card">
          <div className="card-head">
            <h2>Security</h2>
            <p>
              Account security controls are demonstrations until a backend is
              connected.
            </p>
          </div>
          <form onSubmit={changePassword}>
            <PasswordField
              label="Current Password"
              name="current-password"
              autoComplete="current-password"
              required
            />
            <div className="settings-fields">
              <PasswordField
                label="New Password"
                name="new-password"
                autoComplete="new-password"
                required
              />
              <PasswordField
                label="Confirm New Password"
                name="confirm-password"
                autoComplete="new-password"
                required
              />
            </div>
            {passwordError && (
              <p className="form-error" role="alert">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm settings-save"
            >
              Update Password
            </button>
          </form>
          <SettingRow
            title="Two-factor authentication"
            description="Requires a connected authentication service"
          >
            <label className="switch">
              <input
                type="checkbox"
                aria-label="Two-factor authentication"
                checked={false}
                onChange={() =>
                  notify(
                    "Two-factor authentication requires a backend connection.",
                  )
                }
              />
              <span className="switch-track">
                <span className="switch-thumb" />
              </span>
            </label>
          </SettingRow>
        </section>
        <section className="card settings-card">
          <div className="card-head">
            <h2>Archive</h2>
            <p>Transactions and reports you've archived instead of deleted.</p>
          </div>
          <SettingRow
            title="View archive"
            description="Browse and restore archived transactions and reports"
          >
            <Link to="/archive" className="btn btn-outline btn-sm">
              Open Archive
            </Link>
          </SettingRow>
        </section>
        <section className="card settings-card danger-card">
          <div className="card-head">
            <h2>Danger Zone</h2>
            <p>Manage your data and account.</p>
          </div>
          <SettingRow
            title="Export all data"
            description="Download your profile, transactions, budgets, goals, and reports as JSON"
          >
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const data = {
                  exportedAt: new Date().toISOString(),
                  profile,
                  transactions: app.transactions,
                  budgets: app.budgets,
                  goals: app.goals,
                  reports: app.reports,
                  monthlyIncome: app.income,
                  preferences: { currency, dateFormat, theme: app.theme },
                };
                download(
                  JSON.stringify(data, null, 2),
                  "pennyledger-data-export.json",
                  "application/json",
                );
                notify("Data export downloaded");
              }}
            >
              Export
            </button>
          </SettingRow>
          <SettingRow
            title="Delete account"
            description="Account deletion is a demonstration in this app"
            danger
          >
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setDeleteOpen(true)}
            >
              Delete Account
            </button>
          </SettingRow>
        </section>
      </div>
      {deleteOpen && (
        <Modal
          title="Delete your account?"
          onClose={() => setDeleteOpen(false)}
        >
          <p className="report-caption">
            This is a demo. No real account will be deleted.
          </p>
          <Field
            label="Type DELETE to confirm"
            value={deleteText}
            onChange={(event) => setDeleteText(event.target.value)}
            placeholder="DELETE"
          />
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (deleteText !== "DELETE")
                  return notify("Type DELETE to confirm");
                setDeleteOpen(false);
                setDeleteText("");
                notify("This is a demo — no account was deleted.");
              }}
            >
              Delete Account
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
