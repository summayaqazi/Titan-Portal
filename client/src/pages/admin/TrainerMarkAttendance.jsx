import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { PageContainer, Button } from '../../components/common';
import TrainerCheckInPanel from '../../components/attendance/TrainerCheckInPanel';
import AttendanceQrScannerModal from '../../components/attendance/AttendanceQrScannerModal';
import batchesApi from '../../api/batchesApi';
import trainersApi from '../../api/trainersApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Trainer Attendance > Mark Attendance. Reuses
// TrainerCheckInPanel and the trainer-attendance API from the Super Admin
// Attendance page's Trainer Attendance tab. The QR scanner
// (trainerAttendanceApi.scanQr) is scoped to this same campusFilter, so
// scanning a trainer whose in-session class is at a different campus is
// rejected server-side exactly like every other Admin-facing call here.
export default function TrainerMarkAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
  const campusFilter = useAdminCampusFilter();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    trainersApi.list({ limit: 100, campus: campusFilter }).then((res) => setTrainers(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer
      title="Mark Trainer Attendance"
      description="Check in a trainer for a batch session"
      onBack={() => navigate(-1)}
      actions={
        canMark && (
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <QrCode size={15} /> Scan QR
          </Button>
        )
      }
    >
      <TrainerCheckInPanel trainers={trainers} batches={batches} canMark={canMark} />

      <AttendanceQrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="trainer"
        campusFilter={campusFilter}
      />
    </PageContainer>
  );
}
