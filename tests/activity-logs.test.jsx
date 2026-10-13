import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import ActivityLogs from "../src/pages/ActivityLogs";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../src/lib/api", () => ({ api: mocks.api }));
vi.mock("../src/state/AppContext", () => ({
  useApp: () => ({ date: (value) => value, serverPagination: true }),
}));
it("displays complete activity records and requests server filters and pages", async () => {
  mocks.api.mockImplementation(async (path) => {
    const query = new URL("http://fixture" + path).searchParams;
    const page = Number(query.get("page"));
    return {
      items:
        query.get("q") === "absent"
          ? []
          : [
              {
                id: page,
                action: "CREATE",
                description: `Wallet added page ${page}`,
                relatedItem: "wallets #3: Cash",
                date: "2026-10-12T12:00:00",
              },
            ],
      total: query.get("q") === "absent" ? 0 : 26,
      page,
      perPage: 25,
    };
  });
  render(
    <MemoryRouter>
      <ActivityLogs />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Wallet added page 1")).toBeInTheDocument();
  expect(screen.getByText("wallets #3: Cash")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Wallet added page 2")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Action type"), {
    target: { value: "CREATE" },
  });
  expect(await screen.findByText("Wallet added page 1")).toBeInTheDocument();
  expect(mocks.api.mock.calls.at(-1)[0]).toContain("action=CREATE");
  fireEvent.change(screen.getByLabelText("Search activity"), {
    target: { value: "absent" },
  });
  expect(await screen.findByText("No activity found")).toBeInTheDocument();
});
