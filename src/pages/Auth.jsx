import ErrorForm from "../components/ErrorForm";
import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Field, Logo, PasswordField, ThemeSwitch } from "../components/UI";

export default function Auth({ signup = false, admin = false }) {
  const { account, login, register, verifyOtp, resendOtp, registrationOpen } =
    useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [notice, setNotice] = useState("");
  const [otp, setOtp] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "dark",
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.dataset.theme === "dark");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

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
    if (signup && String(password).length < 8)
      return setError("Password must be at least 8 characters.");
    if (signup && password !== form.get("verify-password"))
      return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    try {
      if (signup) {
        // Registration creates an unverified account. The user must enter the
        // emailed code before login is allowed by PHP.
        const result = await register({
          firstName: form.get("first_name").trim(),
          lastName: form.get("last_name").trim(),
          email: form.get("email"),
          password,
        });
        setVerificationEmail(form.get("email"));
        if (result.emailSent)
          setNotice("Verification code sent. Check your email.");
        else
          setError(
            "Account created, but email could not be sent. Check mail settings, then use Resend code.",
          );
        return;
      }
      await login(form.get("email"), password, admin ? "admin" : "user");
      navigate(admin ? "/admin" : "/dashboard", { replace: true });
    } catch (error) {
      setError(error);
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
                ? "Build a money plan that fits your life."
                : "Your next money milestone starts here."}
          </h1>
          <p>
            {admin
              ? "Manage user accounts, review account activity, and control registration from your admin workspace."
              : "Organize your wallets, track everyday spending, and make steady progress toward your savings goals."}
          </p>
          {!admin && (
            <p className="auth-copy-note">
              Record your transactions. Review your plan whenever you need a
              clearer picture.
            </p>
          )}
          <section className="auth-dummy-box" aria-label="Dummy Accounts">
            <h2>Dummy Accounts</h2>
            <p>Credentials for your project demonstration.</p>
            <article className="dummy-account">
              <h3>Administrator</h3>
              <dl>
                <dt>Email</dt>
                <dd>
                  <code>admin@example.com</code>
                </dd>
                <dt>Password</dt>
                <dd>
                  <code>admin123</code>
                </dd>
              </dl>
              <p>Included in the fresh-install SQL for local demonstrations.</p>
              <Link className="btn btn-outline btn-sm" to="/admin/login">
                Admin sign in
              </Link>
            </article>
            <article className="dummy-account">
              <h3>User · Sample</h3>
              <dl>
                <dt>Email</dt>
                <dd>
                  <code>demo.user@example.com</code>
                </dd>
                <dt>Password</dt>
                <dd>
                  <code>DemoUser123!</code>
                </dd>
              </dl>
              <p>
                Included in the fresh-install SQL as a verified demo user.
              </p>
            </article>
          </section>
        </div>
        <div
          className="auth-card"
          style={
            isDarkMode
              ? {
                  backgroundColor: "#203a31",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }
              : {}
          }
        >
          <div className="auth-form-content">
            <h2>
              {admin
                ? "Admin Sign In"
                : signup
                  ? "Create Account"
                  : showResend
                    ? "Resend Code"
                    : "Login"}
            </h2>
            <p>
              {admin
                ? "Administrator accounts only"
                : showResend
                  ? "Get a new verification code sent to your inbox"
                  : "Your personal finance workspace"}
            </p>
            {notice && (
              <p role="status" className="report-caption">
                {notice}
              </p>
            )}
            {verificationEmail ? (
              <ErrorForm
                failure={error}
                key="verification"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    await verifyOtp(verificationEmail, otp);
                    navigate("/login", { replace: true });
                  } catch (failure) {
                    setError(failure);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <p>Enter the six-digit code sent to {verificationEmail}.</p>
                <Field
                  label="Verification code"
                  name="otp"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                />
                {error && (
                  <p
                    className="auth-error"
                    role="alert"
                    style={{
                      padding: "10px 14px",
                      marginBottom: "12px",
                      borderRadius: "6px",
                    }}
                  >
                    {error.message || error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn auth-submit auth-verify"
                  disabled={busy}
                >
                  Verify email
                </button>
                <button
                  type="button"
                  className="btn btn-outline auth-resend"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    setNotice("");
                    try {
                      await resendOtp(verificationEmail);
                      setNotice(
                        "New verification code sent. Check your email.",
                      );
                    } catch (failure) {
                      setError(failure);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resend code
                </button>
              </ErrorForm>
            ) : showResend ? (
              <ErrorForm
                failure={error}
                key="resend"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const email = new FormData(event.currentTarget).get("email");
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    await resendOtp(email);
                    setVerificationEmail(email);
                    setNotice("New verification code sent. Check your email.");
                  } catch (failure) {
                    setError(failure);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <p
                  style={{
                    textAlign: "center",
                    marginTop: "8px",
                    marginBottom: "8px",
                  }}
                >
                  Enter the email for your unverified account.
                </p>
                <Field
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
                {error && (
                  <p
                    className="auth-error"
                    role="alert"
                    style={{
                      padding: "10px 14px",
                      marginBottom: "12px",
                      borderRadius: "6px",
                    }}
                  >
                    {error.message || error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn auth-submit"
                  disabled={busy}
                  style={{ marginBottom: "10px" }}
                >
                  Send new code
                </button>
                <button
                  type="button"
                  className="btn btn-outline auth-resend"
                  onClick={() => {
                    setShowResend(false);
                    setError("");
                  }}
                >
                  Back
                </button>
              </ErrorForm>
            ) : signup && !registrationOpen ? (
              <p role="alert">
                Registration is currently closed. Please contact an
                administrator.
              </p>
            ) : (
              <ErrorForm failure={error} key="account" onSubmit={submit}>
                {signup && (
                  <>
                    <Field
                      label="First name"
                      name="first_name"
                      autoComplete="given-name"
                      required
                      maxLength={100}
                    />
                    <Field
                      label="Last name"
                      name="last_name"
                      autoComplete="family-name"
                      required
                      maxLength={100}
                    />
                  </>
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
                      <span>I agree to create an account.</span>
                    </label>
                  </>
                )}
                {error && (
                  <p
                    className="auth-error"
                    role="alert"
                    style={{
                      padding: "10px 14px",
                      marginBottom: "12px",
                      borderRadius: "6px",
                    }}
                  >
                    {error.message || error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn auth-submit"
                  disabled={busy}
                >
                  {busy ? "Please wait…" : signup ? "Sign Up" : "Login"}
                </button>
              </ErrorForm>
            )}
            <p className="auth-foot">
              {admin ? (
                <Link to="/login">User sign in</Link>
              ) : (
                <>
                  <Link to={signup ? "/login" : "/signup"}>
                    {signup
                      ? "Already registered? Sign in"
                      : "Create an account"}
                  </Link>{" "}
                  · <Link to="/admin/login">Admin sign in</Link>
                </>
              )}
            </p>
            {!admin && !verificationEmail && !showResend && (
              <p className="auth-foot">
                <button
                  type="button"
                  className="btn btn-outline btn-sm auth-resend"
                  onClick={() => {
                    setShowResend(true);
                    setError("");
                  }}
                >
                  Resend verification code
                </button>
              </p>
            )}
            <p className="demo-note">
              Accounts are stored on the PennyLedger server.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
