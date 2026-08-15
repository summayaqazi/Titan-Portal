import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/common';
import RecentActivityPanel from '../../components/attendance/RecentActivityPanel';
import AttendanceHistoryPanel from '../../components/attendance/AttendanceHistoryPanel';
import batchesApi from '../../api/batchesApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Attendance > View Attendance. Reuses the same
// RecentActivityPanel / AttendanceHistoryPanel components and attendance
// API as the Super Admin Attendance page, just on its own route.
export default function ViewAttendance() {
  const { can } = useAuth();
  const canDelete = can('attendance', 'delete');
  const campusFilter = useAdminCampusFilter();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer title="View Attendance" description="Review student attendance history across batches" onBack={() => navigate(-1)}>
      <RecentActivityPanel campusFilter={campusFilter} />
      <AttendanceHistoryPanel batches={batches} canDelete={canDelete} campusFilter={campusFilter} />
    </PageContainer>
  );
}
