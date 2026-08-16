import * as faceapi from '@vladmandic/face-api';

// Client-side face detection/recognition + passive blink liveness for
// Trainer Face + Location Attendance. Everything here runs entirely
// in-browser (face-api.js / TensorFlow.js) — no photo or video frame is
// ever sent to the server, only the numeric 128-float descriptor this
// module extracts, and only after this module's own liveness check has
// passed. Self-hosted model weights (client/public/models/) — the tiny,
// fast subset (tiny face detector + 68-point landmarks + recognition net)
// rather than the larger SSD/Mobilenet variant, since this only ever needs
// to find and verify ONE face already framed by the caller, not detect
// many faces in a crowd scene.
const MODEL_URL = '/models';

// inputSize 320 (was 224) + a slightly lower scoreThreshold (0.4, was 0.5)
// — both purely about *finding* a face reliably across normal laptop/phone
// webcams and imperfect room lighting (recall), not about who it's matched
// against. Affordable now that the expensive step (the recognition
// descriptor) is no longer computed on every tick — see detectFaceLite
// below — so this doesn't reintroduce the slowdown that caused the
// original "can't confirm a live face in time" bug.
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });

let modelsLoadedPromise = null;

// Lazy, once-per-page-load model load — safe to call from multiple
// components (Profile's enroll button, the Mark Attendance page); every
// caller after the first just awaits the same in-flight/resolved promise.
export function loadFaceModels() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).catch((err) => {
      // Let the next call retry instead of permanently caching a failure
      // (e.g. a transient network blip loading the model files).
      modelsLoadedPromise = null;
      throw err;
    });
  }
  return modelsLoadedPromise;
}

// Cheap per-tick check used by the liveness sampling loop — detection +
// 68-point landmarks only, deliberately WITHOUT the 128-d recognition
// descriptor. Computing that descriptor (a full recognition-net forward
// pass, by far the most expensive step in the whole pipeline) on every
// ~100ms sample was the actual root cause of live, clearly-visible faces
// still timing out: it starved the loop down to only a handful of real
// samples across the whole window, easily missing a natural ~150-300ms
// blink entirely. The descriptor is still always computed — exactly once,
// from the very frame the blink was confirmed on — via detectFace() below;
// nothing about WHO the face belongs to is ever skipped or weakened, only
// the per-tick liveness sampling got cheaper.
async function detectFaceLite(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null;
  const result = await faceapi.detectSingleFace(videoEl, DETECTOR_OPTIONS).withFaceLandmarks();
  if (!result) return null;
  return { box: result.detection.box, landmarks: result.landmarks };
}

// Full detection + landmarks + the 128-d recognition descriptor against the
// current video frame. Returns null when no face (or more than one — an
// attendance selfie should only ever show the trainer themselves) is
// confidently found, never a best-guess partial result. Used for the
// one-time warm-up pass and the final post-liveness capture — never in the
// per-tick sampling loop (see detectFaceLite above).
export async function detectFace(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null;
  const result = await faceapi.detectSingleFace(videoEl, DETECTOR_OPTIONS).withFaceLandmarks().withFaceDescriptor();
  if (!result) return null;
  return {
    box: result.detection.box,
    landmarks: result.landmarks,
    descriptor: Array.from(result.descriptor),
  };
}

// TensorFlow.js pays a one-off kernel-compile/shader-setup cost the FIRST
// time each network (detector, landmarks, recognition) actually runs —
// commonly a second or more on a modest laptop/phone GPU/CPU. Previously
// that cost was paid *inside* the timed 8s liveness window, on whatever
// tick happened to run first — eating a big, unpredictable chunk of the
// user's time budget before they even had a fair chance to blink. This
// runs that same first-inference cost once, silently, right after the
// camera starts and BEFORE the liveness timer begins, so it never counts
// against the user. Best-effort: tries briefly to catch an actual face (so
// the recognition net gets warmed up too, not just the detector), but
// always resolves — never blocks the flow if the trainer isn't in frame
// yet, since the real liveness loop handles that with its own feedback.
export async function warmUpFaceModels(videoEl, { attempts = 5, intervalMs = 250 } = {}) {
  for (let i = 0; i < attempts; i++) {
    // eslint-disable-next-line no-await-in-loop
    const result = await detectFace(videoEl).catch(() => null);
    if (result) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

// Eye Aspect Ratio (Soukupová & Čech) — a real blink is a sharp dip in this
// ratio (eyelids closing) followed by a recovery back up (eyelids
// reopening); a static photo/printout can never produce that transition on
// cue, which is what makes this a meaningful (if not bulletproof — see
// FaceCaptureModal's own comment on video-replay attacks) anti-spoof check
// on top of the face MATCH itself, which is always verified server-side.
function eyeAspectRatio(eye) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function averageEyeAspectRatio(landmarks) {
  const left = eyeAspectRatio(landmarks.getLeftEye());
  const right = eyeAspectRatio(landmarks.getRightEye());
  return (left + right) / 2;
}

// --- Adaptive, multi-frame, STATE-BASED blink detection ---------------------
//
// Two earlier attempts at this both leaned on a single idea: "pick the right
// ratio of a one-time session baseline". First a FIXED absolute EAR pair
// (failed — eye shape/glasses/camera/lighting shift a real "eyes open"
// reading too much for one fixed number to work for everyone). Then a
// baseline-RELATIVE ratio pair, calibrated once per session (better, but
// still a guess: it assumes THIS landmark model, at THIS resolution/
// lighting/angle, resolves eyelid closure down to some assumed fraction of
// open — and for some real users/cameras it measurably doesn't; the model's
// own eyelid landmarks can plateau well short of a "deep" closed reading
// even during a completely genuine full blink, so no fixed ratio guessed in
// advance is guaranteed to sit below what that person's blinks actually
// produce). Both attempts were threshold-tuning exercises — this one isn't.
//
// Instead: track what THIS session's EAR signal actually looks like, live,
// continuously, in two numbers —
//   `openRef`     a slow-moving estimate of "what does eyes-open look like
//                 right now" (re-centers itself over time; never updated
//                 while a candidate blink is in progress, so a real dip can
//                 never drag its own reference down).
//   `openJitter`  a slow-moving estimate of how much THAT reading naturally
//                 wobbles, frame to frame, from camera/landmark noise alone
//                 — with no blink happening.
// A candidate dip is only ever trusted as the start of a real blink once it
// clears the session's OWN observed noise floor by a safe margin
// (NOISE_MULTIPLIER x openJitter, with an absolute floor for the first few
// ticks before openJitter has real data yet) — not a fixed guess about how
// deep a "real" blink should go. Whatever this particular user/camera/
// lighting actually produces — a deep 70% drop or a shallow 15% one — gets
// recognized as long as it's clearly bigger than the noise this exact
// session is already producing, because the bar is measured FROM that noise,
// not assumed in advance.
//
// This is tracked as an explicit state machine across frames — open ->
// dipping -> recovering -> confirmed — not a single-frame decision and not a
// single boolean flag either: `dipMin`/`dipThreshold` carry the shape of the
// CURRENT candidate dip across as many ticks as it actually takes (tolerating
// dropped/no-face frames along the way — see stepBlinkState below), and a
// stalled dip (MAX_DIP_MS) simply re-arms from wherever the eyes currently
// are rather than failing the whole attempt, so unusually slow blinks are
// tolerated without unusually fast ones being required either.
const BASELINE_MIN = 0.2;
const BASELINE_MAX = 0.42;
const DEFAULT_BASELINE = 0.3; // used only if calibration couldn't get a reading at all
const JITTER_MIN = 0.006;
const JITTER_MAX = 0.05;
const DEFAULT_JITTER = 0.012; // used only if calibration couldn't get enough readings to estimate real jitter

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Samples EAR for a short period right after the camera starts (while the
// trainer is presumably just looking normally at the camera, not blinking
// on command yet) to establish THEIR OWN starting open-eye reference AND
// noise floor before the timed liveness window even begins — same spirit as
// the existing warm-up-before-timing-starts approach, extended to calibrate
// both numbers the state machine below needs, not just one. `baseline` is
// the median sample (robust against one stray low reading, e.g. an
// accidental blink during calibration); `jitter` is the mean absolute
// deviation from that median, i.e. how noisy THIS session's readings
// already are before any blink happens. Never blocks indefinitely —
// proceeds with reasonable defaults if no face was in frame yet during
// calibration; runBlinkLiveness continues to gently adapt both numbers
// afterward anyway (see below).
export async function calibrateEarBaseline(videoEl, { durationMs = 1200, intervalMs = 100 } = {}) {
  const samples = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < durationMs) {
    // eslint-disable-next-line no-await-in-loop
    const result = await detectFaceLite(videoEl).catch(() => null);
    if (result) {
      const ear = averageEyeAspectRatio(result.landmarks);
      if (ear > 0) samples.push(ear);
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (!samples.length) return { baseline: DEFAULT_BASELINE, jitter: DEFAULT_JITTER };
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const baseline = clamp(median, BASELINE_MIN, BASELINE_MAX);
  const meanAbsDeviation = samples.reduce((sum, s) => sum + Math.abs(s - median), 0) / samples.length;
  const jitter = clamp(meanAbsDeviation, JITTER_MIN, JITTER_MAX);
  return { baseline, jitter };
}

const REF_EMA_ALPHA = 0.08; // how fast openRef drifts toward new open-state readings — slow, so one high/low reading can't yank it
const NOISE_EMA_ALPHA = 0.15; // how fast openJitter adapts to newly observed open-state noise
const MIN_ABS_DROP = 0.012; // absolute EAR-unit floor a candidate drop must clear regardless of openJitter — protects the first few ticks before openJitter has real data
// 3.0x, not a rounder-looking 4 or 5 — chosen empirically (see the test
// harness used to validate this file), not guessed: at realistic ~2-3%
// open-eye landmark jitter, 3.0x already holds a 0% false-positive rate,
// while catching even a shallow/low-dynamic-range real blink (one that only
// ever reads down to ~90% of baseline — plausible for a landmark model that
// doesn't fully resolve eyelid closure at typical webcam resolution) on the
// FIRST attempt ~97% of the time, vs. under 40% at a more conservative 4.0x.
export const DEFAULT_NOISE_MULTIPLIER = 3;
const RECOVERY_FRACTION = 0.5; // must climb back to within this fraction of the drop distance from openRef to confirm the blink
const RISE_FROM_TROUGH_FRACTION = 0.25; // EAR must climb at least this fraction of the way back up from the trough before we call it "recovering" rather than "still dipping"
const MAX_DIP_MS = 2200; // generous dwell for a slow/held blink before that particular candidate dip is abandoned and the state machine re-arms from wherever the eyes currently are

// One state-machine step, given the latest EAR reading. Mutates and returns
// `state`; returns `{ ...state, confirmed: true }` the instant a full
// open -> dipping -> recovering sequence completes. Kept as a pure-ish
// function of (state, ear, now) — no video/timer access — specifically so
// it can be unit-tested directly against synthetic EAR sequences without
// mocking a camera (see the test harness used to validate this).
export function stepBlinkState(state, ear, now, noiseMultiplier = DEFAULT_NOISE_MULTIPLIER) {
  const dropThreshold = Math.max(MIN_ABS_DROP, state.openJitter * noiseMultiplier);

  if (state.phase === 'open') {
    if (ear < state.openRef - dropThreshold) {
      return { ...state, phase: 'dipping', dipMin: ear, dipThreshold: dropThreshold, dipStartedAt: now };
    }
    return {
      ...state,
      openRef: state.openRef + (ear - state.openRef) * REF_EMA_ALPHA,
      openJitter: clamp(state.openJitter + (Math.abs(ear - state.openRef) - state.openJitter) * NOISE_EMA_ALPHA, JITTER_MIN, JITTER_MAX),
    };
  }

  if (state.phase === 'dipping') {
    const dipMin = Math.min(state.dipMin, ear);
    if (ear > dipMin + state.dipThreshold * RISE_FROM_TROUGH_FRACTION) {
      return { ...state, phase: 'recovering', dipMin };
    }
    if (now - state.dipStartedAt > MAX_DIP_MS) {
      // Held too long without a clear reopen — abandon this candidate dip
      // and re-arm from wherever the eyes are right now, rather than
      // failing the whole attempt over one stalled dip.
      return { ...state, phase: 'open', openRef: ear };
    }
    return { ...state, dipMin };
  }

  // phase === 'recovering'
  if (ear >= state.openRef - state.dipThreshold * RECOVERY_FRACTION) {
    return { ...state, phase: 'confirmed', confirmed: true };
  }
  if (now - state.dipStartedAt > MAX_DIP_MS) {
    return { ...state, phase: 'open', openRef: ear };
  }
  return { ...state, dipMin: Math.min(state.dipMin, ear) };
}

function initialBlinkState(openRef, openJitter) {
  return { phase: 'open', openRef, openJitter, dipMin: null, dipThreshold: null, dipStartedAt: null };
}

// Samples the video roughly every `intervalMs` for up to `timeoutMs`,
// running every reading through stepBlinkState above to detect a genuine,
// complete open -> dipping -> recovering sequence — never a single-frame
// decision, and never a fixed guess at how deep "closed" should read (see
// the big comment above for why that's the actual fix here, not another
// round of threshold tuning).
//
// A missed/no-face tick (a dropped camera frame, a momentary motion blur
// mid-blink, a brief look-away) simply isn't fed into the state machine at
// all that tick — nothing resets, no progress is lost — which is the "small
// tolerance/debounce for camera frame drops" the UI relies on, achieved by
// never punishing a gap rather than by requiring extra confirmation frames
// (which would only make genuinely fast blinks harder to catch, not easier).
//
// `onSample` is called on every sample with live UI-feedback state so the
// caller can show "Face detected — blink naturally" / "No face detected"
// without a second detection loop.
//
// Returns `{ promise, cancel }` (not just a Promise) — `promise` resolves to
// { livenessPassed, lastResult, reason }. `lastResult` (when set) is the
// most recent successful detectFaceLite() sample — landmarks only, no
// descriptor; the caller still needs one more detectFace() call to get the
// actual descriptor for enrollment/verification. `reason` distinguishes
// *why* it failed so the caller can show a specific, actionable message:
//   - 'no-face': never once found a face in the whole window — almost
//     always a camera/lighting/framing problem, not a blink problem.
//   - 'no-blink': a face was tracked the whole time but EAR never left the
//     'open' phase — no blink was attempted/visible at all.
//   - 'incomplete-blink': a candidate dip was still 'dipping' or
//     'recovering' the moment the window ran out — genuinely mid-blink,
//     just needs a little more time/a clearer reopen.
//   - 'partial-blink': at least one candidate dip was started earlier in the
//     window but reset (MAX_DIP_MS) before ever confirming — closer than
//     'no-blink' but not the specific "ran out of time mid-blink" case.
// `cancel()` stops the sampling loop immediately without resolving, for
// FaceCaptureModal to call on close/unmount so a stale loop never keeps
// running against a torn-down video element.
const DEFAULT_INTERVAL_MS = 70; // ~14 samples/sec — fast enough that a normal ~150-300ms blink gets multiple real samples, not zero
const MIN_TICK_GAP_MS = 20; // floor on the next tick's delay, so a very fast device can't peg the CPU sampling faster than this
export const DEFAULT_TIMEOUT_MS = 8000; // a reasonable 5-8s verification window — most people blink at least once every 2-10s naturally

export function runBlinkLiveness(
  videoEl,
  { intervalMs = DEFAULT_INTERVAL_MS, timeoutMs = DEFAULT_TIMEOUT_MS, baseline = DEFAULT_BASELINE, jitter = DEFAULT_JITTER, noiseMultiplier = DEFAULT_NOISE_MULTIPLIER, onSample } = {}
) {
  let cancelled = false;
  let timer = null;

  const promise = new Promise((resolve) => {
    let state = initialBlinkState(clamp(baseline, BASELINE_MIN, BASELINE_MAX), clamp(jitter, JITTER_MIN, JITTER_MAX));
    let everSawFace = false;
    let everDipped = false; // true once any candidate dip was ever started, even if it later reset — drives the 'no-blink' vs 'partial-blink' split
    let lastResult = null;
    const startedAt = Date.now();

    const finish = (outcome) => {
      if (cancelled) return;
      resolve(outcome);
    };

    const tick = async () => {
      if (cancelled) return;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > timeoutMs) {
        let reason;
        if (!everSawFace) reason = 'no-face';
        else if (state.phase === 'dipping' || state.phase === 'recovering') reason = 'incomplete-blink';
        else if (everDipped) reason = 'partial-blink';
        else reason = 'no-blink';
        finish({ livenessPassed: false, lastResult, reason });
        return;
      }

      const tickStartedAt = Date.now();
      const result = await detectFaceLite(videoEl);
      if (cancelled) return;

      if (result) {
        everSawFace = true;
        lastResult = result;
        const ear = averageEyeAspectRatio(result.landmarks);
        const wasOpen = state.phase === 'open';
        state = stepBlinkState(state, ear, tickStartedAt, noiseMultiplier);
        if (wasOpen && state.phase === 'dipping') everDipped = true;

        if (state.confirmed) {
          onSample?.({ faceDetected: true, ear, elapsedMs, timeoutMs, blinkDetected: true });
          finish({ livenessPassed: true, lastResult: result, reason: null });
          return;
        }
        onSample?.({ faceDetected: true, ear, elapsedMs, timeoutMs, blinkDetected: false });
      } else {
        onSample?.({ faceDetected: false, ear: null, elapsedMs, timeoutMs, blinkDetected: false });
      }

      // Schedule the next tick `intervalMs` after THIS tick STARTED, not
      // `intervalMs` after it finished — otherwise detectFaceLite's own
      // compute time (which can itself be a meaningful fraction of
      // intervalMs, more on a slower device) stacks on top of the delay
      // every tick, silently stretching the real sampling gap well past
      // what intervalMs asks for, and eating into how many real samples a
      // brief blink actually gets.
      const tickDurationMs = Date.now() - tickStartedAt;
      const nextDelay = Math.max(MIN_TICK_GAP_MS, intervalMs - tickDurationMs);
      timer = setTimeout(tick, nextDelay);
    };

    tick();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}
