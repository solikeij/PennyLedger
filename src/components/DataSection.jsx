import { useApp } from "../state/AppContext";

const labels = {
  analyticsTransactions: "financial totals",
  transactions: "transactions",
  activities: "activity history",
  budgets: "budgets",
  goals: "goals",
  wallets: "wallets",
  profile: "profile",
  reports: "reports",
};
export default function DataSection({ sections, children }) {
  const { sectionState, refreshSection } = useApp();
  if (!sectionState) return children;
  const unavailable = sections.filter((key) => !sectionState[key]?.loaded);
  const errors = sections.filter((key) => sectionState[key]?.error);
  return (
    <>
      {errors.map((key) => (
        <div className="data-notice" role="alert" key={key}>
          <p>
            {sectionState[key].loaded
              ? `Saved data is shown; ${labels[key]} could not be refreshed.`
              : `${labels[key]} are unavailable.`}{" "}
            {sectionState[key].error}
          </p>
          <button
            className="btn btn-outline btn-sm"
            disabled={sectionState[key].loading}
            onClick={() => refreshSection(key)}
          >
            Retry {labels[key]}
          </button>
        </div>
      ))}
      {unavailable.length
        ? !errors.length && (
            <p role="status">
              Loading {unavailable.map((key) => labels[key]).join(", ")}…
            </p>
          )
        : children}
    </>
  );
}
