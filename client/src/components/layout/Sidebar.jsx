import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import { SUPER_ADMIN_NAV } from '../../constants/navigation';

function isChildActive(item, pathname) {
  return item.children?.some((child) => pathname.startsWith(child.path));
}

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState(() =>
    SUPER_ADMIN_NAV.filter((item) => item.children && isChildActive(item, location.pathname)).map(
      (item) => item.label
    )
  );

  const toggleGroup = (label) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const linkClasses = ({ isActive }) =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
      isActive
        ? 'bg-(--color-sidebar-active) text-white font-medium'
        : 'text-slate-300 hover:bg-(--color-sidebar-hover) hover:text-white'
    }`;

  return (
    <aside
      className={`flex h-screen flex-col bg-(--color-sidebar) transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-white/10 px-4">
        <div className="flex items-center gap-2 overflow-hidden">
          <GraduationCap className="shrink-0 text-(--color-sidebar-active)" size={26} />
          {!collapsed && (
            <span className="truncate text-base font-semibold text-white">Titan Portal</span>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {SUPER_ADMIN_NAV.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            const isOpen = openGroups.includes(item.label) || collapsed;
            const active = isChildActive(item, location.pathname);

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.label)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    active ? 'text-white' : 'text-slate-300 hover:bg-(--color-sidebar-hover) hover:text-white'
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

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-center gap-2 border-t border-white/10 py-3 text-slate-300 hover:bg-(--color-sidebar-hover) hover:text-white"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        {!collapsed && <span className="text-sm">Collapse</span>}
      </button>
    </aside>
  );
}
