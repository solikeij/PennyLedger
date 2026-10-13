import { useEffect, useState } from "react";
import { api } from "./api";
import { useApp } from "../state/AppContext";

export function usePagedResource(path, filters, fallback = []) {
  const { dataVersion = 0, serverPagination = false } = useApp();
  const query = new URLSearchParams(filters).toString();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({
    items: [],
    total: 0,
    loading: true,
    error: "",
  });
  // Associate pages with their filters, so changing a filter immediately uses page one.
  const [pageQuery, setPageQuery] = useState(query);
  const selectedPage = pageQuery === query ? page : 1;
  const requestId = JSON.stringify([
    path,
    query,
    selectedPage,
    dataVersion,
    retry,
  ]);
  useEffect(() => {
    if (!serverPagination) return;
    const controller = new AbortController();
    setState((old) => ({ ...old, requestId, loading: true, error: "" }));
    api(`${path}?${query}&page=${selectedPage}&per_page=25`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ ...result, requestId, loading: false, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState((old) => ({
            ...old,
            loading: false,
            error: failure.message,
          }));
      });
    return () => controller.abort();
  }, [
    path,
    query,
    selectedPage,
    dataVersion,
    retry,
    serverPagination,
    requestId,
  ]);
  return {
    ...(serverPagination
      ? { ...state, loading: state.loading || state.requestId !== requestId }
      : { items: fallback, total: fallback.length, loading: false, error: "" }),
    page: serverPagination ? state.page || selectedPage : 1,
    perPage: 25,
    setPage: (value) => {
      setPageQuery(query);
      setPage(value);
    },
    retry: () => setRetry((value) => value + 1),
  };
}

export async function fetchAllPages(path) {
  const items = [];
  let page = 1,
    result;
  do {
    result = await api(`${path}?page=${page++}&per_page=100`);
    items.push(...result.items);
  } while (items.length < result.total);
  return items;
}
