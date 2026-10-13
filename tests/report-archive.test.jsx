vi.mock("../src/components/BudgetPerformance", () => ({ default: () => null }));
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import Reports from "../src/pages/Reports";
import { isArchived } from "../src/lib/report-archive";

const mocks = vi.hoisted(() => ({ app: {}, save: vi.fn() }));
vi.mock("../src/state/AppContext", () => ({ useApp: () => mocks.app }));
// Provide the component and shared state needed for this integration test.
function Harness() {
  const [reports, setReports] = useState([
    {
      id: 4,
      name: "October report",
      type: "income-expense",
      range: "2026-10",
      period: "October 2026",
      generated: "2026-10-11",
      archived: "0",
    },
  ]);
  mocks.app = {
    transactions: [],
    budgets: [],
    goals: [],
    reports,
    money: String,
    date: String,
    notify: vi.fn(),
    archiveReport: async (id, archived) => {
      await mocks.save(id, archived);
      setReports((old) =>
        old.map((report) => ({ ...report, archived: !archived })),
      );
    },
  };
  return <Reports />;
}
it("moves a report between active and archived views and restores it", async () => {
  mocks.save.mockResolvedValue(null);
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Archive October report" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("October report")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: /Archived/ }));
  fireEvent.click(
    screen.getByRole("button", { name: "Restore October report" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("October report")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Active" }));
  expect(screen.getByText("October report")).toBeInTheDocument();
  expect(mocks.save).toHaveBeenCalledWith(4, true);
});
it("keeps reports visible and exposes archive failures", async () => {
  mocks.save.mockRejectedValue(new Error("Archive could not be saved"));
  render(<Harness />);
  fireEvent.click(
    screen.getByRole("button", { name: "Archive October report" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Archive could not be saved",
  );
  expect(screen.getByText("October report")).toBeInTheDocument();
  expect(isArchived("0")).toBe(false);
  expect(isArchived("1")).toBe(true);
});
