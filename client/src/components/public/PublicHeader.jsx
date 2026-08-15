import { Link, NavLink } from 'react-router-dom';
import { BrandLogo } from '../common';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

// Exactly the same colors/logic as Sidebar.jsx's own `linkClasses` (see
// components/layout/Sidebar.jsx) — active/hover both fill with
// `--color-sidebar-hover`, inactive text is `--color-sidebar-text` — just
// applied to a horizontal pill instead of a full-width vertical block,
// since this is a top nav bar rather than a sidebar. Not `primary-*`: that
// scale is this app's *content/action* color (buttons, links, badges —
// unchanged everywhere on these public pages too), never the shell/nav
// color. The navy `--color-sidebar*` tokens are what the shell actually
// uses, both in the Sidebar's own nav list and, most importantly, in
// exactly this "top bar with the logo" spot per Sidebar's own top block
// (`bg-(--color-sidebar-header)`).
const navLinkClasses = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 transition-colors ${
    isActive
      ? 'bg-(--color-sidebar-hover) font-medium text-white'
      : 'text-(--color-sidebar-text) hover:bg-(--color-sidebar-hover) hover:text-white'
  }`;

// Shared top bar for every public (unauthenticated) page — Courses, Course
// Details, Register, Jobs, Job Details, Apply. Deliberately its own small
// component rather than reusing SuperAdminLayout/Sidebar/Header (those
// assume a logged-in user with a role-based nav and would need to be
// reworked for an anonymous visitor); this keeps the locked authenticated
// shell completely untouched while still reusing its EXACT navy shell
// colors (`--color-sidebar`/`--color-sidebar-header`, defined once in
// index.css and otherwise only used by Sidebar.jsx) so this reads as the
// same TITAN product's own branding, not an approximation of it. BrandLogo
// itself is unchanged from Sidebar's usage — same component, same navy
// background it's already designed to sit on there.
export default function PublicHeader() {
  // A logged-in Applicant browsing these public pages (Jobs/Job Details/
  // Apply/Application Success) previously had no way back into their own
  // Applicant Portal from here — the only link was "Student / Staff Login",
  // which doesn't apply to them and doesn't route anywhere useful once
  // already signed in. Reuses the exact same AuthContext every other portal
  // already reads from — not a second auth source, just this header finally
  // looking at it. Every other role/logged-out visitor is unaffected.
  const { user, logout } = useAuth();
  const isApplicant = user?.role === ROLES.APPLICANT;

  return (
    <header className="border-b border-(--color-sidebar-border) bg-(--color-sidebar-header)">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link to="/courses" className="flex items-center gap-2">
          <BrandLogo size={34} fallback={<span className="text-lg font-semibold text-white">TITAN</span>} />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium">
          <NavLink to="/courses" className={navLinkClasses}>
            Courses
          </NavLink>
          {/* Job Portal Phase 2 — additive sibling link, same treatment as
              Courses above. Does not change anything about the existing
              public course/registration flow this header is also used by. */}
          <NavLink to="/jobs" className={navLinkClasses}>
            Careers
          </NavLink>
          {isApplicant ? (
            <>
              <NavLink to="/applicant/dashboard" className={navLinkClasses}>
                My Applications
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="ml-2 rounded-md bg-white px-3 py-1.5 text-(--color-sidebar) transition-colors hover:bg-slate-100"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="ml-2 rounded-md bg-white px-3 py-1.5 text-(--color-sidebar) transition-colors hover:bg-slate-100"
            >
              Student / Staff Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
