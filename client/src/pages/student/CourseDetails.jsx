import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '../../components/common';
import ModuleProgressList from '../../components/student/ModuleProgressList';
import TopicStatCards from '../../components/student/TopicStatCards';
import studentPortalApi from '../../api/studentPortalApi';
import { getErrorMessage } from '../../utils/errors';
import { progressBarColor } from '../../utils/courseTheme';

export default function CourseDetails() {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    studentPortalApi
      .getCourseDetails(enrollmentId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load course details'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enrollmentId]);

  return (
    <PageContainer>
      {/* navigate(-1) instead of a hardcoded destination — this page is
          reachable from both the Dashboard's course cards and the Progress
          page's course cards, so "Back" needs to return wherever the
          student actually came from rather than always going to one of
          them. Client-side history navigation, no full page reload. */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : loading || !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Course Header — enrollment/campus/trainer/schedule info is
              deliberately not shown anywhere on this page; it's a focused
              course-progress view only. "Completed"/"In Progress" is
              derived from progressPercent (same rule the Progress page's
              own cards use) rather than the raw enrollment status, so the
              badge always agrees with the percentage right next to it. */}
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-slate-800">{data.course?.name}</h1>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      data.progress.progressPercent >= 100 ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700'
                    }`}
                  >
                    {data.progress.progressPercent >= 100 ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {data.course?.code} · {data.batchCode}
                </p>
                {data.course?.description && <p className="mt-2 text-sm text-slate-600">{data.course.description}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-semibold text-slate-800">{data.progress.progressPercent}%</p>
                <p className="text-xs text-slate-400">Overall Progress</p>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${progressBarColor(data.progress.progressPercent)}`}
                style={{ width: `${data.progress.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Curriculum Progress</h2>

            <TopicStatCards
              total={data.progress.totalTopics}
              completed={data.progress.completedTopics}
              pending={data.progress.remainingTopics}
            />

            <div className="mt-4 border-t border-slate-100 pt-4">
              <ModuleProgressList modules={data.progress.modules} />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
