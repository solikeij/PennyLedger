import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

export const ACCOUNTS_KEY = "pennyledger_accounts_v1";
export const SESSION_KEY = "pennyledger_session_v1";
export const demoAccounts = [
  {
    id: "admin-demo",
    name: "Morgan Admin",
    email: "admin@pennyledger.demo",
    role: "admin",
    password: "Admin123!",
  },
  {
    id: "alex-demo",
    name: "Alex Rivera",
    email: "alex@email.com",
    role: "user",
    password: "User123!",
  },
  {
    id: "jamie-demo",
    name: "Jamie Santos",
    email: "jamie@pennyledger.demo",
    role: "user",
    password: "User123!",
  },
];
const initial = {
  users: demoAccounts.map(({ password, ...account }) => ({
    ...account,
    status: "active",
    created: "2026-09-23",
    lastLogin: null,
  })),
  activity: [],
  registrationOpen: true,
};
function read(storage, key, fallback) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
async function credential(password, salt = crypto.randomUUID()) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return {
    salt,
    hash: Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [store, setStore] = useState(() => {
    const saved = read(localStorage, ACCOUNTS_KEY, initial);
    return Array.isArray(saved.users) && Array.isArray(saved.activity)
      ? saved
      : initial;
  });
  const [session, setSession] = useState(() =>
    read(sessionStorage, SESSION_KEY, null),
  );
  const account =
    store.users.find(
      (user) => user.id === session && user.status === "active",
    ) || null;
  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(store));
    } catch {}
  }, [store]);
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}
  }, [session]);
  useEffect(() => {
    const sync = (event) => {
      if (event.key === ACCOUNTS_KEY && event.newValue) {
        const next = read(localStorage, ACCOUNTS_KEY, initial);
        if (Array.isArray(next.users) && Array.isArray(next.activity))
          setStore(next);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (session && !account) setSession(null);
  }, [session, account]);
  const log = (action, subject, actor = account?.email || "Guest") => ({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action,
    subject,
    actor,
  });
  async function login(email, password, role) {
    const user = store.users.find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
    );
    const valid = user?.credential
      ? (await credential(password, user.credential.salt)).hash ===
        user.credential.hash
      : demoAccounts.some(
          (item) => item.id === user?.id && item.password === password,
        );
    if (!valid || user?.role !== role)
      throw new Error(
        "Email or password is incorrect for this sign-in portal.",
      );
    if (user.status !== "active")
      throw new Error("This account is suspended. Contact your administrator.");
    const entry = log("Signed in", user.email, user.email);
    setStore((current) => ({
      ...current,
      users: current.users.map((item) =>
        item.id === user.id ? { ...item, lastLogin: entry.at } : item,
      ),
      activity: [entry, ...current.activity].slice(0, 200),
    }));
    setSession(user.id);
  }
  async function createUser({ name, email, password }, signup = false) {
    if (signup ? !store.registrationOpen : account?.role !== "admin")
      throw new Error("Account registration is unavailable.");
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a name and valid email.");
    if (password.length < 8)
      throw new Error("Password should be at least 8 characters.");
    if (store.users.some((user) => user.email.toLowerCase() === email))
      throw new Error("An account with this email already exists.");
    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      role: "user",
      status: "active",
      created: new Date().toISOString(),
      lastLogin: null,
      credential: await credential(password),
    };
    const entry = log(signup ? "Registered" : "Created user", email);
    setStore((current) => ({
      ...current,
      users: [...current.users, user],
      activity: [entry, ...current.activity].slice(0, 200),
    }));
    if (signup) setSession(user.id);
  }
  async function updateUser(id, changes) {
    if (account?.role !== "admin")
      throw new Error("Administrator access required.");
    const target = store.users.find(
      (user) => user.id === id && user.role === "user",
    );
    if (!target) throw new Error("Only user accounts can be managed here.");
    const next = { ...target };
    if (changes.name !== undefined) {
      next.name = changes.name.trim();
      next.email = changes.email.trim().toLowerCase();
      if (!next.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))
        throw new Error("Enter a name and valid email.");
      if (
        store.users.some(
          (user) => user.id !== id && user.email.toLowerCase() === next.email,
        )
      )
        throw new Error("An account with this email already exists.");
    }
    if (changes.status)
      next.status = changes.status === "active" ? "active" : "suspended";
    if (changes.password) {
      if (changes.password.length < 8)
        throw new Error("Password should be at least 8 characters.");
      next.credential = await credential(changes.password);
    }
    const entry = log(
      changes.password
        ? "Reset password"
        : changes.status
          ? `Account ${next.status}`
          : "Updated user",
      next.email,
    );
    setStore((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === id ? next : user)),
      activity: [entry, ...current.activity].slice(0, 200),
    }));
  }
  function updateIdentity(name, email) {
    if (!account) throw new Error("Please sign in.");
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a name and valid email.");
    if (
      store.users.some(
        (user) => user.id !== account.id && user.email.toLowerCase() === email,
      )
    )
      throw new Error("An account with this email already exists.");
    const entry = log("Updated profile", email);
    setStore((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === account.id ? { ...user, name, email } : user,
      ),
      activity: [entry, ...current.activity].slice(0, 200),
    }));
  }
  function setRegistrationOpen(value) {
    if (account?.role !== "admin") return;
    const entry = log(
      value ? "Opened registration" : "Closed registration",
      "Application",
    );
    setStore((current) => ({
      ...current,
      registrationOpen: value,
      activity: [entry, ...current.activity].slice(0, 200),
    }));
  }
  return (
    <AuthContext.Provider
      value={{
        account,
        users: store.users,
        activity: store.activity,
        registrationOpen: store.registrationOpen,
        login,
        logout: () => setSession(null),
        createUser,
        updateUser,
        updateIdentity,
        setRegistrationOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function RequireRole({ role }) {
  const { account } = useAuth();
  if (!account)
    return (
      <Navigate replace to={role === "admin" ? "/admin/login" : "/login"} />
    );
  if (account.role !== role)
    return (
      <Navigate
        replace
        to={account.role === "admin" ? "/admin" : "/dashboard"}
      />
    );
  return <Outlet />;
}
