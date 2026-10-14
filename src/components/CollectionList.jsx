import { useState } from "react";

// Browse large card collections without changing the complete data used for totals.
export default function CollectionList({
  items,
  label,
  searchText,
  sortOptions,
  filterOptions = [],
  getMonth,
  showPageSize = true,
  className,
  emptyText,
  children,
}) {
  const defaults = {
    search: "",
    filter: "",
    month: "",
    sort: sortOptions[0].value,
    page: 1,
    size: 6,
  };
  const [view, setView] = useState(defaults);
  const filter = filterOptions.find((option) => option.value === view.filter);
  const matches = items
    .filter(
      (item) =>
        searchText(item)
          .toLowerCase()
          .includes(view.search.trim().toLowerCase()) &&
        (!filter || filter.matches(item)) &&
        (!view.month || getMonth?.(item) === view.month),
    )
    .sort(sortOptions.find((option) => option.value === view.sort).compare);
  const pages = Math.max(1, Math.ceil(matches.length / view.size));
  const page = Math.min(view.page, pages);
  const start = (page - 1) * view.size;
  // Start at the first page whenever a search, filter, or page size changes.
  const change = (values) => setView((old) => ({ ...old, ...values, page: 1 }));

  return (
    <section className="collection-browser" aria-label={`${label} browser`}>
      <div className="collection-toolbar">
        <label className="field collection-search">
          Search {label}
          <input
            type="search"
            value={view.search}
            placeholder={`Search ${label}`}
            onChange={(event) => change({ search: event.target.value })}
          />
        </label>
        {getMonth && (
          <label className="field">
            Budget month
            <input
              type="month"
              value={view.month}
              onChange={(event) => change({ month: event.target.value })}
            />
          </label>
        )}
        {filterOptions.length > 0 && (
          <label className="field">
            Filter {label}
            <select
              value={view.filter}
              onChange={(event) => change({ filter: event.target.value })}
            >
              <option value="">All</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          Sort {label}
          <select
            value={view.sort}
            onChange={(event) => change({ sort: event.target.value })}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {showPageSize && (
          <label className="field">
            {label} per page
            <select
              value={view.size}
              onChange={(event) => change({ size: Number(event.target.value) })}
            >
              {[6, 12, 24].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setView(defaults)}
        >
          Reset filters
        </button>
      </div>
      <p className="report-caption" role="status">
        Showing {matches.length ? start + 1 : 0}–
        {Math.min(start + view.size, matches.length)} of {matches.length}{" "}
        {label}
        {matches.length !== items.length ? ` (${items.length} total)` : ""}
      </p>
      <div className={className}>
        {!matches.length && (
          <p className="report-caption">
            {items.length
              ? `No ${label} match these filters. Try another search or reset the filters.`
              : emptyText}
          </p>
        )}
        {matches.slice(start, start + view.size).map(children)}
      </div>
      {matches.length > 0 && (
        <nav className="pagination" aria-label={`${label} pages`}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page === 1}
            onClick={() => setView((old) => ({ ...old, page: page - 1 }))}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={page === pages}
            onClick={() => setView((old) => ({ ...old, page: page + 1 }))}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
