# Portal — project rules

## Mobile-first responsiveness (permanent, global)

Every portal (Super Admin, Admin, Trainer, Student) is mobile-first responsive as of 2026-08-08. This is a **standing requirement for the whole project, not a one-time pass** — any new page, component, table, form, modal, drawer, card, or dashboard widget must be built responsive from the start using the same conventions already in place:

- **Shell**: `SuperAdminLayout`/`Sidebar`/`Header` (`client/src/components/layout/`) already handle the mobile nav — the sidebar becomes an off-canvas drawer with a backdrop below the `md` breakpoint, opened via the header's hamburger button. Don't rebuild this per page; it's shared by every portal already.
- **Tables**: use the shared `Table` component (`client/src/components/common/Table.jsx`) or wrap any custom `<table>` in `overflow-x-auto` (never `overflow-hidden`) so wide tables scroll horizontally inside their own container instead of breaking the page or clipping columns.
- **Grids/cards**: start from a single column (`grid-cols-1`) and add columns at `sm:`/`md:`/`lg:` — see `pages/*/Dashboard.jsx` for the pattern (`grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`, etc.).
- **Filter bars / toolbars**: `flex flex-wrap items-center gap-3` so search/select/date controls wrap instead of overflowing.
- **Modals/Drawers**: already capped with `max-w-full`/`max-h-[90vh]` and internal `overflow-y-auto` — don't add fixed pixel widths/heights that break that.
- **Page padding/headers**: use `PageContainer` (`client/src/components/common/PageContainer.jsx`) — it already stacks title/description above actions on narrow screens and scales padding.
- Avoid unresponsive fixed pixel widths (`w-[600px]`, `min-w-[500px]`) on anything that isn't already inside a scroll/overflow container.
- Test new UI at ~360px, ~768px, and desktop widths before considering it done — no horizontal page scroll, no clipped content.

Do not redesign or recolor existing UI to "make it responsive" — reflow/restructure only where needed, keep the existing visual theme.

See also: Portal build-phase/lock rules and Student Portal progress are tracked in this session's persistent memory (Super Admin/Admin/Trainer portals are feature-complete and locked outside of cross-cutting fixes like this one; Student Portal is the active build phase).
