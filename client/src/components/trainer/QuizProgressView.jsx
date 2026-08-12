import { useEffect, useState } from 'react';
import { Users, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { Table, StatusBadge, StatPill, Avatar, EmptyState } from '../common';
import trainerQuizzesApi from '../../api/trainerQuizzesApi';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';

// ONE row per student, regardless of how many attempts they have — the
// backend already returns each student's `attempts` sorted ascending by
// attemptNumber (see trainerQuiz.controller.js#getQuizProgress), so the
// last entry is always their latest attempt. That latest attempt's own
// progress/score/status/timestamps stand in for the whole row; a student
// with zero attempts gets `latestAttempt: null` (rendered as the
// not-started state below) instead of being omitted.
function toStudentRows(students) {
  return students.map((s) => ({
    key: s.studentId,
    student: s,
    latestAttempt: s.attempts.length ? s.attempts[s.attempts.length - 1] : null,
  }));
}

// The attempt's own graded status ('passed'/'failed') already reads
// correctly through StatusBadge's existing color map; 'in-progress' and
// 'not-started' are new states this feature introduces.
function AttemptStatusBadge({ attempt }) {
  if (!attempt) return <StatusBadge status="not-started" />;
  return <StatusBadge status={attempt.status} />;
}

export default function QuizProgressView({ quizId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    trainerQuizzesApi
      .getProgress(quizId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load quiz progress'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const { students } = data;
  const attempted = students.filter((s) => s.attemptsUsed > 0).length;
  const notAttempted = students.length - attempted;
  const completed = students.filter((s) => s.overallStatus === 'completed').length;

  const rows = toStudentRows(students);

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={resolveFileUrl(row.student.profilePicture)} name={row.student.name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{row.student.name}</p>
            <p className="truncate text-xs text-slate-400">{row.student.email}</p>
          </div>
        </div>
      ),
    },
    {
      // Attempt COUNT, not one row per attempt — "1/2" = 1 of 2 attempts
      // used, "0/2" for a student who hasn't attempted yet at all.
      key: 'attempt',
      header: 'Attempt',
      render: (row) => `${row.student.attemptsUsed}/${data.quiz.maxAttempts}`,
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) =>
        row.latestAttempt ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${row.latestAttempt.progressPercent}%` }} />
            </div>
            <span className="text-xs text-slate-500">{row.latestAttempt.progressPercent}%</span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'answered',
      header: 'Answered',
      render: (row) => (row.latestAttempt ? `${row.latestAttempt.answeredCount}/${row.latestAttempt.totalQuestions}` : '—'),
    },
    {
      key: 'score',
      header: 'Score',
      render: (row) =>
        row.latestAttempt && row.latestAttempt.score !== null ? `${row.latestAttempt.score}/${row.latestAttempt.totalMarks}` : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <AttemptStatusBadge attempt={row.latestAttempt} />,
    },
    {
      key: 'startedAt',
      header: 'Started At',
      render: (row) => (row.latestAttempt?.startedAt ? new Date(row.latestAttempt.startedAt).toLocaleString() : '—'),
    },
    {
      key: 'submittedAt',
      header: 'Submitted At',
      render: (row) => (row.latestAttempt?.submittedAt ? new Date(row.latestAttempt.submittedAt).toLocaleString() : '—'),
    },
    {
      key: 'attemptsRemaining',
      header: 'Attempts Remaining',
      render: (row) => `${row.student.attemptsRemaining}/${data.quiz.maxAttempts}`,
    },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill icon={Users} label="Total Students" value={students.length} colorClass="bg-primary-50 text-primary-600" />
        <StatPill icon={CheckCircle2} label="Attempted" value={attempted} colorClass="bg-green-50 text-green-600" />
        <StatPill icon={HelpCircle} label="Not Attempted" value={notAttempted} colorClass="bg-slate-100 text-slate-600" />
        <StatPill icon={Clock} label="Completed" value={completed} colorClass="bg-amber-50 text-amber-600" />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white">
          <EmptyState title="No students enrolled" description="No students are enrolled in this quiz's batch yet." />
        </div>
      ) : (
        <Table columns={columns} data={rows} emptyMessage="No students found" />
      )}
    </div>
  );
}
