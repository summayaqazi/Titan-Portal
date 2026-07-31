import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  PageContainer,
  Table,
  Pagination,
  Select,
  Input,
  Button,
  StatusBadge,
  ConfirmDialog,
  RowActions,
} from '../../components/common';
import StudentFormDrawer from '../../components/students/StudentFormDrawer';
import StudentDetailDrawer from '../../components/students/StudentDetailDrawer';
import useCrudResource from '../../hooks/useCrudResource';
import studentsApi from '../../api/studentsApi';
import citiesApi from '../../api/citiesApi';
import batchesApi from '../../api/batchesApi';

export default function Students() {
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
  } = useCrudResource(studentsApi.list, { limit: 10 });

  const [cities, setCities] = useState([]);
  const [batches, setBatches] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [detailStudent, setDetailStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    citiesApi.list({ limit: 100 }).then((res) => setCities(res.data));
    batchesApi.list({ limit: 100 }).then((res) => setBatches(res.data));
  }, []);

  const openCreate = () => {
    setEditingStudent(null);
    setFormOpen(true);
  };

  const openEdit = (student) => {
    setEditingStudent(student);
    setFormOpen(true);
  };

  const handleSubmit = async (values) => {
    if (editingStudent) {
      await studentsApi.update(editingStudent._id, values);
    } else {
      await studentsApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await studentsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete student');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.user?.name}</p>
          <p className="text-xs text-slate-400">{row.user?.email}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (row) => row.user?.phone || '—' },
    { key: 'city', header: 'City', render: (row) => row.city?.name || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onView={() => setDetailStudent(row)}
          onEdit={() => openEdit(row)}
          onDelete={() => setDeleteTarget(row)}
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="Students"
      description="Manage student records and course enrollments"
      actions={
        <Button onClick={openCreate}>
          <Plus size={16} /> Add Student
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
          />
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
          <Table
            columns={columns}
            data={loading ? [] : items}
            emptyMessage={loading ? 'Loading...' : 'No students found'}
          />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <StudentFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editingStudent}
        cities={cities}
        onSubmit={handleSubmit}
      />

      <StudentDetailDrawer
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        student={detailStudent}
        batches={batches}
        onChanged={refetch}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError('');
        }}
        onConfirm={handleDelete}
        title="Delete Student"
        message={
          deleteError ||
          `Are you sure you want to delete ${deleteTarget?.user?.name || 'this student'}? This cannot be undone.`
        }
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
