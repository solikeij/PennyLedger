export function budgetStatus(budget) {
  const spent = Math.round(Number(budget.spent) * 100);
  const limit = Math.round(Number(budget.limit) * 100);
  return {
    over: spent > limit,
    exceeded: Math.max(0, spent - limit) / 100,
    remaining: (limit - spent) / 100,
    percent: limit > 0 ? (spent / limit) * 100 : 0,
    label:
      spent > limit
        ? "Over budget"
        : spent === limit
          ? "Fully used"
          : spent >= limit * 0.8
            ? "Near limit"
            : "On track",
  };
}
