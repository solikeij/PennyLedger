import ErrorForm from "../components/ErrorForm";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useApp } from "../state/AppContext";
import { DATE_FORMATS, formatDate, localDate } from "../lib/format";
import {
  Field,
  FormActions,
  Modal,
  PageTitle,
  Summary,
  ThemeSwitch,
} from "../components/UI";

// Create or edit an account from the administrator workspace.
function UserEditor({ user, onClose }) {
  const { createUser, updateUser } = useAuth();
  const { notify } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Submit account details and refresh the administrator view.
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      if (user) await updateUser(user.id, values);
      else await createUser(values);
      notify(user ? "User updated" : "User created");
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={user ? "Edit User" : "Create User"} onClose={onClose}>
      <ErrorForm failure={error} onSubmit={submit}>
        <fieldset disabled={busy} className="admin-fieldset">
          <Field
            label="Full name"
            name="name"
            defaultValue={user?.name || ""}
            required
            maxLength={100}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            defaultValue={user?.email || ""}
            required
          />
          <Field
            label={user ? "New password (optional)" : "Temporary password"}
            name="password"
            type="password"
            minLength={8}
            required={!user}
            autoComplete="new-password"
          />
          <p className="report-caption">
            At least 8 characters. Share the temporary password with the user
            through a secure channel.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error.message || error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={busy ? "Saving…" : user ? "Save Changes" : "Create User"}
          />
        </fieldset>
      </ErrorForm>
    </Modal>
  );
}
// Format administrator timestamps with an optional time of day.
function AdminDate({ value, withTime = false }) {
  const { dateFormat } = useApp();
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return "—";
  return (
    <>
      {formatDate(localDate(parsed), dateFormat)}
      {withTime ? `, ${parsed.toLocaleTimeString()}` : ""}
    </>
  );
}

// Display administrator login and signup events.
function ActivityTable({ entries }) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>User</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={index}>
              <td>
                <AdminDate value={entry.timestamp} withTime />
              </td>
              <td>{entry.eventType}</td>
              <td>{entry.user}</td>
            </tr>
          ))}
          {!entries.length && (
            <tr>
              <td colSpan={3}>No authentication events yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Choose the display style for an account status.
function statusPill(status) {
  const normalized = ["active", "inactive", "suspended", "deleted"].includes(
    status,
  )
    ? status
    : "unknown";
  const tone =
    {
      active: "pill-green",
      inactive: "pill-gray",
      suspended: "pill-red",
      deleted: "pill-gray",
    }[normalized] || "pill-gray";
  const label = normalized[0].toUpperCase() + normalized.slice(1);
  return <span className={`pill ${tone}`}>{label}</span>;
}

// Provide administrator user management, authentication history, and registration settings.
export default function Admin({ section = "overview" }) {
  const {
    users,
    activity,
    updateUser,
    deleteUser,
    restoreUser,
    refreshAdmin,
    adminLoading,
    adminError,
    registrationOpen,
    setRegistrationOpen,
    account,
  } = useAuth();
  const { notify, dateFormat, setDateFormat } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [statusSaving, setStatusSaving] = useState(null);
  const members = users.filter((user) => user.role === "user");
  const liveMembers = members.filter(
    (user) => !user.deletedAt && user.status !== "deleted",
  );
  const archivedMembers = members.filter(
    (user) => user.deletedAt || user.status === "deleted",
  );
  const visible = liveMembers.filter(
    (user) =>
      (status === "all" || user.status === status) &&
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const titles = {
    overview: "Admin Overview",
    users: "Manage Users",
    archive: "Deleted Accounts",
    activity: "Authentication Events",
    settings: "Admin Settings",
  };
  return (
    <>
      <PageTitle
        title={titles[section]}
        description="PennyLedger administration"
      >
        <span className="pill pill-blue">Administrator</span>
        <button
          className="btn btn-outline btn-sm"
          disabled={adminLoading}
          onClick={() => refreshAdmin()}
        >
          {adminLoading ? "Refreshing…" : "Refresh data"}
        </button>
      </PageTitle>
      {adminError && (
        <p className="admin-load-error" role="alert">
          Some admin data did not load: {adminError}
        </p>
      )}
      {section === "overview" && (
        <>
          <Summary
            items={[
              {
                label: "Total Users",
                value: adminLoading && !users.length ? "…" : members.length,
              },
              {
                label: "Active Users",
                value:
                  adminLoading && !users.length
                    ? "…"
                    : liveMembers.filter((user) => user.status === "active")
                        .length,
                tone: "green",
              },
              {
                label: "Inactive Users",
                value:
                  adminLoading && !users.length
                    ? "…"
                    : liveMembers.filter((user) => user.status === "inactive")
                        .length,
              },
              {
                label: "Suspended Users",
                value:
                  adminLoading && !users.length
                    ? "…"
                    : liveMembers.filter((user) => user.status === "suspended")
                        .length,
              },
              {
                label: "Deleted Accounts",
                value:
                  adminLoading && !users.length ? "…" : archivedMembers.length,
              },
            ]}
          />
          <section className="card admin-section">
            <div className="card-head">
              <h2>Account management</h2>
              <Link to="/admin/users" className="btn btn-primary btn-sm">
                Manage Users
              </Link>
            </div>
            <p className="report-caption">
              Welcome, {account.name}. Create accounts, set account status, and
              review deleted accounts. Each user has a separate personal ledger.
            </p>
            <span
              className={`pill ${registrationOpen ? "pill-green" : "pill-red"}`}
            >
              Registration {registrationOpen ? "open" : "closed"}
            </span>
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent authentication events</h2>
              <Link className="link" to="/admin/activity">
                View all
              </Link>
            </div>
            <ActivityTable entries={activity.slice(0, 5)} />
          </section>
        </>
      )}
      {section === "users" && (
        <section className="card">
          <div className="admin-toolbar">
            <div className="search-box">
              <input
                aria-label="Search users"
                placeholder="Search name or email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className="filter-select"
              aria-label="Filter users by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All current accounts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <Link className="btn btn-outline btn-sm" to="/admin/archive">
              Deleted Accounts ({archivedMembers.length})
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditing({})}
            >
              Create User
            </button>
          </div>
          <p className="report-caption">
            {visible.length} of {liveMembers.length} current accounts ·
            Administrator accounts cannot be modified here.
          </p>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last sign in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <span className="admin-email">{user.email}</span>
                    </td>
                    <td>{statusPill(user.status)}</td>
                    <td>
                      <AdminDate value={user.created} />
                    </td>
                    <td>
                      {user.lastLogin ? (
                        <AdminDate value={user.lastLogin} withTime />
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          aria-label={`Delete ${user.name}`}
                          onClick={() => setConfirm({ user, action: "delete" })}
                        >
                          Delete
                        </button>
                        {["active", "inactive", "suspended"].includes(
                          user.status,
                        ) ? (
                          <select
                            className="filter-select admin-status-select"
                            aria-label={`Change ${user.name} status`}
                            value={user.status}
                            disabled={statusSaving === user.id}
                            onChange={async (event) => {
                              const nextStatus = event.target.value;
                              setStatusSaving(user.id);
                              try {
                                await updateUser(user.id, {
                                  status: nextStatus,
                                });
                                notify(
                                  `Account status changed to ${nextStatus}`,
                                );
                              } catch (error) {
                                notify(error.message);
                              } finally {
                                setStatusSaving(null);
                              }
                            }}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        ) : (
                          <span className="report-caption">
                            Status unavailable
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={5}>No users match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {section === "archive" && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Deleted Accounts</h2>
              <p className="report-caption">
                Deleted accounts are kept here with their ledger data. Restore
                an account to allow sign-in again.
              </p>
            </div>
            <Link className="btn btn-outline btn-sm" to="/admin/users">
              Back to Users
            </Link>
          </div>
          <div className="search-box admin-archive-search">
            <input
              aria-label="Search deleted accounts"
              placeholder="Search name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p className="report-caption">
            {
              archivedMembers.filter((user) =>
                `${user.name} ${user.email}`
                  .toLowerCase()
                  .includes(search.trim().toLowerCase()),
              ).length
            }{" "}
            archived accounts
          </p>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Deleted</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedMembers
                  .filter((user) =>
                    `${user.name} ${user.email}`
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()),
                  )
                  .map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <span className="admin-email">{user.email}</span>
                      </td>
                      <td>{statusPill("deleted")}</td>
                      <td>
                        <AdminDate value={user.deletedAt} withTime />
                      </td>
                      <td>
                        <AdminDate value={user.created} />
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            setConfirm({ user, action: "restore" })
                          }
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                {!archivedMembers.length && (
                  <tr>
                    <td colSpan={5}>No deleted accounts in the archive.</td>
                  </tr>
                )}
                {!!archivedMembers.length &&
                  !archivedMembers.some((user) =>
                    `${user.name} ${user.email}`
                      .toLowerCase()
                      .includes(search.trim().toLowerCase()),
                  ) && (
                    <tr>
                      <td colSpan={5}>No accounts match your search.</td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {section === "activity" && (
        <section className="card">
          <p className="report-caption">
            Latest 200 LOGIN and SIGNUP events. Only user, event type, and
            timestamp are available.
          </p>
          <ActivityTable entries={activity} />
        </section>
      )}
      {section === "settings" && (
        <div className="settings-grid">
          <section className="card settings-card">
            <div className="card-head">
              <h2>Appearance</h2>
              <p>Choose how PennyLedger looks on your screen.</p>
            </div>
            <div className="settings-row">
              <div className="sr-text">
                <strong>Dark mode</strong>
                <span>Switch between light and dark themes</span>
              </div>
              <div className="sr-control">
                <ThemeSwitch />
              </div>
            </div>
            <div className="settings-row">
              <div className="sr-text">
                <strong>Date format</strong>
                <span>How dates are displayed throughout the admin pages</span>
              </div>
              <div className="sr-control">
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
                    <option key={value} value={value}>
                      {formatDate(localDate(), value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          <section className="card settings-card">
            <div className="card-head">
              <h2>Registration</h2>
              <p>
                Choose whether visitors can create new user accounts.
                Administrators can still create users.
              </p>
            </div>
            <label className="admin-registration">
              <input
                type="checkbox"
                checked={registrationOpen}
                onChange={async (event) => {
                  try {
                    await setRegistrationOpen(event.target.checked);
                    notify("Registration setting updated");
                  } catch (failure) {
                    notify(failure.message);
                  }
                }}
              />
              Allow new user registrations
            </label>
            <hr className="admin-divider" />
            <h2>Connected environment</h2>
            <p className="report-caption">
              Account records, roles, and authentication events are managed by
              the PennyLedger server.
            </p>
          </section>
        </div>
      )}
      {editing && (
        <UserEditor
          user={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <Modal
          title={
            confirm.action === "delete"
              ? "Move account to archive?"
              : "Restore account?"
          }
          onClose={() => setConfirm(null)}
        >
          <p className="report-caption">
            {confirm.user.name} will{" "}
            {confirm.action === "delete"
              ? "be marked Deleted and moved to the archive. Their ledger data will be preserved."
              : "be marked Active and can sign in again."}
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  if (confirm.action === "delete") {
                    await deleteUser(confirm.user.id);
                  } else {
                    await restoreUser(confirm.user.id);
                  }
                  notify(
                    confirm.action === "delete"
                      ? "Account moved to archive"
                      : "Account restored",
                  );
                  setConfirm(null);
                } catch (error) {
                  notify(error.message);
                }
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
