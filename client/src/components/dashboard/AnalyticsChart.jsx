import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Select from '../common/Select';

export default function AnalyticsChart({
  title,
  subtitle,
  data,
  loading,
  error,
  sort,
  onSortChange,
  page,
  totalPages,
  onPageChange,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Select
          className="w-auto"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label={`Sort ${title}`}
        >
          <option value="desc">High to Low</option>
          <option value="asc">Low to High</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
          Loading chart data...
        </div>
      ) : error ? (
        <div className="flex h-72 items-center justify-center text-sm text-red-500">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
          No enrollment data available yet
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#64748b' }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
              />
              <Bar dataKey="count" name="Enrollments" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="count" position="top" style={{ fill: '#334155', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-500">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
