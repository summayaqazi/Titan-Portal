import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Receipt, RefreshCw, Search } from 'lucide-react';
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
import { useAuth } from '../../context/AuthContext';

const METHODS = ['cash', 'bank_transfer', 'card', 'online', 'other'];
const STATUSES = ['pending', 'paid', 'overdue', 'refunded'];
const FEE_TYPES = [
  { value: 'registration', label: 'Registration Fee' },
  { value: 'monthly', label: 'Monthly Fee' },
  { value: 'installment', label: 'Installment Plan' },
];

const currentMonth = () => new Date().toISOString().slice(0, 7);

function PaymentFormDrawer({ open, onClose, payment, students, defaultStudentId, onSubmit, onGeneratePlan }) {
  const isEdit = Boolean(payment);
  const [studentId, setStudentId] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [feeType, setFeeType] = useState('monthly');
  const [form, setForm] = useState({
    enrollment: '',
    amount: '',
    method: 'cash',
    status: 'pending',
    dueDate: '',
    remarks: '',
    month: currentMonth(),
  });
  const [planForm, setPlanForm] = useState({ totalAmount: '', installments: 3, startDate: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const guardSubmit = useSubmitGuard();

  useEffect(() => {
    if (!open) return;
    if (payment) {
      setStudentId(payment.student?._id || '');
      setFeeType(payment.feeType || 'monthly');
      setForm({
        enrollment: payment.enrollment?._id || '',
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        dueDate: payment.dueDate ? payment.dueDate.slice(0, 10) : '',
        remarks: payment.remarks || '',
        month: payment.month || currentMonth(),
      });
    } else {
      setStudentId(defaultStudentId || '');
      setFeeType('monthly');
      setForm({
        enrollment: '',
        amount: '',
        method: 'cash',
        status: 'pending',
        dueDate: '',
        remarks: '',
        month: currentMonth(),
      });
      setPlanForm({ totalAmount: '', installments: 3, startDate: '' });
    }
    setError('');
  }, [open, payment, defaultStudentId]);

  useEffect(() => {
    if (!studentId) {
      setEnrollments([]);
      return;
    }
    enrollmentsApi.listForStudent(studentId).then(setEnrollments);
  }, [studentId]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handlePlanChange = (field) => (e) => setPlanForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    guardSubmit(async () => {
      setError('');
      if (!isEdit && (!studentId || !form.enrollment)) {
        setError('Student and enrollment are required');
        return;
      }

      if (!isEdit && feeType === 'installment') {
        if (!planForm.totalAmount || Number(planForm.totalAmount) <= 0) {
          setError('Total amount must be greater than zero');
          return;
        }
        if (!planForm.installments || Number(planForm.installments) < 1) {
          setError('Number of installments must be at least 1');
          return;
        }
        setSubmitting(true);
        try {
          await onGeneratePlan({
            enrollment: form.enrollment,
            totalAmount: Number(planForm.totalAmount),
            installments: Number(planForm.installments),
            startDate: planForm.startDate || undefined,
          });
          onClose();
        } catch (err) {
          setError(getErrorMessage(err, 'Failed to generate installment plan'));
        } finally {
          setSubmitting(false);
        }
        return;
      }

      if (!form.amount || Number(form.amount) <= 0) {
        setError('Amount must be greater than zero');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit({ ...form, amount: Number(form.amount), feeType });
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
            <FormField label="Fee Type" htmlFor="feeType" required>
              <Select id="feeType" value={feeType} onChange={(e) => setFeeType(e.target.value)}>
                {FEE_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        )}

        {isEdit && (
          <FormField label="Fee Type">
            <p className="text-sm text-slate-600">
              {FEE_TYPES.find((f) => f.value === feeType)?.label || feeType}
              {payment?.invoiceNumber ? ` · ${payment.invoiceNumber}` : ''}
            </p>
          </FormField>
        )}

        {!isEdit && feeType === 'installment' ? (
          <>
            <FormField label="Total Amount (PKR)" htmlFor="totalAmount" required>
              <Input id="totalAmount" type="number" min="0" value={planForm.totalAmount} onChange={handlePlanChange('totalAmount')} required />
            </FormField>
            <FormField label="Number of Installments" htmlFor="installments" required>
              <Input id="installments" type="number" min="1" value={planForm.installments} onChange={handlePlanChange('installments')} required />
            </FormField>
            <FormField label="Start Date" htmlFor="startDate">
              <Input id="startDate" type="date" value={planForm.startDate} onChange={handlePlanChange('startDate')} />
            </FormField>
            <p className="mb-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Creates {planForm.installments || 0} pending payments, one per month, starting from the date above.
            </p>
          </>
        ) : (
          <>
            <FormField label="Amount (PKR)" htmlFor="amount" required>
              <Input id="amount" type="number" min="0" value={form.amount} onChange={handleChange('amount')} required />
            </FormField>
            {!isEdit && feeType === 'monthly' && (
              <FormField label="Billing Month" htmlFor="month">
                <Input id="month" type="month" value={form.month} onChange={handleChange('month')} />
              </FormField>
            )}
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
          </>
        )}
        {error && <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </form>
    </Drawer>
  );
}

export default function Payments() {
  const { can } = useAuth();
  const canCreate = can('payments', 'create');
  const canUpdate = can('payments', 'update');
  const canDelete = can('payments', 'delete');
  const canExport = can('payments', 'export');
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const defaultStudentId = searchParams.get('student') || '';

  useEffect(() => {
    studentsApi.list({ limit: 100 }).then((res) => setStudents(res.data));
  }, []);

  useEffect(() => {
    if (defaultStudentId) {
      setEditing(null);
      setFormOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStudentId]);

  const closeForm = () => {
    setFormOpen(false);
    if (searchParams.get('student')) {
      const next = new URLSearchParams(searchParams);
      next.delete('student');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSubmit = async (values) => {
    if (editing) {
      await paymentsApi.update(editing._id, values);
    } else {
      await paymentsApi.create(values);
    }
    refetch();
  };

  const handleGeneratePlan = async (values) => {
    await paymentsApi.generatePlan(values);
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

  const handleDownloadInvoice = async (row) => {
    setActionError('');
    setBusyId(row._id);
    try {
      await paymentsApi.downloadInvoice(row._id, row.invoiceNumber);
    } catch {
      setActionError('Failed to download invoice');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadReceipt = async (row) => {
    setActionError('');
    setBusyId(row._id);
    try {
      await paymentsApi.downloadReceipt(row._id, row.invoiceNumber);
    } catch {
      setActionError('Failed to download receipt');
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerate = async (row) => {
    setActionError('');
    setBusyId(row._id);
    try {
      await paymentsApi.regenerate(row._id);
      refetch();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to regenerate payment'));
    } finally {
      setBusyId(null);
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
    { key: 'invoiceNumber', header: 'Invoice #', render: (row) => row.invoiceNumber || '—' },
    {
      key: 'feeType',
      header: 'Fee Type',
      render: (row) => FEE_TYPES.find((f) => f.value === row.feeType)?.label || row.feeType,
    },
    { key: 'amount', header: 'Amount', render: (row) => `PKR ${row.amount?.toLocaleString()}` },
    { key: 'dueDate', header: 'Due Date', render: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canExport && (
            <button
              type="button"
              onClick={() => handleDownloadInvoice(row)}
              disabled={busyId === row._id}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
              aria-label="Download invoice"
              title="Download invoice"
            >
              <FileText size={15} />
            </button>
          )}
          {canExport && row.status === 'paid' && (
            <button
              type="button"
              onClick={() => handleDownloadReceipt(row)}
              disabled={busyId === row._id}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-green-600 disabled:opacity-40"
              aria-label="Download receipt"
              title="Download receipt"
            >
              <Receipt size={15} />
            </button>
          )}
          {canCreate && row.feeType === 'monthly' && ['paid', 'overdue'].includes(row.status) && (
            <button
              type="button"
              onClick={() => handleRegenerate(row)}
              disabled={busyId === row._id}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
              aria-label="Regenerate next month"
              title="Generate next month's invoice"
            >
              <RefreshCw size={15} />
            </button>
          )}
          <RowActions
            onEdit={canUpdate ? () => {
              setEditing(row);
              setFormOpen(true);
            } : undefined}
            onDelete={canDelete ? () => setDeleteTarget(row) : undefined}
          />
        </div>
      ),
    },
  ];

  return (
    <PageContainer
      title="Payments"
      description="Track student fee payments and installments"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} /> Generate Payment
          </Button>
        )
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
        <Select className="w-auto" value={filters.feeType || ''} onChange={(e) => setFilter('feeType', e.target.value)}>
          <option value="">All fee types</option>
          {FEE_TYPES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>Due</span>
          <Input type="date" className="w-auto" value={filters.dueFrom || ''} onChange={(e) => setFilter('dueFrom', e.target.value)} />
          <span>to</span>
          <Input type="date" className="w-auto" value={filters.dueTo || ''} onChange={(e) => setFilter('dueTo', e.target.value)} />
        </div>
      </div>

      {actionError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{actionError}</div>}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Table columns={columns} data={loading ? [] : items} emptyMessage={loading ? 'Loading...' : 'No payments found'} />
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        </div>
      )}

      <PaymentFormDrawer
        open={formOpen}
        onClose={closeForm}
        payment={editing}
        students={students}
        defaultStudentId={defaultStudentId}
        onSubmit={handleSubmit}
        onGeneratePlan={handleGeneratePlan}
      />

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
