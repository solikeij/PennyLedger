// Display list loading, errors, and pagination controls around its content.
export default function PagedList({ list, children }) {
  if (list.loading) return <p role="status">Loading records…</p>;
  if (list.error)
    return (
      <div role="alert" className="data-notice">
        <p>Records are unavailable. {list.error}</p>
        <button className="btn btn-outline btn-sm" onClick={list.retry}>
          Retry records
        </button>
      </div>
    );
  const pages = Math.max(1, Math.ceil(list.total / list.perPage));
  return (
    <>
      {children}
      <nav className="pagination" aria-label="List pages">
        <button
          className="btn btn-outline btn-sm"
          disabled={list.page <= 1}
          onClick={() => list.setPage(list.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {list.page} of {pages} · {list.total} records
        </span>
        <button
          className="btn btn-outline btn-sm"
          disabled={list.page >= pages}
          onClick={() => list.setPage(list.page + 1)}
        >
          Next
        </button>
      </nav>
    </>
  );
}
