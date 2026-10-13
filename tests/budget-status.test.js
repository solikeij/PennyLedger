import { expect, it } from "vitest";
import { budgetStatus } from "../src/lib/budget-status";

it("shows an uncapped over-budget percentage and the actual excess", () => {
  expect(budgetStatus({ limit: 2000, spent: 2150 })).toEqual({
    over: true,
    exceeded: 150,
    remaining: -150,
    percent: 107.5,
    label: "Over budget",
  });
});

it("distinguishes the 80%, 100%, and over-budget thresholds", () => {
  expect(budgetStatus({ limit: 2000, spent: 1599 }).label).toBe("On track");
  expect(budgetStatus({ limit: 2000, spent: 1600 }).label).toBe("Near limit");
  expect(budgetStatus({ limit: 2000, spent: 2000 }).label).toBe("Fully used");
  expect(budgetStatus({ limit: 2000, spent: 2000.01 }).label).toBe(
    "Over budget",
  );
});
