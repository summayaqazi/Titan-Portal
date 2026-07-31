import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
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
import citiesApi from '../../api/citiesApi';

const emptyForm = { name: '', province: '', country: 'Pakistan', isActive: true };

function CityFormDrawer({ open, onClose, city, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(city);

  useEffect(() => {
    if (!open) return;
    setForm(city ? { name: city.name, province: city.province || '', country: city.country || 'Pakistan', isActive: city.isActive } : emptyForm);
    setError('');
  }, [open, city]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name) {
        setError('City name is required');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(form);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save city'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit City' : 'Add City'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="city-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="city-form" onSubmit={handleSubmit}>
        <FormField label="City Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Province" htmlFor="province">
          <Input id="province" value={form.province} onChange={handleChange('province')} />
        </FormField>
        <FormField label="Country" htmlFor="country">
          <Input id="country" value={form.country} onChange={handleChange('country')} />
        </FormField>
        <FormField label="Active" htmlFor="isActive">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
            City is active
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Cities() {
  const { items, total, totalPages, page, setPage, search, changeSearch, loading, error, refetch, handleDeleted } =
    useCrudResource(citiesApi.list, { limit: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await citiesApi.update(editing._id, values);
    } else {
      await citiesApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await citiesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete city');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'name', header: 'City', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
    { key: 'province', header: 'Province', render: (row) => row.province || '—' },
    { key: 'country', header: 'Country', render: (row) => row.country || '—' },
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
      title="Cities"
      description="Manage cities where campuses are located"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add City
        </Button>
      }
    >
      <div className="relative mb-4 w-full max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search by name" value={search} onChange={(e) => changeSearch(e.target.value)} />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No cities found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <CityFormDrawer open={formOpen} onClose={() => setFormOpen(false)} city={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete City"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
