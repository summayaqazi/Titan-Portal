import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Download, Filter, Plus, Search, X } from 'lucide-react';
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
  Modal,
  FormField,
} from '../../components/common';
import StudentFormDrawer from '../../components/students/StudentFormDrawer';
import StudentDetailDrawer from '../../components/students/StudentDetailDrawer';
import useCrudResource from '../../hooks/useCrudResource';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';
import studentsApi, { enrollmentsApi } from '../../api/studentsApi';
import citiesApi from '../../api/citiesApi';
import batchesApi from '../../api/batchesApi';
import coursesApi from '../../api/coursesApi';
import { ENROLLMENT_STATUSES } from '../../constants/enrollment';
import { downloadFile } from '../../utils/downloadFile';
import { resolveFileUrl } from '../../utils/fileUrl';
import { useAuth } from '../../context/AuthContext';

function FilterModal({ open, onClose, cities, filters, onApply }) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  return (
    <Modal open={open} onClose={onClose} title="Filter Students">
      <FormField label="Status" htmlFor="f-status">
        <Select id="f-status" value={draft.isActive || ''} onChange={(e) => setDraft((p) => ({ ...p, isActive: e.target.value }))}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FormField>
      <FormField label="City" htmlFor="f-city">
        <Select id="f-city" value={draft.city || ''} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}>
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Enrollment Status" htmlFor="f-enrollment">
        <Select
          id="f-enrollment"
          value={draft.enrollmentStatus || ''}
          onChange={(e) => setDraft((p) => ({ ...p, enrollmentStatus: e.target.value }))}
        >
          <option value="">Any enrollment status</option>
          {ENROLLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="CNIC Verification" htmlFor="f-cnic">
        <Select
          id="f-cnic"
          value={draft.cnicVerified || ''}
          onChange={(e) => setDraft((p) => ({ ...p, cnicVerified: e.target.value }))}
        >
          <option value="">Any</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </Select>
      </FormField>
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const cleared = { isActive: '', city: '', enrollmentStatus: '', cnicVerified: '' };
            setDraft(cleared);
            onApply(cleared);
          }}
        >
          Clear
        </Button>
        <Button
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          Apply Filters
        </Button>
      </div>
    </Modal>
  );
}

export default function Students() {
  const { can } = useAuth();
  const canCreate = can('students', 'create');
  const canUpdate = can('students', 'update');
  const canDelete = can('students', 'delete');
  const canExport = can('students', 'export');
  const navigate = useNavigate();

  // Undefined for every role but ADMIN, so this list request (and every
  // other request below) is byte-for-byte unchanged for Super Admin.
  const campusFilter = useAdminCampusFilter();
  const listStudents = (params) => studentsApi.list({ ...params, campus: campusFilter });

  // Supports a deep link pre-filtered by enrollment status
  // (?enrollmentStatus=pending) — read once on mount only, same as
  // Applications.jsx/Jobs.jsx's own initial-filter-from-URL reads. No
  // dashboard card links here with this param anymore (the "Student
  // Registrations" card family now points at the separate Registrations
  // module — see Dashboard.jsx) — this stays for the Filter modal's own
  // "Enrollment Status" control and any other future deep link into an
  // already-enrolled student's academic status.
  const [searchParams] = useSearchParams();
  const initialEnrollmentStatus = searchParams.get('enrollmentStatus');

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
  } = useCrudResource(listStudents, {
    limit: 10,
    initialFilters: initialEnrollmentStatus ? { enrollmentStatus: initialEnrollmentStatus } : {},
  });

  const [cities, setCities] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [detailStudent, setDetailStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    citiesApi.list({ limit: 100 }).then((res) => setCities(res.data));
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    coursesApi.list({ limit: 100 }).then((res) => setCourses(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFilterCount = Object.values(filters).filter((v) => v).length;

  const openCreate = () => {
    setEditingStudent(null);
    setFormOpen(true);
  };

  const openEdit = (student) => {
    setEditingStudent(student);
    setFormOpen(true);
  };

  const handleSubmit = async (values) => {
    const { enrollment, ...studentValues } = values;
    if (editingStudent) {
      await studentsApi.update(editingStudent._id, studentValues);
    } else {
      const created = await studentsApi.create(studentValues);
      if (enrollment?.batch) {
        const batch = batches.find((b) => b._id === enrollment.batch);
        // Status must be a qualifying (non-'pending') Enrollment status —
        // see student.controller.js's getQualifyingStudentIds — otherwise
        // the student this just created would never appear in the Students
        // list/detail view it's added from. 'pending' here is reserved for
        // an unreviewed course Registration (see Registration.js), which
        // this already-admin-created enrollment is not: the form's own
        // copy promises "Enroll the student in a batch immediately", so
        // 'enrolled' is the correct immediate status.
        await enrollmentsApi.create(created._id, {
          course: enrollment.course || batch?.course?._id,
          batch: enrollment.batch,
          rollNumber: enrollment.rollNumber,
          status: 'enrolled',
        });
      }
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

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadFile(studentsApi.exportUrl({ search, ...filters, campus: campusFilter }), `students-export-${Date.now()}.csv`);
    } catch {
      setExportError('Failed to export students');
    } finally {
      setExporting(false);
    }
  };

  const applyFilters = (draft) => {
    Object.entries(draft).forEach(([key, value]) => setFilter(key, value));
  };

  const columns = [
    {
      key: 'name',
      header: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.profilePicture ? (
            <img
              src={resolveFileUrl(row.profilePicture)}
              alt={row.user?.name}
              loading="lazy"
              decoding="async"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
              {row.user?.name?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <p className="font-medium text-slate-800">{row.user?.name}</p>
            <p className="text-xs text-slate-400">{row.user?.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'fatherName', header: "Father's Name", render: (row) => row.fatherName || '—' },
    { key: 'phone', header: 'Phone Number', render: (row) => row.user?.phone || '—' },
    { key: 'cnic', header: 'CNIC', render: (row) => row.cnic || '—' },
    {
      key: 'course',
      header: 'Course / Batch',
      render: (row) =>
        row.activeEnrollment ? (
          <div>
            <p className="text-slate-700">{row.activeEnrollment.course?.name}</p>
            <p className="text-xs text-slate-400">{row.activeEnrollment.batch?.batchCode}</p>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: 'enrollmentStatus',
      // "Enrollment Status" (not just "Enrollment") — this is an already-
      // legitimate Student's per-course academic/admission status
      // (Enrollment.status), e.g. "Pending" here can mean "course admission
      // still pending for this existing student" just as easily as
      // "Enrolled"/"Dropout"/etc. It is NEVER a registration under review —
      // an unapproved Registration never reaches this table at all (see
      // Registration.js's header comment). The clearer label is here only
      // so that reading "Pending" in this column is never mistaken for a
      // pending Registration.
      header: 'Enrollment Status',
      render: (row) => (row.activeEnrollment ? <StatusBadge status={row.activeEnrollment.status} /> : '—'),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      render: (row) => (row.activeEnrollment ? <StatusBadge status={row.activeEnrollment.paymentStatus} /> : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <RowActions
          onView={() => setDetailStudent(row)}
          onEdit={canUpdate ? () => openEdit(row) : undefined}
          onDelete={canDelete ? () => setDeleteTarget(row) : undefined}
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="Students"
      description="Manage student records and course enrollments"
      // Now on for both roles that reach this page: Admin already had it,
      // and Super Admin's own sidebar/dashboard "Total Students" stat land
      // here too — no role gate needed on this one. The dashboard's
      // "Student Registrations" card family links to the separate
      // Registrations module instead (see Dashboard.jsx) — never here.
      onBack={() => navigate(-1)}
      actions={
        <div className="flex items-center gap-2">
          {canExport && (
            <Button variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus size={16} /> Add Student
            </Button>
          )}
        </div>
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
        <Button variant="secondary" onClick={() => setFilterModalOpen(true)}>
          <Filter size={15} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </Button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => applyFilters({ isActive: '', city: '', enrollmentStatus: '', cnicVerified: '' })}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {exportError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{exportError}</div>}

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
        courses={courses}
        batches={batches}
        onSubmit={handleSubmit}
      />

      <StudentDetailDrawer
        open={Boolean(detailStudent)}
        onClose={() => setDetailStudent(null)}
        student={detailStudent}
        batches={batches}
        onChanged={refetch}
      />

      <FilterModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        cities={cities}
        filters={filters}
        onApply={applyFilters}
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
