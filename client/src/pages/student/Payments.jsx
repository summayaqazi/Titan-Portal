import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Info, Wallet } from 'lucide-react';
import { PageContainer, Table, StatusBadge, Button, EmptyState } from '../../components/common';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';

const FEE_TYPE_LABELS = {
  registration: 'Registration Fee',
  monthly: 'Monthly Fee',
  installment: 'Installment',
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// `month` is stored as 'YYYY-MM' (only meaningful for feeType 'monthly') —
// falls back to the due date's own month/year for registration/installment
// rows, which don't carry a `month` value, so the column is never blank
// just because the fee type isn't monthly.
function formatMonth(row) {
  const source = row.month ? `${row.month}-01` : row.dueDate;
  if (!source) return '—';
  return new Date(source).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

// Copies the voucher id (Payment's invoiceNumber) and flashes a checkmark —
// no shared clipboard component exists yet in this codebase, so this is
// kept page-local rather than adding a one-off common/ component for it.
function CopyVoucherButton({ value }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="text-slate-400">—</span>;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (insecure context, permissions) —
      // fail silently rather than showing an alarming error for a
      // convenience action; the voucher id is still visible to copy by hand.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      title="Copy voucher ID"
    >
      <span className="font-mono">{value}</span>
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-slate-400" />}
    </button>
  );
}

function PaymentInstructions() {
  return (
    <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start gap-2">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Payment Instructions</p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs text-blue-800">
            <li>Pay via bank transfer, online banking, or in person at your campus.</li>
            <li>Always use your Voucher ID as the payment reference so it can be matched to your account.</li>
            <li>Keep your payment receipt until the status here updates to PAID.</li>
            <li>Contact your campus office if a payment doesn't reflect within 2 business days.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_COLUMNS = [
  { key: 'month', header: 'Month', render: formatMonth },
  { key: 'amount', header: 'Amount', render: (row) => `PKR ${row.amount?.toLocaleString()}` },
  { key: 'feeType', header: 'Type', render: (row) => FEE_TYPE_LABELS[row.feeType] || row.feeType },
  { key: 'dueDate', header: 'Due Date', render: (row) => formatDate(row.dueDate) },
  { key: 'invoiceNumber', header: 'Voucher ID', render: (row) => <CopyVoucherButton value={row.invoiceNumber} /> },
  { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
];

// One section per enrolled course, each with a simple compact heading
// (course name + batch code — same "h2 then Table" pattern the Attendance
// page already uses for its own "Attendance Details" section) directly
// above the existing, unmodified payment Table. The table itself is
// byte-for-byte the same PAYMENT_COLUMNS/Table this page always used; the
// only thing added is vertical separation by course. A course with no
// payment rows yet still gets its own section — Table's own `emptyMessage`
// already renders a clean empty row, nothing custom needed for that.
function CourseFeeGroup({ group }) {
  return (
    <div className="mb-6">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-slate-800">{group.courseName || 'Other Payments'}</h2>
        {group.batchCode && <p className="text-xs font-medium text-slate-500">{group.batchCode}</p>}
      </div>

      <Table columns={PAYMENT_COLUMNS} data={group.payments} emptyMessage="No payment records available for this course." />
    </div>
  );
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // getDashboard() is only used here for its `courses` list (enrollmentId/
  // courseName/batchCode) — the same existing endpoint the Progress page
  // already joins against — so a course with no payment records yet still
  // gets its own (empty) section instead of silently disappearing.
  // getPayments() itself is completely unchanged.
  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([studentPortalApi.getPayments(), studentPortalApi.getDashboard()])
      .then(([paymentsData, dashboard]) => {
        setPayments(paymentsData);
        setCourses(dashboard.courses || []);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load payments')))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // One group per enrolled course (seeded from getDashboard()'s own course
  // list, in its existing order) plus one group for any payment whose
  // enrollment isn't in that active list (e.g. a completed/past enrollment)
  // so no payment is ever dropped. Every payment is placed purely by its
  // own enrollmentId/courseId — never by amount, month, or date — so it can
  // only ever land under the course it actually belongs to.
  const groups = [];
  const groupsByKey = new Map();
  for (const c of courses) {
    const key = String(c.enrollmentId);
    const group = { key, courseName: c.courseName, batchCode: c.batchCode, payments: [] };
    groupsByKey.set(key, group);
    groups.push(group);
  }
  for (const p of payments) {
    const key = String(p.enrollmentId || p.courseId || p.courseName || p._id);
    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, courseName: p.courseName, batchCode: p.batchCode, payments: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    group.payments.push(p);
  }

  return (
    <PageContainer
      title="Payments"
      description="Your fee vouchers and payment status"
      actions={
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      }
    >
      <PaymentInstructions />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={Wallet} title="No payment records found" description="Your fee vouchers will appear here once generated." />
      ) : (
        groups.map((group) => <CourseFeeGroup key={group.key} group={group} />)
      )}
    </PageContainer>
  );
}
