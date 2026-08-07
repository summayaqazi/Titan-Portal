const asyncHandler = require('express-async-handler');
const CourseProgress = require('../models/CourseProgress');
const Batch = require('../models/Batch');

// Attaches per-module and overall completed/remaining/percentage figures on
// read — never stored, so they can never drift from the underlying
// `completed` flags on each topic.
const withComputed = (doc) => {
  const obj = doc.toObject();
  let totalTopics = 0;
  let completedTopics = 0;

  obj.modules = obj.modules.map((m) => {
    const total = m.topics.length;
    const completed = m.topics.filter((t) => t.completed).length;
    totalTopics += total;
    completedTopics += completed;
    return {
      ...m,
      totalTopics: total,
      completedTopics: completed,
      remainingTopics: total - completed,
      progressPercent: total ? Math.round((completed / total) * 100) : 0,
    };
  });

  obj.totalTopics = totalTopics;
  obj.completedTopics = completedTopics;
  obj.remainingTopics = totalTopics - completedTopics;
  obj.progressPercent = totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0;
  return obj;
};

// One CourseProgress document per COURSE — created lazily the first time
// it's asked for, so a trainer never has to explicitly "initialize"
// progress, and every batch of that course (this trainer's or another
// trainer's) automatically sees the same curriculum from then on.
const getOrCreate = async (courseId, trainerId) => {
  let progress = await CourseProgress.findOne({ course: courseId });
  if (!progress) {
    progress = await CourseProgress.create({ course: courseId, trainer: trainerId, modules: [] });
  }
  return progress;
};

// Module/topic-scoped routes aren't nested under :batchId (see routes file),
// so ownership can't be checked via requireOwnBatch. Instead: resolve which
// course the progress document belongs to, then confirm this trainer
// actually teaches that course via any batch of their own — the same
// "can this trainer reach this data" guarantee as requireOwnBatch, just
// re-derived from the course side instead of the batch side.
const teachesCourse = async (trainerId, courseId) => Boolean(await Batch.findOne({ trainer: trainerId, course: courseId }));

// Nested arrays need a manual walk to locate a topic — module.id() only
// searches one level, so this scans each module's topics in turn.
const findTopic = (progress, topicId) => {
  for (const module of progress.modules) {
    const topic = module.topics.id(topicId);
    if (topic) return { module, topic };
  }
  return {};
};

// @desc    Get (or lazily create) this course's progress, with computed
//          overall/module percentages and completed/remaining counts.
// @route   GET /api/trainer/me/courses/:batchId/progress
// @access  Private (TRAINER)
const getProgress = asyncHandler(async (req, res) => {
  const progress = await getOrCreate(req.batch.course, req.trainer._id);
  res.json({ success: true, data: withComputed(progress) });
});

// @desc    Add a module to this course's curriculum.
// @route   POST /api/trainer/me/courses/:batchId/progress/modules
// @access  Private (TRAINER)
const addModule = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    res.status(400);
    throw new Error('Module title is required');
  }
  const progress = await getOrCreate(req.batch.course, req.trainer._id);
  progress.modules.push({ title: title.trim(), topics: [] });
  await progress.save();
  res.status(201).json({ success: true, data: withComputed(progress) });
});

// @desc    Rename a module.
// @route   PUT /api/trainer/me/progress/modules/:moduleId
// @access  Private (TRAINER)
const updateModule = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules._id': req.params.moduleId });
  const module = progress?.modules.id(req.params.moduleId);
  if (!module || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Module not found');
  }

  const { title } = req.body;
  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      throw new Error('Module title is required');
    }
    module.title = title.trim();
  }

  await progress.save();
  res.json({ success: true, data: withComputed(progress) });
});

// @desc    Delete a module (and every topic under it).
// @route   DELETE /api/trainer/me/progress/modules/:moduleId
// @access  Private (TRAINER)
const deleteModule = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules._id': req.params.moduleId });
  const module = progress?.modules.id(req.params.moduleId);
  if (!module || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Module not found');
  }

  module.deleteOne();
  await progress.save();
  res.json({ success: true, data: withComputed(progress) });
});

// @desc    Add a topic under a module.
// @route   POST /api/trainer/me/progress/modules/:moduleId/topics
// @access  Private (TRAINER)
const addTopic = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules._id': req.params.moduleId });
  const module = progress?.modules.id(req.params.moduleId);
  if (!module || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Module not found');
  }

  const { title } = req.body;
  if (!title || !title.trim()) {
    res.status(400);
    throw new Error('Topic title is required');
  }

  module.topics.push({ title: title.trim() });
  await progress.save();
  res.status(201).json({ success: true, data: withComputed(progress) });
});

// @desc    Rename a topic.
// @route   PUT /api/trainer/me/progress/topics/:topicId
// @access  Private (TRAINER)
const updateTopic = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules.topics._id': req.params.topicId });
  const { topic } = progress ? findTopic(progress, req.params.topicId) : {};
  if (!topic || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Topic not found');
  }

  const { title } = req.body;
  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      throw new Error('Topic title is required');
    }
    topic.title = title.trim();
  }

  await progress.save();
  res.json({ success: true, data: withComputed(progress) });
});

// @desc    Mark a topic completed/incomplete — the core "trainer updates
//          progress" action. Accepts an explicit `completed` flag, or
//          toggles the current value if omitted.
// @route   PATCH /api/trainer/me/progress/topics/:topicId/toggle
// @access  Private (TRAINER)
const toggleTopic = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules.topics._id': req.params.topicId });
  const { topic } = progress ? findTopic(progress, req.params.topicId) : {};
  if (!topic || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Topic not found');
  }

  // No-body PATCH calls (a plain "toggle" from the UI) leave req.body
  // undefined — express.json() only populates it for an application/json
  // request. Treat that the same as "no explicit value", i.e. flip it.
  const body = req.body || {};
  const completed = body.completed !== undefined ? Boolean(body.completed) : !topic.completed;
  topic.completed = completed;
  topic.completedAt = completed ? new Date() : undefined;

  await progress.save();
  res.json({ success: true, data: withComputed(progress) });
});

// @desc    Delete a topic.
// @route   DELETE /api/trainer/me/progress/topics/:topicId
// @access  Private (TRAINER)
const deleteTopic = asyncHandler(async (req, res) => {
  const progress = await CourseProgress.findOne({ 'modules.topics._id': req.params.topicId });
  const { topic } = progress ? findTopic(progress, req.params.topicId) : {};
  if (!topic || !(await teachesCourse(req.trainer._id, progress.course))) {
    res.status(404);
    throw new Error('Topic not found');
  }

  topic.deleteOne();
  await progress.save();
  res.json({ success: true, data: withComputed(progress) });
});

module.exports = {
  getProgress,
  addModule,
  updateModule,
  deleteModule,
  addTopic,
  updateTopic,
  toggleTopic,
  deleteTopic,
};
