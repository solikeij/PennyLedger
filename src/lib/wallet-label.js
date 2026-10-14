// Distinguish same-name wallets by expense type, then by ID if both labels match.
export function walletLabel(wallet, wallets) {
  const name = wallet.name.trim().toLowerCase();
  const duplicates = wallets.filter(
    (item) => item.name.trim().toLowerCase() === name,
  );
  if (duplicates.length < 2) return { label: wallet.name, tag: "" };
  const expenseType = wallet.expenseType || "Other";
  const sameType = duplicates.filter(
    (item) =>
      (item.expenseType || "Other").toLowerCase() === expenseType.toLowerCase(),
  );
  const tag =
    sameType.length > 1
      ? `${expenseType} #${wallet.paymentMethodId ?? wallet.id}`
      : expenseType;
  return { label: `${wallet.name} · ${tag}`, tag };
}
