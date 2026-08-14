import { BrandLogo } from '../common';

// Shared closing footer for every public (unauthenticated) page — gives the
// Courses/Careers site a proper "ending" instead of the page just stopping
// after the last card, same purpose PublicHeader serves at the top. Same
// navy (`--color-sidebar-header`) as PublicHeader, bookending the page —
// BrandLogo and text colors reused exactly as they already are inside
// Sidebar.jsx's own navy chrome, not a new color. Static/presentational
// only, no data fetching — nothing here is placeholder business data (no
// invented phone numbers, addresses, or hours), just the same brand
// identity already established across the app.
export default function PublicFooter() {
  return (
    <footer className="border-t border-(--color-sidebar-border) bg-(--color-sidebar-header)">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
        <BrandLogo size={28} fallback={<span className="text-base font-semibold text-white">TITAN</span>} />
        <p className="max-w-md text-sm text-(--color-sidebar-text)">
          TITAN Institute — quality technical education and career opportunities, offered across our campuses.
        </p>
        <p className="text-xs text-(--color-sidebar-text-muted)">
          © {new Date().getFullYear()} TITAN Institute. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
