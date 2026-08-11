// Shared by the Student Dashboard's Active Course cards and the Student
// Progress page's course cards, so the SAME course always gets the SAME
// accent color on both pages — a single source of truth instead of two
// independently-tuned copies that could silently drift apart. Deterministic
// (hashed from a stable id, not array position), so a course's color never
// changes across renders/refreshes even if the two backing endpoints
// (getDashboard / getProgress) happen to return enrollments in a different
// order from one another.
// `bar` is intentionally not part of this theme — every progress bar in
// the Student Portal now follows the completion-based `progressBarColor`
// below instead of a per-course decorative color, so only the header
// band/border/heading rotate per-course.
// Six soft, professional accents (not just two) so two, three, or several
// active courses each read as visually distinct at a glance instead of two
// of them sharing the same header color — still pastel/70-opacity
// backgrounds with a matching soft border/heading, same visual weight as
// the original primary/emerald pair, just more of them. Courses beyond the
// sixth simply cycle back to the start (`hash % COURSE_THEMES.length`
// below) rather than breaking.
export const COURSE_THEMES = [
  { bg: 'bg-primary-100/70', border: 'border-primary-100', hoverBorder: 'hover:border-primary-300', heading: 'text-primary-700' },
  { bg: 'bg-emerald-100/70', border: 'border-emerald-100', hoverBorder: 'hover:border-emerald-300', heading: 'text-emerald-700' },
  { bg: 'bg-violet-100/70', border: 'border-violet-100', hoverBorder: 'hover:border-violet-300', heading: 'text-violet-700' },
  { bg: 'bg-orange-100/70', border: 'border-orange-100', hoverBorder: 'hover:border-orange-300', heading: 'text-orange-700' },
  { bg: 'bg-teal-100/70', border: 'border-teal-100', hoverBorder: 'hover:border-teal-300', heading: 'text-teal-700' },
  { bg: 'bg-rose-100/70', border: 'border-rose-100', hoverBorder: 'hover:border-rose-300', heading: 'text-rose-700' },
];

export function themeForCourse(key) {
  const str = String(key || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return COURSE_THEMES[hash % COURSE_THEMES.length];
}

// Trainer Dashboard's own progress-bar rule (see trainer/Dashboard.jsx's
// ProgressTab-equivalent): green once actually complete, portal blue
// otherwise — a completion signal, not a decorative accent. Shared by the
// Student Dashboard's course cards/Overall Progress and the Student
// Progress page's course cards/Overall Progress, so every progress bar in
// the Student Portal follows the exact same rule.
export function progressBarColor(percent) {
  return percent >= 100 ? 'bg-green-500' : 'bg-primary-600';
}
