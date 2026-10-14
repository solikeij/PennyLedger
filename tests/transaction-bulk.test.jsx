import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TransactionTable } from "../src/pages/Transactions";

const { bulk, notify } = vi.hoisted(() => ({ bulk: vi.fn(), notify: vi.fn() }));
vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({
    money: String,
    date: String,
    bulkTransactions: bulk,
    notify,
  }),
}));
const records = [
  {
    id: 1,
    description: "Lunch",
    category: "Food",
    amount: -100,
    date: "2026-10-01",
    archived: false,
  },
  {
    id: 2,
    description: "Bus",
    category: "Travel",
    amount: -50,
    date: "2026-10-01",
    archived: false,
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  bulk.mockResolvedValue(null);
});

it("selects rows and all visible rows, confirms deletion, and clears completed selection", async () => {
  render(<TransactionTable records={records} />);
  expect(
    screen.getByRole("button", { name: "Delete selected" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Select Lunch (transaction 1)"));
  expect(
    screen.getByLabelText("Select all transactions on this page"),
  ).toBePartiallyChecked();
  fireEvent.click(
    screen.getByLabelText("Select all transactions on this page"),
  );
  expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  expect(bulk).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("cannot be undone");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(bulk).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm deletion" }));
  await waitFor(() => expect(bulk).toHaveBeenCalledWith([1, 2], "delete"));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("status")).toHaveTextContent("0 selected");
});

it("archives only selected records and preserves the selection on failure", async () => {
  bulk.mockRejectedValueOnce(
    new Error("Some selected transactions are unavailable"),
  );
  render(<TransactionTable records={records} />);
  fireEvent.click(screen.getByLabelText("Select Bus (transaction 2)"));
  fireEvent.click(screen.getByRole("button", { name: "Archive selected" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
  expect(bulk).toHaveBeenCalledWith([2], "archive");
  expect(screen.getByLabelText("Select Bus (transaction 2)")).toBeChecked();
  expect(notify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));
  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith("1 transactions archived"),
  );
});

it("offers bulk restore in archived history and drops selections when rows leave the page", async () => {
  const archived = records.map((tx) => ({ ...tx, archived: true }));
  const view = render(<TransactionTable records={archived} restoreOnly />);
  fireEvent.click(
    screen.getByLabelText("Select all transactions on this page"),
  );
  view.rerender(<TransactionTable records={[archived[1]]} restoreOnly />);
  expect(screen.getByRole("status")).toHaveTextContent("1 selected");
  fireEvent.click(screen.getByRole("button", { name: "Restore selected" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
  await waitFor(() => expect(bulk).toHaveBeenCalledWith([2], "restore"));
});
