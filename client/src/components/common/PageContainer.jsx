import { ArrowLeft } from 'lucide-react';

// `className` defaults to the original padding exactly — every existing
// caller that doesn't pass it renders byte-identical to before. Only a page
// that explicitly opts in (passing its own value) gets different spacing.
// `onBack` is the same opt-in shape: omitted (every existing caller, and
// every Super Admin/Trainer/Student page) renders with zero change; only a
// caller that passes it gets the Back button above the title. Same visual
// language as the Trainer Portal's own existing back links (QuestionsManager.
// jsx/SubmissionsView.jsx's "Back to Quizzes"/"Back to Assignments") — an
// ArrowLeft icon + text, just wired to React Router's navigate(-1) instead
// of a local view-switch, since these are real routes, not sub-views.
export default function PageContainer({ title, description, actions, children, className = 'p-4 sm:p-6', onBack }) {
  return (
    <div className={className}>
      {(title || actions) && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft size={12} /> Back
              </button>
            )}
            {title && <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">{title}</h1>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
