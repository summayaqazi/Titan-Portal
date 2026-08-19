import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function SuperAdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Safety net: if a route changes without the nav link's own onClick
  // closing the drawer (e.g. programmatic navigation), don't leave the
  // mobile overlay stuck open.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Stable handler identities so the memoized Sidebar/Header below (see
  // React.memo on each) actually skip re-rendering on every navigation —
  // this component itself re-renders on every route change (useLocation),
  // and a fresh inline arrow function here would otherwise still count as
  // a changed prop even with memo in place. Same behavior either way.
  const handleToggleCollapsed = useCallback(() => setCollapsed((prev) => !prev), []);
  const handleCloseMobile = useCallback(() => setMobileOpen(false), []);
  const handleOpenMobile = useCallback(() => setMobileOpen(true), []);

  return (
    <div className="flex h-screen bg-(--color-app-bg)">
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={handleCloseMobile}
      />
      {/* min-w-0 lets flex children (tables, wide content) shrink instead of
          forcing this column past the viewport width — the usual cause of
          page-level horizontal scroll in flex layouts. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={handleOpenMobile} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
