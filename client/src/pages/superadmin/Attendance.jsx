import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { PageContainer, Button } from '../../components/common';
import MarkAttendancePanel from '../../components/attendance/MarkAttendancePanel';
import RollNumberLookup from '../../components/attendance/RollNumberLookup';
import RecentActivityPanel from '../../components/attendance/RecentActivityPanel';
import AttendanceHistoryPanel from '../../components/attendance/AttendanceHistoryPanel';
import TrainerCheckInPanel from '../../components/attendance/TrainerCheckInPanel';
import TrainerAttendanceHistory from '../../components/attendance/TrainerAttendanceHistory';
import AttendanceQrScannerModal from '../../components/attendance/AttendanceQrScannerModal';
import batchesApi from '../../api/batchesApi';
import trainersApi from '../../api/trainersApi';
import { useAuth } from '../../context/AuthContext';

export default function Attendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
  const canUpdate = can('attendance', 'update');
  const canDelete = can('attendance', 'delete');

  const [tab, setTab] = useState('students');
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [trainerRefreshKey, setTrainerRefreshKey] = useState(0);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    batchesApi.list({ limit: 100 }).then((res) => setBatches(res.data));
    trainersApi.list({ limit: 100 }).then((res) => setTrainers(res.data));
  }, []);

  // Scanning a Student QR marks attendance directly (no batch/date form
  // needed — the server resolves it from the enrollment's own live
  // schedule, see attendanceApi.scanQr), so refresh the same lists a manual
  // mark/check-in already refreshes. Super Admin is never campus-scoped
  // (campusFilter omitted here — undefined, same as every other Super
  // Admin call in this file), matching every existing call in this file.
  const handleScanned = () => {
    if (tab === 'students') setHistoryRefreshKey((k) => k + 1);
    else setTrainerRefreshKey((k) => k + 1);
  };

  return (
    <PageContainer
      title="Attendance"
      description="Mark and review student and trainer attendance across batches"
      actions={
        canMark && (
          <Button variant="secondary" onClick={() => setScannerOpen(true)}>
            <QrCode size={15} /> Scan QR
          </Button>
        )
      }
    >
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('students')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'students' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Student Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab('trainers')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'trainers' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Trainer Attendance
        </button>
      </div>

      {tab === 'students' ? (
        <>
          <RollNumberLookup />

          <MarkAttendancePanel batches={batches} onMarked={() => setHistoryRefreshKey((k) => k + 1)} canMark={canMark} />

          <RecentActivityPanel />

          <AttendanceHistoryPanel refreshKey={historyRefreshKey} batches={batches} canDelete={canDelete} />
        </>
      ) : (
        <>
          <TrainerCheckInPanel
            trainers={trainers}
            batches={batches}
            canMark={canMark}
            onChecked={() => setTrainerRefreshKey((k) => k + 1)}
          />
          <TrainerAttendanceHistory
            trainers={trainers}
            batches={batches}
            canUpdate={canUpdate}
            canDelete={canDelete}
            refreshKey={trainerRefreshKey}
          />
        </>
      )}

      <AttendanceQrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode={tab === 'students' ? 'student' : 'trainer'}
        onScanned={handleScanned}
      />
    </PageContainer>
  );
}
