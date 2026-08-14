// Branded intro banner for the top-level public pages (Courses, Jobs).
// Uses `--color-sidebar` (the Sidebar's own main-body navy) directly below
// PublicHeader's `--color-sidebar-header` (its top logo-block navy) —
// exactly the same two-tone relationship those two tokens already have
// inside Sidebar.jsx itself (header block slightly darker than the nav
// body below it), just carried into this horizontal layout instead of a
// vertical one. A small new component rather than inlining this markup
// twice — used by Courses.jsx and Jobs.jsx only, nothing authenticated
// touches this file.
//
// `actions` is optional (Courses.jsx doesn't pass one, so its layout is
// unchanged) — Jobs.jsx uses it for the "Applicant Portal" button, kept
// mobile-first responsive by stacking below the text on narrow screens
// (flex-col) and sitting beside it from `sm:` up, same breakpoint every
// other toolbar in this app already switches at.
export default function PublicHero({ eyebrow, title, description, actions }) {
  return (
    <div className="bg-(--color-sidebar)">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-14">
        <div>
          {eyebrow && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-(--color-sidebar-text)">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-(--color-sidebar-text) sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
