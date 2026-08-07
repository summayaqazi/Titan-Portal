import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { PageContainer, FormField, Input, Textarea, Button } from '../../components/common';
import attendanceApi from '../../api/attendanceApi';
import { getErrorMessage } from '../../utils/errors';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

const today = () => new Date().toISOString().slice(0, 10);

// Admin Portal — Attendance > Multi Attendance. Bulk-marks attendance
// (present) for a comma-separated list of roll numbers on a single date.
// Reuses the attendance API's upsert-by-(enrollment,date) logic on the
// server rather than duplicating it — this page is purely a bulk front end
// for it.
export default function MultiAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
  const campusFilter = useAdminCampusFilter();

  const [date, setDate] = useState(today());
  const [rollNumbersText, setRollNumbersText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    const rollNumbers = rollNumbersText
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    if (!date) {
      setError('Attendance date is required');
      return;
    }
    if (rollNumbers.length === 0) {
      setError('Enter at least one roll number');
      return;
    }

    setSubmitting(true);
    try {
      const data = await attendanceApi.multiMark(date, rollNumbers, undefined, campusFilter);
      setResult(data);
      setRollNumbersText('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update attendance'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Multi Attendance"
      description="Mark attendance as present for multiple roll numbers at once"
    >
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
        <FormField label="Attendance Date" htmlFor="multi-date" required>
          <Input id="multi-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </FormField>

        <FormField label="Roll Numbers" htmlFor="multi-roll-numbers" required>
          <Textarea
            id="multi-roll-numbers"
            rows={8}
            value={rollNumbersText}
            onChange={(e) => setRollNumbersText(e.target.value)}
            placeholder="1122,1123,1124"
          />
        </FormField>
        <p className="mb-4 text-xs text-slate-400">
          Enter comma-separated roll numbers. Each will be marked present for the selected date.
        </p>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <p>
              Updated {result.updatedCount} student{result.updatedCount === 1 ? '' : 's'}
              {result.notFoundCount > 0 && `, ${result.notFoundCount} roll number${result.notFoundCount === 1 ? '' : 's'} not found`}.
            </p>
            {result.notFound?.length > 0 && (
              <p className="mt-1 text-xs text-green-600">Not found: {result.notFound.join(', ')}</p>
            )}
          </div>
        )}

        {canMark && (
          <Button type="submit" className="w-full" disabled={submitting}>
            <CheckCheck size={16} /> {submitting ? 'Updating…' : 'Update'}
          </Button>
        )}
      </form>
    </PageContainer>
  );
}
