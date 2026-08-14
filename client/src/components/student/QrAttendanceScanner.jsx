import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Modal, Button } from '../common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

// How long an inline error stays up before the scan loop automatically
// resumes — long enough to read ("This ID card does not belong to your
// account."), short enough that a student pointing the camera back at
// their OWN card isn't stuck waiting.
const ERROR_COOLDOWN_MS = 2500;

// Camera-driven QR scanner for the Student Portal's own "Scan QR"
// attendance flow. Decoding happens entirely client-side (jsQR against
// video frames drawn to a hidden canvas) — the decoded text is only ever
// sent to the server for the actual verification (see
// studentPortalApi.scanAttendance / markOwnAttendanceViaQr), never trusted
// or acted on here. No Trainer QR is ever involved — this only ever calls
// the student's own /me/attendance/scan endpoint.
export default function QrAttendanceScanner({ open, onClose, onSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const busyRef = useRef(false); // true while a decoded code is being verified, or during the post-error cooldown
  const cooldownTimeoutRef = useRef(null);

  const [phase, setPhase] = useState('starting'); // starting | scanning | verifying | success | camera-error
  const [error, setError] = useState('');
  const [successRecords, setSuccessRecords] = useState(null);

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
    const code = jsQR(imageData.data, imageData.width, imageData.height);

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
      const data = await studentPortalApi.scanAttendance(qrText);
      // Verified — stop the camera now, per spec ("Stop the camera after
      // successful verification"), and surface what was actually marked.
      stopCamera();
      setSuccessRecords(data.records || []);
      setPhase('success');
      onSuccess?.(data);
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
      }, ERROR_COOLDOWN_MS);
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setPhase('starting');
    setError('');
    setSuccessRecords(null);
    busyRef.current = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
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
          setError('Camera access is required to scan your ID card. Please allow camera permission and try again.');
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
      ?.getUserMedia({ video: { facingMode: 'environment' } })
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
        setError('Camera access is required to scan your ID card. Please allow camera permission and try again.');
      });
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Scan QR" size="sm">
      <div className="space-y-3">
        {phase === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={40} className="text-green-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Attendance marked</p>
              <p className="mt-1 text-xs text-slate-500">
                {successRecords?.length
                  ? successRecords
                      .map((r) => `${r.courseName || 'Course'}${r.alreadyMarked ? ' (already marked today)' : ''}`)
                      .join(', ')
                  : 'You are marked present for today.'}
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        ) : phase === 'camera-error' ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle size={36} className="text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" onClick={retryCamera}>
              <RotateCcw size={14} /> Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Responsive video frame — fills the modal's width and keeps a
                fixed aspect ratio instead of a fixed pixel size, so it
                scales correctly from a narrow phone screen up to desktop
                (Modal itself is already capped at max-w-sm/max-h-[90vh]). */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              {phase === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                  <Camera size={28} />
                  <p className="text-xs">Starting camera…</p>
                </div>
              )}
              {phase === 'scanning' && (
                <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70" />
              )}
              {phase === 'verifying' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                  Verifying…
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <p className="text-center text-xs text-slate-500">
              Show the QR code on your own Student ID Card to the camera.
            </p>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-center text-xs text-red-600">{error}</p>}

            <Button variant="secondary" className="w-full" onClick={handleClose}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
