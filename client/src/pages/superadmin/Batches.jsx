import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Select,
  Input,
  Button,
  StatusBadge,
  ConfirmDialog,
  Drawer,
  FormField,
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import batchesApi from '../../api/batchesApi';
import coursesApi from '../../api/coursesApi';
import campusesApi from '../../api/campusesApi';
import trainersApi from '../../api/trainersApi';
import slotsApi from '../../api/slotsApi';

const BATCH_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const emptyForm = {
  batchCode: '',
  course: '',
  campus: '',
  trainer: '',
  slot: '',
  startDate: '',
  endDate: '',
  capacity: 30,
  status: 'upcoming',
  registrationOpen: true,
};

function BatchFormDrawer({ open, onClose, batch, courses, campuses, trainers, slots, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(batch);

  useEffect(() => {
    if (!open) return;
    setForm(
      batch
        ? {
            batchCode: batch.batchCode,
            course: batch.course?._id || '',
            campus: batch.campus?._id || '',
            trainer: batch.trainer?._id || '',
            slot: batch.slot?._id || '',
            startDate: batch.startDate ? batch.startDate.slice(0, 10) : '',
            endDate: batch.endDate ? batch.endDate.slice(0, 10) : '',
            capacity: batch.capacity,
            status: batch.status,
            registrationOpen: batch.registrationOpen,
          }
        : emptyForm
    );
    setError('');
  }, [open, batch]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.batchCode || !form.course || !form.campus || !form.startDate) {
      setError('Batch code, course, campus and start date are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ ...form, capacity: Number(form.capacity) || 30 });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Batch' : 'Add Batch'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="batch-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="batch-form" onSubmit={handleSubmit}>
        <FormField label="Batch Code" htmlFor="batchCode" required>
          <Input id="batchCode" value={form.batchCode} onChange={handleChange('batchCode')} placeholder="e.g. WEBDEV-B3" required />
        </FormField>
        <FormField label="Course" htmlFor="course" required>
          <Select id="course" value={form.course} onChange={handleChange('course')} required>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Campus" htmlFor="campus" required>
          <Select id="campus" value={form.campus} onChange={handleChange('campus')} required>
            <option value="">Select campus</option>
            {campuses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Trainer" htmlFor="trainer">
          <Select id="trainer" value={form.trainer} onChange={handleChange('trainer')}>
            <option value="">Unassigned</option>
            {trainers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.user?.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Slot" htmlFor="slot">
          <Select id="slot" value={form.slot} onChange={handleChange('slot')}>
            <option value="">Unassigned</option>
            {slots.map((s) => (
              <option key={s._id} value={s._id}>
                {s.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Start Date" htmlFor="startDate" required>
          <Input id="startDate" type="date" value={form.startDate} onChange={handleChange('startDate')} required />
        </FormField>
        <FormField label="End Date" htmlFor="endDate">
          <Input id="endDate" type="date" value={form.endDate} onChange={handleChange('endDate')} />
        </FormField>
        <FormField label="Capacity" htmlFor="capacity">
          <Input id="capacity" type="number" min="1" value={form.capacity} onChange={handleChange('capacity')} />
        </FormField>
        <FormField label="Status" htmlFor="status">
          <Select id="status" value={form.status} onChange={handleChange('status')}>
            {BATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Registration" htmlFor="registrationOpen">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              id="registrationOpen"
              type="checkbox"
              checked={form.registrationOpen}
              onChange={handleChange('registrationOpen')}
            />
            Registration is open for this batch
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Batches() {
  const { items, total, totalPages, page, setPage, filters, setFilter, loading, error, refetch } = useCrudResource(
    batchesApi.list,
    { limit: 10 }
  );

  const [courses, setCourses] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [slots, setSlots] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    coursesApi.list({ limit: 100 }).then((res) => setCourses(res.data));
    campusesApi.list({ limit: 100 }).then((res) => setCampuses(res.data));
    trainersApi.list({ limit: 100 }).then((res) => setTrainers(res.data));
    slotsApi.list({ limit: 100 }).then((res) => setSlots(res.data));
  }, []);

  const handleSubmit = async (values) => {
    if (editing) {
      await batchesApi.update(editing._id, values);
    } else {
      await batchesApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await batchesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'batchCode',
      header: 'Batch',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.batchCode}</p>
          <p className="text-xs text-slate-400">{row.course?.name}</p>
        </div>
      ),
    },
    { key: 'campus', header: 'Campus', render: (row) => row.campus?.name || '—' },
    { key: 'trainer', header: 'Trainer', render: (row) => row.trainer?.user?.name || '—' },
    { key: 'slot', header: 'Slot', render: (row) => row.slot?.label || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'registration',
      header: 'Registration',
      render: (row) => <StatusBadge status={row.registrationOpen ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setEditing(row);
              setFormOpen(true);
            }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
            aria-label="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer
      title="Batches"
      description="Manage course batches across campuses"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add Batch
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="w-auto" value={filters.course || ''} onChange={(e) => setFilter('course', e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.campus || ''} onChange={(e) => setFilter('campus', e.target.value)}>
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {BATCH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No batches found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <BatchFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        batch={editing}
        courses={courses}
        campuses={campuses}
        trainers={trainers}
        slots={slots}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Batch"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.batchCode}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
