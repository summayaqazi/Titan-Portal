import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
} from '../../components/common';
import useCrudResource from '../../hooks/useCrudResource';
import campusesApi from '../../api/campusesApi';
import citiesApi from '../../api/citiesApi';

const emptyForm = { name: '', city: '', address: '', contactNumber: '', isActive: true };

function CampusFormDrawer({ open, onClose, campus, cities, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(campus);

  useEffect(() => {
    if (!open) return;
    setForm(
      campus
        ? {
            name: campus.name,
            city: campus.city?._id || '',
            address: campus.address || '',
            contactNumber: campus.contactNumber || '',
            isActive: campus.isActive,
          }
        : emptyForm
    );
    setError('');
  }, [open, campus]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.city) {
      setError('Campus name and city are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save campus');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Campus' : 'Add Campus'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="campus-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="campus-form" onSubmit={handleSubmit}>
        <FormField label="Campus Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="City" htmlFor="city" required>
          <Select id="city" value={form.city} onChange={handleChange('city')} required>
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Address" htmlFor="address">
          <Input id="address" value={form.address} onChange={handleChange('address')} />
        </FormField>
        <FormField label="Contact Number" htmlFor="contactNumber">
          <Input id="contactNumber" value={form.contactNumber} onChange={handleChange('contactNumber')} />
        </FormField>
        <FormField label="Active" htmlFor="isActive">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
            Campus is active
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Campuses() {
  const { items, total, totalPages, page, setPage, search, changeSearch, filters, setFilter, loading, error, refetch } =
    useCrudResource(campusesApi.list, { limit: 10 });

  const [cities, setCities] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    citiesApi.list({ limit: 100 }).then((res) => setCities(res.data));
  }, []);

  const handleSubmit = async (values) => {
    if (editing) {
      await campusesApi.update(editing._id, values);
    } else {
      await campusesApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await campusesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete campus');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'name', header: 'Campus', render: (row) => <span className="font-medium text-slate-800">{row.name}</span> },
    { key: 'city', header: 'City', render: (row) => row.city?.name || '—' },
    { key: 'address', header: 'Address', render: (row) => row.address || '—' },
    { key: 'contactNumber', header: 'Contact', render: (row) => row.contactNumber || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
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
      title="Campuses"
      description="Manage physical campus locations"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add Campus
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select className="w-auto" value={filters.city || ''} onChange={(e) => setFilter('city', e.target.value)}>
          <option value="">All cities</option>
          {cities.map((c) => (
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
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No campuses found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <CampusFormDrawer open={formOpen} onClose={() => setFormOpen(false)} campus={editing} cities={cities} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Campus"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
