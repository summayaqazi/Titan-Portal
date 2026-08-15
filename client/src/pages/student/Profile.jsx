import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Cake,
  GraduationCap,
  IdCard,
  ShieldCheck,
  Pencil,
  Contact,
  UserRound,
  BookOpen,
  LogOut,
  Download,
} from 'lucide-react';
import { PageContainer, Avatar, StatusBadge, Button, Drawer, FormField, Input, Select, Textarea, ImageUpload } from '../../components/common';
import studentPortalApi from '../../api/studentPortalApi';
import { updateProfileRequest } from '../../api/profileApi';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import { downloadStudentIdCard } from '../../utils/studentIdCard';
import useSubmitGuard from '../../hooks/useSubmitGuard';

const GENDER_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

// Mirrors Student.js's own highestQualification enum exactly (server-side
// validated against the schema itself, not a hardcoded list — this is
// purely a display-label lookup for the same values).
const QUALIFICATION_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'matric', label: 'Matric' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'bachelors', label: "Bachelor's" },
  { value: 'masters', label: "Master's" },
  { value: 'other', label: 'Other' },
];
// Empty/unset intentionally returns null (not the placeholder option's own
// "Not set" label) so InfoRow's single "Not provided" fallback is what
// actually renders — one consistent empty-state string across every field,
// not two different ones depending on which field it is.
const labelFor = (options, value) => (value ? options.find((o) => o.value === value)?.label : null) || null;

const PHONE_RE = /^[0-9+\-\s()]{7,15}$/;

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value || 'Not provided'}</p>
      </div>
    </div>
  );
}

// Editable: Name, Phone (via the existing shared PUT /auth/profile — same
// endpoint/pattern Super Admin/Admin/Trainer already use for these two
// fields), Address/Gender/Date of Birth/Highest Qualification/Profile
// Image (via the new PUT /student/me/profile). Email and CNIC are
// deliberately read-only — see updateMyProfile's own comment in
// studentPortal.controller.js for the reasoning on both. Resets to the
// latest saved `profile` every time it's opened, so Cancel always
// discards unsaved changes without an API call.
function EditProfileDrawer({ open, onClose, profile, onSaved }) {
  const { updateUser } = useAuth();
  const guardSubmit = useSubmitGuard();
  const [form, setForm] = useState(null);
  const [pictureFile, setPictureFile] = useState(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [pictureError, setPictureError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        address: profile.address || '',
        gender: profile.gender || '',
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : '',
        highestQualification: profile.highestQualification || '',
      });
      setPictureFile(null);
      setRemovePicture(false);
      setPictureError('');
      setError('');
    }
  }, [open, profile]);

  if (!form) return null;

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name.trim()) {
        setError('Name is required');
        return;
      }
      if (form.phone && !PHONE_RE.test(form.phone)) {
        setError('Enter a valid phone number');
        return;
      }
      if (pictureError) {
        setError(pictureError);
        return;
      }

      setSubmitting(true);
      // Two independent resources (User vs Student), same as Trainer's own
      // Profile page — both must actually succeed against the backend
      // before anything is treated as saved; a partial failure is reported,
      // not silently swallowed, and the form stays open with what the
      // student typed.
      try {
        const updatedUser = await updateProfileRequest({ name: form.name.trim(), phone: form.phone });
        updateUser(updatedUser);
      } catch (err) {
        setSubmitting(false);
        setError(getErrorMessage(err, 'Failed to update name/phone'));
        return;
      }

      try {
        const updatedStudent = await studentPortalApi.updateMyProfile({
          address: form.address,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          highestQualification: form.highestQualification,
          profilePictureFile: pictureFile,
          removeProfilePicture: removePicture,
        });
        onSaved({ name: form.name.trim(), phone: form.phone, ...updatedStudent });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Name/phone were saved, but the rest of your profile failed to update'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit Profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="student-edit-profile-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id="student-edit-profile-form" onSubmit={handleSubmit}>
        <FormField label="Profile Image">
          <ImageUpload
            currentUrl={resolveFileUrl(profile.profilePicture)}
            onChange={(file) => {
              setPictureFile(file);
              if (file) setRemovePicture(false);
            }}
            onRemove={() => setRemovePicture(true)}
            error={pictureError}
            setError={setPictureError}
            round
          />
        </FormField>

        <FormField label="Full Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" value={profile.email} disabled className="bg-slate-50 text-slate-400" />
        </FormField>
        <FormField label="Phone Number" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="03xx-xxxxxxx" />
        </FormField>
        <FormField label="Full Address" htmlFor="address">
          <Textarea id="address" rows={2} value={form.address} onChange={handleChange('address')} maxLength={500} />
        </FormField>
        <FormField label="Gender" htmlFor="gender">
          <Select id="gender" value={form.gender} onChange={handleChange('gender')}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Date of Birth" htmlFor="dateOfBirth">
          <Input
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={handleChange('dateOfBirth')}
          />
        </FormField>
        <FormField label="Last Qualification" htmlFor="highestQualification">
          <Select id="highestQualification" value={form.highestQualification} onChange={handleChange('highestQualification')}>
            {QUALIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="CNIC">
          <Input value={profile.cnic || '—'} disabled className="bg-slate-50 text-slate-400" />
        </FormField>

        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  // Same logout() + redirect pattern the Sidebar's own Student Logout
  // control already uses — this button doesn't replace that one (still
  // there for every other Student page), it's just also reachable from
  // here per the reference layout.
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [cardError, setCardError] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Same try/download/finally shape as the Trainer Portal's own "Download
  // Profile ID" handler (pages/trainer/Profile.jsx) — reuses whatever's
  // already loaded in `profile` rather than a second fetch, since this page
  // already keeps it fresh via the effect below.
  const handleDownloadIdCard = async () => {
    setCardError('');
    setDownloadingCard(true);
    try {
      await downloadStudentIdCard(profile);
    } catch (err) {
      setCardError(err.message || 'Failed to generate the ID card');
    } finally {
      setDownloadingCard(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    studentPortalApi
      .getMyProfile()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load profile'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer title="Profile" description="Your account and enrollment details">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading || !profile ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Header — a plain navy band (the same --color-sidebar used by
              the Admin/Super Admin/Trainer portal's own navbar) stands in
              for a cover image (no cover-photo field exists anywhere in
              the data model, so nothing is fetched/faked for it — it's
              pure decorative chrome, same category as a card's border or
              background).
              Name sits above the role badge (not beside it) so the two
              never compete for the same line; avatar stays beside that
              stacked text block, its bottom edge overlapping the banner —
              and, per the same overlap, the name itself sits ON the navy
              band (confirmed by rendering it), so it's white rather than
              the dark slate used everywhere else on this page; the role
              badge and email below it clear the band and stay on the
              white card body, so they're untouched (StatusBadge's own
              opaque pill background is self-contained regardless either
              way). The whole avatar+text group is then centered as a unit
              against the Edit Profile button. */}
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="h-24 bg-(--color-sidebar) sm:h-28" />
            <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="-mt-10 flex items-end gap-4">
                <Avatar
                  src={resolveFileUrl(profile.profilePicture)}
                  name={profile.name}
                  size={84}
                  className="border-4 border-white shadow-sm"
                />
                <div className="min-w-0 pb-1">
                  <h1 className="truncate text-xl font-bold text-white sm:text-2xl">{profile.name}</h1>
                  <div className="mt-1.5">
                    <StatusBadge status="student" />
                  </div>
                  <p className="mt-1.5 truncate text-sm text-slate-500">{profile.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handleDownloadIdCard} disabled={downloadingCard} className="shrink-0">
                    <Download size={15} /> {downloadingCard ? 'Generating…' : 'Download ID Card'}
                  </Button>
                  <Button onClick={() => setEditOpen(true)} className="shrink-0">
                    <Pencil size={15} /> Edit Profile
                  </Button>
                </div>
                {cardError && <p className="text-xs text-red-600">{cardError}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Contact size={16} className="text-primary-600" /> Contact Info
              </h2>
              <div className="space-y-4">
                <InfoRow icon={Mail} label="Email" value={profile.email} />
                <InfoRow icon={Phone} label="Phone" value={profile.phone} />
                <InfoRow icon={MapPin} label="Full Address" value={profile.address} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserRound size={16} className="text-primary-600" /> Personal Information
              </h2>
              <div className="space-y-4">
                <InfoRow icon={GraduationCap} label="Gender" value={labelFor(GENDER_OPTIONS, profile.gender)} />
                <InfoRow icon={Cake} label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
                <InfoRow icon={GraduationCap} label="Last Qualification" value={labelFor(QUALIFICATION_OPTIONS, profile.highestQualification)} />
                <InfoRow
                  icon={IdCard}
                  label="CNIC"
                  value={
                    profile.cnic ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {profile.cnic}
                        {profile.cnicVerified && (
                          <span className="flex items-center gap-0.5 text-xs font-medium text-green-600">
                            <ShieldCheck size={12} /> Verified
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BookOpen size={16} className="text-primary-600" /> Enrolled Courses
                </h2>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-semibold text-primary-700">
                  {profile.enrollments.length}
                </span>
              </div>
              {profile.enrollments.length === 0 ? (
                <p className="text-xs text-slate-400">No courses enrolled.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profile.enrollments.map((e) => (
                    <li
                      key={e.enrollmentId}
                      className="flex items-center justify-between gap-3 rounded-lg border-l-4 border-primary-400 bg-primary-50/60 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-700">{e.courseName}</p>
                        <p className="mt-0.5 text-xs text-slate-400">{e.batchCode}</p>
                      </div>
                      <StatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="danger" onClick={handleLogout}>
              <LogOut size={15} /> Logout
            </Button>
          </div>

          <EditProfileDrawer
            open={editOpen}
            onClose={() => setEditOpen(false)}
            profile={profile}
            onSaved={(updates) => setProfile((prev) => ({ ...prev, ...updates }))}
          />
        </>
      )}
    </PageContainer>
  );
}
