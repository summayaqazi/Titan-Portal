const CourseProgress = require('../models/CourseProgress');

// The single source of truth for "how far along is this course" — every
// place that shows a progress percentage (Dashboard's Active Course cards,
// Course Workspace header) must go through this, so they can never drift
// from what the Course Progress tab itself computes and persists to.
// Returns 0 for a course with no curriculum yet or no topics marked
// complete — never a fabricated/estimated number.
const getCourseProgressPercent = async (courseId) => {
  if (!courseId) return 0;
  const progress = await CourseProgress.findOne({ course: courseId }).select('modules');
  if (!progress) return 0;

  let totalTopics = 0;
  let completedTopics = 0;
  progress.modules.forEach((m) => {
    totalTopics += m.topics.length;
    completedTopics += m.topics.filter((t) => t.completed).length;
  });

  return totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
};

module.exports = { getCourseProgressPercent };
