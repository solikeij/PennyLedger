import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useApp } from "../state/AppContext";
import {
  Field,
  FormActions,
  Modal,
  PageTitle,
  Summary,
} from "../components/UI";

function UserEditor({ user, onClose }) {
  const { createUser, updateUser } = useAuth();
  const { notify } = useApp();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={user ? "Edit User" : "Create User"} onClose={onClose}>
      <form onSubmit={submit}>
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
            outside this demo.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <FormActions
            onClose={onClose}
            label={busy ? "Saving…" : user ? "Save Changes" : "Create User"}
          />
        </fieldset>
      </form>
    </Modal>
  );
}
function ActivityTable({ entries }) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Subject</th>
            <th>Performed by</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.at).toLocaleString()}</td>
              <td>{entry.action}</td>
              <td>{entry.subject}</td>
              <td>{entry.actor}</td>
            </tr>
          ))}
          {!entries.length && (
            <tr>
              <td colSpan={4}>No activity yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function Admin({ section = "overview" }) {
  const {
    users,
    activity,
    updateUser,
    registrationOpen,
    setRegistrationOpen,
    account,
  } = useAuth();
  const { notify } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const members = users.filter((user) => user.role === "user");
  const visible = members.filter(
    (user) =>
      (status === "all" || user.status === status) &&
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const titles = {
    overview: "Admin Overview",
    users: "Manage Users",
    activity: "Activity Log",
    settings: "Admin Settings",
  };
  return (
    <>
      <PageTitle
        title={titles[section]}
        description="PennyLedger administration"
      >
        <span className="pill pill-blue">Administrator</span>
      </PageTitle>
      {section === "overview" && (
        <>
          <Summary
            items={[
              { label: "Total Users", value: members.length },
              {
                label: "Active Users",
                value: members.filter((user) => user.status === "active")
                  .length,
                tone: "green",
              },
              {
                label: "Suspended Users",
                value: members.filter((user) => user.status === "suspended")
                  .length,
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
              Welcome, {account.name}. Create user accounts, update contact
              details, reset passwords, and suspend or restore access. Each user
              has a separate personal ledger.
            </p>
            <span
              className={`pill ${registrationOpen ? "pill-green" : "pill-red"}`}
            >
              Registration {registrationOpen ? "open" : "closed"}
            </span>
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent activity</h2>
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
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditing({})}
            >
              Create User
            </button>
          </div>
          <p className="report-caption">
            {visible.length} of {members.length} users · Administrator accounts
            cannot be modified here.
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
                    <td>
                      <span
                        className={`pill ${user.status === "active" ? "pill-green" : "pill-red"}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td>{new Date(user.created).toLocaleDateString()}</td>
                    <td>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString()
                        : "Never"}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          aria-label={`Edit ${user.name}`}
                          onClick={() => setEditing(user)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          aria-label={`${user.status === "active" ? "Suspend" : "Restore"} ${user.name}`}
                          onClick={() => setConfirm(user)}
                        >
                          {user.status === "active" ? "Suspend" : "Restore"}
                        </button>
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
      {section === "activity" && (
        <section className="card">
          <p className="report-caption">
            Latest 200 account events, including sign-ins, registrations, and
            administrator changes.
          </p>
          <ActivityTable entries={activity} />
        </section>
      )}
      {section === "settings" && (
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
              onChange={(event) => {
                setRegistrationOpen(event.target.checked);
                notify("Registration setting updated");
              }}
            />
            Allow new user registrations
          </label>
          <hr className="admin-divider" />
          <h2>Demo environment</h2>
          <p className="report-caption">
            Account records and activity are stored in this browser. Route
            checks demonstrate account roles; a backend is required for secure
            authentication, authorization, and shared administration across
            devices.
          </p>
        </section>
      )}
      {editing && (
        <UserEditor
          user={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <Modal
          title={`${confirm.status === "active" ? "Suspend" : "Restore"} user?`}
          onClose={() => setConfirm(null)}
        >
          <p className="report-caption">
            {confirm.name} will{" "}
            {confirm.status === "active"
              ? "lose access until restored. Their ledger will be preserved."
              : "be able to sign in again."}
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
                  await updateUser(confirm.id, {
                    status:
                      confirm.status === "active" ? "suspended" : "active",
                  });
                  notify("Account status updated");
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
