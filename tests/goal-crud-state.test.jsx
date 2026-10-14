import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider, useApp } from "../src/state/AppContext";
import Goals from "../src/pages/Goals";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({ account: { id: 10, role: "user" } }),
}));
vi.mock("../src/lib/api", () => ({ api: mocks.api, assetUrl: () => null }));

// Observe the same goal data consumed by the dashboard and report builders.
function GoalCount() {
  const { goals } = useApp();
  return <p>{goals.length} shared goals</p>;
}

it("updates shared goal data only after deletion succeeds and refreshes activity", async () => {
  let completeDeletion;
  mocks.api.mockImplementation(async (path, options) => {
    if (path === "/profile") return { name: "Test", email: "test@example.com" };
    if (path === "/goals")
      return [
        {
          id: 4,
          name: "Emergency fund",
          target: 1000,
          saved: 100,
          date: "2026-12-31",
          statusId: 1,
        },
      ];
    if (path === "/goals/4" && options?.method === "DELETE")
      return new Promise((resolve) => {
        completeDeletion = resolve;
      });
    return [];
  });
  render(
    <MemoryRouter>
      <AppProvider>
        <Goals />
        <GoalCount />
      </AppProvider>
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete Emergency fund" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  expect(screen.getByText("1 shared goals")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  completeDeletion(null);
  await screen.findByText("0 shared goals");
  expect(
    screen.queryByRole("button", { name: "Delete Emergency fund" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(mocks.api).toHaveBeenCalledWith("/goals/4", { method: "DELETE" });
  expect(
    mocks.api.mock.calls.filter(([path]) => path === "/activity-logs"),
  ).toHaveLength(2);
});
