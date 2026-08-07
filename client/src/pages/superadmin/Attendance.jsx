import { useEffect, useState } from 'react';
import { PageContainer } from '../../components/common';
import MarkAttendancePanel from '../../components/attendance/MarkAttendancePanel';
import RollNumberLookup from '../../components/attendance/RollNumberLookup';
import RecentActivityPanel from '../../components/attendance/RecentActivityPanel';
import AttendanceHistoryPanel from '../../components/attendance/AttendanceHistoryPanel';
import TrainerCheckInPanel from '../../components/attendance/TrainerCheckInPanel';
import TrainerAttendanceHistory from '../../components/attendance/TrainerAttendanceHistory';
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

  useEffect(() => {
    batchesApi.list({ limit: 100 }).then((res) => setBatches(res.data));
    trainersApi.list({ limit: 100 }).then((res) => setTrainers(res.data));
  }, []);

  return (
    <PageContainer title="Attendance" description="Mark and review student and trainer attendance across batches">
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab('students')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'students' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          Student Attendance
        </button>
        <button
          type="button"
          onClick={() => setTab('trainers')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'trainers' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'
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
    </PageContainer>
  );
}
