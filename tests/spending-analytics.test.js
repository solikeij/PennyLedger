import { expect, it } from "vitest";
import { spendingAnalytics, shiftMonth } from "../src/lib/spending-analytics";

it("estimates from completed months, counts archived expenses, and ignores future records", () => {
  const analysis = spendingAnalytics([
    { date: "2026-08-01", amount: -100, category: "Food", archived: true },
    { date: "2026-09-01", amount: -300, category: "Food" },
    { date: "2026-09-02", amount: 500 },
    { date: "2026-10-05", amount: -100, category: "Food" },
    { date: "2026-10-20", amount: -900 },
    { date: "2026-11-01", amount: -1000 },
  ], [{ period: "monthly", startDate: "2026-10-01", isMonthlyPlan: true, limit: 250 }], "2026-10-10");
  expect(analysis).toMatchObject({ averageExpense: 200, suggestedLimit: 220, nextMonth: "2026-11", projectedExpense: 310 });
  expect(analysis.adjustments).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "pace", amount: 60 }), expect.objectContaining({ kind: "category", name: "Food" })]));
  expect(analysis.previous).toMatchObject({ month: "2026-09", income: 500, expense: 300 });
});
it("does not invent an estimate without historical expenses and handles year boundaries", () => {
  expect(spendingAnalytics([], [], "2026-10-11").suggestedLimit).toBeNull();
  expect(spendingAnalytics([{ date: "2026-09-01", amount: 100 }], [], "2026-10-11").suggestedLimit).toBeNull();
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
});
