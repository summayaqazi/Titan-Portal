import { useState } from 'react';
import { LogOut, Menu, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Trainer Portal already has its own profile/avatar + Logout in the
  // sidebar's bottom profile card (see Sidebar.jsx) — this header's
  // profile dropdown would be a duplicate profile/role element for the
  // same account, so for TRAINER nothing is rendered here at all. Student
  // now gets the same treatment (Sidebar.jsx grew its own bottom Logout
  // control) so its Dashboard can match Trainer's header-less layout
  // without losing the ability to log out. Applicant (Job Portal Phase 4)
  // gets the same bottom sidebar card too, same reasoning. Super Admin/
  // Admin have no other profile entry point, so their dropdown (avatar,
  // name, Logout) is untouched.
  const hasSidebarExit = user?.role === ROLES.TRAINER || user?.role === ROLES.STUDENT || user?.role === ROLES.APPLICANT;
  // Only ever rendered for Super Admin/Admin now — Trainer/Student render
  // nothing here (see hasSidebarExit above).
  const avatarColorClass = 'bg-primary-100 text-primary-700';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    // For Trainer/Student this bar renders nothing at all at desktop widths
    // (no hamburger — that's md:hidden — and the profile dropdown is null,
    // see above), so it was pure dead space above the page content.
    // Collapsing it to h-0 there (a real layout change, not a visibility
    // trick) removes that space outright; Super Admin/Admin keep the normal
    // h-12 bar unchanged, and Trainer/Student keep it too below md, where
    // the hamburger still needs the room.
    <header
      className={`flex h-12 items-center border-b border-slate-200 bg-white px-3 sm:px-6 ${
        hasSidebarExit ? 'md:h-0 md:overflow-hidden md:border-0 md:px-0' : ''
      }`}
    >
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
      >
        <Menu size={20} />
      </button>
      {/* ml-auto (not the parent's old justify-between) pins this flush
          right regardless of whether the mobile-only hamburger above is in
          the DOM — with justify-between, hiding that button at md: (its
          only sibling) left this centered/left-aligned on desktop instead
          of at the original top-right. */}
      {hasSidebarExit ? null : (
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100"
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${avatarColorClass}`}>
              <User size={16} />
            </span>
            <span className="text-sm font-medium text-slate-700">{user?.name || 'User'}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-700">{user?.name}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
