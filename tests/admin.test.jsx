import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { ACCOUNTS_KEY, SESSION_KEY } from "../src/state/AuthContext";
import { STORAGE_KEY } from "../src/state/AppContext";

function open(path, id) {
  if (id) sessionStorage.setItem(SESSION_KEY, JSON.stringify(id));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
async function signIn(user, email, password) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password", { exact: true }), password);
  await user.click(screen.getByRole("button", { name: "Login", exact: true }));
}
describe("role-separated accounts", () => {
  it("guards private routes and prevents users from opening admin routes", () => {
    const app = open("/admin/users");
    expect(
      screen.getByRole("heading", { name: "Admin Sign In" }),
    ).toBeInTheDocument();
    app.unmount();
    open("/admin/users", "alex-demo");
    expect(
      screen.getByRole("heading", { name: "Good afternoon, Alex" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Manage Users")).not.toBeInTheDocument();
  });
  it("rejects incorrect credentials and the wrong portal, then signs an admin in and out", async () => {
    const user = userEvent.setup();
    open("/admin/login");
    await signIn(user, "alex@email.com", "User123!");
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    await user.clear(screen.getByLabelText("Email"));
    await user.clear(screen.getByLabelText("Password", { exact: true }));
    await signIn(user, "admin@pennyledger.demo", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect");
    await user.clear(screen.getByLabelText("Password", { exact: true }));
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "Admin123!",
    );
    await user.click(
      screen.getByRole("button", { name: "Login", exact: true }),
    );
    expect(
      await screen.findByRole("heading", { name: "Admin Overview" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    expect(
      await screen.findByRole("heading", { name: "Admin Sign In" }),
    ).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY))).toBeNull();
  });
  it("creates, edits, resets, suspends and restores users with persistent activity", async () => {
    const user = userEvent.setup();
    const app = open("/admin/users", "admin-demo");
    await user.click(screen.getByRole("button", { name: "Create User" }));
    let dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Full name"), "Taylor Demo");
    await user.type(dialog.getByLabelText("Email"), "alex@email.com");
    await user.type(dialog.getByLabelText("Temporary password"), "Taylor123!");
    await user.click(dialog.getByRole("button", { name: "Create User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "already exists",
    );
    await user.clear(dialog.getByLabelText("Email"));
    await user.type(dialog.getByLabelText("Email"), "taylor@example.com");
    await user.click(dialog.getByRole("button", { name: "Create User" }));
    expect(await screen.findByText("Taylor Demo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Taylor Demo" }));
    dialog = within(screen.getByRole("dialog"));
    await user.clear(dialog.getByLabelText("Full name"));
    await user.type(dialog.getByLabelText("Full name"), "Taylor Updated");
    await user.type(
      dialog.getByLabelText("New password (optional)"),
      "Changed123!",
    );
    await user.click(dialog.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Taylor Updated")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Suspend Taylor Updated" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("suspended")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(screen.getByRole("link", { name: "User sign in" }));
    await signIn(user, "taylor@example.com", "Changed123!");
    expect(await screen.findByRole("alert")).toHaveTextContent("suspended");
    app.unmount();
    const admin = open("/admin/users", "admin-demo");
    await user.click(
      screen.getByRole("button", { name: "Restore Taylor Updated" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(screen.getByRole("link", { name: "User sign in" }));
    await signIn(user, "taylor@example.com", "Changed123!");
    expect(
      await screen.findByRole("heading", { name: "Good afternoon, Taylor" }),
    ).toBeInTheDocument();
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    expect(saved).toContain("Reset password");
    expect(saved).not.toContain("Changed123!");
    admin.unmount();
  });
  it("isolates ledgers and retains each account's data across sign-in changes", async () => {
    const user = userEvent.setup();
    const app = open("/transactions", "alex-demo");
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(
      dialog.getByLabelText("Description"),
      "Alex private purchase",
    );
    await user.type(dialog.getByLabelText("Amount (USD)"), "12");
    await user.click(dialog.getByRole("button", { name: "Add Transaction" }));
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await signIn(user, "jamie@pennyledger.demo", "User123!");
    expect(
      await screen.findByRole("heading", { name: "Good afternoon, Jamie" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Alex private purchase")).not.toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(`${STORAGE_KEY}_jamie-demo`))
        .transactions,
    ).toEqual([]);
    app.unmount();
    open("/transactions", "alex-demo");
    expect(screen.getByText("Alex private purchase")).toBeInTheDocument();
  });
  it("persists the registration switch and blocks signup when closed", async () => {
    const user = userEvent.setup();
    open("/admin/settings", "admin-demo");
    await user.click(
      screen.getByRole("checkbox", { name: "Allow new user registrations" }),
    );
    await user.click(screen.getByRole("button", { name: "Log out" }));
    await user.click(screen.getByRole("link", { name: "User sign in" }));
    await user.click(screen.getByRole("link", { name: "Create an account" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Registration is currently closed",
    );
    expect(
      screen.queryByRole("button", { name: "Sign Up" }),
    ).not.toBeInTheDocument();
  });
});
