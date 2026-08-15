import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Eye, EyeOff, GraduationCap, KeyRound, Info, UserRound } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, FormField, Input, Select, Textarea, ImageUpload } from '../../components/common';
import publicApi from '../../api/publicApi';

// Same CNIC auto-formatter used by the Admin-facing StudentFormDrawer
// (components/students/StudentFormDrawer.jsx) — copied rather than
// imported since it isn't exported from a shared module today; kept
// byte-identical so a CNIC typed here behaves exactly the same way.
function formatCnic(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join('-');
}

const CNIC_RE = /^\d{5}-\d{7}-\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

const emptyForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  fatherName: '',
  cnic: '',
  fatherCnic: '',
  fatherContactNumber: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  highestQualification: '',
  computerProficiency: '',
  laptopAvailability: '',
  batch: '',
};

function PasswordField({ id, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// Public Student Registration + Course Enrollment form. Reachable as
// /register (course chosen inline) or /enroll/:courseId (course
// pre-selected — from CourseDetails's "Enroll Now", or a shared link).
// Submits once to POST /api/public/register, which atomically creates
// User + Student + Enrollment (or, for a returning applicant, just a new
// Enrollment on their existing Student — see public.controller.js).
export default function Register() {
  const { courseId: routeCourseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [allCourses, setAllCourses] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(routeCourseId || '');
  // Bug fix (pre-existing, found while verifying this page live): when
  // landing on plain /register with neither a route param nor router state
  // (a bookmark, a typed URL, browser back/forward), `routeCourseId` and
  // `location.state?.course?._id` are BOTH `undefined`, so the old
  // `=== routeCourseId` check spuriously matched and then read
  // `location.state.course` unguarded — throwing on the `null` state,
  // crashing the whole page. Fully optional-chained now, and the id
  // comparison only ever "matches" when a course id genuinely came through
  // router state, never as a side effect of both sides being undefined.
  const [courseDetail, setCourseDetail] = useState(
    routeCourseId && location.state?.course?._id === routeCourseId ? location.state.course : null
  );
  const [courseLoadError, setCourseLoadError] = useState('');

  const [form, setForm] = useState(emptyForm);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [imageError, setImageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Course picker only needed when no course was pre-selected via the URL.
  useEffect(() => {
    if (routeCourseId) return;
    publicApi
      .listCourses()
      .then(setAllCourses)
      .catch(() => setCourseLoadError('Unable to load the course list right now.'));
  }, [routeCourseId]);

  // Fetch full details (incl. open batches) whenever the selected course
  // changes — including on first load for /enroll/:courseId, unless it was
  // already handed off via router state from CourseDetails.
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseDetail(null);
      return;
    }
    if (courseDetail?._id === selectedCourseId) return;

    setCourseLoadError('');
    publicApi
      .getCourse(selectedCourseId)
      .then(setCourseDetail)
      .catch(() => {
        setCourseDetail(null);
        setCourseLoadError('This course could not be loaded. Please pick another course.');
      });
    setForm((prev) => ({ ...prev, batch: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleCnicChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: formatCnic(e.target.value) }));

  const availableBatches = courseDetail?.batches || [];

  const batchOptionLabel = (batch) =>
    [batch.batchCode, batch.campus?.name, batch.slot?.label].filter(Boolean).join(' — ');

  // Mirrors the backend's own validation in public.controller.js — server
  // is still the source of truth (re-checked there on submit), this is
  // only for instant feedback instead of a round-trip 400.
  const validate = () => {
    const errors = {};
    if (!selectedCourseId) errors.course = 'Please select a course';
    if (!form.batch) errors.batch = 'Please select a batch';

    if (!form.name.trim()) errors.name = 'Full name is required';
    if (!EMAIL_RE.test(form.email)) errors.email = 'A valid email address is required';
    if (form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match';
    if (!PHONE_RE.test(form.phone)) errors.phone = 'A valid phone number is required';
    if (!form.fatherName.trim()) errors.fatherName = "Father's name is required";
    if (!CNIC_RE.test(form.cnic)) errors.cnic = 'CNIC must be in the format xxxxx-xxxxxxx-x';
    if (form.fatherCnic && !CNIC_RE.test(form.fatherCnic)) {
      errors.fatherCnic = "Father's CNIC must be in the format xxxxx-xxxxxxx-x";
    }
    if (form.fatherContactNumber && !PHONE_RE.test(form.fatherContactNumber)) {
      errors.fatherContactNumber = "Enter a valid father's contact number";
    }
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    else if (new Date(form.dateOfBirth) > new Date()) errors.dateOfBirth = 'Date of birth cannot be in the future';
    if (!form.gender) errors.gender = 'Please select a gender';
    if (!form.address.trim()) errors.address = 'Address is required';
    if (!form.highestQualification) errors.highestQualification = 'Please select a qualification';
    // Shown through ImageUpload's own error slot (imageError), not
    // fieldErrors — same as its file-type/size errors, so there's exactly
    // one message in one place instead of two for the same field.
    if (!profilePictureFile) setImageError('A profile photo is required to register');

    setFieldErrors(errors);
    return Object.keys(errors).length === 0 && Boolean(profilePictureFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = await publicApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone,
        fatherName: form.fatherName,
        cnic: form.cnic,
        fatherCnic: form.fatherCnic,
        fatherContactNumber: form.fatherContactNumber,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        address: form.address,
        highestQualification: form.highestQualification,
        computerProficiency: form.computerProficiency,
        laptopAvailability: form.laptopAvailability,
        course: selectedCourseId,
        batch: form.batch,
        profilePicture: profilePictureFile || undefined,
      });
      navigate('/register/success', { state: { result: data } });
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong submitting your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const courseLocked = Boolean(routeCourseId);

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/courses" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to courses
        </Link>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Same thin navy brand accent as Course Details / Job Details. */}
          <div className="h-1.5 bg-(--color-sidebar)" />
          <div className="p-6 sm:p-8">
            <h1 className="mb-1 text-xl font-semibold text-slate-800">Student Registration</h1>
            <p className="mb-6 text-sm text-slate-500">
              Fill in your details below to apply. Your application will be reviewed by the institute before your
              Student Portal account becomes active.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpen size={16} className="text-primary-600" /> Course
              </h2>

              {!courseLocked && (
                <FormField label="Select Course" htmlFor="course" required error={fieldErrors.course}>
                  <Select
                    id="course"
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                    }}
                  >
                    <option value="">Select a course</option>
                    {(allCourses || []).map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              {courseLocked && courseDetail && (
                <div className="mb-4 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">{courseDetail.name}</span>
                  <Link to="/courses" className="text-xs text-primary-700 hover:underline">
                    Change course
                  </Link>
                </div>
              )}

              {courseLoadError && <p className="mb-4 text-xs text-red-600">{courseLoadError}</p>}

              {selectedCourseId && (
                <FormField label="Select Batch" htmlFor="batch" required error={fieldErrors.batch}>
                  <Select id="batch" value={form.batch} onChange={handleChange('batch')} disabled={!courseDetail}>
                    <option value="">
                      {courseDetail ? 'Select a batch' : 'Loading batches…'}
                    </option>
                    {availableBatches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {batchOptionLabel(b)}
                      </option>
                    ))}
                  </Select>
                  {courseDetail && availableBatches.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">No batches are currently open for this course.</p>
                  )}
                </FormField>
              )}

              <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound size={16} className="text-primary-600" /> Personal Information
              </h2>

              <FormField label="Full Name" htmlFor="name" required error={fieldErrors.name}>
                <Input id="name" value={form.name} onChange={handleChange('name')} autoComplete="name" />
              </FormField>
              <FormField label="Father's Name" htmlFor="fatherName" required error={fieldErrors.fatherName}>
                <Input id="fatherName" value={form.fatherName} onChange={handleChange('fatherName')} />
              </FormField>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="Email" htmlFor="email" required error={fieldErrors.email}>
                  <Input id="email" type="email" value={form.email} onChange={handleChange('email')} autoComplete="email" />
                </FormField>
                <FormField label="Phone" htmlFor="phone" required error={fieldErrors.phone}>
                  <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="03xx-xxxxxxx" />
                </FormField>
              </div>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="CNIC" htmlFor="cnic" required error={fieldErrors.cnic}>
                  <Input id="cnic" value={form.cnic} onChange={handleCnicChange('cnic')} placeholder="xxxxx-xxxxxxx-x" maxLength={15} />
                </FormField>
                <FormField label="Father's CNIC" htmlFor="fatherCnic" error={fieldErrors.fatherCnic}>
                  <Input
                    id="fatherCnic"
                    value={form.fatherCnic}
                    onChange={handleCnicChange('fatherCnic')}
                    placeholder="xxxxx-xxxxxxx-x"
                    maxLength={15}
                  />
                </FormField>
              </div>
              <FormField label="Father's Contact Number" htmlFor="fatherContactNumber" error={fieldErrors.fatherContactNumber}>
                <Input id="fatherContactNumber" value={form.fatherContactNumber} onChange={handleChange('fatherContactNumber')} />
              </FormField>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="Date of Birth" htmlFor="dateOfBirth" required error={fieldErrors.dateOfBirth}>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} />
                </FormField>
                <FormField label="Gender" htmlFor="gender" required error={fieldErrors.gender}>
                  <Select id="gender" value={form.gender} onChange={handleChange('gender')}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Address" htmlFor="address" required error={fieldErrors.address}>
                <Textarea id="address" value={form.address} onChange={handleChange('address')} />
              </FormField>

              <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <GraduationCap size={16} className="text-primary-600" /> Education
              </h2>

              <FormField label="Last Qualification" htmlFor="highestQualification" required error={fieldErrors.highestQualification}>
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
              <FormField label="Computer Proficiency" htmlFor="computerProficiency">
                <Select id="computerProficiency" value={form.computerProficiency} onChange={handleChange('computerProficiency')}>
                  <option value="">Select level</option>
                  <option value="none">None</option>
                  <option value="basic">Basic</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </FormField>

              <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Info size={16} className="text-primary-600" /> Additional Information
              </h2>

              <FormField label="Laptop Availability" htmlFor="laptopAvailability">
                <Select id="laptopAvailability" value={form.laptopAvailability} onChange={handleChange('laptopAvailability')}>
                  <option value="">Prefer not to say</option>
                  <option value="true">I have a laptop</option>
                  <option value="false">I don't have a laptop</option>
                </Select>
              </FormField>
              <FormField label="Profile Image" htmlFor="profilePicture" required>
                <ImageUpload onChange={setProfilePictureFile} error={imageError} setError={setImageError} />
              </FormField>

              <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <KeyRound size={16} className="text-primary-600" /> Account
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Choose a password for your Student Portal account. You'll be able to sign in once your application is
                approved.
              </p>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                <FormField label="Password" htmlFor="password" required error={fieldErrors.password}>
                  <PasswordField
                    id="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </FormField>
                <FormField label="Confirm Password" htmlFor="confirmPassword" required error={fieldErrors.confirmPassword}>
                  <PasswordField
                    id="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </FormField>
              </div>
              <p className="mb-4 text-xs text-slate-400">
                Already applied before? Enter your existing account's email and password here to submit another
                course application to the same account.
              </p>

              {serverError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Application'}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
