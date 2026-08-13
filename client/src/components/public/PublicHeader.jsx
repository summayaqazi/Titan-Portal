import { Link } from 'react-router-dom';
import { BrandLogo } from '../common';

// Shared top bar for every public (unauthenticated) page — Courses, Course
// Details, Register. Deliberately its own small component rather than
// reusing SuperAdminLayout/Sidebar/Header (those assume a logged-in user
// with a role-based nav and would need to be reworked for an anonymous
// visitor); this keeps the locked authenticated shell completely untouched
// while still reusing the same brand/typography/color system (BrandLogo,
// Tailwind `primary-*` tokens) so the public pages read as the same TITAN
// product, not a bolted-on microsite.
export default function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/courses" className="flex items-center gap-2">
          <BrandLogo size={32} fallback={<span className="text-lg font-semibold text-slate-800">TITAN</span>} />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
          <Link to="/courses" className="hover:text-primary-700">
            Courses
          </Link>
          {/* Job Portal Phase 2 — additive sibling link, same treatment as
              Courses above. Does not change anything about the existing
              public course/registration flow this header is also used by. */}
          <Link to="/jobs" className="hover:text-primary-700">
            Careers
          </Link>
          <Link
            to="/login"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Student / Staff Login
          </Link>
        </nav>
      </div>
    </header>
  );
}
