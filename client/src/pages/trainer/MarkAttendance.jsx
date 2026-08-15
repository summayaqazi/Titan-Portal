import { useEffect, useState } from 'react';
import { CalendarX2, MapPin, ScanFace, CheckCircle2, Clock, BookOpen } from 'lucide-react';
import { PageContainer, Button, EmptyState, StatusBadge } from '../../components/common';
import FaceCaptureModal from '../../components/trainer/FaceCaptureModal';
import trainerPortalApi from '../../api/trainerPortalApi';
import { getErrorMessage } from '../../utils/errors';

// STEP flow: sessions load -> idle (session card + Start button) -> face
// (FaceCaptureModal open) -> submitting (POST check-in) -> success | failed
// (retryable, back to idle). No location/geofence step — a trainer is not
// required to be physically inside the campus to check in here; Face +
// liveness verification and the schedule/check-in-window rules are
// untouched.
const STEP = { LOADING: 'loading', IDLE: 'idle', FACE: 'face', SUBMITTING: 'submitting', SUCCESS: 'success', FAILED: 'failed' };

export default function MarkAttendance() {
  const [step, setStep] = useState(STEP.LOADING);
  const [sessions, setSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadSessions = () => {
    setStep(STEP.LOADING);
    setSessionsError('');
    trainerPortalApi
      .getCurrentSessions()
      .then((data) => {
        setSessions(data);
        setStep(STEP.IDLE);
      })
      .catch((err) => {
        setSessionsError(getErrorMessage(err, 'Failed to load your schedule'));
        setStep(STEP.IDLE);
      });
  };

  useEffect(() => {
    loadSessions();
  }, []);

  // >1 concurrently-active session is a genuine scheduling conflict (mirrors
  // the server's own check-in-time rejection for the same case) — shown
  // plainly rather than silently picking one of them to display.
  const hasConflict = sessions.length > 1;
  const session = sessions.length === 1 ? sessions[0] : null;

  const handleFaceCapture = async ({ descriptor, livenessPassed }) => {
    setStep(STEP.SUBMITTING);
    setError('');
    try {
      const data = await trainerPortalApi.checkInWithVerification({
        descriptor,
        liveness: { passed: livenessPassed, method: 'blink' },
      });
      setResult(data);
      setStep(STEP.SUCCESS);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark attendance'));
      setStep(STEP.FAILED);
    }
  };

  const startOver = () => {
    setError('');
    setResult(null);
    loadSessions();
  };

  return (
    <PageContainer title="Mark Attendance" description="Face verified check-in for your current class">
      <div className="mx-auto max-w-xl">
        {step === STEP.LOADING && <p className="py-10 text-center text-sm text-slate-400">Checking your schedule…</p>}

        {sessionsError && step !== STEP.LOADING && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{sessionsError}</div>
        )}

        {step === STEP.IDLE && !session && !hasConflict && !sessionsError && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <EmptyState
              icon={CalendarX2}
              title="No scheduled session found"
              description="Attendance can only be marked while one of your classes is actually in session. Check back at your next scheduled class time."
            />
          </div>
        )}

        {step === STEP.IDLE && hasConflict && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <h2 className="text-sm font-semibold text-amber-800">Schedule Conflict</h2>
            <p className="mt-2 text-sm text-amber-700">
              More than one of your classes is scheduled at this exact time. Please contact your campus admin to resolve the schedule
              conflict before marking attendance.
            </p>
          </div>
        )}

        {(step === STEP.IDLE || step === STEP.SUBMITTING) && session && (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">Session in progress</p>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-800">
              <BookOpen size={18} className="text-primary-600" /> {session.courseName || 'Class'}
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <MapPin size={15} className="text-slate-400" /> {session.campusName || '—'}
              </p>
              <p className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400" />
                {session.startTime && session.endTime ? `${session.startTime} – ${session.endTime}` : session.slotLabel || '—'}
              </p>
            </div>

            {error && step === STEP.IDLE && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <Button
              className="mt-5 w-full justify-center"
              disabled={step !== STEP.IDLE}
              onClick={() => {
                setError('');
                setStep(STEP.FACE);
              }}
            >
              <ScanFace size={16} />
              {step === STEP.SUBMITTING ? 'Marking attendance…' : 'Start Verification'}
            </Button>
          </div>
        )}

        {step === STEP.SUCCESS && result && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-green-600" size={36} />
            <h2 className="text-lg font-semibold text-slate-800">Attendance Marked</h2>
            <p className="mt-1 text-sm text-slate-600">
              {result.courseName} · {result.campusName}
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
              <StatusBadge status={result.status} />
              {result.isLate && <StatusBadge status="late" />}
              <span>Checked in at {new Date(result.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Your check-in is recorded as pending until your Admin/Super Admin verifies it — same as before.
            </p>
            <Button variant="secondary" className="mt-5" onClick={startOver}>
              Done
            </Button>
          </div>
        )}

        {step === STEP.FAILED && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-base font-semibold text-red-700">Attendance Not Marked</h2>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <Button className="mt-5" onClick={startOver}>
              Try Again
            </Button>
          </div>
        )}
      </div>

      <FaceCaptureModal
        open={step === STEP.FACE}
        onClose={() => setStep(STEP.IDLE)}
        onCapture={handleFaceCapture}
        title="Verify Your Face"
        subtitle="Look at the camera and blink naturally to confirm it's really you."
      />
    </PageContainer>
  );
}
