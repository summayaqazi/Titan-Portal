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
import paymentsApi from '../../api/paymentsApi';
import studentsApi, { enrollmentsApi } from '../../api/studentsApi';

const METHODS = ['cash', 'bank_transfer', 'card', 'online', 'other'];
const STATUSES = ['pending', 'paid', 'overdue', 'refunded'];

function PaymentFormDrawer({ open, onClose, payment, students, onSubmit }) {
  const isEdit = Boolean(payment);
  const [studentId, setStudentId] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [form, setForm] = useState({
    enrollment: '',
    amount: '',
    method: 'cash',
    installmentNumber: 1,
    status: 'pending',
    dueDate: '',
    remarks: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setStudentId(payment.student?._id || '');
      setForm({
        enrollment: payment.enrollment?._id || '',
        amount: payment.amount,
        method: payment.method,
        installmentNumber: payment.installmentNumber,
        status: payment.status,
        dueDate: payment.dueDate ? payment.dueDate.slice(0, 10) : '',
        remarks: payment.remarks || '',
      });
    } else {
      setStudentId('');
      setForm({ enrollment: '', amount: '', method: 'cash', installmentNumber: 1, status: 'pending', dueDate: '', remarks: '' });
    }
    setError('');
  }, [open, payment]);

  useEffect(() => {
    if (!studentId) {
      setEnrollments([]);
      return;
    }
    enrollmentsApi.listForStudent(studentId).then(setEnrollments);
  }, [studentId]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!isEdit && (!studentId || !form.enrollment)) {
        setError('Student and enrollment are required');
        return;
      }
      if (!form.amount || Number(form.amount) <= 0) {
        setError('Amount must be greater than zero');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({ ...form, amount: Number(form.amount), installmentNumber: Number(form.installmentNumber) || 1 });
        onClose();
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save payment'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Payment' : 'Generate Payment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit}>
        {!isEdit && (
          <>
            <FormField label="Student" htmlFor="student" required>
              <Select id="student" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.user?.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Enrollment" htmlFor="enrollment" required>
              <Select id="enrollment" value={form.enrollment} onChange={handleChange('enrollment')} required disabled={!studentId}>
                <option value="">{studentId ? 'Select enrollment' : 'Select a student first'}</option>
                {enrollments.map((en) => (
                  <option key={en._id} value={en._id}>
                    {en.course?.name} — {en.batch?.batchCode}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        )}
        <FormField label="Amount (PKR)" htmlFor="amount" required>
          <Input id="amount" type="number" min="0" value={form.amount} onChange={handleChange('amount')} required />
        </FormField>
        <FormField label="Installment #" htmlFor="installmentNumber">
          <Input id="installmentNumber" type="number" min="1" value={form.installmentNumber} onChange={handleChange('installmentNumber')} />
        </FormField>
        <FormField label="Method" htmlFor="method">
          <Select id="method" value={form.method} onChange={handleChange('method')}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ')}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" htmlFor="status">
          <Select id="status" value={form.status} onChange={handleChange('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due Date" htmlFor="dueDate">
          <Input id="dueDate" type="date" value={form.dueDate} onChange={handleChange('dueDate')} />
        </FormField>
        <FormField label="Remarks" htmlFor="remarks">
          <Input id="remarks" value={form.remarks} onChange={handleChange('remarks')} />
        </FormField>
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Payments() {
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
  } = useCrudResource(paymentsApi.list, { limit: 10 });

  const [students, setStudents] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    studentsApi.list({ limit: 100 }).then((res) => setStudents(res.data));
  }, []);

  const handleSubmit = async (values) => {
    if (editing) {
      await paymentsApi.update(editing._id, values);
    } else {
      await paymentsApi.create(values);
    }
    refetch();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await paymentsApi.remove(deleteTarget._id);
      setDeleteTarget(null);
      handleDeleted();
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-800">{row.student?.user?.name}</p>
          <p className="text-xs text-slate-400">
            {row.enrollment?.course?.name} — {row.enrollment?.batch?.batchCode}
          </p>
        </div>
      ),
    },
    { key: 'amount', header: 'Amount', render: (row) => `PKR ${row.amount?.toLocaleString()}` },
    { key: 'installment', header: 'Installment', render: (row) => `#${row.installmentNumber}` },
    { key: 'method', header: 'Method', render: (row) => row.method?.replace('_', ' ') },
    { key: 'dueDate', header: 'Due Date', render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
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
      title="Payments"
      description="Track student fee payments and installments"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} /> Generate Payment
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by student name" value={search} onChange={(e) => changeSearch(e.target.value)} />
        </div>
        <Select className="w-auto" value={filters.status || ''} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No payments found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <PaymentFormDrawer open={formOpen} onClose={() => setFormOpen(false)} payment={editing} students={students} onSubmit={handleSubmit} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Payment"
        message="Are you sure you want to delete this payment record? This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </PageContainer>
  );
}
