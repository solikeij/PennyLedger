import { usePagedResource } from "../lib/use-paged-resource";
import PagedList from "../components/PagedList";
import { Link } from "react-router-dom";
import { useApp } from "../state/AppContext";
import { PageTitle } from "../components/UI";
import { TransactionTable } from "./Transactions";
import { ReportTable } from "./Reports";
import { isArchived } from "../lib/report-archive";

export default function Archive() {
  const { transactions, reports } = useApp();
  const archivedTransactions = transactions
    .filter((tx) => tx.archived)
    .sort((a, b) => a.description.localeCompare(b.description));
  const archivedReports = reports
    .filter((report) => isArchived(report.archived))
    .sort((a, b) => a.name.localeCompare(b.name));
  const txList = usePagedResource(
    "/transactions",
    { archived: "true" },
    archivedTransactions,
  );
  const reportList = usePagedResource(
    "/report-logs",
    { archived: "true" },
    archivedReports,
  );
  return (
    <>
      <PageTitle
        title="Archive"
        description="Restore transactions and reports you've archived"
      >
        <Link to="/settings" className="btn btn-outline btn-sm">
          Back to Settings
        </Link>
      </PageTitle>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h2>Archived Transactions</h2>
          <span className="muted-tag">
            {txList.loading || txList.error ? "?" : txList.total} archived
            transactions
          </span>
        </div>
        <PagedList list={txList}>
          <TransactionTable records={txList.items} restoreOnly />
        </PagedList>
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Archived Reports</h2>
          <span className="muted-tag">
            {reportList.loading || reportList.error ? "?" : reportList.total}{" "}
            archived reports
          </span>
        </div>
        <PagedList list={reportList}>
          <ReportTable records={reportList.items} />
        </PagedList>
      </section>
    </>
  );
}
