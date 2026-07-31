import { useState } from 'react';
import { User } from 'lucide-react';
import { PageContainer, FormField, Input, Button } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { updateProfileRequest, changePasswordRequest } from '../../api/profileApi';

function ProfileDetailsForm() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!form.name) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updateProfileRequest({ ...form, avatarFile });
      updateUser(updated);
      setMessage('Profile updated successfully');
      setAvatarFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const avatarUrl = user?.avatar ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${user.avatar}` : null;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Profile Details</h2>

      <div className="mb-4 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-blue-700">
          {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : <User size={28} />}
        </span>
        <div>
          <input
            id="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
            className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100"
          />
        </div>
      </div>

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

function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      setError(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Change Password</h2>

      <FormField label="Current Password" htmlFor="currentPassword" required>
        <Input
          id="currentPassword"
          type="password"
          value={form.currentPassword}
          onChange={handleChange('currentPassword')}
          required
        />
      </FormField>
      <FormField label="New Password" htmlFor="newPassword" required>
        <Input id="newPassword" type="password" value={form.newPassword} onChange={handleChange('newPassword')} required />
      </FormField>
      <FormField label="Confirm New Password" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange('confirmPassword')}
          required
        />
      </FormField>

      {message && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Updating…' : 'Update Password'}
      </Button>
    </form>
  );
}

export default function Profile() {
  return (
    <PageContainer title="Profile" description="View and update your account details">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileDetailsForm />
        <ChangePasswordForm />
      </div>
    </PageContainer>
  );
}
