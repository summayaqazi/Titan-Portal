import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, MapPin } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import { EmptyState } from '../../components/common';
import publicApi from '../../api/publicApi';

// Public, unauthenticated Courses page — the entry point of the
// Public Website -> Courses -> Course Details -> Enroll flow. Loads live
// data through GET /api/public/courses (server/src/controllers/
// public.controller.js), which already only returns active courses with at
// least one currently open batch — never hardcoded, never mock data.
export default function Courses() {
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    publicApi
      .listCourses()
      .then(setCourses)
      .catch(() => setError('Unable to load courses right now. Please try again shortly.'));
  }, []);

  return (
    <div className="min-h-screen bg-(--color-app-bg)">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Courses open for enrollment</h1>
          <p className="mt-1 text-sm text-slate-500">
            Browse the courses currently accepting applications and apply online in a few minutes.
          </p>
        </div>

        {error && <p className="mb-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {courses === null && !error && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {courses?.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white">
            <EmptyState
              icon={BookOpen}
              title="No courses are open for registration right now"
              description="Please check back soon, or contact the institute for the next intake."
            />
          </div>
        )}

        {courses?.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course._id}
                to={`/courses/${course._id}`}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-slate-800">{course.name}</h2>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    Open
                  </span>
                </div>
                {course.description && (
                  <p className="mb-4 line-clamp-3 flex-1 text-sm text-slate-500">{course.description}</p>
                )}
                <div className="mt-auto space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="shrink-0" />
                    <span>{course.durationInMonths} month{course.durationInMonths === 1 ? '' : 's'}</span>
                  </div>
                  {course.campuses.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="shrink-0" />
                      <span className="truncate">{course.campuses.join(', ')}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
