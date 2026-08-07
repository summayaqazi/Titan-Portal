import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

export default function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Trainer Portal already has its own Logout in the sidebar's bottom
  // profile card (see Sidebar.jsx) — this header's dropdown would be a
  // second Logout for the same account, so for TRAINER it's shown as a
  // plain, non-interactive name/avatar instead of a clickable menu.
  // Super Admin/Admin have no other Logout entry point, so their dropdown
  // (and its Logout button) is untouched.
  const isTrainer = user?.role === ROLES.TRAINER;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      {isTrainer ? (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <User size={16} />
          </span>
          <span className="text-sm font-medium text-slate-700">{user?.name || 'User'}</span>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
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
