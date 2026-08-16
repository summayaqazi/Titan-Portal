import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { getErrorMessage } from '../utils/errors';

// Camera-driven QR scan loop — extracted out of
// components/student/QrAttendanceScanner.jsx (the Student Portal's own
// "Scan QR" attendance flow, which now uses this hook internally with
// byte-identical behavior) so the exact same camera/decode mechanics also
// back the Admin/Super Admin QR scanner (components/attendance/
// AttendanceQrScannerModal.jsx) instead of a second, copy-pasted loop.
// Decoding happens entirely client-side (jsQR against video frames drawn to
// a hidden canvas) — the decoded text is only ever handed to the caller's
// own `onDecode`, never interpreted or acted on here.
//
// `onDecode(qrText)` does the actual verification (an API call) and should
// return a resolved value on success or throw/reject on failure — this
// hook only manages the camera/scan-loop lifecycle around that call, never
// which endpoint it hits. Read via a ref (not closed over directly) so a
// caller passing a fresh inline function every render never leaves the
// scan loop running against a stale one.
const DEFAULT_COOLDOWN_MS = 2500;
const DEFAULT_CAMERA_ERROR_MESSAGE = 'Camera access is required to scan. Please allow camera permission and try again.';
// Requested as `ideal`, not `exact` — every device still gets a stream
// (falls back to its closest supported resolution), but this pushes
// phones/webcams that default to a modest capture size toward a sharper
// one, which is what a printed ID card's QR actually needs to stay
// decodable from a normal arm's-length distance or a slight angle.
const VIDEO_CONSTRAINTS = { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } };
// How often the center-crop fallback decode (see decodeCroppedFallback) is
// allowed to run — it's real decode work on top of the full-frame attempt
// already happening every animation frame, so it's throttled by time
// rather than run unconditionally at up to 60fps.
const FALLBACK_INTERVAL_MS = 150;
// How much of the frame's shorter side the fallback crops to, then
// upscales by CROP_UPSCALE — a card held up to the camera fills roughly the
// center of the frame, not the edges, so that's where a QR code that's too
// small/distant for the full-frame decode actually is.
const CROP_FRACTION = 0.55;
const CROP_UPSCALE = 2;

// Re-samples just the center of the current video frame at a larger
// effective size and attempts a second decode — full-frame jsQR can miss a
// QR code that's small in frame (held farther away) or only sharp in its
// center (a slight hand-tilt/angle blurring the edges); zooming into just
// that center region gives jsQR more effective pixels per QR module instead
// of a few blurry ones lost in the full frame. `cropCanvasRef` holds a
// canvas created lazily on first use and never inserted into the DOM
// (getImageData/drawImage both work fine on a detached canvas), so this
// needs no JSX from any caller.
function decodeCroppedFallback(video, cropCanvasRef) {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return null;

  if (!cropCanvasRef.current) {
    cropCanvasRef.current = document.createElement('canvas');
  }
  const cropCanvas = cropCanvasRef.current;
  const cropSize = Math.round(Math.min(videoWidth, videoHeight) * CROP_FRACTION);
  const outSize = cropSize * CROP_UPSCALE;
  cropCanvas.width = outSize;
  cropCanvas.height = outSize;

  const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, (videoWidth - cropSize) / 2, (videoHeight - cropSize) / 2, cropSize, cropSize, 0, 0, outSize, outSize);
  const imageData = ctx.getImageData(0, 0, outSize, outSize);
  return jsQR(imageData.data, outSize, outSize);
}

export default function useQrCodeScanner({
  open,
  onDecode,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  cameraErrorMessage = DEFAULT_CAMERA_ERROR_MESSAGE,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null); // lazily-created, never mounted — see decodeCroppedFallback
  const lastFallbackAttemptRef = useRef(0);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const busyRef = useRef(false); // true while a decoded code is being verified, or during the post-error cooldown
  const cooldownTimeoutRef = useRef(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  const [phase, setPhase] = useState('starting'); // starting | scanning | verifying | success | camera-error
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = jsQR(imageData.data, imageData.width, imageData.height);

    // Full-frame decode failed this frame — try the throttled center-crop
    // fallback (see decodeCroppedFallback) before giving up on this frame
    // entirely, so a card held farther away or slightly angled still gets a
    // real shot instead of only ever being read when it's dead-center and
    // close.
    if (!code) {
      const now = performance.now();
      if (now - lastFallbackAttemptRef.current > FALLBACK_INTERVAL_MS) {
        lastFallbackAttemptRef.current = now;
        code = decodeCroppedFallback(video, cropCanvasRef);
      }
    }

    if (code?.data && !busyRef.current) {
      handleDecoded(code.data);
      return; // handleDecoded drives the next step (verify, then resume or stop)
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const handleDecoded = async (qrText) => {
    busyRef.current = true;
    setPhase('verifying');
    setError('');
    try {
      const data = await onDecodeRef.current(qrText);
      // Verified — stop the camera now (only a successful scan stops it).
      stopCamera();
      setResult(data);
      setPhase('success');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not verify this QR code.'));
      setPhase('scanning');
      // Cooldown before resuming the scan loop — long enough to read the
      // error, short enough to retry quickly with the right card. Camera
      // stays on throughout (only a successful scan stops it).
      cooldownTimeoutRef.current = setTimeout(() => {
        busyRef.current = false;
        setError('');
        rafRef.current = requestAnimationFrame(scanFrame);
      }, cooldownMs);
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setPhase('starting');
    setError('');
    setResult(null);
    busyRef.current = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: VIDEO_CONSTRAINTS })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setPhase('scanning');
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('camera-error');
          setError(cameraErrorMessage);
        }
      });

    return () => {
      cancelled = true;
      stopCamera();
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const retryCamera = () => {
    setPhase('starting');
    setError('');
    navigator.mediaDevices
      ?.getUserMedia({ video: VIDEO_CONSTRAINTS })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setPhase('scanning');
        rafRef.current = requestAnimationFrame(scanFrame);
      })
      .catch(() => {
        setPhase('camera-error');
        setError(cameraErrorMessage);
      });
  };

  const stop = () => stopCamera();

  return { videoRef, canvasRef, phase, error, result, retryCamera, stop };
}
