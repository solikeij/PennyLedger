import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api, getToken, setToken } from "../lib/api";

const AuthContext = createContext(null);

// Real accounts now come from PHP/MySQL. No passwords ship in the React bundle.

function splitName(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return { first_name: words.shift() || "", last_name: words.join(" ") || "—" };
}

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const sessionAttempt = useRef(0);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [registrationOpen, setRegistrationOpenState] = useState(true);

  async function recoverSession() {
    const attempt = ++sessionAttempt.current;
    setSessionError("");
    if (!getToken()) { setLoading(false); return; }
    setLoading(true);
    try {
      const profile = await api('/profile');
      if (attempt === sessionAttempt.current) setAccount(profile);
    } catch (failure) {
      if (attempt !== sessionAttempt.current) return;
      if (failure.status === 401) { setToken(null); setAccount(null); }
      else setSessionError(failure.message);
    } finally { if (attempt === sessionAttempt.current) setLoading(false); }
  }
  useEffect(() => {
    const expire = () => {
      ++sessionAttempt.current;
      setAccount(null); setSessionError(''); setLoading(false);
    };
    window.addEventListener('penny-session-expired', expire);
    recoverSession();
    return () => { ++sessionAttempt.current; window.removeEventListener('penny-session-expired', expire); };
  }, []);

  useEffect(() => {
    api("/auth/registration-status", { token: null })
      .then((result) => setRegistrationOpenState(result.registrationOpen))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (account?.role !== "admin") {
      setUsers([]);
      setActivity([]);
      setAdminError("");
      setAdminLoading(false);
      return;
    }
    refreshAdmin().catch(console.error);
  }, [account?.id, account?.role]);

  async function login(email, password, expectedRole = "user") {
    ++sessionAttempt.current;
    const result = await api("/auth/login", {
      method: "POST", body: { email, password }, token: null,
    });
    if (result.user.role !== expectedRole) {
      await api("/auth/logout", { method: "POST", token: result.token }).catch(() => {});
      throw new Error(`Use the ${result.user.role} sign-in page for this account.`);
    }
    setToken(result.token);
    setAccount(result.user);
    return result.user;
  }

  async function register(values) {
    return api("/auth/register", {
      method: "POST",
      body: { ...(values.firstName !== undefined
        ? { first_name: values.firstName, last_name: values.lastName }
        : splitName(values.name)), email: values.email, password: values.password },
      token: null,
    });
  }

  async function verifyOtp(email, otp) {
    return api("/auth/verify-otp", { method: "POST", body: { email, otp }, token: null });
  }

  async function resendOtp(email) {
    // The backend limits resend requests and only accepts unverified accounts.
    return api("/auth/resend-otp", { method: "POST", body: { email }, token: null });
  }

  async function logout() {
    ++sessionAttempt.current;
    try { if (getToken()) await api("/auth/logout", { method: "POST" }); }
    finally { setToken(null); setAccount(null); setSessionError(''); }
  }

  async function updateIdentity(firstName, lastName, email, phone = "") {
    const revised = await api("/profile", {
      method: "PUT", body: { first_name: firstName, last_name: lastName, email, phone },
    });
    setAccount(revised);
    return revised;
  }

  async function refreshAdmin() {
    setAdminLoading(true);
    const loadUsers = async (status = "") => {
      const query = status ? `?status=${status}&per_page=100` : "?per_page=100";
      const firstPage = await api(`/admin/users${query}`);
      const pages = Math.ceil(firstPage.total / 100);
      const extraPages = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
        api(`/admin/users${query}&page=${index + 2}`)));
      return [...firstPage.items, ...extraPages.flatMap((page) => page.items)];
    };
    const results = await Promise.allSettled([
      loadUsers(),
      loadUsers("deleted"),
      api("/admin/auth-events?per_page=200"),
      api("/admin/settings"),
    ]);
    const labels = ["accounts", "deleted accounts", "authentication events", "admin settings"];
    const values = results.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`Failed to load admin ${labels[index]}`, result.reason);
      return null;
    });
    const [people, archived, logs, settings] = values;

    // Let one failed request leave other admin data visible instead of
    // rejecting the whole dashboard and making every count look like zero.
    setUsers((current) => {
      const currentPeople = current.filter((user) => !user.deletedAt && user.status !== "deleted");
      const currentArchive = current.filter((user) => user.deletedAt || user.status === "deleted");
      const rows = [...(people ?? currentPeople), ...(archived ?? currentArchive)];
      return rows.map((user) => ({ ...user,
        created: user.createdAt || user.created,
        lastLogin: user.lastLoginAt || user.lastLogin }));
    });
    if (logs) setActivity(logs.items);
    if (settings) setRegistrationOpenState(settings.registrationOpen);
    setAdminError(results
      .map((result, index) => result.status === "rejected"
        ? `${labels[index]}: ${result.reason?.message || "request failed"}`
        : null)
      .filter(Boolean)
      .join(" · "));
    setAdminLoading(false);
  }

  async function createUser(values, selfRegistration = false) {
    if (selfRegistration) return register(values);
    const created = await api("/admin/users", {
      method: "POST",
      body: { ...splitName(values.name), email: values.email, password: values.password },
    });
    await refreshAdmin();
    return created;
  }

  async function updateUser(id, values) {
    if (values.status) {
      await api(`/admin/users/${id}/status`, { method: "PATCH", body: { status: values.status } });
    } else {
      await api(`/admin/users/${id}`, {
        method: "PUT",
        body: { ...splitName(values.name), email: values.email,
          ...(values.password ? { password: values.password } : {}) },
      });
    }
    await refreshAdmin();
  }

  async function deleteUser(id) {
    await api(`/admin/users/${id}/delete`, { method: "PATCH", body: {} });
    await refreshAdmin();
  }

  async function restoreUser(id) {
    await api(`/admin/users/${id}/restore`, { method: "PATCH", body: {} });
    await refreshAdmin();
  }

  async function permanentlyDeleteUser(id, password) {
    await api(`/admin/users/${id}`, { method: 'DELETE', body: { password } });
    await refreshAdmin();
  }

  async function setRegistrationOpen(value) {
    const result = await api("/admin/settings", {
      method: "PUT", body: { registrationOpen: value },
    });
    setRegistrationOpenState(result.registrationOpen);
  }

  return <AuthContext.Provider value={{
    account, loading, users, activity, adminLoading, adminError, registrationOpen,
    login, register, verifyOtp, resendOtp, logout, updateIdentity,
    createUser, updateUser, deleteUser, restoreUser, permanentlyDeleteUser, setRegistrationOpen, refreshAdmin,
  }}>{loading ? <p role="status">Checking your session…</p> : sessionError ?
    <section className="card" role="alert"><h1>Could not load your account</h1><p>{sessionError}</p>
      <button className="btn btn-primary" onClick={recoverSession}>Retry</button>
      <button className="btn btn-outline" onClick={() => { setToken(null); setSessionError(''); setAccount(null); }}>Sign out</button>
    </section> : children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}

export function RequireRole({ role }) {
  const { account } = useAuth();
  if (!account) return <Navigate replace to={role === "admin" ? "/admin/login" : "/login"} />;
  // Missing roles never pass. PHP also checks permissions on every request.
  if (account.role !== role) {
    return <Navigate replace to={account.role === "admin" ? "/admin" : "/dashboard"} />;
  }
  return <Outlet />;
}
