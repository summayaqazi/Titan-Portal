// Shared quiz-attempt logic used by BOTH the Student Portal
// (studentPortal.controller.js — taking a quiz) and the Trainer Portal
// (trainerQuiz.controller.js — authoring a quiz, viewing student progress).
// Pulled out to its own util (rather than living in either controller and
// being imported by the other) specifically to avoid a circular require:
// studentPortal.controller.js already imports `syncSchedule` FROM
// trainerQuiz.controller.js, so anything trainerQuiz.controller.js needed
// back from studentPortal.controller.js would form a cycle. A neutral util
// with no controller-side dependencies has none of that risk, and keeps
// grading/availability logic defined in exactly one place for both portals
// to share — never two implementations that could drift apart.

// The Quiz model has no passing-percentage or attempt-limit field (verified
// by reading Quiz.js) — both are fixed constants here, local to grading
// logic only. Zero risk to Trainer/Admin quiz authoring: nothing about how a
// quiz is created, edited, published, or scored by a trainer changes.
const QUIZ_PASS_PERCENTAGE = 50;
const MAX_QUIZ_ATTEMPTS = 2;

// Strips a question down to what's safe to send a student who can still
// attempt (or is currently attempting) the quiz — text/type/options/points
// only. `correctOptions` is never included here; the only place a
// question's correct answer ever factors in is server-side grading inside
// gradeAttempt() below, which reads it straight off the authoritative Quiz
// document, never off anything the client sent.
const sanitizeQuestion = (q) => ({
  _id: q._id,
  text: q.text,
  type: q.type,
  options: q.options,
  points: q.points,
});

// The one and only place a QuizAttempt's score/percentage/status are ever
// computed. `answers` is whatever the client submitted, already filtered
// (by the caller) down to question ids that actually belong to `quiz` — a
// question with no matching answer, or an answer set that doesn't exactly
// match `correctOptions`, simply scores 0 for that question. The client
// never supplies (and this function never reads) a score/percentage/status
// from the request — those three values are the server's alone to decide.
const gradeAttempt = (quiz, answers) => {
  const answerByQuestion = new Map(
    (answers || []).map((a) => [String(a.question), new Set((a.selectedOptions || []).map(Number))])
  );

  let score = 0;
  let correctCount = 0;
  quiz.questions.forEach((q) => {
    const selected = answerByQuestion.get(String(q._id));
    if (!selected) return;
    const correct = new Set(q.correctOptions);
    const isCorrect = selected.size === correct.size && [...selected].every((v) => correct.has(v));
    if (isCorrect) {
      score += q.points || 0;
      correctCount += 1;
    }
  });

  const totalMarks = quiz.totalMarks;
  const totalQuestions = quiz.questions.length;
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const status = percentage >= QUIZ_PASS_PERCENTAGE ? 'passed' : 'failed';
  return { score, correctCount, totalMarks, totalQuestions, percentage, status };
};

// A per-attempt deadline is startedAt + quiz.durationMinutes, same as
// before — but now also capped at the quiz's own global `endAt` (if set and
// earlier), so a student who starts near the very end of the availability
// window can never be handed a countdown that runs past it. This is the
// ONLY change needed to make the quiz's end date/time a hard boundary on
// "continuing" an attempt — it reuses the exact same
// already-existing/trusted "deadline passed -> auto-close as late" pipeline
// below instead of adding a second, separate expiry check anywhere else.
//
// `durationMinutes` always falls back to DEFAULT_DURATION_MINUTES rather
// than ever producing a null deadline — createQuiz already defaults a
// missing/zero value to 30 (`durationMinutes || 30`), but updateQuiz has no
// such fallback (`if (durationMinutes !== undefined) quiz.durationMinutes =
// durationMinutes` — verified by reading it), so an explicit 0 can reach
// here. Without this fallback, that produces an attempt with NO deadline at
// all, which `closeExpiredAttempt` below can then never auto-close — a
// permanently "in-progress" attempt that would keep showing Resume forever,
// even once the student has no attempts left to fall back on. Every
// attempt gets a real, finite deadline, full stop.
const DEFAULT_DURATION_MINUTES = 30;
const computeAttemptDeadline = (quiz, startedAt) => {
  const minutes = quiz.durationMinutes > 0 ? quiz.durationMinutes : DEFAULT_DURATION_MINUTES;
  const durationDeadline = new Date(startedAt.getTime() + minutes * 60000);
  const endAt = quiz.endAt ? new Date(quiz.endAt) : null;
  if (endAt && endAt < durationDeadline) return endAt;
  return durationDeadline;
};

// The quiz's own time-window status, independent of any one student's
// attempt. Only ever 'available' for a quiz that is actually `published` —
// a draft/scheduled quiz is never attemptable regardless of startAt/endAt.
// Server time (`new Date()`) is always the default `now` — callers never
// pass a client-supplied timestamp in.
const getQuizAvailability = (quiz, now = new Date()) => {
  if (quiz.status !== 'published') return 'not-started';
  if (quiz.startAt && now < new Date(quiz.startAt)) return 'not-started';
  if (quiz.endAt && now > new Date(quiz.endAt)) return 'expired';
  return 'available';
};

// If `attempt` is still marked in-progress but is no longer valid to
// continue, grades it right now on whatever answers are on file (possibly
// none — see saveQuizAttemptProgress, the autosave that keeps this current)
// and persists that. Triggered by EITHER of two independent boundaries,
// whichever is hit first:
//   1. The attempt's own deadline (startedAt + duration, capped at the
//      quiz's endAt AS OF START TIME — see computeAttemptDeadline) — the
//      normal per-attempt timer running out.
//   2. The quiz's CURRENT availability being 'expired' — re-checked fresh
//      every call, independent of what the attempt's own stored deadline
//      says. This is what makes a trainer shortening/editing a quiz's
//      endAt AFTER a student already started take effect immediately: the
//      attempt's own `deadline` is a snapshot from start time and would
//      never retroactively shrink on its own, but this second check
//      doesn't rely on it — closeExpiredAttempt is called on every
//      resume/submit/autosave/list-read, so "the quiz end date/time has
//      passed" is enforced strictly and immediately everywhere, exactly
//      once, from this one function.
// Same auto-close-on-read behavior startQuizAttempt already did inline,
// now shared so getQuizzes/getQuizInfo (student), getQuizProgress
// (trainer), submitQuizAttempt, and saveQuizAttemptProgress all see (and
// enforce) identically up-to-date status — never a stale "in-progress"
// that only gets reconciled whenever the student next happens to hit
// Start. Mirrors the exact precedent trainerQuiz.controller.js's
// syncSchedule already sets for Quiz.status (lazy reconciliation on read,
// no cron). No-op (returns false) otherwise.
const closeExpiredAttempt = async (quiz, attempt) => {
  if (attempt.status !== 'in-progress') return false;

  const now = new Date();
  const deadline = attempt.deadline ? new Date(attempt.deadline) : null;
  const deadlinePassed = Boolean(deadline && deadline <= now);
  const quizExpired = getQuizAvailability(quiz, now) === 'expired';
  if (!deadlinePassed && !quizExpired) return false;

  // Whichever boundary actually triggered this is what "submitted at"
  // should reflect — the true moment this attempt stopped being valid,
  // not whenever a later request happened to notice and reconcile it.
  const effectiveDeadline = deadlinePassed ? deadline : new Date(quiz.endAt);

  const result = gradeAttempt(quiz, attempt.answers);
  Object.assign(attempt, result, { submittedAt: effectiveDeadline, late: true });
  await attempt.save();
  return true;
};

const AVAILABILITY_MESSAGES = {
  'not-started': 'Quiz has not started yet.',
  available: 'Quiz is available.',
  expired: 'Quiz has expired.',
};

// The single source of truth for "should a Resume button/action be offered
// for this quiz" — computed here once, server-side, and handed to the
// frontend as an explicit flag (`canResume`) instead of the frontend
// re-deriving it from `latestAttempt.status === 'in-progress'` on its own.
// That inference used to be correct in isolation, but only as long as the
// caller had ALREADY run `closeExpiredAttempt` on `latestAttempt` first —
// two different read paths (getQuizzes, getQuizInfo) each doing that
// reconciliation and then re-deriving the same boolean independently was
// exactly the kind of drift risk (and, before computeAttemptDeadline's own
// fix above, the zero-duration/null-deadline gap) that let a genuinely
// finished quiz keep showing Resume. Requires the caller to have already
// called closeExpiredAttempt(quiz, latestAttempt) on this exact attempt —
// that's still done by getQuizzes/getQuizInfo, just once, not duplicated.
const canResumeAttempt = (latestAttempt) => Boolean(latestAttempt && latestAttempt.status === 'in-progress');

// Which attempt should represent this quiz in the student's own quiz
// list/result display — a Passed attempt always wins over a later Failed
// (or still in-progress) one, so a genuine pass can never be hidden by a
// subsequent unsuccessful retake. Falls back to the true latest attempt
// (whatever its status, including null if never attempted) only when
// nothing has passed yet — this is what "no attempt is passed, show the
// latest attempt" means. Deliberately independent of canResumeAttempt
// above: which attempt is shown as the RESULT and whether Resume is
// offered are two separate questions — a student who passed on attempt 1
// but has attempt 2 genuinely in progress should see "Passed" as the
// result AND still be able to Resume attempt 2.
//
// `quizAttempts` must already be sorted descending by attemptNumber (both
// callers already fetch it that way) so `[0]` is the true latest and, among
// multiple passes, `.find` below naturally prefers the most recent one.
const pickDisplayAttempt = (quizAttempts) => {
  const passed = quizAttempts.find((a) => a.status === 'passed');
  return passed || quizAttempts[0] || null;
};

// Never show more attempts, or a higher attempt COUNT, than the real
// MAX_QUIZ_ATTEMPTS cap — a defensive display-layer clamp against any
// attempt documents that predate this cap being enforced (e.g. historical
// data from before attempt limits existed). Enforcement of the cap itself
// (rejecting a would-be 3rd attempt) is entirely separate and unaffected —
// this only ever governs what a student is SHOWN, never what the backend
// allows them to create.
const cappedAttemptsUsed = (attemptCount) => Math.min(attemptCount, MAX_QUIZ_ATTEMPTS);

// The attempts actually worth showing a student in their own quiz
// info/history — once ANY attempt has passed, every failed attempt is
// hidden: a pass is the qualifying result, so an earlier or later failed
// retake is no longer meaningful information, just noise (same "a pass
// always wins" spirit pickDisplayAttempt already applies to the single
// summary result above, extended here to the full attempts list). An
// in-progress attempt is always kept — there's an active session to show
// regardless of past pass/fail history. Also defensively capped at
// MAX_QUIZ_ATTEMPTS entries, same reasoning as cappedAttemptsUsed above.
//
// `quizAttempts` must already be sorted descending by attemptNumber (same
// precondition pickDisplayAttempt documents) so the cap keeps the most
// recent attempts, and relative order is preserved through the filter.
const visibleAttempts = (quizAttempts) => {
  const hasPassed = quizAttempts.some((a) => a.status === 'passed');
  const filtered = hasPassed ? quizAttempts.filter((a) => a.status !== 'failed') : quizAttempts;
  return filtered.slice(0, MAX_QUIZ_ATTEMPTS);
};

module.exports = {
  QUIZ_PASS_PERCENTAGE,
  MAX_QUIZ_ATTEMPTS,
  sanitizeQuestion,
  gradeAttempt,
  computeAttemptDeadline,
  closeExpiredAttempt,
  getQuizAvailability,
  AVAILABILITY_MESSAGES,
  canResumeAttempt,
  pickDisplayAttempt,
  cappedAttemptsUsed,
  visibleAttempts,
};
