import { Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import { PageContainer, Avatar } from '../../components/common';
import { useAuth } from '../../context/AuthContext';

// Applicant Profile — read-only, per this phase's scope. Uses the User
// data AuthContext already holds from login (no new API call needed);
// Applicants cannot edit role/permissions/application status from here or
// anywhere in this portal.
export default function Profile() {
  const { user } = useAuth();

  return (
    <PageContainer title="Profile" description="Your applicant account information">
      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={user?.name} size={56} />
          <div>
            <p className="text-base font-semibold text-slate-800">{user?.name}</p>
            <p className="text-sm text-slate-500">Job Applicant</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <UserIcon size={16} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-400">Name</p>
              <p className="text-sm text-slate-700">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <Mail size={16} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-400">Email</p>
              <p className="text-sm text-slate-700">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <ShieldCheck size={16} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-400">Account Status</p>
              <p className="text-sm text-slate-700">Active</p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
