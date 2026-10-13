import { expect, it } from "vitest";
import { ledgerTotals } from "../src/lib/ledger-totals";
it("calculates monthly income, expenses, and planning limits", () => {
  const totals = ledgerTotals(
    [
      { date: "2026-10-02", amount: -2150, archived: true },
      { date: "2026-10-03", amount: 500 },
      { date: "2026-09-01", amount: 9000 },
    ],
    [
      { period: "monthly", startDate: "2026-10-01", limit: 2000, spent: 2150 },
      { period: "monthly", startDate: "2026-09-01", limit: 7000, spent: 1000 },
    ],
    "2026-10-11",
  );
  expect(totals).toMatchObject({
    income: 500,
    expenses: 2150,
    budgeted: 2000,
    spent: 2150,
    remaining: -150,
  });
});
