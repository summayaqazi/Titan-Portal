import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, Users } from 'lucide-react';
import { PageContainer } from '../../components/common';
import StudentsTab from '../../components/trainer/StudentsTab';
import AttendanceTab from '../../components/trainer/AttendanceTab';
import AssignmentsTab from '../../components/trainer/AssignmentsTab';
import QuizzesTab from '../../components/trainer/QuizzesTab';
import ProgressTab from '../../components/trainer/ProgressTab';
import trainerPortalApi from '../../api/trainerPortalApi';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errors';

const TABS = [
  { key: 'students', label: 'Students', module: 'students' },
  { key: 'attendance', label: 'Attendance', module: 'attendance' },
  { key: 'assignments', label: 'Assignments', module: 'assignments' },
  { key: 'quizzes', label: 'Quizzes', module: 'quizzes' },
  { key: 'progress', label: 'Course Progress', module: 'progress' },
];

// One layout, tab content swaps — Students/Attendance (Phase 3),
// Assignments (Phase 4), and Quizzes/Course Progress (Phase 5) are all real.
export default function CourseWorkspace() {
  const { batchId } = useParams();
  const { can } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    trainerPortalApi
      .getCourseWorkspace(batchId)
      .then((res) => {
        if (!cancelled) setWorkspace(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load course'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const visibleTabs = TABS.filter((t) => !t.module || can(t.module, 'view'));

  return (
    <PageContainer
      title={
        <Link to="/trainer/dashboard" className="mb-1 inline-flex items-center gap-1 text-xs font-normal text-slate-400 hover:text-slate-600">
          <ArrowLeft size={12} /> Dashboard
        </Link>
      }
      // Fills the layout's scrollable <main> exactly (h-full) instead of
      // growing past it — so only the tab-content div below scrolls, and
      // the breadcrumb/course-info/tabs above it (all shrink-0) never move.
      // Without this, `<main>` itself scrolls the whole page (course info
      // and tabs included), which is the "outer/full-page scroll" the
      // mobile course/student view must not have.
      className="flex h-full min-h-0 flex-col p-4 sm:p-6"
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-5 shrink-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">{workspace.course?.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {workspace.campus?.name} · {workspace.batchCode}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} />
                {workspace.slot ? `${workspace.slot.label} · ${workspace.slot.startTime}–${workspace.slot.endTime}` : 'No slot assigned'}
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} /> {workspace.studentCount} students
              </span>
            </div>
          </div>

          {/* overflow-x-auto + shrink-0 buttons: on a narrow phone the 5
              tabs scroll sideways within their own strip instead of
              wrapping or overflowing the page. */}
          <div className="mb-5 flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === 'students' && <StudentsTab batchId={batchId} />}
            {activeTab === 'attendance' && <AttendanceTab batchId={batchId} />}
            {activeTab === 'assignments' && <AssignmentsTab batchId={batchId} />}
            {activeTab === 'quizzes' && <QuizzesTab batchId={batchId} />}
            {activeTab === 'progress' && <ProgressTab batchId={batchId} />}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
