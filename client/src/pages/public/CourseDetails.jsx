import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, GraduationCap, MapPin, Users } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import { Button } from '../../components/common';
import publicApi from '../../api/publicApi';

// Public Course Details page — GET /api/public/courses/:id. Reachable even
// for a course/batch that's no longer open (deep link, or a course an
// admin closed after it was shared), in which case enrollment is disabled
// and "Registration closed" is shown, per spec, instead of a bare error.
export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setCourse(null);
    setError('');
    publicApi
      .getCourse(courseId)
      .then(setCourse)
      .catch((err) => {
        setError(err.response?.data?.message || 'This course could not be found.');
      });
  }, [courseId]);

  const handleEnroll = () => {
    // Carries the already-selected course through to the registration form
    // via router state, so the visitor never has to search for it again —
    // Register.jsx also accepts /enroll/:courseId directly for a shared link.
    navigate(`/enroll/${courseId}`, { state: { course } });
  };

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/courses" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={15} /> Back to courses
        </Link>

        {error && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!error && !course && <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />}

        {course && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {/* Thin brand accent — same navy as PublicHeader/PublicHero,
                kept subtle here (not a full banner) since that would clash
                with the Open/Closed badge's light background just below. */}
            <div className="h-1.5 bg-(--color-sidebar)" />
            <div className="border-b border-slate-200 p-6 sm:p-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {/* Same color tokens StatusBadge uses for open/closed, kept
                    as its own span (not <StatusBadge>) only because this
                    page wants the fuller "Registration open/closed" copy
                    instead of StatusBadge's plain status-word label. */}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    course.registrationOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {course.registrationOpen ? 'Registration open' : 'Registration closed'}
                </span>
                <span className="text-xs text-slate-400">{course.code}</span>
              </div>
              <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">{course.name}</h1>
              {course.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{course.description}</p>}

              <div className="mt-5 flex items-center gap-1.5 text-sm text-slate-500">
                <Clock size={16} className="shrink-0" />
                <span>
                  {course.durationInMonths} month{course.durationInMonths === 1 ? '' : 's'} duration
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Available batches</h2>

              {course.batches.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No batches are currently open for this course. Please check back later or contact the institute.
                </p>
              ) : (
                <ul className="space-y-3">
                  {course.batches.map((batch) => (
                    <li
                      key={batch._id}
                      className="flex flex-wrap items-center gap-x-6 gap-y-1.5 rounded-lg border border-slate-200 p-3.5 text-sm text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                    >
                      <span className="font-medium text-slate-800">{batch.batchCode}</span>
                      {batch.campus && (
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="shrink-0 text-slate-400" />
                          {batch.campus.name}
                          {batch.campus.city ? `, ${batch.campus.city}` : ''}
                        </span>
                      )}
                      {batch.slot && (
                        <span className="flex items-center gap-1.5">
                          <Users size={14} className="shrink-0 text-slate-400" />
                          {batch.slot.label} ({batch.slot.startTime}–{batch.slot.endTime})
                        </span>
                      )}
                      {/* Trainer — newly surfaced from GET /api/public/courses/:id
                          (server/src/controllers/public.controller.js populates
                          it now), same "relevant course data" every other field
                          on this row already shows a prospective student. */}
                      {batch.trainer && (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap size={14} className="shrink-0 text-slate-400" />
                          {batch.trainer.name}
                        </span>
                      )}
                      {batch.startDate && (
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={14} className="shrink-0 text-slate-400" />
                          Starts {new Date(batch.startDate).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                <Button onClick={handleEnroll} disabled={!course.registrationOpen} className="w-full sm:w-auto">
                  {course.registrationOpen ? 'Enroll Now' : 'Registration Closed'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
