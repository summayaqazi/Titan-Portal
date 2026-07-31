import { useEffect, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

// Shared list-state manager for Super Admin CRUD pages: pagination, search,
// arbitrary filters, and a refetch trigger for use after create/update/delete.
export default function useCrudResource(listFn, { limit = 10, initialFilters = {} } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const refetch = () => setRefreshKey((k) => k + 1);

  // Call after a successful delete instead of refetch() - if the deleted row
  // was the last one on a page beyond the first, step back a page instead of
  // showing an empty table.
  const handleDeleted = () => {
    if (items.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      refetch();
    }
  };

  // Debounce the search box so fast typing doesn't fire a request per
  // keystroke (avoids request pile-ups and out-of-order responses).
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    listFn({ page, limit, search: debouncedSearch, ...filters })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, JSON.stringify(filters), refreshKey]);

  return {
    items,
    total,
    totalPages,
    page,
    setPage,
    search,
    changeSearch,
    filters,
    setFilter,
    loading,
    error,
    refetch,
    handleDeleted,
  };
}
