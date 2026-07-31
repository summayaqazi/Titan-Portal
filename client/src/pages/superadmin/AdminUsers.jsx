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
import adminUsersApi from '../../api/adminUsersApi';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['SUPER_ADMIN', 'ADMIN'];
const emptyForm = { name: '', email: '', phone: '', role: 'ADMIN', isActive: true };

function AdminUserFormDrawer({ open, onClose, user, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? { name: user.name, email: user.email, phone: user.phone || '', role: user.role, isActive: user.isActive }
        : emptyForm
    );
    setError('');
  }, [open, user]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save admin user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Admin User' : 'Add Admin User'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="admin-user-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="admin-user-form" onSubmit={handleSubmit}>
        <FormField label="Full Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Email" htmlFor="email" required>
          <Input id="email" type="email" value={form.email} onChange={handleChange('email')} required />
        </FormField>
        <FormField label="Phone" htmlFor="phone">
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} />
        </FormField>
        <FormField label="Role" htmlFor="role" required>
          <Select id="role" value={form.role} onChange={handleChange('role')} required>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </FormField>
        {isEdit && (
          <FormField label="Active" htmlFor="isActive">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
              Account is active
            </label>
          </FormField>
        )}
        {!isEdit && (
          <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            A login account will be created with the default password <strong>Admin123</strong>.
          </p>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { items, total, totalPages, page, setPage, search, changeSearch, filters, setFilter, loading, error, refetch } =
    useCrudResource(adminUsersApi.list, { limit: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await adminUsersApi.update(editing._id, values);
    } else {
      await adminUsersApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await adminUsersApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete admin user');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">
            {row.name} {row._id === currentUser?.id && <span className="text-xs text-slate-400">(you)</span>}
          </p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    { key: 'role', header: 'Role', render: (row) => <StatusBadge status={row.role === 'SUPER_ADMIN' ? 'approved' : 'pending'} /> },
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
            disabled={row._id === currentUser?.id}
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
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
      title="Admin Users"
      description="Manage admin accounts for campuses"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Add Admin User
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name or email" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select className="w-auto" value={filters.role || ''} onChange={(e) => setFilter('role', e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No admin users found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <AdminUserFormDrawer open={formOpen} onClose={() => setFormOpen(false)} user={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Admin User"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
