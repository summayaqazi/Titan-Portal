import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  RowActions,
  Avatar,
} from '../../components/common';
import TrainerFormDrawer from '../../components/trainers/TrainerFormDrawer';
import TrainerDetailDrawer from '../../components/trainers/TrainerDetailDrawer';
import useCrudResource from '../../hooks/useCrudResource';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';
import trainersApi from '../../api/trainersApi';
import campusesApi from '../../api/campusesApi';
import coursesApi from '../../api/coursesApi';
import { resolveFileUrl } from '../../utils/fileUrl';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';

export default function Trainers() {
  const { user, can } = useAuth();
  const isAdmin = user?.role === ROLES.ADMIN;
  const canCreate = can('trainers', 'create');
  const canUpdate = can('trainers', 'update');
  const canDelete = can('trainers', 'delete');
  const navigate = useNavigate();

  // Undefined for every role but ADMIN — Super Admin's request/behavior is
  // byte-for-byte unchanged. When set, it always wins over this page's own
  // "campus" filter (below) so an admin can never browse into another
  // campus's trainers via that control.
  const campusFilter = useAdminCampusFilter();
  const listTrainers = (params) => trainersApi.list({ ...params, campus: campusFilter || params.campus });

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
  } = useCrudResource(listTrainers, { limit: 10, initialFilters: { campus: campusFilter } });

  const [campuses, setCampuses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailTrainer, setDetailTrainer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    campusesApi.list({ limit: 100 }).then((res) => setCampuses(res.data));
    coursesApi.list({ limit: 100 }).then((res) => setCourses(res.data));
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
        <div className="flex items-center gap-2.5">
          <Avatar src={resolveFileUrl(row.profileImage)} name={row.user?.name} size={32} />
          <div>
            <p className="font-medium text-slate-800">{row.user?.name}</p>
            <p className="text-xs text-slate-400">{row.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'campuses',
      header: 'Campuses',
      render: (row) => (row.campuses?.length ? row.campuses.map((c) => c.name).join(', ') : '—'),
    },
    {
      key: 'courses',
      header: 'Courses',
      render: (row) => (row.courses?.length ? row.courses.map((c) => c.name).join(', ') : '—'),
    },
    {
      key: 'hourlyRate',
      header: 'Hourly Rate',
      render: (row) => (row.hourlyRate ? `PKR ${row.hourlyRate.toLocaleString()}` : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onView={() => setDetailTrainer(row)}
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
      title="Trainers"
      description="Manage trainer profiles and assignments"
      onBack={isAdmin ? () => navigate(-1) : undefined}
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Add Trainer
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select
          className="w-auto"
          value={filters.campus || ''}
          onChange={(e) => setFilter('campus', e.target.value)}
          disabled={Boolean(campusFilter)}
        >
          <option value="">All campuses</option>
          {campuses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.course || ''} onChange={(e) => setFilter('course', e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
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

      <TrainerFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        trainer={editing}
        campuses={campuses}
        courses={courses}
        onSubmit={handleSubmit}
      />

      <TrainerDetailDrawer open={Boolean(detailTrainer)} onClose={() => setDetailTrainer(null)} trainer={detailTrainer} />

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
