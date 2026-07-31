import { useEffect, useState } from 'react';

const LIMIT = 10;

export default function useEnrollmentAnalytics(fetchAnalytics) {
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchAnalytics({ sort, page, limit: LIMIT })
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
  }, [sort, page]);

  const changeSort = (nextSort) => {
    setSort(nextSort);
    setPage(1);
  };

  return { data, loading, error, sort, page, totalPages, changeSort, setPage };
}
