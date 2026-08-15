import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Info, Play, RotateCcw, ShieldAlert, Wifi, Maximize } from 'lucide-react';
import { PageContainer, Table, StatusBadge, Button, Modal, EmptyState } from '../../components/common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

// Every line here describes something this build actually does — no claim
// about window-leave tracking or a guaranteed fullscreen lock, since
// neither is implemented (see TakeQuiz.jsx: fullscreen is requested
// best-effort only, and nothing observes tab-visibility at all).
function QuizInstructions() {
  const items = [
    { icon: ShieldAlert, text: 'Complete the quiz in one sitting — once started, the timer keeps running even if you navigate away or refresh the page.' },
    { icon: Wifi, text: 'A stable internet connection is recommended. If your connection drops before you submit, your selections may not be saved.' },
    { icon: Maximize, text: 'The quiz screen can open in fullscreen where your browser supports it.' },
  ];
  return (
    <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <p className="mb-2 text-sm font-medium text-blue-900">Before you start</p>
      <ul className="space-y-1.5 text-xs text-blue-800">
        {items.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2">
            <Icon size={14} className="mt-0.5 shrink-0 text-blue-600" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuizInfoModal({ quizId, onClose }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!quizId) return;
    setLoading(true);
    setError('');
    studentPortalApi
      .getQuizInfo(quizId)
      .then(setInfo)
      .catch((err) => setError(getErrorMessage(err, 'Failed to load quiz information')))
      .finally(() => setLoading(false));
  }, [quizId]);

  return (
    <Modal open={Boolean(quizId)} onClose={onClose} title="Quiz Information" size="md">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold text-slate-800">{info.title}</p>
            <p className="text-xs text-slate-400">
              {info.courseName} · {info.batchCode}
            </p>
            {info.description && <p className="mt-2 text-sm text-slate-600">{info.description}</p>}
          </div>

          <div
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              info.availability === 'available'
                ? 'bg-green-50 text-green-700'
                : info.availability === 'expired'
                ? 'bg-red-50 text-red-600'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {info.availabilityMessage}
            {(info.startAt || info.endAt) && (
              <span className="ml-1 font-normal text-xs opacity-80">
                {info.startAt && `Opens ${new Date(info.startAt).toLocaleString()}`}
                {info.startAt && info.endAt && ' · '}
                {info.endAt && `Closes ${new Date(info.endAt).toLocaleString()}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Questions</p>
              <p className="font-medium text-slate-700">{info.totalQuestions}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Duration</p>
              <p className="font-medium text-slate-700">{info.durationMinutes} min</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Marks</p>
              <p className="font-medium text-slate-700">{info.totalMarks}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Passing %</p>
              <p className="font-medium text-slate-700">{info.passPercentage}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Allowed Attempts</p>
              <p className="font-medium text-slate-700">{info.maxAttempts}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Attempts Remaining</p>
              <p className="font-medium text-slate-700">{info.attemptsRemaining}</p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Previous Attempts</p>
            {info.attempts.length === 0 ? (
              <p className="text-xs text-slate-400">You haven't attempted this quiz yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {info.attempts.map((a) => (
                  <li
                    key={a.attemptNumber}
                    className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-slate-600">
                      Attempt {a.attemptNumber}
                      {a.submittedAt ? ` · ${new Date(a.submittedAt).toLocaleString()}` : ''}
                      {a.late ? ' · late' : ''}
                    </span>
                    <span className="flex items-center gap-2">
                      {a.status !== 'in-progress' && <span className="text-slate-500">{a.percentage}%</span>}
                      <StatusBadge status={a.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Quiz() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [infoQuizId, setInfoQuizId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    studentPortalApi
      .getQuizzes()
      .then((data) => {
        if (!cancelled) setQuizzes(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load quizzes'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // `row.canResume` is the server's own explicit, already-reconciled
  // verdict (see canResumeAttempt in quizGrading.js) — trusted as-is here
  // instead of this component re-deriving "is it resumable" from
  // `row.status === 'in-progress'` on its own. Real enforcement is still
  // server-side regardless of what this renders — a student who bypasses
  // this button entirely (e.g. hitting the API directly) still gets the
  // exact same block from startQuizAttempt.
  const actionFor = (row) => {
    if (row.canResume) {
      return (
        <Button variant="primary" onClick={() => navigate(`/student/quizzes/${row._id}/take`)}>
          <Play size={14} /> Resume
        </Button>
      );
    }

    // Not resumable — either never attempted, or the latest attempt is
    // genuinely finished/expired. Once attempts are exhausted (2/2), this
    // always falls through to the "both attempts used" message below,
    // never a button — the quiz's completed/result state (row.status,
    // score/percentage columns) is what represents it now, not an action.
    if (row.availability === 'not-started') {
      return <span className="text-xs text-slate-400">{row.availabilityMessage}</span>;
    }
    if (row.availability === 'expired') {
      return <span className="text-xs text-red-500">{row.availabilityMessage}</span>;
    }
    if (row.attemptsRemaining <= 0) {
      return <span className="text-xs text-slate-400">You have used both attempts for this quiz.</span>;
    }

    const label = row.status === 'pending' ? 'Start' : 'Retake';
    const Icon = row.status === 'pending' ? Play : RotateCcw;
    return (
      <Button variant="secondary" onClick={() => navigate(`/student/quizzes/${row._id}/take`)}>
        <Icon size={14} /> {label}
      </Button>
    );
  };

  return (
    <PageContainer title="Quiz" description="Take quizzes for your enrolled courses">
      <QuizInstructions />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : !loading && quizzes.length === 0 ? (
        <EmptyState icon={FileQuestion} title="No quizzes yet" description="Your trainer hasn't published any quizzes for your enrolled courses yet." />
      ) : (
        <Table
          emptyMessage={loading ? 'Loading…' : 'No quizzes found'}
          columns={[
            { key: 'courseName', header: 'Course', render: (row) => row.courseName || '—' },
            { key: 'title', header: 'Title' },
            { key: 'totalQuestions', header: 'Questions' },
            {
              key: 'attemptsCount',
              header: 'Attempts',
              render: (row) => `${row.attemptsUsed}/${row.maxAttempts}`,
            },
            {
              key: 'score',
              header: 'Score',
              render: (row) => (row.latestAttempt && row.latestAttempt.status !== 'in-progress' ? `${row.latestAttempt.score}/${row.totalMarks}` : '—'),
            },
            {
              key: 'percentage',
              header: 'Percentage',
              render: (row) => (row.bestPercentage !== null ? `${row.bestPercentage}%` : '—'),
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
            {
              key: 'info',
              header: 'Information',
              render: (row) => (
                <button
                  type="button"
                  onClick={() => setInfoQuizId(row._id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
                  aria-label="Quiz information"
                  title="Quiz information"
                >
                  <Info size={16} />
                </button>
              ),
            },
            { key: 'action', header: '', render: actionFor },
          ]}
          data={loading ? [] : quizzes}
        />
      )}

      <QuizInfoModal quizId={infoQuizId} onClose={() => setInfoQuizId(null)} />
    </PageContainer>
  );
}
