import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Select, Input, Button } from '../common';
import trainerAttendanceApi from '../../api/trainerAttendanceApi';
import { getErrorMessage } from '../../utils/errors';

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

// Trainer check-in form, shared by the Super Admin combined Attendance page
// and the Admin "Mark Trainer Attendance" page.
export default function TrainerCheckInPanel({ trainers, batches, canMark, onChecked }) {
  const [trainer, setTrainer] = useState('');
  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState(nowTime());
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const trainerBatches = trainer ? batches.filter((b) => b.trainer?._id === trainer) : [];

  const handleCheckIn = async () => {
    setError('');
    setMessage('');
    if (!trainer || !batch || !date || !time) {
      setError('Trainer, batch, date and time are required');
      return;
    }
    setSubmitting(true);
    try {
      await trainerAttendanceApi.checkIn({
        trainer,
        batch,
        date,
        checkInTime: new Date(`${date}T${time}`).toISOString(),
        remarks,
      });
      setMessage('Trainer checked in');
      setRemarks('');
      onChecked?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to check in trainer'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 flex items-center gap-1.5 text-base font-semibold text-slate-800">
        <LogIn size={17} /> Trainer Check-In
      </h2>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select
          className="w-auto"
          value={trainer}
          onChange={(e) => {
            setTrainer(e.target.value);
            setBatch('');
          }}
        >
          <option value="">Select trainer</option>
          {trainers.map((t) => (
            <option key={t._id} value={t._id}>
              {t.user?.name}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={batch} onChange={(e) => setBatch(e.target.value)} disabled={!trainer}>
          <option value="">{trainer ? 'Select batch' : 'Select a trainer first'}</option>
          {trainerBatches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.batchCode} — {b.course?.name}
              {b.slot ? ` (${b.slot.startTime}-${b.slot.endTime})` : ''}
            </option>
          ))}
        </Select>
        <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input type="time" className="w-auto" value={time} onChange={(e) => setTime(e.target.value)} />
        <Input
          className="w-48"
          placeholder="Remarks (optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        {canMark && (
          <Button onClick={handleCheckIn} disabled={submitting}>
            <LogIn size={15} /> {submitting ? 'Checking in…' : 'Check In'}
          </Button>
        )}
      </div>
      {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
