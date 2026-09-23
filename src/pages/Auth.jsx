import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth, demoAccounts } from "../state/AuthContext";
import { Field, Logo, PasswordField, ThemeSwitch } from "../components/UI";

export default function Auth({ signup = false, admin = false }) {
  const { account, login, createUser, registrationOpen } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (account)
    return (
      <Navigate
        replace
        to={account.role === "admin" ? "/admin" : "/dashboard"}
      />
    );
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    if (signup && password !== form.get("verify-password"))
      return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    try {
      if (signup)
        await createUser(
          { name: form.get("name"), email: form.get("email"), password },
          true,
        );
      else await login(form.get("email"), password, admin ? "admin" : "user");
      navigate(admin ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="auth-header">
        <Logo />
        <div className="auth-header-actions">
          <ThemeSwitch />
          <Link to="/" className="btn btn-outline btn-sm">
            Home
          </Link>
        </div>
      </header>
      <main className="auth-wrap">
        <div className="auth-copy">
          <h1>
            {admin
              ? "Administration"
              : signup
                ? "Manage your Money Securely with trust."
                : "Welcome Back!"}
          </h1>
          <p>
            {admin
              ? "Manage user accounts, review account activity, and control registration from your admin workspace."
              : "Track your transactions, budgets, and savings goals in your own account."}
          </p>
          {!signup && (
            <section className="demo-accounts" aria-label="Dummy accounts">
              <h2>Try a dummy account</h2>
              {demoAccounts
                .filter((user) => user.role === (admin ? "admin" : "user"))
                .map((user) => (
                  <div key={user.id}>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <code>{user.password}</code>
                  </div>
                ))}
            </section>
          )}
        </div>
        <div className="auth-card">
          <h2>
            {admin ? "Admin Sign In" : signup ? "Create Account" : "Login"}
          </h2>
          <p>
            {admin
              ? "Administrator accounts only"
              : "Your personal finance workspace"}
          </p>
          {signup && !registrationOpen ? (
            <p role="alert">
              Registration is currently closed. Please contact an administrator.
            </p>
          ) : (
            <form onSubmit={submit}>
              {signup && (
                <Field
                  label="Name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                />
              )}
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
              <PasswordField
                autoComplete={signup ? "new-password" : "current-password"}
                required
              />
              {signup && (
                <>
                  <PasswordField
                    label="Verify Password"
                    name="verify-password"
                    autoComplete="new-password"
                    required
                  />
                  <label className="check-row">
                    <input type="checkbox" required />
                    <span>I understand this is a local demo.</span>
                  </label>
                </>
              )}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-dark" disabled={busy}>
                {busy ? "Please wait…" : signup ? "Sign Up" : "Login"}
              </button>
            </form>
          )}
          <p className="auth-foot">
            {admin ? (
              <Link to="/login">User sign in</Link>
            ) : (
              <>
                <Link to={signup ? "/login" : "/signup"}>
                  {signup ? "Already registered? Sign in" : "Create an account"}
                </Link>{" "}
                · <Link to="/admin/login">Admin sign in</Link>
              </>
            )}
          </p>
          <p className="demo-note">
            Local demo only. Use dummy information and a password you do not use
            elsewhere. Accounts are stored in this browser.
          </p>
        </div>
      </main>
    </>
  );
}
