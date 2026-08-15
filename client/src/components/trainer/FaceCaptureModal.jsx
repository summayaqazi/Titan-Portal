import { useEffect, useRef, useState } from 'react';
import { Camera, ScanFace, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '../common';
import {
  loadFaceModels,
  warmUpFaceModels,
  calibrateEarBaseline,
  runBlinkLiveness,
  detectFace,
  DEFAULT_NOISE_MULTIPLIER,
  DEFAULT_TIMEOUT_MS,
} from '../../utils/faceVerification';

const STAGES = {
  STARTING: 'starting', // requesting camera + loading/warming up models
  SCANNING: 'scanning', // live, waiting for a face + blink
  CAPTURING: 'capturing', // liveness passed, grabbing the final descriptor
  DONE: 'done', // captured, about to hand off to the caller
  ERROR: 'error',
};

// Each retry (`attempt` > 0, see the `attempt` state below) requires a
// candidate dip to clear a slightly SMALLER multiple of this session's own
// observed EAR noise (see runBlinkLiveness's `noiseMultiplier`), and gets a
// slightly longer window — someone who's already struggled once gets a
// genuinely easier next try, not the exact same bar shown again with just a
// different button click. Capped (MAX_RETRY_STEPS, and MIN_NOISE_MULTIPLIER
// as a hard floor) so repeated retries can never loosen things enough to
// risk a false positive from camera noise alone — the multiplier can ease
// off, but never below a safety floor still comfortably beyond ordinary
// landmark jitter.
const MAX_RETRY_STEPS = 3;
const RETRY_NOISE_MULTIPLIER_STEP = 0.25; // -0.25x per retry, from the 3.0x default down toward the floor below
const MIN_NOISE_MULTIPLIER = 2.2; // hard floor — still comfortably beyond ordinary landmark jitter (0% false-positive at realistic noise — see faceVerification.js's own test harness), never looser
const RETRY_TIMEOUT_STEP_MS = 1500; // +1.5s per retry, up to +4.5s at the cap

// A face genuinely never found across the whole window vs. a face that was
// tracked fine but no qualifying blink happened both used to collapse into
// one vague "couldn't confirm a live face" message — split (matching the
// `reason` values runBlinkLiveness now distinguishes — see its own comment
// in utils/faceVerification.js) so the trainer gets an actionable reason
// instead of a guess, and a genuinely different message on each kind of
// miss instead of the same generic line every retry.
const ERROR_MESSAGES = {
  'no-face': "We couldn't detect your face. Make sure you're facing the camera, your face is centered in the oval, and the room is well lit, then try again.",
  'no-blink': "We could see your face but didn't catch a blink. Look at the camera and blink naturally — a normal blink is enough, no need to blink slowly or hold your eyes shut.",
  'partial-blink': "We saw you start to blink but didn't catch a clean, complete blink. Try one clear, natural blink and keep your face in the oval, then try again.",
  'incomplete-blink': "We saw you close your eyes but ran out of time before catching them reopen. Make sure your face stays in the oval right after you blink, then try again.",
  capture: "Lost sight of your face right after the blink. Stay in frame for a moment after blinking, then try again.",
  default: 'Something went wrong starting face verification. Please try again.',
};

// Shared camera + face + passive-blink-liveness capture UI — used by both
// the Trainer Profile's "Enroll Face ID" action and the Mark Attendance
// flow, so the camera/liveness logic exists exactly once. Resolves via
// `onCapture({ descriptor, livenessPassed: true })` the moment a real blink
// is observed on a detected face AND the descriptor for that same face has
// been captured; the caller decides what to do with that (enroll vs.
// submit a check-in) — this component never talks to the API itself and
// never sends the video/photo anywhere, only the 128-float descriptor it
// hands back.
//
// Known limitation (documented, not hidden): passive blink detection
// defeats a static printed/held-up photo, but not a pre-recorded video
// played back at the camera. There's no way to close that gap from a
// browser-only, no-cloud-API stack — the face MATCH itself is always
// re-verified server-side regardless, which is the check that actually
// prevents impersonation; this liveness step is an additional deterrent
// against the cheapest spoof (a photo), not a complete anti-spoof system.
export default function FaceCaptureModal({ open, onClose, onCapture, title = 'Face Verification', subtitle }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const livenessRef = useRef(null);
  // Guards against ever running two capture attempts at once (e.g. a
  // double-invoked effect, or a stray extra call some future change might
  // introduce) — checked/set at the very start of each attempt, cleared in
  // the effect's own cleanup. Not reachable via the UI today (the only
  // trigger, retry(), is a single button that disappears once a new
  // attempt starts), but explicit rather than assumed.
  const inFlightRef = useRef(false);
  const [stage, setStage] = useState(STAGES.STARTING);
  const [feedback, setFeedback] = useState('Starting camera…');
  const [progress, setProgress] = useState(0); // 0-1, how far through the liveness window
  const [error, setError] = useState('');
  // Bumped by retry() to re-run the capture effect below (which only
  // depends on `open`, and `open` doesn't change on a retry) — the whole
  // getUserMedia+models+liveness sequence restarts from scratch each time
  // this changes.
  const [attempt, setAttempt] = useState(0);

  const stopCamera = () => {
    livenessRef.current?.cancel();
    livenessRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // Explicitly detach the (now-stopped) stream from the <video> element
    // rather than leaving its old srcObject dangling — on some browsers a
    // stale srcObject left attached across a retry's new getUserMedia call
    // is what leaves the element painting its last (or a black) frame
    // instead of cleanly showing the new stream once it's assigned.
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return undefined;
    }

    if (inFlightRef.current) return undefined; // a capture attempt is already running — never start a second one
    inFlightRef.current = true;

    let cancelled = false;
    setStage(STAGES.STARTING);
    setError('');
    setProgress(0);
    setFeedback('Starting camera…');

    (async () => {
      try {
        const [stream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 } }, audio: false }),
          loadFaceModels(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if (cancelled) return;

        // Absorb TensorFlow.js's one-off first-inference cost (can be a
        // second or more) here, BEFORE the timed liveness window starts —
        // this used to happen on whatever tick ran first inside the 8s
        // window, silently eating a big chunk of the trainer's time budget.
        setFeedback('Preparing face detection…');
        await warmUpFaceModels(videoRef.current);
        if (cancelled) return;

        // Calibrate THIS trainer's own "eyes open" reference AND how noisy
        // that reading already is (camera angle, distance, lighting,
        // glasses, eye shape all shift both) before the timer starts — see
        // calibrateEarBaseline's/stepBlinkState's own comments in
        // utils/faceVerification.js for why a fixed guess (whether an
        // absolute number or a fixed ratio of the baseline) was the actual
        // cause of a real, clearly-blinking face never registering: the
        // bar a candidate blink has to clear is measured against this exact
        // session's own observed noise, not assumed in advance.
        setFeedback('Calibrating…');
        const { baseline, jitter } = await calibrateEarBaseline(videoRef.current);
        if (cancelled) return;

        setStage(STAGES.SCANNING);
        setFeedback('Position your face in the oval and look at the camera…');

        // Each retry (attempt > 0) requires a slightly smaller multiple of
        // the observed noise floor and gives a little more time — someone
        // who's already struggled once gets a genuinely easier next try
        // instead of facing the exact same bar again. Capped
        // (MAX_RETRY_STEPS, MIN_NOISE_MULTIPLIER) so it never eases enough
        // to risk false positives from camera noise alone.
        const retryStep = Math.min(attempt, MAX_RETRY_STEPS);
        const liveness = runBlinkLiveness(videoRef.current, {
          baseline,
          jitter,
          noiseMultiplier: Math.max(MIN_NOISE_MULTIPLIER, DEFAULT_NOISE_MULTIPLIER - retryStep * RETRY_NOISE_MULTIPLIER_STEP),
          timeoutMs: DEFAULT_TIMEOUT_MS + retryStep * RETRY_TIMEOUT_STEP_MS,
          onSample: ({ faceDetected, elapsedMs, timeoutMs, blinkDetected }) => {
            if (cancelled) return;
            setProgress(Math.min(1, elapsedMs / timeoutMs));
            if (blinkDetected) {
              setFeedback('Blink detected — verifying…');
            } else {
              setFeedback(faceDetected ? 'Face detected — blink naturally to continue' : 'No face detected — center your face in the oval');
            }
          },
        });
        livenessRef.current = liveness;
        const result = await liveness.promise;
        if (cancelled) return;

        if (!result.livenessPassed || !result.lastResult) {
          stopCamera();
          setStage(STAGES.ERROR);
          setError(ERROR_MESSAGES[result.reason] || ERROR_MESSAGES.default);
          return;
        }

        // The liveness loop only ever ran the cheap landmarks-only check
        // (see detectFaceLite in utils/faceVerification.js) — the actual
        // 128-d descriptor is captured here, exactly once, from this same
        // moment right after the confirmed blink. A short retry window
        // covers the rare case where the trainer's face moved out of frame
        // in the split second right after blinking.
        setStage(STAGES.CAPTURING);
        setFeedback('Blink detected — verifying…');
        let captured = null;
        for (let i = 0; i < 5 && !cancelled; i++) {
          // eslint-disable-next-line no-await-in-loop
          captured = await detectFace(videoRef.current);
          if (captured) break;
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (cancelled) return;

        if (!captured) {
          stopCamera();
          setStage(STAGES.ERROR);
          setError(ERROR_MESSAGES.capture);
          return;
        }

        setStage(STAGES.DONE);
        stopCamera();
        onCapture({ descriptor: captured.descriptor, livenessPassed: true });
      } catch (err) {
        if (cancelled) return;
        stopCamera();
        setStage(STAGES.ERROR);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera access was denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera was found on this device.');
        } else {
          setError(err.message || ERROR_MESSAGES.default);
        }
      }
    })();

    return () => {
      cancelled = true;
      inFlightRef.current = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  const showProgress = stage === STAGES.SCANNING;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col items-center gap-3">
        {subtitle && <p className="text-center text-sm text-slate-500">{subtitle}</p>}

        <div className="relative flex h-72 w-72 items-center justify-center overflow-hidden rounded-full bg-slate-900">
          {/* The mirror flip lives on this wrapper, not the <video> itself
              (previously `scale-x-[-1]` was applied directly to the video
              element) — a CSS transform applied straight to a hardware-
              decoded <video> can land it in a separate GPU compositing
              layer that, on some browser/driver combinations, paints solid
              black instead of the actual frame. The wrapper carries the
              transform + its own compositing-layer hint instead, leaving
              the video element itself untransformed so its decode/paint
              path stays the plain, reliable one. `key={attempt}` forces a
              fully fresh <video> DOM node on every retry rather than
              reusing one that already rendered a stream once — cheap
              insurance against any lingering per-element decode/paint state
              from the previous attempt. */}
          <div key={attempt} className="h-full w-full [transform:scaleX(-1)] [will-change:transform]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted autoPlay playsInline className="h-full w-full bg-slate-900 object-cover" />
          </div>
          <div
            className={`pointer-events-none absolute inset-2 rounded-full border-4 ${
              stage === STAGES.ERROR ? 'border-red-400' : stage === STAGES.DONE || stage === STAGES.CAPTURING ? 'border-green-400' : 'border-white/70'
            }`}
          />
          {stage === STAGES.STARTING && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 text-white">
              <Camera className="animate-pulse" size={32} />
            </div>
          )}
        </div>

        {/* Thin progress bar for how far through the liveness window we
            are — purely informational (nothing is time-pressured harder by
            showing it), so a trainer waiting on a slower device can see
            it's still actively working instead of wondering if it's stuck. */}
        {showProgress && (
          <div className="h-1 w-56 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary-500 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="flex min-h-10 items-center gap-2 text-center text-sm">
          {stage === STAGES.ERROR ? (
            <span className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle size={15} /> {error}
            </span>
          ) : stage === STAGES.DONE ? (
            <span className="flex items-center gap-1.5 text-green-600">
              <ScanFace size={15} /> Verified — processing…
            </span>
          ) : (
            <span className="text-slate-600">{feedback}</span>
          )}
        </div>

        {stage === STAGES.ERROR && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button onClick={retry}>Try Again</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
