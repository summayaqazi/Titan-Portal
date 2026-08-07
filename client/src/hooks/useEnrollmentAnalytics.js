import { useEffect, useState } from 'react';

const LIMIT = 10;

// `extraParams` is merged into every fetch and re-triggers the fetch when
// it changes (e.g. the Admin Portal's Dashboard campus selector) — optional
// and defaults to {}, so existing callers are unaffected. `ready: false`
// skips fetching entirely (keeps `loading: true`) until the caller says so
// — used to avoid an unscoped fetch firing before a required filter (e.g.
// the admin's campus) has resolved.
export default function useEnrollmentAnalytics(fetchAnalytics, extraParams = {}, { ready = true } = {}) {
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const extraParamsKey = JSON.stringify(extraParams);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAnalytics({ sort, page, limit: LIMIT, ...extraParams })
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setTotalPages(res.totalPages);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to load chart data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, page, extraParamsKey, ready]);

  const changeSort = (nextSort) => {
    setSort(nextSort);
    setPage(1);
  };

  return { data, loading, error, sort, page, totalPages, changeSort, setPage };
}
