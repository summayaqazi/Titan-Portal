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
import adminUsersApi from '../../api/adminUsersApi';
import campusesApi from '../../api/campusesApi';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['SUPER_ADMIN', 'ADMIN'];
const emptyForm = { name: '', email: '', phone: '', password: '', role: 'ADMIN', campus: '', isActive: true };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,15}$/;

function AdminUserFormDrawer({ open, onClose, user, campuses, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(user);

  useEffect(() => {
    if (!open) return;
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            password: '',
            role: user.role,
            campus: user.campus?._id || user.campus || '',
            isActive: user.isActive,
          }
        : emptyForm
    );
    setError('');
  }, [open, user]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name || !form.email) {
        setError('Name and email are required');
        return;
      }
      if (!EMAIL_RE.test(form.email)) {
        setError('Enter a valid email address');
        return;
      }
      if (form.phone && !PHONE_RE.test(form.phone)) {
        setError('Enter a valid phone number');
        return;
      }
      if (!isEdit && form.password && form.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      setSubmitting(true);
      try {
        const payload = { ...form };
        if (isEdit || !payload.password) delete payload.password;
        await onSubmit(payload);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save admin user'));
      } finally {
        setSubmitting(false);
      }
    });
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
          <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="03xx-xxxxxxx" />
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
        {form.role === 'ADMIN' && (
          <FormField label="Campus" htmlFor="campus">
            <Select id="campus" value={form.campus} onChange={handleChange('campus')}>
              <option value="">Unassigned</option>
              {(campuses || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {isEdit && (
          <FormField label="Active" htmlFor="isActive">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
              Account is active
            </label>
          </FormField>
        )}
        {!isEdit && (
          <>
            <FormField label="Password (optional)" htmlFor="password">
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                placeholder="Leave blank to use default"
              />
            </FormField>
            <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Leave the password blank to create the account with the default password <strong>Admin123</strong>.
            </p>
          </>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function AdminUsers() {
  const { user: currentUser, can } = useAuth();
  const canCreate = can('adminUsers', 'create');
  const canUpdate = can('adminUsers', 'update');
  const canDelete = can('adminUsers', 'delete');
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
  } = useCrudResource(adminUsersApi.list, { limit: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [togglingId, setTogglingId] = useState(null);
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    campusesApi.list({ limit: 100 }).then((res) => setCampuses(res.data));
  }, []);

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
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete admin user');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (row) => {
    setToggleError('');
    setTogglingId(row._id);
    try {
      await adminUsersApi.update(row._id, { isActive: !row.isActive });
      refetch();
    } catch (err) {
      setToggleError(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setTogglingId(null);
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
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isSelf = row._id === currentUser?.id;
        return (
          <button
            type="button"
            disabled={!canUpdate || isSelf || togglingId === row._id}
            onClick={() => handleToggleActive(row)}
            title={isSelf ? 'You cannot deactivate your own account' : 'Toggle status'}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            <StatusBadge status={row.isActive ? 'active' : 'inactive'} />
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onEdit={canUpdate ? () => {
            setEditing(row);
            setFormOpen(true);
          } : undefined}
          onDelete={canDelete ? () => setDeleteTarget(row) : undefined}
          deleteDisabled={row._id === currentUser?.id}
          deleteTitle="You cannot delete your own account"
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="Admin Users"
      description="Manage admin accounts for campuses"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Add Admin User
          </Button>
        )
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
        <Select
          className="w-auto"
          value={filters.isActive ?? ''}
          onChange={(e) => setFilter('isActive', e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>

      {toggleError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{toggleError}</div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No admin users found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <AdminUserFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        campuses={campuses}
        onSubmit={handleSubmit}
      />

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
