const SIZES = {
  sm: { wrap: 'gap-2 px-3 py-2', icon: 'h-7 w-7', iconSize: 14, value: 'text-sm' },
  md: { wrap: 'gap-2.5 px-3.5 py-3', icon: 'h-8 w-8', iconSize: 15, value: 'text-base' },
};

// Small icon + value + label stat card, shared by every list/detail view
// that shows an at-a-glance row of counts (Attendance roster, Assignment
// submissions, Course Progress overview) — previously copy-pasted per file.
export default function StatPill({ icon: Icon, label, value, colorClass, size = 'sm' }) {
  const s = SIZES[size];
  return (
    <div className={`flex items-center rounded-lg border border-slate-200 bg-white ${s.wrap}`}>
      <span className={`flex items-center justify-center rounded-md ${s.icon} ${colorClass}`}>
        <Icon size={s.iconSize} />
      </span>
      <div>
        <p className={`font-semibold text-slate-800 ${s.value}`}>{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}
