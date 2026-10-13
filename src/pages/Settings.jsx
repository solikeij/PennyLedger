import ErrorForm, { FailureMessage } from '../components/ErrorForm';
import { fetchAllPages } from '../lib/use-paged-resource';
import { useAuth } from "../state/AuthContext";
import { api } from "../lib/api";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { DATE_FORMATS, download, formatDate, localDate } from "../lib/format";
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
  const { updateIdentity, logout } = useAuth();
  const app = useApp();
  const {
    profile,
    currency,
    dateFormat,
    setDateFormat,
    notify,
    updateProfile,
  } = app;
  const [profileError, setProfileError] = useState('');
  const [accountAction, setAccountAction] = useState('archive');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const photoInput = useRef(null);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [profileBusy, setProfileBusy] = useState(false);
  useEffect(() => {
    if (!pendingPhoto) { setPhotoPreview(null); return; }
    const url = URL.createObjectURL(pendingPhoto);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);
  const displayedPhoto = removePhoto ? null : photoPreview || profile.photo;
  async function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = form.get("first_name").trim();
    const lastName = form.get("last_name").trim();
    if (!firstName || !lastName) return notify("Please enter your first and last name.");
    setProfileBusy(true);
    setProfileError('');
    let identitySaved = false;
    try {
      const revised = await updateIdentity(firstName, lastName, form.get("email"), form.get("phone").trim());
      updateProfile(revised);
      identitySaved = true;
      if (pendingPhoto) {
        const body = new FormData();
        body.append("photo", pendingPhoto);
        const saved = await api("/profile/photo", { method: "POST", body });
        updateProfile({ ...revised, photoUrl: saved.photoUrl });
      } else if (removePhoto) {
        await api("/profile/photo", { method: "DELETE" });
        updateProfile({ ...revised, photoUrl: null });
      }
      setPendingPhoto(null);
      setRemovePhoto(false);
      if (photoInput.current) photoInput.current.value = "";
    } catch (error) {
      if (identitySaved) error.message = `Profile details saved, but the photo change ${error.uncertain ? 'could not be confirmed' : 'failed'}. ${error.message}`;
      setProfileError(error);
      return;
    } finally { setProfileBusy(false); }
    notify("Profile updated");
  }
  async function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("new-password").length < 8)
      return setPasswordError("Password should be at least 8 characters.");
    if (form.get("new-password") !== form.get("confirm-password"))
      return setPasswordError("Passwords don't match.");
    try {
      // PHP verifies the current password, saves a new hash, and revokes
      // existing sessions. A successful change returns the user to login.
      await api("/profile/password", { method: "PUT", body: {
        current_password: form.get("current-password"),
        new_password: form.get("new-password"),
      } });
      setPasswordError("");
      await logout().catch(() => {});
      window.location.hash = "#/login";
    } catch (failure) { setPasswordError(failure); }
  }
  function photo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 1000000
    )
      return notify("Choose a JPG, PNG, or WebP image under 1 MB.");
    setPendingPhoto(file);
    setRemovePhoto(false);
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
              {displayedPhoto ? (
                <img
                  className="profile-photo"
                  src={displayedPhoto}
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
                aria-label="Profile photo"
                disabled={profileBusy}
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={photo}
              />
              <button
                className="btn btn-outline btn-sm"
                disabled={profileBusy}
                onClick={() => photoInput.current?.click()}
              >
                Change Photo
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={profileBusy}
                style={{ color: "var(--danger)" }}
                onClick={() => {
                  setPendingPhoto(null);
                  setRemovePhoto(true);
                  if (photoInput.current) photoInput.current.value = "";
                }}
              >
                Remove
              </button>
            </div>
          </div>
          <ErrorForm failure={profileError} onSubmit={saveProfile}>
            <fieldset disabled={profileBusy} className="admin-fieldset">
            <div className="settings-fields">
              <Field
                label="First name"
                name="first_name"
                defaultValue={profile.firstName}
                required
              />
              <Field label="Last name" name="last_name" defaultValue={profile.lastName} required maxLength={100} />
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

            </div>
            <FailureMessage error={profileError} />
            <p className="report-caption">Profile details and photo are saved when you click Save Changes.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={(event) => {
              event.currentTarget.form.reset();
              setPendingPhoto(null);
              setRemovePhoto(false);
              if (photoInput.current) photoInput.current.value = "";
            }}>Discard Changes</button>
            <button
              className="btn btn-primary btn-sm settings-save"
              type="submit"
            >
              {profileBusy ? "Saving…" : "Save Changes"}
            </button>
            </fieldset>
          </ErrorForm>
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
                <option key={value} value={value}>{formatDate(localDate(), value)}</option>
              ))}
            </select>
          </SettingRow>
        </section>
        <section className="card settings-card">
          <div className="card-head">
            <h2>Security</h2>
            <p>
              Your password is managed by the PennyLedger server.
            </p>
          </div>
          <ErrorForm failure={passwordError} onSubmit={changePassword}>
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
                {passwordError.message || passwordError}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-sm settings-save"
            >
              Update Password
            </button>
          </ErrorForm>

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
        <section className="card settings-card">
          <div className="card-head"><h2>Activity Logs</h2><p>Your private account activity.</p></div>
          <SettingRow title="View activity logs" description="Search and filter your account history">
            <Link to="/settings/activity-logs" className="btn btn-outline btn-sm">Open Activity Logs</Link>
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
              disabled={exportBusy}
              onClick={async () => {
                setExportBusy(true);
                try {
                const [savedProfile, budgets, wallets, goals] = await Promise.all([
                  api('/profile'), api('/budgets'), api('/wallets'), api('/goals'),
                ]);
                const transactions = await fetchAllPages("/transactions");
                const logs = await fetchAllPages("/report-logs");
                const reports = [];
                for (const log of logs) reports.push(await api(`/report-logs/${log.id}`));
                const data = {
                  exportedAt: new Date().toISOString(),
                  profile: savedProfile,
                  transactions,
                  budgets,
                  wallets,
                  goals,
                  reports,

                  preferences: { currency, dateFormat, theme: app.theme },
                };
                download(
                  JSON.stringify(data, null, 2),
                  "pennyledger-data-export.json",
                  "application/json",
                );
                notify("Data export downloaded");
                } catch (failure) { notify(`Export failed: ${failure.message}`); }
                finally { setExportBusy(false); }
              }}
            >
              {exportBusy ? "Preparing export?" : "Export"}
            </button>
          </SettingRow>
          <SettingRow title="Archive account" description="Disable sign-in and preserve your data. An administrator can restore it; your email stays reserved." danger>
            <button className="btn btn-outline btn-sm" onClick={() => { setAccountAction('archive'); setDeleteOpen(true); setDeleteText(''); setDeletePassword(''); setAccountError(''); }}>Archive Account</button>
          </SettingRow>
          <SettingRow title="Permanently delete account" description="Erase your account, ledger records, and profile photo. Your email becomes available for registration. This cannot be undone." danger>
            <button className="btn btn-danger btn-sm" onClick={() => { setAccountAction('delete'); setDeleteOpen(true); setDeleteText(''); setDeletePassword(''); setAccountError(''); }}>Permanently Delete Account</button>
          </SettingRow>
        </section>
      </div>
      {deleteOpen && <Modal title={accountAction === 'archive' ? 'Archive your account?' : 'Permanently delete your account?'} onClose={() => { if (!accountBusy) setDeleteOpen(false); }}>
        <ErrorForm failure={accountError} onSubmit={async (event) => {
          event.preventDefault();
          const confirmation = accountAction === 'archive' ? 'ARCHIVE' : 'DELETE';
          if (deleteText !== confirmation) return setAccountError('Type ' + confirmation + ' to confirm');
          setAccountBusy(true); setAccountError('');
          try {
            await api(accountAction === 'archive' ? '/profile/archive' : '/profile', { method: accountAction === 'archive' ? 'PATCH' : 'DELETE', body: { password: deletePassword } });
            await logout().catch(() => {});
            window.location.hash = '#/login';
          } catch (failure) { setAccountError(failure); }
          finally { setAccountBusy(false); }
        }}>
          <fieldset disabled={accountBusy} className="admin-fieldset">
            <p className="report-caption">{accountAction === 'archive' ? 'Your data and email remain reserved. Contact an administrator to restore access.' : 'Your account, all ledger records, and uploaded profile photo will be permanently removed. This cannot be undone.'}</p>
            <Field label={accountAction === 'archive' ? 'Type ARCHIVE to confirm' : 'Type DELETE to confirm'} value={deleteText} onChange={(event) => setDeleteText(event.target.value)} required />
            <PasswordField label="Confirm your password" name="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" required />
            <FailureMessage error={accountError} />
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={accountBusy || !!accountError?.uncertain}>{accountBusy ? 'Please wait?' : accountAction === 'archive' ? 'Archive Account' : 'Permanently Delete Account'}</button>
            </div>
          </fieldset>
        </ErrorForm>
      </Modal>}
    </>
  );
}
