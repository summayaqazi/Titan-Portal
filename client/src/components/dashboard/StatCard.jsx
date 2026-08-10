// Every className prop defaults to the exact original look/order, so any
// caller that doesn't pass them (Super Admin/Admin/Student) renders
// unchanged. `iconWrapClassName`/`textWrapClassName` let a caller reposition
// the icon (e.g. flex-row-reverse on `className` + a circular icon shape)
// or flip value/label stacking (flex-col-reverse) via pure CSS, with no
// conditional JSX — that's how the Trainer dashboard gets its icon-on-right,
// value-on-top compact layout without touching anyone else's card.
export default function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName = 'text-blue-600',
  iconClassName = 'bg-blue-50 text-blue-600',
  labelClassName = 'text-slate-500',
  className = 'flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5',
  iconWrapClassName = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
  textWrapClassName = 'min-w-0',
}) {
  return (
    <div className={className}>
      <div className={`${iconWrapClassName} ${iconClassName}`}>
        <Icon size={22} />
      </div>
      <div className={textWrapClassName}>
        <p className={`truncate text-sm ${labelClassName}`}>{label}</p>
        <p className={`text-2xl font-semibold ${valueClassName}`}>{value}</p>
      </div>
    </div>
  );
}
