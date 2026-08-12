const STATUS_STYLES = {
  // greens
  approved: 'bg-green-100 text-green-700',
  active: 'bg-green-100 text-green-700',
  enrolled: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  present: 'bg-green-100 text-green-700',
  passed: 'bg-green-100 text-green-700',
  certified: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  verified: 'bg-green-100 text-green-700',
  published: 'bg-green-100 text-green-700',
  // ambers
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  leave: 'bg-amber-100 text-amber-700',
  late: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-amber-100 text-amber-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  // reds
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  eliminated: 'bg-red-100 text-red-700',
  dropout: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  blacklisted: 'bg-red-100 text-red-700',
  overdue: 'bg-red-100 text-red-700',
  absent: 'bg-red-100 text-red-700',
  inactive: 'bg-red-100 text-red-700',
  expired: 'bg-red-100 text-red-700',
  // neutrals
  refunded: 'bg-slate-100 text-slate-600',
  waived: 'bg-slate-100 text-slate-600',
};

const DEFAULT_STYLE = 'bg-slate-100 text-slate-600';

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status?.toLowerCase()] || DEFAULT_STYLE;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
