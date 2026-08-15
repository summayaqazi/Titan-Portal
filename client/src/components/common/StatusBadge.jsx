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
  // Job Portal — an open job/application window (public Jobs/Job Details).
  open: 'bg-green-100 text-green-700',
  // ambers
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  leave: 'bg-amber-100 text-amber-700',
  late: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-amber-100 text-amber-700',
  // Job Portal — a job whose opening date hasn't arrived yet.
  upcoming: 'bg-amber-100 text-amber-700',
  // Quiz — a resumable in-progress attempt.
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
  // Job Portal — a closed job (status=closed, or past its closing date).
  closed: 'bg-red-100 text-red-700',
  // Quiz — the availability window has passed.
  expired: 'bg-red-100 text-red-700',
  // Job Portal — Application.status's two "in progress" states, distinct
  // from the generic amber `pending` above so an applicant/reviewer can
  // tell the three apart at a glance.
  under_review: 'bg-blue-100 text-blue-700',
  shortlisted: 'bg-violet-100 text-violet-700',
  // neutrals
  refunded: 'bg-slate-100 text-slate-600',
  waived: 'bg-slate-100 text-slate-600',
};

const DEFAULT_STYLE = 'bg-slate-100 text-slate-600';

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status?.toLowerCase()] || DEFAULT_STYLE;
  // Snake_case status values (only Application.status's 'under_review' today)
  // render as separate, capitalized words ("Under Review") instead of
  // "Under_review" — every other status value in the app is a single word,
  // so this is a no-op for all of them.
  const label = status
    ? status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Unknown';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
