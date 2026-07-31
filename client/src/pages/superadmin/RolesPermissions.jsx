import { useEffect, useState } from 'react';
import { Check, Minus, ShieldCheck, UserCog, GraduationCap, User } from 'lucide-react';
import { PageContainer } from '../../components/common';
import axiosInstance from '../../api/axiosInstance';

const ROLE_META = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Full access to every module across the institute.',
    icon: ShieldCheck,
    color: 'bg-blue-50 text-blue-600',
  },
  ADMIN: {
    label: 'Admin',
    description: 'Campus-level administration (Admin portal not yet built).',
    icon: UserCog,
    color: 'bg-amber-50 text-amber-600',
  },
  TRAINER: {
    label: 'Trainer',
    description: 'Manages assigned batches and attendance (Trainer portal not yet built).',
    icon: GraduationCap,
    color: 'bg-purple-50 text-purple-600',
  },
  STUDENT: {
    label: 'Student',
    description: 'Views enrollments, attendance and payments (Student portal not yet built).',
    icon: User,
    color: 'bg-slate-100 text-slate-600',
  },
};

const MODULES = [
  'Dashboard',
  'Students',
  'Academic Management',
  'Administration',
  'Trainers',
  'Attendance',
  'Payments',
  'Admin Users',
  'Roles & Permissions',
  'Profile',
];

// Access reflects the real `authorize()` middleware on the API: every Super
// Admin route currently requires the SUPER_ADMIN role, since only the Super
// Admin portal has been built so far.
const ACCESS = {
  SUPER_ADMIN: MODULES.map(() => true),
  ADMIN: MODULES.map(() => false),
  TRAINER: MODULES.map(() => false),
  STUDENT: MODULES.map(() => false),
};

export default function RolesPermissions() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axiosInstance
      .get('/roles/summary')
      .then((res) => {
        const map = Object.fromEntries(res.data.data.map((r) => [r.role, r.count]));
        setCounts(map);
      })
      .catch(() => setError('Failed to load role summary'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer title="Roles & Permissions" description="Overview of system roles and module access">
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(ROLE_META).map(([role, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={role} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.color}`}>
                  <Icon size={20} />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{meta.label}</p>
                  <p className="text-sm text-blue-600">{loading ? '—' : counts[role] || 0} users</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">{meta.description}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-800">Module Access</h2>
        <p className="mb-4 text-sm text-slate-500">Which roles can currently access each module.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Module</th>
                {Object.values(ROLE_META).map((meta) => (
                  <th key={meta.label} className="px-4 py-3 text-center font-medium">
                    {meta.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULES.map((module, i) => (
                <tr key={module}>
                  <td className="px-4 py-2.5 text-slate-700">{module}</td>
                  {Object.keys(ROLE_META).map((role) => (
                    <td key={role} className="px-4 py-2.5 text-center">
                      {ACCESS[role][i] ? (
                        <Check size={16} className="mx-auto text-green-600" />
                      ) : (
                        <Minus size={16} className="mx-auto text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
