import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/common';
import TrainerCheckInPanel from '../../components/attendance/TrainerCheckInPanel';
import batchesApi from '../../api/batchesApi';
import trainersApi from '../../api/trainersApi';
import { useAuth } from '../../context/AuthContext';
import useAdminCampusFilter from '../../hooks/useAdminCampusFilter';

// Admin Portal — Trainer Attendance > Mark Attendance. Reuses
// TrainerCheckInPanel and the trainer-attendance API from the Super Admin
// Attendance page's Trainer Attendance tab.
export default function TrainerMarkAttendance() {
  const { can } = useAuth();
  const canMark = can('attendance', 'create');
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
    <PageContainer title="Mark Trainer Attendance" description="Check in a trainer for a batch session" onBack={() => navigate(-1)}>
      <TrainerCheckInPanel trainers={trainers} batches={batches} canMark={canMark} />
    </PageContainer>
  );
}
