import DataSection from "./DataSection";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { Icon, Logo, ThemeSwitch } from "./UI";

import { useAuth } from "../state/AuthContext";

// Render shared navigation and the current protected page.
export default function Layout({ admin = false }) {
  const { account, logout } = useAuth();
  const { profile, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    // Close the navigation when the user requests dismissal.
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const links = admin
    ? [
        ["admin", "Overview"],
        ["admin/users", "Users"],
        ["admin/archive", "Deleted Accounts"],
        ["admin/activity", "Authentication Events"],
        ["admin/settings", "Admin Settings"],
      ]
    : [
        ["dashboard", "Dashboard"],
        ["transactions", "Transaction history"],
        ["budget", "Budget"],
        ["goals", "Financial Goals"],
        ["reports", "Reports"],
        ["settings", "Settings"],
      ];
  return (
    <div className="app-shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Logo />
        {admin && <span className="admin-badge">Administration</span>}
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(([path, label]) => (
            <NavLink key={path} to={`/${path}`} end={path === "admin"}>
              <Icon
                name={
                  admin
                    ? path === "admin/archive"
                      ? "archive"
                      : "settings"
                    : path
                }
              />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="side-profile">
          <div className="avatar">
            {!admin && profile.photo ? (
              <img
                className="profile-photo"
                src={profile.photo}
                alt="Your profile"
              />
            ) : (
              (admin ? account.name : profile.name)
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")
            )}
          </div>
          <div className="who">
            <strong>{admin ? account.name : profile.name}</strong>
            <span>{admin ? account.email : profile.email}</span>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={async () => {
            try {
              await logout();
            } finally {
              notify("Logged out");
              navigate(admin ? "/admin/login" : "/login");
            }
          }}
        >
          Log out
        </button>
      </aside>
      <div
        className={`sidebar-overlay${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
      />
      <div className="main">
        <div className="topbar">
          <button
            className="hamburger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div style={{ flex: 1 }} />
          {!admin && (
            <form
              className="search-box"
              onSubmit={(event) => {
                event.preventDefault();
                navigate(`/transactions?q=${encodeURIComponent(search)}`);
              }}
            >
              <Icon name="search" />
              <input
                aria-label="Search transactions"
                placeholder="Search transactions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </form>
          )}
          <ThemeSwitch />
        </div>
        <main className="content">
          <DataSection
            sections={
              admin
                ? []
                : {
                    "/budget": ["budgets", "analyticsTransactions"],
                    "/goals": ["goals"],
                    "/settings": ["profile"],
                  }[location.pathname] || []
            }
          >
            <Outlet />
          </DataSection>
        </main>
      </div>
    </div>
  );
}
