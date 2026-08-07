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
import coursesApi from '../../api/coursesApi';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', code: '', description: '', durationInMonths: '', fee: '', isActive: true };

function CourseFormDrawer({ open, onClose, course, onSubmit }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();
  const isEdit = Boolean(course);

  useEffect(() => {
    if (!open) return;
    setForm(
      course
        ? {
            name: course.name,
            code: course.code,
            description: course.description || '',
            durationInMonths: course.durationInMonths,
            fee: course.fee,
            isActive: course.isActive,
          }
        : emptyForm
    );
    setError('');
  }, [open, course]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!form.name || !form.code || !form.durationInMonths) {
        setError('Name, code and duration are required');
        return;
      }
      if (Number(form.durationInMonths) <= 0) {
        setError('Duration must be greater than zero');
        return;
      }
      if (form.fee !== '' && Number(form.fee) < 0) {
        setError('Fee cannot be negative');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({ ...form, durationInMonths: Number(form.durationInMonths), fee: Number(form.fee) || 0 });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save course'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Course' : 'Add Course'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="course-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={handleSubmit}>
        <FormField label="Course Name" htmlFor="name" required>
          <Input id="name" value={form.name} onChange={handleChange('name')} required />
        </FormField>
        <FormField label="Course Code" htmlFor="code" required>
          <Input id="code" value={form.code} onChange={handleChange('code')} placeholder="e.g. WEBDEV" required />
        </FormField>
        <FormField label="Duration (months)" htmlFor="durationInMonths" required>
          <Input
            id="durationInMonths"
            type="number"
            min="1"
            value={form.durationInMonths}
            onChange={handleChange('durationInMonths')}
            required
          />
        </FormField>
        <FormField label="Fee (PKR)" htmlFor="fee">
          <Input id="fee" type="number" min="0" value={form.fee} onChange={handleChange('fee')} />
        </FormField>
        <FormField label="Description" htmlFor="description">
          <Input id="description" value={form.description} onChange={handleChange('description')} />
        </FormField>
        <FormField label="Active" htmlFor="isActive">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input id="isActive" type="checkbox" checked={form.isActive} onChange={handleChange('isActive')} />
            Course is active
          </label>
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Courses() {
  const { can } = useAuth();
  const canCreate = can('courses', 'create');
  const canUpdate = can('courses', 'update');
  const canDelete = can('courses', 'delete');
  const { items, total, totalPages, page, setPage, search, changeSearch, loading, error, refetch, handleDeleted } =
    useCrudResource(coursesApi.list, { limit: 10 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleSubmit = async (values) => {
    if (editing) {
      await coursesApi.update(editing._id, values);
    } else {
      await coursesApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await coursesApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Course',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-400">{row.code}</p>
        </div>
      ),
    },
    { key: 'durationInMonths', header: 'Duration', render: (row) => `${row.durationInMonths} months` },
    { key: 'fee', header: 'Fee', render: (row) => `PKR ${row.fee?.toLocaleString()}` },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
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
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="Courses"
      description="Manage the courses offered by your institute"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Add Course
          </Button>
        )
      }
    >
      <div className="relative mb-4 w-full max-w-xs">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search by name or code" value={search} onChange={(e) => changeSearch(e.target.value)} />
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No courses found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <CourseFormDrawer open={formOpen} onClose={() => setFormOpen(false)} course={editing} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Course"
        message={deleteError || `Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
