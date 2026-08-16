import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { PageContainer, Button } from '../../components/common';
import RollNumberLookup from '../../components/attendance/RollNumberLookup';
import MarkAttendancePanel from '../../components/attendance/MarkAttendancePanel';
import AttendanceQrScannerModal from '../../components/attendance/AttendanceQrScannerModal';
import batchesApi from '../../api/batchesApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Attendance > Mark Attendance. Reuses the same
// RollNumberLookup / MarkAttendancePanel components and attendance API as
// the Super Admin Attendance page, just on its own route. The QR scanner
// (attendanceApi.scanQr) is scoped to this same campusFilter, so scanning a
// student enrolled at a different campus is rejected server-side exactly
// like every other Admin-facing lookup/mark call already scoped by it.
export default function MarkAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
  const campusFilter = useAdminCampusFilter();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer
      title="Mark Attendance"
      description="Look up a student and mark batch attendance"
      onBack={() => navigate(-1)}
      actions={
        canMark && (
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <QrCode size={15} /> Scan QR
          </Button>
        )
      }
    >
      <RollNumberLookup campusFilter={campusFilter} />
      <MarkAttendancePanel batches={batches} canMark={canMark} />

      <AttendanceQrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="student"
        campusFilter={campusFilter}
      />
    </PageContainer>
  );
}
