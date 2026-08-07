import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageContainer, FormField, Select, Textarea, Button } from '../../components/common';
import { enrollmentsApi } from '../../api/studentsApi';
import { ENROLLMENT_STATUSES } from '../../constants/enrollment';
import { getErrorMessage } from '../../utils/errors';
import { useAuth } from '../../context/AuthContext';

const UPDATE_TYPES = [{ value: 'results', label: 'Results' }];

// Admin Portal — Updation. Bulk-updates enrollment status for a
// comma-separated list of roll numbers. Reuses the enrollment status/history
// logic already on the server (same as the per-student Enrollment edit)
// rather than duplicating it.
export default function Updation() {
  const { can } = useAuth();
  const canUpdate = can('updation', 'update');

  const [updateType, setUpdateType] = useState('results');
  const [rollNumbersText, setRollNumbersText] = useState('');
  const [status, setStatus] = useState('');
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

    if (rollNumbers.length === 0) {
      setError('Enter at least one roll number');
      return;
    }
    if (!status) {
      setError('Select a status to apply');
      return;
    }

    setSubmitting(true);
    try {
      const data = await enrollmentsApi.bulkUpdateStatus(rollNumbers, status);
      setResult(data);
      setRollNumbersText('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update enrollments'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer title="Updation" description="Bulk-update enrollment status for a list of roll numbers">
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5">
        <FormField label="Update Type" htmlFor="update-type" required>
          <Select id="update-type" value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
            {UPDATE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Roll Numbers" htmlFor="update-roll-numbers" required>
          <Textarea
            id="update-roll-numbers"
            rows={8}
            value={rollNumbersText}
            onChange={(e) => setRollNumbersText(e.target.value)}
            placeholder="1122,1123,1124"
          />
        </FormField>
        <p className="mb-4 text-xs text-slate-400">Enter comma-separated roll numbers to update.</p>

        <FormField label="Status" htmlFor="update-status" required>
          <Select id="update-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Select status</option>
            {ENROLLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>

        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <p>
              Updated {result.updatedCount} enrollment{result.updatedCount === 1 ? '' : 's'}
              {result.notFoundCount > 0 && `, ${result.notFoundCount} roll number${result.notFoundCount === 1 ? '' : 's'} not found`}.
            </p>
            {result.notFound?.length > 0 && (
              <p className="mt-1 text-xs text-green-600">Not found: {result.notFound.join(', ')}</p>
            )}
          </div>
        )}

        {canUpdate && (
          <Button type="submit" className="w-full" disabled={submitting}>
            <RefreshCw size={16} /> {submitting ? 'Updating…' : 'Update'}
          </Button>
        )}
      </form>
    </PageContainer>
  );
}
