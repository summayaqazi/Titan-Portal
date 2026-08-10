import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, FileDown, Plus, ShieldAlert, Trash2, Wallet } from 'lucide-react';
import { Drawer, StatusBadge, Select, Input, Button, Avatar } from '../common';
import { enrollmentsApi } from '../../api/studentsApi';
import studentsApi from '../../api/studentsApi';
import paymentsApi from '../../api/paymentsApi';
import attendanceApi from '../../api/attendanceApi';
import { ENROLLMENT_STATUSES } from '../../constants/enrollment';
import { resolveFileUrl } from '../../utils/fileUrl';
import { downloadFile } from '../../utils/downloadFile';
import { getErrorMessage } from '../../utils/errors';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

const EMPLOYMENT_LABELS = {
  unemployed: 'Unemployed',
  employed: 'Employed',
  self_employed: 'Self-Employed',
  student: 'Student',
};

const QUALIFICATION_LABELS = {
  matric: 'Matric',
  intermediate: 'Intermediate',
  bachelors: 'Bachelors',
  masters: 'Masters',
  other: 'Other',
};

export default function StudentDetailDrawer({ open, onClose, student, batches, onChanged }) {
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const campusFilter = useAdminCampusFilter();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceByEnrollment, setAttendanceByEnrollment] = useState({});
  const canUpdateStudents = can('students', 'update');
  const canDeleteStudents = can('students', 'delete');

  const [batchId, setBatchId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [studentData, setStudentData] = useState(student);

  useEffect(() => {
    setStudentData(student);
  }, [student]);

  const load = () => {
    if (!student) return;
    setLoading(true);
    setError('');
    enrollmentsApi
      .listForStudent(student._id, { campus: campusFilter })
      .then(async (data) => {
        setEnrollments(data);
        const summaries = await Promise.all(
          data.map((en) => attendanceApi.summary(en._id).catch(() => null))
        );
        setAttendanceByEnrollment(Object.fromEntries(data.map((en, i) => [en._id, summaries[i]])));
      })
      .catch(() => setError('Failed to load enrollments'))
      .finally(() => setLoading(false));
  };

  const loadPayments = () => {
    if (!student) return;
    setPaymentsLoading(true);
    paymentsApi
      .list({ student: student._id, limit: 100 })
      .then((res) => setPayments(res.data))
      .catch(() => {})
      .finally(() => setPaymentsLoading(false));
  };

  useEffect(() => {
    if (open && student) {
      load();
      loadPayments();
      setBatchId('');
      setRollNumber('');
      setAddError('');
      setVerifyError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student]);

  const handleAddEnrollment = async (e) => {
    e.preventDefault();
    setAddError('');

    const batch = batches.find((b) => b._id === batchId);
    if (!batch) {
      setAddError('Please select a batch');
      return;
    }

    setAdding(true);
    try {
      await enrollmentsApi.create(student._id, {
        course: batch.course?._id,
        batch: batch._id,
        rollNumber,
        status: 'pending',
      });
      setBatchId('');
      setRollNumber('');
      load();
      onChanged?.();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add enrollment');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (enrollmentId, status) => {
    await enrollmentsApi.update(enrollmentId, { status });
    load();
    onChanged?.();
  };

  const handleDelete = async (enrollmentId) => {
    await enrollmentsApi.remove(enrollmentId);
    load();
    onChanged?.();
  };

  const handleVerifyCnic = async () => {
    setVerifying(true);
    setVerifyError('');
    try {
      const updated = await studentsApi.verifyCnic(student._id);
      setStudentData(updated);
      onChanged?.();
    } catch (err) {
      setVerifyError(getErrorMessage(err, 'Failed to verify CNIC'));
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadAuditPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadFile(studentsApi.auditPdfUrl(student._id), `student-audit-${student._id}.pdf`);
    } catch {
      setVerifyError('Failed to download audit PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!studentData) return null;

  const paidTotal = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const courseFeeTotal = enrollments.reduce((sum, en) => sum + (en.course?.fee || 0), 0);

  return (
    <Drawer open={open} onClose={onClose} title={studentData.user?.name || 'Student'} width="w-[560px]">
      <div className="mb-4 flex items-start gap-4">
        {studentData.profilePicture ? (
          <img
            src={resolveFileUrl(studentData.profilePicture)}
            alt={studentData.user?.name}
            className="h-16 w-16 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
            {studentData.user?.name?.charAt(0) || '?'}
          </div>
        )}
        <div className="flex-1 space-y-0.5 text-sm">
          <p className="text-slate-500">{studentData.user?.email}</p>
          {studentData.user?.phone && <p className="text-slate-500">{studentData.user.phone}</p>}
          <p className="text-slate-500">{studentData.city?.name || 'No city set'}</p>
          <StatusBadge status={studentData.isActive ? 'active' : 'inactive'} />
        </div>
        {can('students', 'export') && (
          <Button variant="secondary" onClick={handleDownloadAuditPdf} disabled={downloadingPdf}>
            <FileDown size={14} /> {downloadingPdf ? 'Preparing…' : 'Audit PDF'}
          </Button>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">CNIC</p>
          {studentData.cnicVerified ? (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700">
              <BadgeCheck size={14} /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <ShieldAlert size={14} /> Unverified
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">{studentData.cnic || 'Not on file'}</p>
        {studentData.cnicVerified && studentData.cnicVerifiedBy && (
          <p className="mt-1 text-xs text-slate-400">
            Verified by {studentData.cnicVerifiedBy.name} on{' '}
            {new Date(studentData.cnicVerifiedAt).toLocaleDateString()}
          </p>
        )}
        {!studentData.cnicVerified && can('students', 'update') && (
          <Button
            variant="secondary"
            className="mt-2"
            onClick={handleVerifyCnic}
            disabled={verifying || !studentData.cnic}
          >
            {verifying ? 'Verifying…' : 'Verify CNIC'}
          </Button>
        )}
        {verifyError && <p className="mt-2 text-xs text-red-600">{verifyError}</p>}
      </div>

      {studentData.employmentStatus && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-1 font-semibold text-slate-800">Employment</p>
          <p className="text-slate-600">{EMPLOYMENT_LABELS[studentData.employmentStatus]}</p>
          {studentData.organization && <p className="text-slate-500">{studentData.organization}</p>}
          {studentData.designation && <p className="text-slate-500">{studentData.designation}</p>}
          {studentData.monthlyIncome ? (
            <p className="text-slate-500">PKR {Number(studentData.monthlyIncome).toLocaleString()} / month</p>
          ) : null}
        </div>
      )}

      {(studentData.highestQualification || studentData.institute) && (
        <div className="mb-4 rounded-lg border border-slate-200 p-3 text-sm">
          <p className="mb-1 font-semibold text-slate-800">Education</p>
          <p className="text-slate-600">{QUALIFICATION_LABELS[studentData.highestQualification] || '—'}</p>
          {studentData.institute && <p className="text-slate-500">{studentData.institute}</p>}
          {studentData.yearOfCompletion ? <p className="text-slate-500">Completed {studentData.yearOfCompletion}</p> : null}
        </div>
      )}

      <div className="mb-6 text-xs text-slate-400">
        {studentData.createdBy && (
          <p>
            Created by {studentData.createdBy.name} on {new Date(studentData.createdAt).toLocaleString()}
          </p>
        )}
        {studentData.updatedBy && (
          <p>
            Last updated by {studentData.updatedBy.name} on {new Date(studentData.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Wallet size={15} /> Payments
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              navigate(`/${user?.role === 'ADMIN' ? 'admin' : 'super-admin'}/payments?student=${student._id}`)
            }
          >
            <Plus size={14} /> Generate Payment
          </Button>
        </div>
        {paymentsLoading ? (
          <p className="text-xs text-slate-400">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-slate-400">No payments recorded yet.</p>
        ) : (
          <>
            <div className="mb-2 space-y-1.5">
              {payments.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">
                    {p.invoiceNumber || '—'} · PKR {p.amount.toLocaleString()}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
            {courseFeeTotal > 0 && (
              <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">
                Paid PKR {paidTotal.toLocaleString()} of PKR {courseFeeTotal.toLocaleString()} in course fees
                (computed, not an official balance).
              </p>
            )}
          </>
        )}
      </div>

      <h3 className="mb-3 text-sm font-semibold text-slate-800">Enrollments</h3>

      {canUpdateStudents && (
        <form onSubmit={handleAddEnrollment} className="mb-4 space-y-2 rounded-lg border border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.batchCode} — {b.course?.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Roll number (optional)" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
          </div>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <Button type="submit" variant="secondary" className="w-full" disabled={adding}>
            <Plus size={14} /> {adding ? 'Adding…' : 'Add Enrollment'}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading enrollments...</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-red-500">{error}</p>
      ) : enrollments.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No enrollments yet</p>
      ) : (
        <div className="space-y-3">
          {enrollments.map((en) => (
            <div key={en._id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{en.course?.name}</p>
                  <p className="text-xs text-slate-500">
                    {en.batch?.batchCode} · {en.campus?.name}
                    {en.rollNumber ? ` · Roll ${en.rollNumber}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">
                    Admitted {en.admissionDate ? new Date(en.admissionDate).toLocaleDateString() : '—'}
                  </p>
                  {en.trainer?.user?.name && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Avatar src={resolveFileUrl(en.trainer.profileImage)} name={en.trainer.user.name} size={18} />
                      <span className="text-xs text-slate-500">{en.trainer.user.name}</span>
                    </div>
                  )}
                </div>
                {canDeleteStudents && (
                  <button
                    type="button"
                    onClick={() => handleDelete(en._id)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove enrollment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={en.status} />
                  <StatusBadge status={en.paymentStatus} />
                </div>
                {canUpdateStudents ? (
                  <Select
                    className="w-auto text-xs"
                    value={en.status}
                    onChange={(e) => handleStatusChange(en._id, e.target.value)}
                  >
                    {ENROLLMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>
              {attendanceByEnrollment[en._id] && attendanceByEnrollment[en._id].total > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Attendance: {attendanceByEnrollment[en._id].percentPresent}% present ·{' '}
                  {attendanceByEnrollment[en._id].total} session(s) recorded
                </p>
              )}
              {en.history?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-400">History ({en.history.length})</summary>
                  <ul className="mt-1 space-y-1 text-xs text-slate-500">
                    {en.history.map((h, i) => (
                      <li key={i}>
                        {new Date(h.changedAt).toLocaleDateString()} — {h.status}
                        {h.note ? ` (${h.note})` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
