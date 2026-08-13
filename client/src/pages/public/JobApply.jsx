import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, FileText, X } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import { Button, FormField, Input, Textarea } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { validateResumeFile } from '../../utils/validateFile';
import publicJobsApi from '../../api/publicJobsApi';
import applicantApi from '../../api/applicantApi';

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  TRAINER: 'Trainer',
  STUDENT: 'Student',
};

// Same show/hide password pattern already used on Login.jsx / Register.jsx.
function PasswordField({ id, value, onChange, autoComplete, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
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

// The "Apply Now" destination from Job Details (Phase 2's minimal
// integration point). Combines the auth gate (Login / Create Applicant
// Account) and the Application Form into one page, switching view based on
// the current auth state — never a separate route for each step, and never
// routes an authenticated non-Applicant (Student/Trainer/Admin/Super Admin)
// into submitting as themselves.
export default function JobApply() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const [job, setJob] = useState(null);
  const [jobError, setJobError] = useState('');

  useEffect(() => {
    publicJobsApi
      .getOne(jobId)
      .then(setJob)
      .catch((err) => setJobError(err.response?.data?.message || 'This job could not be found.'));
  }, [jobId]);

  // --- Auth gate (Login / Create Account) ---
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const handleAuthChange = (field) => (e) => setAuthForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      // Reuses the exact same login() AuthContext already exposes (the one
      // and only place a session token is minted) — no second auth flow.
      const loggedInUser = await login(authForm.email, authForm.password);
      if (loggedInUser.role !== ROLES.APPLICANT) {
        setAuthError(
          `This is a ${ROLE_LABELS[loggedInUser.role] || loggedInUser.role} account, not a job applicant account. Please log out and use a different account, or create a new applicant account below.`
        );
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Unable to log in. Please check your email and password.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authForm.name.trim()) {
      setAuthError('Name is required');
      return;
    }
    if (authForm.password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    if (authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    setAuthSubmitting(true);
    try {
      // Registration only creates the account (User + Applicant) — it does
      // not itself return a session. Establishing the session goes through
      // the exact same login() the "Log In" tab above uses, so there is
      // still only one place in the app that ever mints a token.
      await applicantApi.register({ name: authForm.name, email: authForm.email, password: authForm.password });
      await login(authForm.email, authForm.password);
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Unable to create your account. Please try again.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // --- Application form ---
  const [form, setForm] = useState({
    phone: '',
    qualification: '',
    experience: '',
    skills: '',
    subjectCommand: '',
    languages: '',
    links: '',
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill phone from the applicant's own account once it's known —
  // never overwrites what they've already typed in this session.
  useEffect(() => {
    if (user?.role === ROLES.APPLICANT && user.phone) {
      setForm((prev) => (prev.phone ? prev : { ...prev, phone: user.phone }));
    }
  }, [user]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleResumePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateResumeFile(file);
    if (err) {
      setResumeError(err);
      setResumeFile(null);
      return;
    }
    setResumeError('');
    setResumeFile(file);
  };

  const validateApplication = () => {
    const errors = {};
    if (!form.qualification.trim()) errors.qualification = 'Qualification is required';
    if (!form.experience.trim()) errors.experience = 'Experience is required';
    if (job?.resumeRequired && !resumeFile) errors.resume = 'A resume/CV is required for this job';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validateApplication()) return;

    setSubmitting(true);
    try {
      const result = await applicantApi.submitApplication({
        jobId,
        phone: form.phone,
        qualification: form.qualification,
        experience: form.experience,
        skills: form.skills,
        subjectCommand: form.subjectCommand,
        languages: form.languages,
        links: form.links,
        resume: resumeFile || undefined,
      });
      navigate('/apply/success', { state: { result } });
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong submitting your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isApplicant = user?.role === ROLES.APPLICANT;
  const isWrongRole = Boolean(user) && !isApplicant;

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to={`/jobs/${jobId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to job details
        </Link>

        {jobError && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-red-600">{jobError}</p>
          </div>
        )}

        {!jobError && !job && <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />}

        {job && job.applicationState !== 'open' && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">
              {job.applicationState === 'upcoming'
                ? 'Applications for this job have not opened yet.'
                : 'This job is no longer accepting applications.'}
            </p>
            <Link to={`/jobs/${jobId}`} className="mt-3 inline-block text-sm text-primary-700 hover:underline">
              Back to job details
            </Link>
          </div>
        )}

        {job && job.applicationState === 'open' && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
            <h1 className="mb-1 text-xl font-semibold text-slate-800">Apply for {job.title}</h1>

            {isWrongRole && (
              <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="mb-3">
                  You're currently signed in as a {ROLE_LABELS[user.role] || user.role} account. Job applications are
                  submitted as a job applicant, not this account — please log out first.
                </p>
                <Button variant="secondary" onClick={logout}>
                  Log out
                </Button>
              </div>
            )}

            {!isWrongRole && !isApplicant && (
              <div className="mt-6">
                <p className="mb-4 text-sm text-slate-500">Log in to your applicant account, or create a new one, to continue.</p>

                <div className="mb-5 flex gap-2 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError('');
                    }}
                    className={`px-3 py-2 text-sm font-medium ${authMode === 'login' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500'}`}
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError('');
                    }}
                    className={`px-3 py-2 text-sm font-medium ${authMode === 'register' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500'}`}
                  >
                    Create Applicant Account
                  </button>
                </div>

                {authMode === 'login' ? (
                  <form onSubmit={handleLogin}>
                    <FormField label="Email" htmlFor="loginEmail" required>
                      <Input
                        id="loginEmail"
                        type="email"
                        autoComplete="email"
                        value={authForm.email}
                        onChange={handleAuthChange('email')}
                        required
                      />
                    </FormField>
                    <FormField label="Password" htmlFor="loginPassword" required>
                      <PasswordField
                        id="loginPassword"
                        autoComplete="current-password"
                        value={authForm.password}
                        onChange={handleAuthChange('password')}
                        placeholder="••••••••"
                      />
                    </FormField>
                    {authError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}
                    <Button type="submit" className="w-full" disabled={authSubmitting}>
                      {authSubmitting ? 'Signing in…' : 'Log In'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister}>
                    <FormField label="Full Name" htmlFor="regName" required>
                      <Input id="regName" autoComplete="name" value={authForm.name} onChange={handleAuthChange('name')} required />
                    </FormField>
                    <FormField label="Email" htmlFor="regEmail" required>
                      <Input
                        id="regEmail"
                        type="email"
                        autoComplete="email"
                        value={authForm.email}
                        onChange={handleAuthChange('email')}
                        required
                      />
                    </FormField>
                    <FormField label="Password" htmlFor="regPassword" required>
                      <PasswordField
                        id="regPassword"
                        autoComplete="new-password"
                        value={authForm.password}
                        onChange={handleAuthChange('password')}
                        placeholder="At least 6 characters"
                      />
                    </FormField>
                    <FormField label="Confirm Password" htmlFor="regConfirmPassword" required>
                      <PasswordField
                        id="regConfirmPassword"
                        autoComplete="new-password"
                        value={authForm.confirmPassword}
                        onChange={handleAuthChange('confirmPassword')}
                        placeholder="••••••••"
                      />
                    </FormField>
                    {authError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{authError}</p>}
                    <Button type="submit" className="w-full" disabled={authSubmitting}>
                      {authSubmitting ? 'Creating account…' : 'Create Account & Continue'}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {!isWrongRole && isApplicant && (
              <form onSubmit={handleSubmit} className="mt-6" noValidate>
                <div className="mb-4 grid grid-cols-1 gap-x-4 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-slate-400">Name: </span>
                    <span className="text-slate-700">{user.name}</span>
                  </p>
                  <p>
                    <span className="text-slate-400">Email: </span>
                    <span className="text-slate-700">{user.email}</span>
                  </p>
                </div>

                <FormField label="Phone" htmlFor="phone">
                  <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="03xx-xxxxxxx" />
                </FormField>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  <FormField label="Qualification" htmlFor="qualification" required error={formErrors.qualification}>
                    <Input id="qualification" value={form.qualification} onChange={handleChange('qualification')} />
                  </FormField>
                  <FormField label="Experience" htmlFor="experience" required error={formErrors.experience}>
                    <Input id="experience" value={form.experience} onChange={handleChange('experience')} placeholder="e.g. 2 years" />
                  </FormField>
                </div>
                <FormField label="Skills" htmlFor="skills">
                  <Input id="skills" value={form.skills} onChange={handleChange('skills')} placeholder="Comma-separated, e.g. React, Node.js" />
                </FormField>
                <FormField label="Subject Command" htmlFor="subjectCommand">
                  <Input id="subjectCommand" value={form.subjectCommand} onChange={handleChange('subjectCommand')} />
                </FormField>
                <FormField label="Languages" htmlFor="languages">
                  <Input id="languages" value={form.languages} onChange={handleChange('languages')} placeholder="Comma-separated, e.g. English, Urdu" />
                </FormField>
                <FormField label="Relevant Links" htmlFor="links">
                  <Textarea
                    id="links"
                    value={form.links}
                    onChange={handleChange('links')}
                    placeholder="Portfolio, LinkedIn, GitHub… one per line or comma-separated"
                  />
                </FormField>

                <FormField label="Resume / CV" htmlFor="resume" required={job.resumeRequired} error={formErrors.resume || resumeError}>
                  {!resumeFile ? (
                    <label
                      htmlFor="resume"
                      className="flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed border-slate-300 px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      <FileText size={20} className="shrink-0 text-slate-400" />
                      <span className="text-slate-500">
                        Click to upload your resume <span className="text-xs">(PDF, DOC or DOCX, up to 5MB)</span>
                      </span>
                      <input id="resume" type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumePick} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 rounded-md border border-slate-200 px-4 py-3 text-sm">
                      <FileText size={20} className="shrink-0 text-primary-600" />
                      <span className="flex-1 truncate text-slate-700">{resumeFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setResumeFile(null)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        aria-label="Remove resume"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </FormField>

                {serverError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </Button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
