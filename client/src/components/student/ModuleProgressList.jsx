import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

// Shared by the Student Portal's Progress page and Course Details page —
// both render the exact same module/topic breakdown (courtesy of the same
// withComputed() derivation on the backend, see studentPortal.controller.js),
// so this lives here rather than being duplicated per page. Not in
// components/common — it's Student-Portal-specific shape/wording (e.g.
// "Curriculum not published for this course yet"), not a generic primitive
// other portals would reuse.
//
// IMPORTANT: completed topics are marked with an icon + color change only —
// never a strikethrough — so the topic text stays fully readable.
export function ProgressBar({ percent }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-primary-600" style={{ width: `${percent}%` }} />
    </div>
  );
}

function ModuleRow({ module }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? (
            <ChevronDown size={15} className="shrink-0 text-slate-400" />
          ) : (
            <ChevronRight size={15} className="shrink-0 text-slate-400" />
          )}
          <span className="truncate text-sm font-medium text-slate-800">{module.title}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            Topics: {module.completedTopics}/{module.totalTopics}
          </span>
          {/* `remainingTopics` is already computed server-side (same
              withComputed() derivation as every other number here) — just
              not previously surfaced in this row. */}
          <span className="text-orange-600">Pending: {module.remainingTopics}</span>
          <span className="hidden w-24 sm:inline-block">
            <ProgressBar percent={module.progressPercent} />
          </span>
          <span className="w-9 text-right font-semibold text-slate-700">{module.progressPercent}%</span>
        </div>
      </button>

      {open && (
        <ul className="space-y-1 border-t border-slate-100 px-4 py-3">
          {module.topics.length === 0 ? (
            <li className="text-xs text-slate-400">No topics added yet.</li>
          ) : (
            module.topics.map((topic) => (
              <li key={topic._id} className="flex items-center gap-2 text-sm">
                {topic.completed ? (
                  <CheckCircle2 size={15} className="shrink-0 text-green-600" />
                ) : (
                  <Circle size={15} className="shrink-0 text-slate-300" />
                )}
                {/* No strikethrough on completed topics — icon + color are
                    the only completion indicators, text stays readable. */}
                <span className={topic.completed ? 'text-slate-700' : 'text-slate-500'}>{topic.title}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// `modules` is the array shape studentPortal.controller.js's withComputed()
// produces (each with totalTopics/completedTopics/progressPercent already
// derived) — read-only display only, matches the Student Portal's
// read-only access to curriculum/progress data (topic completion is a
// Trainer-only action via the Trainer Portal's own Progress tab).
export default function ModuleProgressList({ modules, emptyText = 'Curriculum not published for this course yet.' }) {
  if (!modules || modules.length === 0) {
    return <p className="text-xs text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-2">
      {modules.map((module) => (
        <ModuleRow key={module._id} module={module} />
      ))}
    </div>
  );
}
