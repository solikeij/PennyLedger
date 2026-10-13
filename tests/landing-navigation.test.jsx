import { afterEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HashRouter, Route, Routes } from "react-router-dom";
import Home from "../src/pages/Home";
import Auth from "../src/pages/Auth";

vi.mock("../src/state/AuthContext", () => ({ useAuth: () => ({ account: null, registrationOpen: true }) }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => ({ theme: "light", setTheme: vi.fn() }) }));
afterEach(() => { window.location.hash = ""; });
function mount(hash) {
  window.location.hash = hash;
  render(<HashRouter><Routes><Route path="/" element={<Home />} /><Route path="/login" element={<Auth />} /></Routes></HashRouter>);
}
it("navigates to landing sections without leaving the home route", () => {
  mount("#/");
  fireEvent.click(screen.getAllByRole("link", { name: "Features" })[0]);
  expect(window.location.hash).toBe("#/#features");
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("link", { name: "Security" })[0]);
  expect(window.location.hash).toBe("#/#security");
  expect(screen.getByRole("heading", { name: /Manage your money securely/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Home" }));
  expect(window.location.hash).toBe("#/#top");
});
it("shows dummy credentials beneath the intro while keeping the login form visible", () => {
  mount("#/login");
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "draft@example.com" } });
  expect(screen.getByRole("region", { name: "Dummy Accounts" })).toHaveTextContent("admin@example.com");
  expect(screen.getByRole("region", { name: "Dummy Accounts" })).toHaveTextContent("DemoUser123!");
  expect(screen.getByRole("region", { name: "Dummy Accounts" })).toHaveTextContent("Sample credentials only");
  expect(screen.getByLabelText("Email")).toHaveValue("draft@example.com");
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Features" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Security" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Login" })).toHaveClass("auth-submit");
});
