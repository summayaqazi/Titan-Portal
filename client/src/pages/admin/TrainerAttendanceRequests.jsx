import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/common';
import TrainerAttendanceHistory from '../../components/attendance/TrainerAttendanceHistory';
import batchesApi from '../../api/batchesApi';
import trainersApi from '../../api/trainersApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Trainer Attendance > Attendance Request. Reuses
// TrainerAttendanceHistory preset to pending requests, so verify/reject
// stays a single shared implementation instead of a second one.
export default function TrainerAttendanceRequests() {
  const { can } = useAuth();
  const canUpdate = can('attendance', 'update');
  const canDelete = can('attendance', 'delete');
  const campusFilter = useAdminCampusFilter();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);

  useEffect(() => {
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    trainersApi.list({ limit: 100, campus: campusFilter }).then((res) => setTrainers(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer title="Attendance Requests" description="Verify or reject pending trainer check-in requests" onBack={() => navigate(-1)}>
      <TrainerAttendanceHistory
        trainers={trainers}
        batches={batches}
        canUpdate={canUpdate}
        canDelete={canDelete}
        campusFilter={campusFilter}
        initialFilters={{ status: 'pending' }}
        title="Pending Attendance Requests"
      />
    </PageContainer>
  );
}
