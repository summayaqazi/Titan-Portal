import { useEffect, useState } from 'react';
import { UserCheck, UserX, UserMinus, Clock, CheckCircle2, ClipboardList, FileText } from 'lucide-react';
import { Drawer, Avatar, StatusBadge, StatPill, EmptyState } from '../common';
import trainerPortalApi from '../../api/trainerPortalApi';
import { resolveFileUrl } from '../../utils/fileUrl';
import { getErrorMessage } from '../../utils/errors';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'quizzes', label: 'Quizzes' },
];

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

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value}</dd>
    </div>
  );
}

// Read-only student profile for the Trainer Portal — the exact same
// Student record Super Admin/Admin manage (fetched fresh via
// getCourseStudentDetail, never a separate trainer-side copy), scoped to
// one student on one of the trainer's own batches. No edit/delete actions
// here: same "trainers view, never modify" rule as StudentsTab/AttendanceTab.
export default function StudentDetailDrawer({ open, onClose, batchId, studentId, studentName }) {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !batchId || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setTab('overview');
    trainerPortalApi
      .getCourseStudentDetail(batchId, studentId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load student details'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, batchId, studentId]);

  const student = data?.student;
  const enrollment = data?.enrollment;

  return (
    <Drawer open={open} onClose={onClose} title={studentName || student?.user?.name || 'Student'} width="w-[520px]">
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading student details…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-red-500">{error}</p>
      ) : !data ? null : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-4 flex shrink-0 items-start gap-3">
            <Avatar src={resolveFileUrl(student.profilePicture)} name={student.user?.name} size={56} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-800">{student.user?.name}</p>
              <p className="truncate text-sm text-slate-500">{student.user?.email}</p>
              {student.user?.phone && <p className="text-sm text-slate-500">{student.user.phone}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={student.isActive ? 'active' : 'inactive'} />
                <StatusBadge status={enrollment?.status} />
              </div>
            </div>
          </div>

          {/* Tabs — horizontally scrollable instead of wrapping/overflowing
              on narrow screens, same pattern as CourseWorkspace's own tabs. */}
          <div className="mb-4 flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'overview' && (
              <div>
                <div className="mb-4 rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Course</p>
                  <dl className="grid grid-cols-2 gap-3">
                    <InfoRow label="Roll Number" value={enrollment?.rollNumber} />
                    <InfoRow label="Campus" value={enrollment?.campus?.name} />
                    <InfoRow
                      label="Admitted On"
                      value={enrollment?.admissionDate ? new Date(enrollment.admissionDate).toLocaleDateString() : '—'}
                    />
                  </dl>
                </div>

                <div className="mb-4 rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Personal Information</p>
                  <dl className="grid grid-cols-2 gap-3">
                    <InfoRow label="Father's Name" value={student.fatherName} />
                    <InfoRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null} />
                    <InfoRow
                      label="Date of Birth"
                      value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : null}
                    />
                    <InfoRow label="City" value={student.city?.name} />
                    <InfoRow label="Address" value={student.address} />
                    <InfoRow label="CNIC" value={student.cnic} />
                  </dl>
                </div>

                {student.employmentStatus && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Employment</p>
                    <dl className="grid grid-cols-2 gap-3">
                      <InfoRow label="Status" value={EMPLOYMENT_LABELS[student.employmentStatus]} />
                      <InfoRow label="Organization" value={student.organization} />
                      <InfoRow label="Designation" value={student.designation} />
                    </dl>
                  </div>
                )}

                {(student.highestQualification || student.institute) && (
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Education</p>
                    <dl className="grid grid-cols-2 gap-3">
                      <InfoRow label="Qualification" value={QUALIFICATION_LABELS[student.highestQualification]} />
                      <InfoRow label="Institute" value={student.institute} />
                      <InfoRow label="Completed" value={student.yearOfCompletion} />
                    </dl>
                  </div>
                )}
              </div>
            )}

            {tab === 'attendance' && (
              <div>
                <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <StatPill icon={UserCheck} label="Present" value={data.attendance.summary.present} colorClass="bg-green-50 text-green-600" />
                  <StatPill icon={UserX} label="Absent" value={data.attendance.summary.absent} colorClass="bg-red-50 text-red-600" />
                  <StatPill icon={Clock} label="Late" value={data.attendance.summary.late} colorClass="bg-amber-50 text-amber-600" />
                  <StatPill icon={UserMinus} label="Leave" value={data.attendance.summary.leave} colorClass="bg-slate-100 text-slate-500" />
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  {data.attendance.summary.percentPresent}% present across {data.attendance.summary.total} session(s) recorded
                </p>
                {data.attendance.records.length === 0 ? (
                  <EmptyState title="No attendance recorded yet" />
                ) : (
                  <div className="space-y-1.5">
                    {data.attendance.records.map((a) => (
                      <div key={a._id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-600">{new Date(a.date).toLocaleDateString()}</span>
                        <StatusBadge status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'assignments' && (
              <div>
                {data.assignments.length === 0 ? (
                  <EmptyState title="No assignments in this course yet" />
                ) : (
                  <div className="space-y-2">
                    {data.assignments.map((a) => (
                      <div key={a._id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{a.title}</p>
                            <p className="text-xs text-slate-400">
                              Due {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}
                            </p>
                          </div>
                          {a.submission ? (
                            <StatusBadge status={a.submission.status} />
                          ) : (
                            <span className="shrink-0 inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                              Not Submitted
                            </span>
                          )}
                        </div>
                        {a.submission?.submittedAt && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                            <FileText size={12} /> Submitted {new Date(a.submission.submittedAt).toLocaleDateString()}
                          </p>
                        )}
                        {a.submission?.feedback && (
                          <p className="mt-1.5 text-xs text-slate-500">Feedback: {a.submission.feedback}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'quizzes' && (
              <div>
                {data.quizzes.length === 0 ? (
                  <EmptyState title="No quizzes in this course yet" />
                ) : (
                  <div className="space-y-2">
                    {data.quizzes.map((q) => (
                      <div key={q._id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{q.title}</p>
                            <p className="flex items-center gap-1 text-xs text-slate-400">
                              <ClipboardList size={12} /> {q.durationMinutes} min · {q.totalMarks} marks
                            </p>
                          </div>
                          <StatusBadge status={q.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 size={12} /> Quiz-taking isn't available in the Student Portal yet — this lists the
                  course's quizzes; no results exist yet to show.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
