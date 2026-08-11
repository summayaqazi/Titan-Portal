import { Layers, CheckCircle2, Clock } from 'lucide-react';

// Shared by the Student Progress page's course cards and the Course Details
// page — same three compact "topic summary" stat boxes (Total/Completed/
// Pending), same icon + color per stat everywhere so a student learns to
// recognize them at a glance instead of the two pages drifting into
// different looks. Purely presentational: every number is passed in from
// whichever page already fetched it (getProgress()/getCourseDetails(), both
// driven by the same withComputed() derivation) — nothing computed or
// fetched here.
//
// Colors are varied (violet/emerald/orange) but drawn from shades already
// used elsewhere in the Student Dashboard (StatCard's "Active Courses" tile
// is violet, "Assignments" is orange, success states are emerald) so the
// variety reads as coordinated, not random. Icon boxes use the same
// rounded-lg + soft-background language as the Dashboard's own StatCard.
const STATS = [
  {
    key: 'total',
    label: 'Total Topics',
    icon: Layers,
    iconWrap: 'bg-violet-100 text-violet-600',
    value: 'text-violet-700',
    label_: 'text-violet-600/80',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    iconWrap: 'bg-emerald-100 text-emerald-600',
    value: 'text-emerald-700',
    label_: 'text-emerald-600/80',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: Clock,
    iconWrap: 'bg-orange-100 text-orange-600',
    value: 'text-orange-700',
    label_: 'text-orange-600/80',
  },
];

export default function TopicStatCards({ total, completed, pending }) {
  const values = { total, completed, pending };
  return (
    <div className="grid grid-cols-3 gap-2">
      {STATS.map((stat) => (
        <div key={stat.key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.iconWrap}`}>
            <stat.icon size={15} />
          </div>
          <div className="min-w-0">
            <p className={`text-base font-bold leading-none ${stat.value}`}>{values[stat.key]}</p>
            <p className={`mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide ${stat.label_}`}>{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
