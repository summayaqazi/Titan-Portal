import { useEffect, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Drawer, FormField, Input, Select, Button, ImageUpload } from '../common';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  campuses: [],
  courses: [],
  specialization: '',
  qualification: '',
  cnic: '',
  joiningDate: '',
  isActive: true,
  hourlyRate: '',
  bio: '',
  socialLinks: { linkedin: '', twitter: '', facebook: '', website: '' },
};

const selectedValues = (e) => Array.from(e.target.selectedOptions).map((o) => o.value);

export default function TrainerFormDrawer({ open, onClose, trainer, campuses, courses, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(trainer);

  useEffect(() => {
    if (!open) return;
    if (trainer) {
      setForm({
        name: trainer.user?.name || '',
        email: trainer.user?.email || '',
        phone: trainer.user?.phone || '',
        campuses: (trainer.campuses || []).map((c) => c._id),
        courses: (trainer.courses || []).map((c) => c._id),
        specialization: (trainer.specialization || []).join(', '),
        qualification: trainer.qualification || '',
        cnic: trainer.cnic || '',
        joiningDate: trainer.joiningDate ? trainer.joiningDate.slice(0, 10) : '',
        isActive: trainer.isActive,
        hourlyRate: trainer.hourlyRate ?? '',
        bio: trainer.bio || '',
        socialLinks: {
          linkedin: trainer.socialLinks?.linkedin || '',
          twitter: trainer.socialLinks?.twitter || '',
          facebook: trainer.socialLinks?.facebook || '',
          website: trainer.socialLinks?.website || '',
        },
      });
    } else {
      setForm(emptyForm);
    }
    setProfileImageFile(null);
    setRemoveProfileImage(false);
    setImageError('');
    setError('');
  }, [open, trainer]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSocialChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: e.target.value } }));

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name || !form.email || form.campuses.length === 0) {
        setError('Name, email and at least one campus are required');
        return;
      }
      if (imageError) {
        setError(imageError);
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          specialization: form.specialization
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          profileImageFile,
          removeProfileImage,
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save trainer'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Trainer' : 'Add Trainer'}
      width="w-[520px]"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="trainer-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="trainer-form" onSubmit={handleSubmit}>
        <FormField label="Full Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" type="email" value={form.email} onChange={handleChange('email')} required />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} />
        </FormField>
        <FormField label="Campuses" htmlFor="campuses" required>
          <Select
            id="campuses"
            multiple
            size={Math.min(campuses.length || 1, 4)}
            value={form.campuses}
            onChange={(e) => setForm((p) => ({ ...p, campuses: selectedValues(e) }))}
          >
            {campuses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-400">Hold Ctrl/Cmd to select multiple campuses.</p>
        </FormField>
        <FormField label="Assigned Courses" htmlFor="courses">
          <Select
            id="courses"
            multiple
            size={Math.min(courses.length || 1, 4)}
            value={form.courses}
            onChange={(e) => setForm((p) => ({ ...p, courses: selectedValues(e) }))}
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Specialization" htmlFor="specialization">
          <Input
            id="specialization"
            value={form.specialization}
            onChange={handleChange('specialization')}
            placeholder="Comma separated, e.g. Web Development, Cloud Computing"
          />
        </FormField>
        <FormField label="Qualification" htmlFor="qualification">
          <Input id="qualification" value={form.qualification} onChange={handleChange('qualification')} />
        </FormField>
        <FormField label="Hourly Rate (PKR)" htmlFor="hourlyRate">
          <Input id="hourlyRate" type="number" min="0" value={form.hourlyRate} onChange={handleChange('hourlyRate')} />
        </FormField>
        <FormField label="CNIC" htmlFor="cnic">
          <Input id="cnic" value={form.cnic} onChange={handleChange('cnic')} placeholder="xxxxx-xxxxxxx-x" />
        </FormField>
        <FormField label="Joining Date" htmlFor="joiningDate">
          <Input id="joiningDate" type="date" value={form.joiningDate} onChange={handleChange('joiningDate')} />
        </FormField>

        <FormField label="Biography" htmlFor="bio">
          <ReactQuill theme="snow" value={form.bio} onChange={(value) => setForm((p) => ({ ...p, bio: value }))} />
        </FormField>

        <FormField label="Social Links">
          <div className="space-y-2">
            <Input placeholder="LinkedIn URL" value={form.socialLinks.linkedin} onChange={handleSocialChange('linkedin')} />
            <Input placeholder="Twitter / X URL" value={form.socialLinks.twitter} onChange={handleSocialChange('twitter')} />
            <Input placeholder="Facebook URL" value={form.socialLinks.facebook} onChange={handleSocialChange('facebook')} />
            <Input placeholder="Website URL" value={form.socialLinks.website} onChange={handleSocialChange('website')} />
          </div>
        </FormField>

        <FormField label="Profile Image" htmlFor="profileImage">
          <ImageUpload
            key={trainer?._id || 'new'}
            currentUrl={resolveFileUrl(trainer?.profileImage)}
            onChange={(file) => {
              setProfileImageFile(file);
              if (file) setRemoveProfileImage(false);
            }}
            onRemove={() => setRemoveProfileImage(true)}
            error={imageError}
            setError={setImageError}
            round
          />
        </FormField>

        {isEdit && (
          <FormField label="Active" htmlFor="isActive">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
              Trainer is active
            </label>
          </FormField>
        )}
        {!isEdit && (
          <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            A login account will be created with the default password <strong>Trainer123</strong>.
          </p>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}
