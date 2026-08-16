import { Camera, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Modal, Button, StatusBadge } from '../common';
import attendanceApi from '../../api/attendanceApi';
import trainerAttendanceApi from '../../api/trainerAttendanceApi';
import useQrCodeScanner from '../../hooks/useQrCodeScanner';

const COPY = {
  student: {
    title: 'Scan Student QR',
    instruction: "Show the student's ID Card QR code to the camera.",
    cameraErrorMessage: 'Camera access is required to scan a Student ID Card. Please allow camera permission and try again.',
    // Unchanged from before this label existed — the Student flow's own
    // overlay text stays byte-identical.
    verifyingLabel: 'Verifying…',
  },
  trainer: {
    title: 'Scan Trainer QR',
    instruction: "Show the trainer's ID Card QR code to the camera.",
    cameraErrorMessage: 'Camera access is required to scan a Trainer ID Card. Please allow camera permission and try again.',
    // More specific than the Student flow's generic "Verifying…" — this is
    // the "Trainer Found" step of the Scanning -> Trainer Found -> Verified
    // states: the QR already decoded to a trainer id at this point, the
    // server call in flight is identifying + checking that trainer in.
    verifyingLabel: 'Verifying trainer…',
  },
};

// Admin/Super Admin QR attendance scanner — Student and Trainer ID Card
// scanning share this one component (`mode` picks which), which itself
// shares its camera/scan-loop mechanics with the Student Portal's own
// self-scan (hooks/useQrCodeScanner.js). Verification/marking is the
// server's job (attendanceApi.scanQr / trainerAttendanceApi.scanQr, backed
// by the exact same logic the self-scan and self-check-in flows already
// use — see server/src/utils/studentQrAttendance.js and
// trainerQrAttendance.js) — this component only drives the camera and
// renders whatever the server decided: success, or the specific reason it
// wasn't (invalid QR, no class in session, already marked, outside your
// campus, outside the check-in window).
export default function AttendanceQrScannerModal({ open, onClose, mode, campusFilter, onScanned }) {
  const copy = COPY[mode] || COPY.student;

  const { videoRef, canvasRef, phase, error, result, retryCamera, stop } = useQrCodeScanner({
    open,
    onDecode: (qrText) =>
      mode === 'trainer' ? trainerAttendanceApi.scanQr(qrText, campusFilter) : attendanceApi.scanQr(qrText, campusFilter),
    cameraErrorMessage: copy.cameraErrorMessage,
  });

  const handleClose = () => {
    stop();
    onClose();
  };

  const handleDone = () => {
    onScanned?.(result);
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={copy.title} size="sm">
      <div className="space-y-3">
        {phase === 'success' ? (
          <SuccessSummary mode={mode} result={result} onDone={handleDone} />
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
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-900">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
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
                  {copy.verifyingLabel}
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <p className="text-center text-xs text-slate-500">{copy.instruction}</p>
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

function SuccessSummary({ mode, result, onDone }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <CheckCircle2 size={40} className="text-green-600" />
      {mode === 'trainer' ? <TrainerSummary result={result} /> : <StudentSummary result={result} />}
      <Button onClick={onDone}>Done</Button>
    </div>
  );
}

function StudentSummary({ result }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{result?.studentName || 'Attendance marked'}</p>
      <p className="mt-1 text-xs text-slate-500">
        {result?.records?.length
          ? result.records
              .map((r) => `${r.courseName || 'Course'}${r.alreadyMarked ? ' (already marked today)' : ''}`)
              .join(', ')
          : 'Marked present for today.'}
      </p>
    </div>
  );
}

function TrainerSummary({ result }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">Trainer Verified — Attendance Marked</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{result?.trainerName || 'Attendance marked'}</p>
      <p className="mt-1 text-xs text-slate-500">
        {result?.courseName} {result?.batchCode ? `(${result.batchCode})` : ''} · {result?.campusName}
      </p>
      <div className="mt-2 flex items-center justify-center gap-2">
        {result?.status && <StatusBadge status={result.status} />}
        {result?.isLate && <StatusBadge status="late" />}
      </div>
    </div>
  );
}
