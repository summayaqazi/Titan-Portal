import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { SUPER_ADMIN_NAV, ADMIN_NAV, TRAINER_NAV, STUDENT_NAV } from '../../constants/navigation';
import { ROLES } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';
import { resolveFileUrl } from '../../utils/fileUrl';

function isChildActive(item, pathname) {
  return item.children?.some((child) => pathname.startsWith(child.path));
}

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, can, logout } = useAuth();

  // Same sidebar component for every portal — only the nav list (and thus
  // the menu shown) changes per role. SUPER_ADMIN keeps its existing nav
  // unchanged; other roles get their own nav array here as portals are added.
  const NAV =
    user?.role === ROLES.ADMIN
      ? ADMIN_NAV
      : user?.role === ROLES.TRAINER
      ? TRAINER_NAV
      : user?.role === ROLES.STUDENT
      ? STUDENT_NAV
      : SUPER_ADMIN_NAV;
  const isTrainer = user?.role === ROLES.TRAINER;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter items/children by view permission (module-less group headers stay
  // if at least one visible child remains).
  const visibleNav = useMemo(
    () =>
      NAV.map((item) => {
        if (item.children) {
          const children = item.children.filter((child) => can(child.module, 'view'));
          return children.length ? { ...item, children } : null;
        }
        return can(item.module, 'view') ? item : null;
      }).filter(Boolean),
    [can, NAV]
  );

  const [openGroups, setOpenGroups] = useState(() =>
    NAV.filter((item) => item.children && isChildActive(item, location.pathname)).map((item) => item.label)
  );

  const toggleGroup = (label) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
      isActive
        ? 'bg-(--color-sidebar-menu-active) text-(--color-sidebar-menu-active-text) font-medium shadow-sm'
        : 'text-(--color-sidebar-text) hover:bg-(--color-sidebar-hover) hover:text-white'
    }`;

  return (
    <aside
      className={`flex h-screen flex-col bg-(--color-sidebar) transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-(--color-sidebar-border) bg-(--color-sidebar-header) px-4">
        <BrandLogo
          size={36}
          className="shrink-0"
          fallback={
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--color-sidebar-active) text-base font-bold text-white shadow-sm">
              T
            </span>
          }
        />
        {!collapsed && (
          <span className="truncate text-lg font-bold tracking-wide text-white">TITAN</span>
        )}
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
        {visibleNav.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            const isOpen = openGroups.includes(item.label) || collapsed;
            const active = isChildActive(item, location.pathname);

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active ? 'text-white' : 'text-(--color-sidebar-text) hover:bg-(--color-sidebar-hover) hover:text-white'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </>
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className="mt-1 space-y-1 pl-8">
                    {item.children.map((child) => (
                      <NavLink key={child.path} to={child.path} className={linkClasses}>
                        <span className="h-1 w-1 rounded-full bg-current" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink key={item.path} to={item.path} className={linkClasses} title={collapsed ? item.label : undefined}>
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Trainer-only: bottom profile card doubles as the Profile "tab" (no
          separate Profile entry in TRAINER_NAV — this card is the entry
          point into /trainer/profile) plus logout, matching the Trainer
          portal's sidebar reference design. Super Admin/Admin are
          unaffected — they never render this block. */}
      {isTrainer && (
        <div className="border-t border-(--color-sidebar-border) p-3">
          <div className={`flex items-center gap-1 ${collapsed ? 'justify-center' : ''}`}>
            <NavLink
              to="/trainer/profile"
              title={collapsed ? 'Profile' : undefined}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors ${
                  isActive ? 'bg-(--color-sidebar-menu-active)' : 'hover:bg-(--color-sidebar-hover)'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {user?.avatar ? (
                <img
                  src={resolveFileUrl(user.avatar)}
                  alt={user.name}
                  className="h-9 w-9 shrink-0 rounded-full border border-(--color-sidebar-border) object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--color-sidebar-active) text-sm font-semibold text-white">
                  {user?.name?.charAt(0) || '?'}
                </span>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                  <p className="truncate text-xs text-(--color-sidebar-text-muted)">{user?.email}</p>
                </div>
              )}
            </NavLink>
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="shrink-0 rounded-md p-1.5 text-(--color-sidebar-text-muted) transition-colors hover:bg-(--color-sidebar-hover) hover:text-white"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className="mt-1.5 flex w-full items-center justify-center rounded-md p-1.5 text-(--color-sidebar-text-muted) transition-colors hover:bg-(--color-sidebar-hover) hover:text-white"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center gap-2 border-t border-(--color-sidebar-border) py-3 text-(--color-sidebar-text-muted) transition-colors hover:bg-(--color-sidebar-hover) hover:text-white"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        {!collapsed && <span className="text-sm">Collapse</span>}
      </button>
    </aside>
  );
}
