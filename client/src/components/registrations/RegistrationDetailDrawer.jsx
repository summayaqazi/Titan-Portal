import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { Drawer, Button, StatusBadge, ConfirmDialog, Avatar } from '../common';
import { getErrorMessage } from '../../utils/errors';
import { resolveFileUrl } from '../../utils/fileUrl';
import registrationsApi from '../../api/registrationsApi';

const QUALIFICATION_LABELS = {
  matric: 'Matric',
  intermediate: 'Intermediate',
  bachelors: 'Bachelors',
  masters: 'Masters',
  other: 'Other',
};

const PROFICIENCY_LABELS = {
  none: 'None',
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm text-slate-700">{children}</div>
    </div>
  );
}

// Super Admin/Admin's review view over one Registration — the submission as
// it stood before any Student existed, plus Approve/Reject. Deliberately its
// own drawer, not a variant of StudentDetailDrawer: a Registration isn't a
// Student and never displays as one — see Registration.js's header comment.
// Approving here is what creates the resulting Student (registration.
// controller.js) — after that, everything about that person moves to the
// Students module; this drawer never re-opens as an edit view for them.
export default function RegistrationDetailDrawer({ open, onClose, registration, onChanged }) {
  const [statusTarget, setStatusTarget] = useState(null); // { status, label, danger }
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [visitInfo, setVisitInfo] = useState(null);
  // Which registration id this drawer has already logged a visit for during
  // the current "open" session — guards against re-logging just because
  // `registration` gets a fresh object reference after Approve/Reject
  // (onChanged), while still logging a fresh visit the next time this same
  // registration is reopened later.
  const loggedVisitRef = useRef(null);

  // The entire Visitor API integration: opening this drawer (the EXISTING
  // "Review" click on Registrations.jsx — never a separate Visitor button)
  // logs a visit automatically, in the background. Best-effort — a failed
  // visit log never blocks or interrupts reviewing the registration itself.
  useEffect(() => {
    if (!open || !registration?._id || loggedVisitRef.current === registration._id) return;
    loggedVisitRef.current = registration._id;
    registrationsApi
      .logVisit(registration._id)
      .then(setVisitInfo)
      .catch(() => {});
  }, [open, registration?._id]);

  useEffect(() => {
    if (!open) {
      loggedVisitRef.current = null;
      setVisitInfo(null);
    }
  }, [open]);

  if (!registration) return null;

  const handleStatusConfirm = async () => {
    setStatusSubmitting(true);
    setStatusError('');
    try {
      const updated = await registrationsApi.update(registration._id, { status: statusTarget.status });
      setStatusTarget(null);
      onChanged?.(updated);
    } catch (err) {
      setStatusError(getErrorMessage(err, 'Failed to update this registration'));
    } finally {
      setStatusSubmitting(false);
    }
  };

  const availableActions =
    registration.status === 'pending'
      ? [
          { status: 'approved', label: 'Approve' },
          { status: 'rejected', label: 'Reject', danger: true },
        ]
      : [];

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Registration Details" width="w-[480px]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <StatusBadge status={registration.status} />
          <span className="text-xs text-slate-400">Submitted {formatDate(registration.createdAt)}</span>
        </div>

        {/* Visit info — a plain informational line, not a control. Reflects
            this open (visitInfo, once the background log call resolves) or
            falls back to what was already known about this registration
            (registration.visitCount/lastVisitedAt) while it's in flight. */}
        {(visitInfo?.visitCount ?? registration.visitCount) > 0 && (
          <p className="mb-4 text-xs text-slate-400">
            Reviewed {visitInfo?.visitCount ?? registration.visitCount} time
            {(visitInfo?.visitCount ?? registration.visitCount) === 1 ? '' : 's'} · last on{' '}
            {formatDate(visitInfo?.lastVisitedAt ?? registration.lastVisitedAt)}
          </p>
        )}

        <div className="mb-5 flex items-start gap-3 rounded-md bg-slate-50 p-3">
          {/* The registrant's own submitted photo (Registration.
              profilePicture) — carried over to Student.profilePicture
              verbatim on approval; never a course/batch image. */}
          <Avatar src={resolveFileUrl(registration.profilePicture)} name={registration.name} size={44} />
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Registrant</p>
            <p className="text-sm font-medium text-slate-800">{registration.name || '—'}</p>
            {registration.email && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Mail size={12} /> {registration.email}
              </p>
            )}
            {registration.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={12} /> {registration.phone}
              </p>
            )}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Course</p>
          <p className="text-sm font-medium text-slate-800">{registration.course?.name || 'Course no longer available'}</p>
          {registration.batch && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              {registration.batch.batchCode}
              {registration.batch.campus ? ` · ${registration.batch.campus}` : ''}
            </p>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Father's Name">{registration.fatherName || '—'}</Field>
          <Field label="CNIC">{registration.cnic || '—'}</Field>
          {registration.fatherCnic && <Field label="Father's CNIC">{registration.fatherCnic}</Field>}
          {registration.fatherContactNumber && (
            <Field label="Father's Contact Number">{registration.fatherContactNumber}</Field>
          )}
          <Field label="Date of Birth">{formatDate(registration.dateOfBirth)}</Field>
          <Field label="Gender">
            {registration.gender ? registration.gender.charAt(0).toUpperCase() + registration.gender.slice(1) : '—'}
          </Field>
          <Field label="Address">
            <span className="flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
              {registration.address || '—'}
            </span>
          </Field>
          <Field label="Highest Qualification">
            {QUALIFICATION_LABELS[registration.highestQualification] || '—'}
          </Field>
          {registration.computerProficiency && (
            <Field label="Computer Proficiency">{PROFICIENCY_LABELS[registration.computerProficiency]}</Field>
          )}
          {registration.laptopAvailability !== undefined && registration.laptopAvailability !== null && (
            <Field label="Laptop Availability">{registration.laptopAvailability ? 'Has a laptop' : "Doesn't have a laptop"}</Field>
          )}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status History</p>
          {!registration.history?.length ? (
            <p className="text-sm text-slate-500">No status history available yet.</p>
          ) : (
            <ol className="space-y-3">
              {registration.history.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <CheckCircle2 size={12} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(entry.changedAt)}</p>
                    {entry.note && <p className="mt-0.5 text-xs text-slate-500">{entry.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {availableActions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {availableActions.map((action) => (
              <Button
                key={action.status}
                variant={action.danger ? 'danger' : 'primary'}
                onClick={() => setStatusTarget(action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => {
          setStatusTarget(null);
          setStatusError('');
        }}
        onConfirm={handleStatusConfirm}
        title={statusTarget?.label}
        message={
          statusError ||
          (statusTarget?.status === 'approved'
            ? `Approve this registration? This creates a new Student account for ${registration.name} and cannot be undone.`
            : `Are you sure you want to reject this registration? This cannot be undone.`)
        }
        confirmLabel={statusTarget?.label}
        loading={statusSubmitting}
        danger={Boolean(statusTarget?.danger)}
      />
    </>
  );
}
