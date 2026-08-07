import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogOut } from 'lucide-react';
import { PageContainer, FormField, Input, Button, ImageUpload, Avatar } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { updateProfileRequest, changePasswordRequest } from '../../api/profileApi';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import { MODULE_LABELS } from '../../constants/permissions';
import { ADMIN_NAV, getNavModules } from '../../constants/navigation';
import { ROLES } from '../../constants/roles';

function ProfileDetailsForm() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      setMessage('');
      if (!form.name) {
        setError('Name is required');
        return;
      }
      if (avatarError) {
        setError(avatarError);
        return;
      }
      setSubmitting(true);
      try {
        const updated = await updateProfileRequest({ ...form, avatarFile, removeAvatar });
        updateUser(updated);
        setMessage('Profile updated successfully');
        setAvatarFile(null);
        setRemoveAvatar(false);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to update profile'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Profile Details</h2>

      <FormField label="Avatar">
        <ImageUpload
          key={user?.id || 'me'}
          currentUrl={resolveFileUrl(user?.avatar)}
          onChange={(file) => {
            setAvatarFile(file);
            if (file) setRemoveAvatar(false);
          }}
          onRemove={() => setRemoveAvatar(true)}
          error={avatarError}
          setError={setAvatarError}
          round
        />
      </FormField>

      <FormField label="Full Name" htmlFor="name" required>
        <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
      </FormField>
      <FormField label="Email" htmlFor="email">
        <Input id="email" value={user?.email || ''} disabled className="bg-slate-50 text-slate-400" />
      </FormField>
      <FormField label="Phone" htmlFor="phone">
        <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
      </FormField>
      <FormField label="Role" htmlFor="role">
        <Input id="role" value={user?.role || ''} disabled className="bg-slate-50 text-slate-400" />
      </FormField>

      {message && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

function PasswordInput({ id, value, onChange, required }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange} required={required} className="pr-9" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      setMessage('');

      if (!form.currentPassword || !form.newPassword) {
        setError('Both current and new password are required');
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError('New password and confirmation do not match');
        return;
      }
      if (form.newPassword.length < 6) {
        setError('New password must be at least 6 characters');
        return;
      }

      setSubmitting(true);
      try {
        await changePasswordRequest(form.currentPassword, form.newPassword);
        setMessage('Password updated successfully');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to update password'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Change Password</h2>

      <FormField label="Current Password" htmlFor="currentPassword" required>
        <PasswordInput id="currentPassword" value={form.currentPassword} onChange={handleChange('currentPassword')} required />
      </FormField>
      <FormField label="New Password" htmlFor="newPassword" required>
        <PasswordInput id="newPassword" value={form.newPassword} onChange={handleChange('newPassword')} required />
      </FormField>
      <FormField label="Confirm New Password" htmlFor="confirmPassword" required>
        <PasswordInput id="confirmPassword" value={form.confirmPassword} onChange={handleChange('confirmPassword')} required />
      </FormField>

      {message && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  );
}

// Read-only account summary: role, campus assignment (with derived
// country/city) and the effective permission set, plus a logout action.
// Shown for every role that reuses this page (Super Admin, Admin, ...) —
// campus/country/city simply render as "—" for roles with no campus
// assignment (e.g. Super Admin).
function AccountSummaryCard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // For ADMIN, curate badges down to modules with an actual sidebar entry
  // (ADMIN_NAV) — several modules (cities, campuses, courses, batches, ...)
  // are granted view-only just to back reference-data dropdowns elsewhere
  // and aren't a real "permission" worth showing here. Every other role
  // (SUPER_ADMIN today) keeps the original unfiltered behavior.
  const adminNavModules = user?.role === ROLES.ADMIN ? getNavModules(ADMIN_NAV) : null;
  const grantedModules = Object.entries(user?.permissions || {})
    .filter(([module, actions]) => actions?.view && (!adminNavModules || adminNavModules.has(module)))
    .map(([module]) => MODULE_LABELS[module] || module);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="mb-4 flex items-center gap-3">
        <Avatar src={resolveFileUrl(user?.avatar)} name={user?.name} size={48} />
        <div>
          <h2 className="text-base font-semibold text-slate-800">{user?.name}</h2>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-400">Role</p>
          <p className="text-slate-700">{user?.role?.replace('_', ' ') || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Country</p>
          <p className="text-slate-700">{user?.campus?.city?.country || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">City</p>
          <p className="text-slate-700">{user?.campus?.city?.name || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Campus</p>
          <p className="text-slate-700">{user?.campus?.name || '—'}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs text-slate-400">Permissions</p>
        {grantedModules.length === 0 ? (
          <p className="text-sm text-slate-400">No modules granted yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {grantedModules.map((label) => (
              <span
                key={label}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button variant="secondary" onClick={handleLogout}>
        <LogOut size={15} /> Logout
      </Button>
    </div>
  );
}

export default function Profile() {
  return (
    <PageContainer title="Profile" description="View and update your account details">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AccountSummaryCard />
        <ProfileDetailsForm />
        <ChangePasswordForm />
      </div>
    </PageContainer>
  );
}
