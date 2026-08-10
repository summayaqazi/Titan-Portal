import { useState } from 'react';
import { Eye, EyeOff, Download, Link2, Globe } from 'lucide-react';
import { PageContainer, FormField, Input, Textarea, Button, ImageUpload, Avatar } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { updateProfileRequest, changePasswordRequest } from '../../api/profileApi';
import { getMeRequest } from '../../api/authApi';
import trainerPortalApi from '../../api/trainerPortalApi';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import { downloadTrainerIdCard } from '../../utils/trainerIdCard';

// Name/phone/avatar and password reuse the exact same endpoints
// (/auth/profile, /auth/password) and form shape as Super Admin/Admin's own
// Profile page — that page itself isn't touched, this is a separate file so
// the locked Super Admin/Admin portals are never at risk from Trainer-only
// changes, but the underlying API + UI primitives are 100% shared.

function PersonalInfoForm() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  const trainerProfile = user?.trainerProfile;

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
      <h2 className="mb-4 text-base font-semibold text-slate-800">Personal Information</h2>

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
      <FormField label="Employee ID" htmlFor="employeeId">
        <Input id="employeeId" value={trainerProfile?.employeeId || '—'} disabled className="bg-slate-50 text-slate-400" />
      </FormField>
      <FormField label="Hourly Rate" htmlFor="hourlyRate">
        <Input
          id="hourlyRate"
          value={trainerProfile?.hourlyRate != null ? trainerProfile.hourlyRate : '—'}
          disabled
          className="bg-slate-50 text-slate-400"
        />
      </FormField>

      {message && <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save Changes'}
      </Button>
    </form>
  );
}

function BioAndSocialForm() {
  const { user, updateUser } = useAuth();
  const trainerProfile = user?.trainerProfile;
  const [bio, setBio] = useState(trainerProfile?.bio || '');
  const [socialLinks, setSocialLinks] = useState({
    linkedin: trainerProfile?.socialLinks?.linkedin || '',
    twitter: trainerProfile?.socialLinks?.twitter || '',
    facebook: trainerProfile?.socialLinks?.facebook || '',
    website: trainerProfile?.socialLinks?.website || '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      setMessage('');
      setSubmitting(true);
      try {
        const updated = await trainerPortalApi.updateProfile({ bio, socialLinks });
        updateUser({ trainerProfile: updated });
        setMessage('Bio & social links updated successfully');
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to update bio & social links'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  const linkField = (key, label, Icon) => (
    <FormField label={label} htmlFor={key}>
      <div className="relative">
        <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          id={key}
          className="pl-9"
          value={socialLinks[key]}
          onChange={(e) => setSocialLinks((p) => ({ ...p, [key]: e.target.value }))}
          placeholder="https://…"
        />
      </div>
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Bio & Social Links</h2>

      <FormField label="Bio" htmlFor="bio">
        <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell students a little about yourself…" />
      </FormField>

      {linkField('linkedin', 'LinkedIn', Link2)}
      {linkField('twitter', 'Twitter', Link2)}
      {linkField('facebook', 'Facebook', Link2)}
      {linkField('website', 'Website', Globe)}

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

function ProfileHeader() {
  const { user, updateUser } = useAuth();
  const trainerProfile = user?.trainerProfile;
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setError('');
    setDownloading(true);
    try {
      // Re-fetch first so an edit made just now (name, photo, or a course
      // reassignment by Super Admin/Admin elsewhere) is reflected in the
      // card instead of whatever was in memory since login.
      let latestUser = user;
      try {
        const { user: fresh } = await getMeRequest();
        latestUser = fresh;
        updateUser(fresh);
      } catch {
        // Fall back to the in-memory profile — still real, still dynamic,
        // just possibly a few minutes stale.
      }
      await downloadTrainerIdCard(latestUser);
    } catch (err) {
      setError(err.message || 'Failed to generate the ID card');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center lg:col-span-2">
      <div className="flex items-center gap-3">
        <Avatar src={resolveFileUrl(user?.avatar)} name={user?.name} size={56} />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{user?.name}</h2>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <p className="mt-0.5 text-xs text-slate-400">{trainerProfile?.employeeId}</p>
        </div>
      </div>
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
          <Download size={15} /> {downloading ? 'Generating…' : 'Download Profile ID'}
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <PageContainer title="Profile" description="Your account details">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ProfileHeader />
        <PersonalInfoForm />
        <BioAndSocialForm />
        <ChangePasswordForm />
      </div>
    </PageContainer>
  );
}
