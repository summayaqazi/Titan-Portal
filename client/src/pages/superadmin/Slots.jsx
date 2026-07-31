import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Input,
  Button,
  StatusBadge,
  ConfirmDialog,
  Drawer,
  FormField,
  RowActions,
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { getErrorMessage } from '../../utils/errors';
import slotsApi from '../../api/slotsApi';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const emptyForm = { label: '', startTime: '', endTime: '', days: [], isActive: true };

function SlotFormDrawer({ open, onClose, slot, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(slot);

  useEffect(() => {
    if (!open) return;
    setForm(
      slot
        ? { label: slot.label, startTime: slot.startTime, endTime: slot.endTime, days: slot.days || [], isActive: slot.isActive }
        : emptyForm
    );
    setError('');
  }, [open, slot]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.label || !form.startTime || !form.endTime) {
        setError('Label, start time and end time are required');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(form);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save slot'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Slot' : 'Add Slot'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="slot-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="slot-form" onSubmit={handleSubmit}>
        <FormField label="Label" htmlFor="label" required>
          <Input id="label" value={form.label} onChange={handleChange('label')} placeholder="e.g. Morning 9-11" required />
        </FormField>
        <FormField label="Start Time" htmlFor="startTime" required>
          <Input id="startTime" type="time" value={form.startTime} onChange={handleChange('startTime')} required />
        </FormField>
        <FormField label="End Time" htmlFor="endTime" required>
          <Input id="endTime" type="time" value={form.endTime} onChange={handleChange('endTime')} required />
        </FormField>
        <FormField label="Days">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  form.days.includes(day)
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="Active" htmlFor="isActive">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
            Slot is active
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Slots() {
  const { items, total, totalPages, page, setPage, loading, error, refetch, handleDeleted } = useCrudResource(
    slotsApi.list,
    { limit: 10 }
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await slotsApi.update(editing._id, values);
    } else {
      await slotsApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await slotsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete slot');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'label', header: 'Slot', render: (row) => <span className="font-medium text-slate-800">{row.label}</span> },
    { key: 'time', header: 'Time', render: (row) => `${row.startTime} - ${row.endTime}` },
    { key: 'days', header: 'Days', render: (row) => (row.days?.length ? row.days.join(', ') : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onEdit={() => {
            setEditing(row);
            setFormOpen(true);
          }}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="Slots"
      description="Manage class timing slots"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add Slot
        </Button>
      }
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No slots found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <SlotFormDrawer open={formOpen} onClose={() => setFormOpen(false)} slot={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Slot"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.label}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
