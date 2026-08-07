import { useEffect, useState } from 'react';
import { Drawer, FormField, Input, Select, Textarea, Button, ImageUpload } from '../common';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';

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
  employmentStatus: '',
  organization: '',
  designation: '',
  monthlyIncome: '',
  highestQualification: '',
  institute: '',
  yearOfCompletion: '',
};

const emptyEnrollment = { course: '', batch: '', rollNumber: '' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,15}$/;

// Formats raw digits into xxxxx-xxxxxxx-x as the user types.
function formatCnic(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join('-');
}

export default function StudentFormDrawer({ open, onClose, student, cities, courses, batches, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [enrollment, setEnrollment] = useState(emptyEnrollment);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false);
  const [imageError, setImageError] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  const isEdit = Boolean(student);
  const showEmploymentDetails = form.employmentStatus === 'employed' || form.employmentStatus === 'self_employed';
  const batchesForCourse = enrollment.course
    ? (batches || []).filter((b) => b.course?._id === enrollment.course)
    : batches || [];

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
        employmentStatus: student.employmentStatus || '',
        organization: student.organization || '',
        designation: student.designation || '',
        monthlyIncome: student.monthlyIncome ?? '',
        highestQualification: student.highestQualification || '',
        institute: student.institute || '',
        yearOfCompletion: student.yearOfCompletion ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setEnrollment(emptyEnrollment);
    setProfilePictureFile(null);
    setRemoveProfilePicture(false);
    setImageError('');
    setError('');
  }, [open, student]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCnicChange = (e) => {
    setForm((prev) => ({ ...prev, cnic: formatCnic(e.target.value) }));
  };

  const handleEnrollmentCourseChange = (e) => {
    setEnrollment({ course: e.target.value, batch: '', rollNumber: enrollment.rollNumber });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');

      if (!form.name || !form.email) {
        setError('Name and email are required');
        return;
      }
      if (!EMAIL_RE.test(form.email)) {
        setError('Enter a valid email address');
        return;
      }
      if (form.phone && !PHONE_RE.test(form.phone)) {
        setError('Enter a valid phone number');
        return;
      }
      if (form.cnic && !/^\d{5}-\d{7}-\d$/.test(form.cnic)) {
        setError('CNIC must be in the format xxxxx-xxxxxxx-x');
        return;
      }
      if (imageError) {
        setError(imageError);
        return;
      }
      if (!isEdit && enrollment.batch && !enrollment.course) {
        setError('Select a course for the enrollment');
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          profilePictureFile,
          removeProfilePicture,
          enrollment: !isEdit && enrollment.batch ? enrollment : undefined,
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save student'));
      } finally {
        setSubmitting(false);
      }
    });
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
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="03xx-xxxxxxx" />
        </FormField>
        <FormField label="Father Name" htmlFor="fatherName">
          <Input id="fatherName" value={form.fatherName} onChange={handleChange('fatherName')} />
        </FormField>
        <FormField label="CNIC" htmlFor="cnic">
          <Input id="cnic" value={form.cnic} onChange={handleCnicChange} placeholder="xxxxx-xxxxxxx-x" maxLength={15} />
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

        <FormField label="Highest Qualification" htmlFor="highestQualification">
          <Select
            id="highestQualification"
            value={form.highestQualification}
            onChange={handleChange('highestQualification')}
          >
            <option value="">Select qualification</option>
            <option value="matric">Matric</option>
            <option value="intermediate">Intermediate</option>
            <option value="bachelors">Bachelors</option>
            <option value="masters">Masters</option>
            <option value="other">Other</option>
          </Select>
        </FormField>
        <FormField label="Institute" htmlFor="institute">
          <Input id="institute" value={form.institute} onChange={handleChange('institute')} />
        </FormField>
        <FormField label="Year of Completion" htmlFor="yearOfCompletion">
          <Input
            id="yearOfCompletion"
            type="number"
            min="1950"
            max="2100"
            value={form.yearOfCompletion}
            onChange={handleChange('yearOfCompletion')}
          />
        </FormField>

        <FormField label="Employment Status" htmlFor="employmentStatus">
          <Select id="employmentStatus" value={form.employmentStatus} onChange={handleChange('employmentStatus')}>
            <option value="">Select status</option>
            <option value="unemployed">Unemployed</option>
            <option value="employed">Employed</option>
            <option value="self_employed">Self-Employed</option>
            <option value="student">Student</option>
          </Select>
        </FormField>
        {showEmploymentDetails && (
          <>
            <FormField label="Organization" htmlFor="organization">
              <Input id="organization" value={form.organization} onChange={handleChange('organization')} />
            </FormField>
            <FormField label="Designation" htmlFor="designation">
              <Input id="designation" value={form.designation} onChange={handleChange('designation')} />
            </FormField>
            <FormField label="Monthly Income (PKR)" htmlFor="monthlyIncome">
              <Input
                id="monthlyIncome"
                type="number"
                min="0"
                value={form.monthlyIncome}
                onChange={handleChange('monthlyIncome')}
              />
            </FormField>
          </>
        )}

        {!isEdit && (
          <div className="mb-4 rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Enrollment (optional)</p>
            <FormField label="Course" htmlFor="enrollCourse">
              <Select id="enrollCourse" value={enrollment.course} onChange={handleEnrollmentCourseChange}>
                <option value="">Select course</option>
                {(courses || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Batch" htmlFor="enrollBatch">
              <Select
                id="enrollBatch"
                value={enrollment.batch}
                onChange={(e) => setEnrollment((prev) => ({ ...prev, batch: e.target.value }))}
                disabled={!enrollment.course}
              >
                <option value="">{enrollment.course ? 'Select batch' : 'Select a course first'}</option>
                {batchesForCourse.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.batchCode}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Roll Number" htmlFor="enrollRollNumber">
              <Input
                id="enrollRollNumber"
                value={enrollment.rollNumber}
                onChange={(e) => setEnrollment((prev) => ({ ...prev, rollNumber: e.target.value }))}
                placeholder="Optional"
              />
            </FormField>
            <p className="text-xs text-slate-400">Enroll the student in a batch immediately, or add enrollments later from the student's detail view.</p>
          </div>
        )}

        <FormField label="Profile Picture" htmlFor="profilePicture">
          <ImageUpload
            key={student?._id || 'new'}
            currentUrl={resolveFileUrl(student?.profilePicture)}
            onChange={(file) => {
              setProfilePictureFile(file);
              if (file) setRemoveProfilePicture(false);
            }}
            onRemove={() => setRemoveProfilePicture(true)}
            error={imageError}
            setError={setImageError}
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
