import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider } from "./state/AppContext";
import { AuthProvider, RequireRole, useAuth } from "./state/AuthContext";
import Admin from "./pages/Admin";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Archive from "./pages/Archive";

const titles = {
  "/admin": "Admin Overview",
  "/admin/login": "Admin Sign In",
  "/admin/users": "Manage Users",
  "/admin/activity": "Activity Log",
  "/admin/settings": "Admin Settings",
  "/": "Take control of your money",
  "/login": "Log In",
  "/signup": "Create Account",
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/budget": "Budget",
  "/goals": "Financial Goals",
  "/reports": "Reports",
  "/settings": "Settings",
  "/archive": "Archive",
};

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { account } = useAuth();
  const location = useLocation();
  useEffect(() => {
    document.title = `${titles[location.pathname] || "Page not found"} — PennyLedger`;
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <AppProvider key={account?.id || "guest"}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth key="login" />} />
        <Route path="/signup" element={<Auth key="signup" signup />} />
        <Route path="/admin/login" element={<Auth key="admin" admin />} />
        <Route element={<RequireRole role="admin" />}>
          <Route element={<Layout admin />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users" element={<Admin section="users" />} />
            <Route
              path="/admin/activity"
              element={<Admin section="activity" />}
            />
            <Route
              path="/admin/settings"
              element={<Admin section="settings" />}
            />
          </Route>
        </Route>
        <Route element={<RequireRole role="user" />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/archive" element={<Archive />} />
          </Route>
        </Route>
        {[
          "index",
          "login",
          "signup",
          "dashboard",
          "transactions",
          "budget",
          "goals",
          "reports",
          "settings",
          "archive",
        ].map((name) => (
          <Route
            key={name}
            path={`/${name}.html`}
            element={
              <Navigate
                replace
                to={`${name === "index" ? "/" : "/" + name}${location.search}${location.hash}`}
              />
            }
          />
        ))}
        <Route
          path="*"
          element={
            <main className="empty-state">
              <h1>Page not found</h1>
              <p>The page you requested does not exist.</p>
              <Link className="btn btn-primary" to="/">
                Back to Home
              </Link>
            </main>
          }
        />
      </Routes>
    </AppProvider>
  );
}
