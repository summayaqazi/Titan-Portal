import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Input,
  Select,
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
import trainersApi from '../../api/trainersApi';
import campusesApi from '../../api/campusesApi';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  campus: '',
  specialization: '',
  qualification: '',
  cnic: '',
  joiningDate: '',
  isActive: true,
};

function TrainerFormDrawer({ open, onClose, trainer, campuses, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(trainer);

  useEffect(() => {
    if (!open) return;
    setForm(
      trainer
        ? {
            name: trainer.user?.name || '',
            email: trainer.user?.email || '',
            phone: trainer.user?.phone || '',
            campus: trainer.campus?._id || '',
            specialization: (trainer.specialization || []).join(', '),
            qualification: trainer.qualification || '',
            cnic: trainer.cnic || '',
            joiningDate: trainer.joiningDate ? trainer.joiningDate.slice(0, 10) : '',
            isActive: trainer.isActive,
          }
        : emptyForm
    );
    setError('');
  }, [open, trainer]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name || !form.email || !form.campus) {
        setError('Name, email and campus are required');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({
          ...form,
          specialization: form.specialization
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save trainer'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Trainer' : 'Add Trainer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="trainer-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="trainer-form" onSubmit={handleSubmit}>
        <FormField label="Full Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" type="email" value={form.email} onChange={handleChange('email')} required />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} />
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
        <FormField label="Specialization" htmlFor="specialization">
          <Input
            id="specialization"
            value={form.specialization}
            onChange={handleChange('specialization')}
            placeholder="Comma separated, e.g. Web Development, Cloud Computing"
          />
        </FormField>
        <FormField label="Qualification" htmlFor="qualification">
          <Input id="qualification" value={form.qualification} onChange={handleChange('qualification')} />
        </FormField>
        <FormField label="CNIC" htmlFor="cnic">
          <Input id="cnic" value={form.cnic} onChange={handleChange('cnic')} placeholder="xxxxx-xxxxxxx-x" />
        </FormField>
        <FormField label="Joining Date" htmlFor="joiningDate">
          <Input id="joiningDate" type="date" value={form.joiningDate} onChange={handleChange('joiningDate')} />
        </FormField>
        {isEdit && (
          <FormField label="Active" htmlFor="isActive">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
              Trainer is active
            </label>
          </FormField>
        )}
        {!isEdit && (
          <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            A login account will be created with the default password <strong>Trainer123</strong>.
          </p>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Trainers() {
  const {
    items,
    total,
    totalPages,
    page,
    setPage,
    search,
    changeSearch,
    filters,
    setFilter,
    loading,
    error,
    refetch,
    handleDeleted,
  } = useCrudResource(trainersApi.list, { limit: 10 });

  const [campuses, setCampuses] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    campusesApi.list({ limit: 100 }).then((res) => setCampuses(res.data));
  }, []);

  const handleSubmit = async (values) => {
    if (editing) {
      await trainersApi.update(editing._id, values);
    } else {
      await trainersApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await trainersApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete trainer');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Trainer',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.user?.name}</p>
          <p className="text-xs text-slate-400">{row.user?.email}</p>
        </div>
      ),
    },
    { key: 'campus', header: 'Campus', render: (row) => row.campus?.name || '—' },
    {
      key: 'specialization',
      header: 'Specialization',
      render: (row) => (row.specialization?.length ? row.specialization.join(', ') : '—'),
    },
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
      title="Trainers"
      description="Manage trainer profiles and assignments"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add Trainer
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select className="w-auto" value={filters.campus || ''} onChange={(e) => setFilter('campus', e.target.value)}>
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No trainers found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <TrainerFormDrawer open={formOpen} onClose={() => setFormOpen(false)} trainer={editing} campuses={campuses} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Trainer"
        message={
          deleteError || `Are you sure you want to delete ${deleteTarget?.user?.name || 'this trainer'}? This cannot be undone.`
        }
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
