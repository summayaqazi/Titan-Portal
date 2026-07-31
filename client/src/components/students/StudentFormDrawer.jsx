import { useEffect, useState } from 'react';
import { Drawer, FormField, Input, Select, Textarea, Button } from '../common';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  fatherName: '',
  cnic: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  city: '',
  isActive: true,
};

export default function StudentFormDrawer({ open, onClose, student, cities, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(student);

  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        name: student.user?.name || '',
        email: student.user?.email || '',
        phone: student.user?.phone || '',
        fatherName: student.fatherName || '',
        cnic: student.cnic || '',
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
        gender: student.gender || '',
        address: student.address || '',
        city: student.city?._id || '',
        isActive: student.isActive ?? true,
      });
    } else {
      setForm(emptyForm);
    }
    setProfilePictureFile(null);
    setError('');
  }, [open, student]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ ...form, profilePictureFile });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save student');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Student' : 'Add Student'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit}>
        <FormField label="Full Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" type="email" value={form.email} onChange={handleChange('email')} required />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} />
        </FormField>
        <FormField label="Father Name" htmlFor="fatherName">
          <Input id="fatherName" value={form.fatherName} onChange={handleChange('fatherName')} />
        </FormField>
        <FormField label="CNIC" htmlFor="cnic">
          <Input id="cnic" value={form.cnic} onChange={handleChange('cnic')} placeholder="xxxxx-xxxxxxx-x" />
        </FormField>
        <FormField label="Date of Birth" htmlFor="dateOfBirth">
          <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} />
        </FormField>
        <FormField label="Gender" htmlFor="gender">
          <Select id="gender" value={form.gender} onChange={handleChange('gender')}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        <FormField label="City" htmlFor="city">
          <Select id="city" value={form.city} onChange={handleChange('city')}>
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Address" htmlFor="address">
          <Textarea id="address" value={form.address} onChange={handleChange('address')} />
        </FormField>
        <FormField label="Profile Picture" htmlFor="profilePicture">
          <input
            id="profilePicture"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setProfilePictureFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100"
          />
        </FormField>
        {isEdit && (
          <FormField label="Active" htmlFor="isActive">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
              Student account is active
            </label>
          </FormField>
        )}
        {!isEdit && (
          <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            A login account will be created with the default password <strong>Student123</strong>.
          </p>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}
