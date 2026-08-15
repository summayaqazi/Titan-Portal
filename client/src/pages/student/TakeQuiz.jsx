import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Send,
  Maximize,
  Minimize,
} from 'lucide-react';
import { PageContainer, Button, ConfirmDialog } from '../../components/common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Best-effort only — not every browser/embedding context allows it (e.g.
// an iframe without allow="fullscreen"), and nothing here depends on it
// succeeding. Matches what the Quiz list's instructions panel actually
// promises ("where your browser supports it"), not a guaranteed lock.
function useBestEffortFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const enter = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {
      // Unsupported/denied — silently stay in normal view, exactly as the
      // instructions panel already hedges ("where supported").
    });
  }, []);
  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  return { isFullscreen, enter, exit };
}

function ResultView({ result, quizTitle, onBack }) {
  const passed = result.status === 'passed';
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center">
      {passed ? (
        <CheckCircle2 size={40} className="mx-auto mb-3 text-green-600" />
      ) : (
        <XCircle size={40} className="mx-auto mb-3 text-red-600" />
      )}
      <p className="text-lg font-semibold text-slate-800">{passed ? 'You passed!' : 'You did not pass'}</p>
      <p className="mt-0.5 text-sm text-slate-500">{quizTitle}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">Score</p>
          <p className="text-lg font-semibold text-slate-800">
            {result.score}/{result.totalMarks}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">Percentage</p>
          <p className="text-lg font-semibold text-slate-800">{result.percentage}%</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">Correct</p>
          <p className="text-lg font-semibold text-slate-800">
            {result.correctCount}/{result.totalQuestions}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-400">Attempt #</p>
          <p className="text-lg font-semibold text-slate-800">{result.attemptNumber}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
          <p className="text-xs text-slate-400">Submitted</p>
          <p className="text-sm font-medium text-slate-700">
            {new Date(result.submittedAt).toLocaleString()}
            {result.late ? ' (after time expired)' : ''}
          </p>
        </div>
      </div>

      <Button className="mt-6" onClick={onBack}>
        <ArrowLeft size={15} /> Back to Quizzes
      </Button>
    </div>
  );
}

export default function TakeQuiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { isFullscreen, enter: enterFullscreen, exit: exitFullscreen } = useBestEffortFullscreen();

  const [state, setState] = useState('loading'); // loading | ready | error | result
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(null); // { attemptId, quiz, deadline, ... }
  const [answers, setAnswers] = useState({}); // questionId -> number[]
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    studentPortalApi
      .startQuiz(quizId)
      .then((data) => {
        if (cancelled) return;
        setAttempt(data);
        // Restores whatever was already autosaved (see the debounced save
        // effect below) — a refresh, a resume on another device, or just
        // reopening this attempt after navigating away all pick up right
        // where the student left off instead of starting blank.
        const restored = {};
        (data.answers || []).forEach((a) => {
          if (a.selectedOptions?.length) restored[a.question] = new Set(a.selectedOptions);
        });
        setAnswers(restored);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        // The server's own exact wording ("Quiz has not started yet." /
        // "Quiz has expired." / "You have used both attempts for this
        // quiz." / enrollment-forbidden) is shown as-is — never replaced or
        // hidden by a generic message, so the student always sees the real
        // reason they were blocked.
        setError(getErrorMessage(err, 'Failed to start quiz'));
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  // Periodic autosave — debounced so every single click doesn't fire a
  // request, but frequent enough that a Trainer's live progress view (and a
  // refreshed/resumed session, see above) never lags far behind what's
  // actually been answered. Never touches grading/status — only
  // submitQuizAttempt (on explicit Submit) does that.
  //
  // A 410 here means the server has already independently closed this
  // attempt out (the quiz's own end date/time passed, or the attempt's own
  // timer ran out — see closeExpiredAttempt) — not just a transient network
  // hiccup. Locking the page immediately (reusing the existing 'error'
  // state/UI, same as a failed Start) is what makes expiry take effect
  // right away even while a student is mid-answer, rather than only being
  // discovered whenever they next click Submit.
  useEffect(() => {
    if (state !== 'ready' || !attempt) return undefined;
    const timeout = setTimeout(() => {
      const payload = Object.entries(answers).map(([question, selectedOptions]) => ({
        question,
        selectedOptions: Array.from(selectedOptions),
      }));
      studentPortalApi.saveQuizProgress(attempt.attemptId, payload).catch((err) => {
        if (err.response?.status === 410) {
          setError(getErrorMessage(err, 'This quiz has expired.'));
          setState('error');
          return;
        }
        // Otherwise best-effort as before — a transient autosave failure
        // never blocks the student from continuing to answer, or from
        // submitting for real at the end (handleSubmit sends the full,
        // current answer set regardless of whether the last autosave
        // succeeded).
      });
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, state, attempt?.attemptId]);

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current || !attempt) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const payload = Object.entries(answers).map(([question, selectedOptions]) => ({
          question,
          selectedOptions: Array.from(selectedOptions),
        }));
        const data = await studentPortalApi.submitQuizAttempt(attempt.attemptId, payload);
        setResult(data);
        setState('result');
      } catch (err) {
        submittedRef.current = false;
        const message = getErrorMessage(err, auto ? 'Time expired, but the automatic submission failed. Please try submitting again.' : 'Failed to submit quiz');
        setError(message);
        // 410 = the deadline had already passed server-side (quiz endAt or
        // the attempt's own timer, whichever came first) and this attempt
        // was auto-closed from the last autosaved answers instead of this
        // submission. No further answers/submissions are possible for it —
        // lock the page (existing 'error' state/UI) rather than leave the
        // now-dead quiz form up as if retrying could still work.
        if (err.response?.status === 410) setState('error');
      } finally {
        setSubmitting(false);
        setConfirmOpen(false);
        exitFullscreen();
      }
    },
    [answers, attempt, exitFullscreen]
  );

  // Server-authoritative countdown — recomputed every tick from
  // attempt.deadline (a server timestamp), never from a client-side
  // duration counter that could drift or be paused by e.g. a backgrounded
  // tab. Auto-submits once, exactly at zero; the server independently
  // re-checks the deadline on submit regardless of when this fires.
  useEffect(() => {
    if (state !== 'ready' || !attempt?.deadline) return undefined;
    const tick = () => {
      const ms = new Date(attempt.deadline).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0) handleSubmit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, attempt, handleSubmit]);

  // Best-effort fullscreen on entering the quiz; always released on the way
  // out (submit or unmount) so a student is never stuck in fullscreen.
  useEffect(() => {
    if (state === 'ready') enterFullscreen();
    return () => exitFullscreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // A best-effort nudge, not an enforcement mechanism — matches the
  // instructions panel's own wording ("keeps running even if you navigate
  // away"), it does not claim to block navigation.
  useEffect(() => {
    if (state !== 'ready') return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  const questions = attempt?.quiz?.questions || [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const toggleOption = (question, optionIndex) => {
    setAnswers((prev) => {
      const next = { ...prev };
      const current = new Set(next[question._id] || []);
      if (question.type === 'multiple') {
        if (current.has(optionIndex)) current.delete(optionIndex);
        else current.add(optionIndex);
      } else {
        current.clear();
        current.add(optionIndex);
      }
      next[question._id] = current;
      return next;
    });
  };

  if (state === 'loading') {
    return (
      <PageContainer title="Quiz">
        <p className="text-sm text-slate-400">Starting quiz…</p>
      </PageContainer>
    );
  }

  if (state === 'error') {
    return (
      <PageContainer title="Quiz">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/student/quizzes')}>
          <ArrowLeft size={15} /> Back to Quizzes
        </Button>
      </PageContainer>
    );
  }

  if (state === 'result') {
    return (
      <PageContainer title="Quiz Result">
        <ResultView result={result} quizTitle={attempt.quiz.title} onBack={() => navigate('/student/quizzes')} />
      </PageContainer>
    );
  }

  const low = remainingMs !== null && remainingMs < 60000;

  return (
    <PageContainer title={attempt.quiz.title} description={`Attempt ${attempt.attemptNumber}`} className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${low ? 'text-red-600' : 'text-slate-700'}`}>
          <Clock size={16} /> {remainingMs !== null ? formatRemaining(remainingMs) : '--:--'}
        </div>
        <p className="text-xs text-slate-500">
          {answeredCount}/{questions.length} answered
        </p>
        <button
          type="button"
          onClick={() => (isFullscreen ? exitFullscreen() : enterFullscreen())}
          className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
        >
          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />} {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {/* Question navigator — wraps instead of overflowing on narrow
          screens, so it never causes page-wide horizontal scroll. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {questions.map((q, i) => {
          const isAnswered = Boolean(answers[q._id]?.size);
          const isCurrent = i === currentIndex;
          const style = isCurrent
            ? 'bg-primary-600 text-white'
            : isAnswered
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-100 text-slate-500';
          return (
            <button
              key={q._id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-medium ${style}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {currentQuestion && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            Question {currentIndex + 1} of {questions.length} · {currentQuestion.points} pt{currentQuestion.points === 1 ? '' : 's'}
          </p>
          <p className="mb-4 text-base font-medium text-slate-800">{currentQuestion.text}</p>

          <div className="space-y-2">
            {currentQuestion.options.map((opt, i) => {
              const selected = answers[currentQuestion._id]?.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleOption(currentQuestion, i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                    selected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] ${
                      currentQuestion.type === 'multiple' ? 'rounded' : 'rounded-full'
                    } ${selected ? 'border-primary-600 bg-primary-600 text-white' : 'border-slate-300'}`}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
          <ChevronLeft size={15} /> Previous
        </Button>

        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
            Next <ChevronRight size={15} />
          </Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            <Send size={15} /> Submit Quiz
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleSubmit(false)}
        title="Submit quiz?"
        message={`You've answered ${answeredCount} of ${questions.length} questions. Once submitted, you cannot change your answers for this attempt.`}
        confirmLabel="Submit"
        danger={false}
        loading={submitting}
      />
    </PageContainer>
  );
}
