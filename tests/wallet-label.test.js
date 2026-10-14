import { expect, it } from "vitest";
import { walletLabel } from "../src/lib/wallet-label";

it("uses expense types to distinguish duplicate names regardless of case or surrounding spaces", () => {
  const wallets = [
    { id: 1, name: "GCash", expenseType: "Food" },
    { id: 2, name: " gcash ", expenseType: "Travel" },
    { id: 3, name: "Cash", expenseType: "Other" },
  ];
  expect(walletLabel(wallets[0], wallets)).toEqual({
    label: "GCash · Food",
    tag: "Food",
  });
  expect(walletLabel(wallets[1], wallets).tag).toBe("Travel");
  expect(walletLabel(wallets[2], wallets)).toEqual({ label: "Cash", tag: "" });
});

it("keeps same-name, same-type wallets distinct with stable IDs in cards and payment choices", () => {
  const wallets = [
    { id: 1, paymentMethodId: 11, name: "GCash", expenseType: "Food" },
    { id: 2, paymentMethodId: 12, name: "GCash", expenseType: "Food" },
  ];
  const methods = wallets.map((wallet) => ({
    ...wallet,
    id: wallet.paymentMethodId,
  }));
  expect(walletLabel(wallets[0], wallets).tag).toBe("Food #11");
  expect(walletLabel(wallets[1], wallets).tag).toBe("Food #12");
  expect(walletLabel(methods[0], methods).label).toBe(
    walletLabel(wallets[0], wallets).label,
  );
});
