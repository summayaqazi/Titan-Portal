import { useEffect, useRef } from 'react';
import { Camera, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Modal, Button } from '../common';
import studentPortalApi from '../../api/studentPortalApi';
import useQrCodeScanner from '../../hooks/useQrCodeScanner';

// Camera-driven QR scanner for the Student Portal's own "Scan QR"
// attendance flow. The actual camera/canvas/jsQR scan-loop mechanics live
// in hooks/useQrCodeScanner.js (shared with the Admin/Super Admin QR
// scanner, components/attendance/AttendanceQrScannerModal.jsx) — this
// component is now just that hook wired to studentPortalApi.scanAttendance
// plus this flow's own copy/rendering. Decoded text is only ever sent to
// the server for the actual verification, never trusted or acted on here.
// No Trainer QR is ever involved — this only ever calls the student's own
// /me/attendance/scan endpoint.
export default function QrAttendanceScanner({ open, onClose, onSuccess }) {
  const { videoRef, canvasRef, phase, error, result, retryCamera, stop } = useQrCodeScanner({
    open,
    onDecode: (qrText) => studentPortalApi.scanAttendance(qrText),
    cameraErrorMessage: 'Camera access is required to scan your ID card. Please allow camera permission and try again.',
  });

  // Fire onSuccess exactly once per successful scan, the moment `phase`
  // actually transitions to 'success' — same timing the original inline
  // handleDecoded had (called right alongside setting the success state),
  // not re-fired on every re-render while still on the success screen.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (phase === 'success' && !notifiedRef.current) {
      notifiedRef.current = true;
      onSuccess?.(result);
    }
    if (phase !== 'success') notifiedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const successRecords = result?.records || null;

  const handleClose = () => {
    stop();
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
