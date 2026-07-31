import { useEffect, useState } from 'react';

// Shared list-state manager for Super Admin CRUD pages: pagination, search,
// arbitrary filters, and a refetch trigger for use after create/update/delete.
export default function useCrudResource(listFn, { limit = 10, initialFilters = {} } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    listFn({ page, limit, search, ...filters })
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
  }, [page, limit, search, JSON.stringify(filters), refreshKey]);

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
  };
}
