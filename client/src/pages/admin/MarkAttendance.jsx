import { useEffect, useState } from 'react';
import { PageContainer } from '../../components/common';
import RollNumberLookup from '../../components/attendance/RollNumberLookup';
import MarkAttendancePanel from '../../components/attendance/MarkAttendancePanel';
import batchesApi from '../../api/batchesApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Attendance > Mark Attendance. Reuses the same
// RollNumberLookup / MarkAttendancePanel components and attendance API as
// the Super Admin Attendance page, just on its own route.
export default function MarkAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
  const campusFilter = useAdminCampusFilter();
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    batchesApi.list({ limit: 100, campus: campusFilter }).then((res) => setBatches(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer title="Mark Attendance" description="Look up a student and mark batch attendance">
      <RollNumberLookup campusFilter={campusFilter} />
      <MarkAttendancePanel batches={batches} canMark={canMark} />
    </PageContainer>
  );
}
