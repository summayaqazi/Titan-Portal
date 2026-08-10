import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { PageContainer, Modal, FormField, Input, Textarea, Button, ConfirmDialog } from '../../components/common';
import rolesApi from '../../api/rolesApi';
import { PERMISSION_MODULES, PERMISSION_ACTIONS, MODULE_LABELS } from '../../constants/permissions';
import { getErrorMessage } from '../../utils/errors';
import useSubmitGuard from '../../hooks/useSubmitGuard';
import { useAuth } from '../../context/AuthContext';

const emptyMatrix = () =>
  PERMISSION_MODULES.map((module) => ({
    module,
    view: false,
    create: false,
    update: false,
    delete: false,
    export: false,
  }));

function NewRoleModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', label: '', description: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  useEffect(() => {
    if (open) {
      setForm({ name: '', label: '', description: '' });
      setError('');
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      if (!form.name.trim() || !form.label.trim()) {
        setError('Role name and label are required');
        return;
      }
      setSubmitting(true);
      setError('');
      try {
        const created = await rolesApi.create({ ...form, permissions: emptyMatrix() });
        onCreated(created);
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to create role'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Role"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="new-role-form" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Role'}
          </Button>
        </>
      }
    >
      <form id="new-role-form" onSubmit={handleSubmit}>
        <FormField label="Role Name (unique code)" htmlFor="roleName" required>
          <Input
            id="roleName"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. CAMPUS_MANAGER"
          />
        </FormField>
        <FormField label="Display Label" htmlFor="roleLabel" required>
          <Input
            id="roleLabel"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="e.g. Campus Manager"
          />
        </FormField>
        <FormField label="Description" htmlFor="roleDescription">
          <Textarea
            id="roleDescription"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          New roles start with every permission unchecked — configure the matrix after creating.
        </p>
      </form>
    </Modal>
  );
}

function PermissionMatrix({ permissions, locked, onToggle }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Module</th>
            {PERMISSION_ACTIONS.map((action) => (
              <th key={action} className="px-4 py-3 text-center font-medium capitalize">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permissions.map((entry) => (
            <tr key={entry.module}>
              <td className="px-4 py-2.5 text-slate-700">{MODULE_LABELS[entry.module] || entry.module}</td>
              {PERMISSION_ACTIONS.map((action) => (
                <td key={action} className="px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(entry[action])}
                    disabled={locked}
                    onChange={() => onToggle(entry.module, action)}
                    className="h-4 w-4 accent-primary-600 disabled:opacity-40"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RolesPermissions() {
  const { can } = useAuth();
  const [roles, setRoles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('rolesPermissions', 'create');
  const canUpdate = can('rolesPermissions', 'update');
  const canDelete = can('rolesPermissions', 'delete');

  const loadRoles = () => {
    setLoading(true);
    rolesApi
      .list()
      .then((res) => {
        setRoles(res.data);
        setSelectedId((prev) => prev || res.data[0]?._id || null);
      })
      .catch(() => setError('Failed to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = useMemo(() => roles.find((r) => r._id === selectedId) || null, [roles, selectedId]);

  useEffect(() => {
    if (selectedRole) {
      setMatrix(selectedRole.permissions);
      setDirty(false);
      setSaveError('');
    }
  }, [selectedRole]);

  const handleToggle = (module, action) => {
    if (selectedRole?.isSystem || !canUpdate) return;
    setMatrix((prev) => prev.map((p) => (p.module === module ? { ...p, [action]: !p[action] } : p)));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await rolesApi.update(selectedRole._id, {
        label: selectedRole.label,
        description: selectedRole.description,
        permissions: matrix,
      });
      setRoles((prev) => prev.map((r) => (r._id === updated._id ? { ...updated, userCount: r.userCount } : r)));
      setDirty(false);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save permissions'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await rolesApi.remove(deleteTarget._id);
      setRoles((prev) => prev.filter((r) => r._id !== deleteTarget._id));
      if (selectedId === deleteTarget._id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete role'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageContainer
      title="Roles & Permissions"
      description="Configure per-module, per-action access for every role"
      actions={
        canCreate && (
          <Button onClick={() => setNewRoleOpen(true)}>
            <Plus size={16} /> New Role
          </Button>
        )
      }
    >
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {loading && <p className="text-sm text-slate-400">Loading roles…</p>}
          {roles.map((role) => (
            <button
              key={role._id}
              type="button"
              onClick={() => setSelectedId(role._id)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedId === role._id
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                {role.isSystem ? (
                  <ShieldCheck size={18} className="text-primary-600" />
                ) : (
                  <KeyRound size={18} className="text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">{role.label}</p>
                  <p className="text-xs text-slate-500">{role.userCount || 0} users</p>
                </div>
              </div>
              {role.isSystem && <Lock size={14} className="text-slate-300" />}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          {!selectedRole ? (
            <p className="text-sm text-slate-400">Select a role to view its permissions.</p>
          ) : (
            <>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{selectedRole.label}</h2>
                  <p className="text-sm text-slate-500">{selectedRole.description || 'No description'}</p>
                  {selectedRole.isSystem && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary-600">
                      <Lock size={12} /> System role — full access is fixed and cannot be edited.
                    </p>
                  )}
                </div>
                {canDelete && !selectedRole.isSystem && (
                  <Button variant="danger" onClick={() => setDeleteTarget(selectedRole)}>
                    <Trash2 size={16} /> Delete
                  </Button>
                )}
              </div>

              <PermissionMatrix
                permissions={matrix}
                locked={selectedRole.isSystem || !canUpdate}
                onToggle={handleToggle}
              />

              {saveError && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
              )}

              {!selectedRole.isSystem && canUpdate && (
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSave} disabled={!dirty || saving}>
                    <Check size={16} /> {saving ? 'Saving…' : 'Save Permissions'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <NewRoleModal
        open={newRoleOpen}
        onClose={() => setNewRoleOpen(false)}
        onCreated={(created) => {
          setRoles((prev) => [...prev, { ...created, userCount: 0 }]);
          setSelectedId(created._id);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Role"
        message={
          deleteError ||
          `Are you sure you want to delete "${deleteTarget?.label}"? This cannot be undone.`
        }
        confirmLabel="Delete"
      />
    </PageContainer>
  );
}
