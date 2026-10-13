import { useState } from "react";
import { Link } from "react-router-dom";
import { Field, PageTitle } from "../components/UI";
import PagedList from "../components/PagedList";
import { usePagedResource } from "../lib/use-paged-resource";
import { useApp } from "../state/AppContext";

export default function ActivityLogs() {
  const { date } = useApp();
  const [filters, setFilters] = useState({
    q: "",
    action: "",
    from: "",
    to: "",
  });
  const list = usePagedResource("/activity-logs", filters);
  const change = (key) => (event) =>
    setFilters((old) => ({ ...old, [key]: event.target.value }));
  return (
    <>
      <PageTitle
        title="Activity Logs"
        description="Your account history, newest first."
      >
        <Link to="/settings" className="btn btn-outline btn-sm">
          Back to Settings
        </Link>
      </PageTitle>
      <section className="card">
        <div className="activity-filters">
          <Field
            label="Search activity"
            type="search"
            maxLength={200}
            value={filters.q}
            onChange={change("q")}
          />
          <div className="field">
            <label htmlFor="activity-action">Action type</label>
            <select
              id="activity-action"
              value={filters.action}
              onChange={change("action")}
            >
              <option value="">All actions</option>
              {[
                "CREATE",
                "UPDATE",
                "DELETE",
                "ARCHIVE",
                "RESTORE",
                "LOGIN",
                "SIGNUP",
                "LOGOUT",
              ].map((action) => (
                <option key={action}>{action}</option>
              ))}
            </select>
          </div>
          <Field
            label="From date"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={change("from")}
          />
          <Field
            label="To date"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={change("to")}
          />
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setFilters({ q: "", action: "", from: "", to: "" })}
          >
            Clear filters
          </button>
        </div>
        <PagedList list={list}>
          {!list.items.length ? (
            <div className="empty-state">
              <h2>No activity found</h2>
              <p>Your activity will appear here. Try clearing any filters.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Date/time</th>
                    <th>Action</th>
                    <th>Description</th>
                    <th>Related item</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <time dateTime={entry.date}>
                          {date(entry.date.slice(0, 10))}{" "}
                          {new Date(entry.date).toLocaleTimeString()}
                        </time>
                      </td>
                      <td>{entry.action}</td>
                      <td>{entry.description}</td>
                      <td>{entry.relatedItem || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PagedList>
      </section>
    </>
  );
}
