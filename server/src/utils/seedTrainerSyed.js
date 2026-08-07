// Populates ONE existing trainer — Syed Sammar Abbas (syedsammarabbas@gmail.com,
// a real trainer already present in the DB, not seeded by seedDemoData.js)
// with realistic Assignment/Submission/Quiz data, the same *types* of
// records Trainer 1 already has, so every tab of their portal (Courses,
// Assignments, Assignment Submissions, Quizzes) has something real to show
// instead of an empty state.
//
// Strictly additive and idempotent — safe to re-run:
//   - Never creates a User or Trainer document (this trainer must already
//     exist; the script aborts if it doesn't rather than creating a
//     duplicate).
//   - Never touches Trainer 1 (or any other trainer's) records — every
//     Assignment/Quiz/Submission created here is scoped to Syed's own
//     trainer id and his own batches, resolved live from the DB.
//   - Never touches CourseProgress — it's one shared document per COURSE
//     (see CourseProgress.js), and both of Syed's courses already have one
//     (created earlier, shared with whichever other trainer(s) teach the
//     same course), so seeding a second one here would either duplicate or
//     silently overwrite data that isn't this script's to own.
//   - Assignments/Quiz are matched on (trainer, batch, title) before
//     insert — re-running this script updates the same records in place
//     instead of duplicating them. The submission is matched on
//     (assignment, student) — the same uniqueness Submission.js already
//     enforces — and its placeholder file is only written to disk the
//     first time.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Trainer = require('../models/Trainer');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');

const TRAINER_EMAIL = 'syedsammarabbas@gmail.com';

const upsertAssignment = async (def) => {
  const assignment = await Assignment.findOneAndUpdate(
    { trainer: def.trainer, batch: def.batch, title: def.title },
    { $set: def },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return assignment;
};

const upsertQuiz = async (def) => {
  const existing = await Quiz.findOne({ trainer: def.trainer, batch: def.batch, title: def.title });
  if (existing) return { quiz: existing, created: false };

  const totalMarks = def.questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const quiz = await Quiz.create({ ...def, totalMarks });
  return { quiz, created: true };
};

const run = async () => {
  await connectDB();

  const user = await User.findOne({ email: TRAINER_EMAIL });
  if (!user) {
    throw new Error(`No User found with email ${TRAINER_EMAIL} — aborting (this script never creates trainers).`);
  }
  const trainer = await Trainer.findOne({ user: user._id });
  if (!trainer) {
    throw new Error(`No Trainer profile found for ${TRAINER_EMAIL} — aborting (this script never creates trainers).`);
  }

  const batches = await Batch.find({ trainer: trainer._id }).populate('course', 'name code');
  const webDevBatch = batches.find((b) => b.course?.code === 'WEBDEV');
  const modWebBatch = batches.find((b) => b.course?.name === 'Modern Web And App Development') || batches[1];

  if (!webDevBatch || !modWebBatch) {
    throw new Error(
      `Expected 2 batches (Web Development + Modern Web And App Development) for ${TRAINER_EMAIL}, found: ${batches
        .map((b) => b.course?.name)
        .join(', ')}. Aborting rather than guessing.`
    );
  }

  // --- Assignments (on the Modern Web And App Development batch) ---
  const assignment1 = await upsertAssignment({
    title: 'Build a Personal Portfolio Website',
    description:
      'Build a responsive personal portfolio site (Home, Projects, Contact) using React components and client-side routing. Deploy it and share the live link along with your repository.',
    topic: 'React Components, Routing',
    referenceLinks: ['https://github.com/demo-trainer/portfolio-starter'],
    dueDate: new Date('2026-09-05'),
    referenceImages: [],
    attachments: [],
    course: modWebBatch.course._id,
    batch: modWebBatch._id,
    trainer: trainer._id,
  });

  const assignment2 = await upsertAssignment({
    title: 'API Integration Task',
    description:
      'Fetch data from a public REST API using async/await, handle loading and error states, and render the results in a list. Submit your source code link and a short write-up of your approach.',
    topic: 'Fetch API, Async/Await',
    referenceLinks: ['https://jsonplaceholder.typicode.com/'],
    dueDate: new Date('2026-08-20'),
    referenceImages: [],
    attachments: [],
    course: modWebBatch.course._id,
    batch: modWebBatch._id,
    trainer: trainer._id,
  });

  // --- One realistic submission, from a student actually ENROLLED (not
  // merely pending) in the batch the assignment belongs to ---
  const enrolledStudentIds = await Enrollment.distinct('student', { batch: modWebBatch._id, status: 'enrolled' });
  const submittingStudent = enrolledStudentIds.length
    ? await Student.findById(enrolledStudentIds[0]).populate('user', 'name email')
    : null;

  let submissionResult = 'skipped — no enrolled student found on this batch';
  if (submittingStudent) {
    const existingSubmission = await Submission.findOne({ assignment: assignment2._id, student: submittingStudent._id });
    if (existingSubmission) {
      submissionResult = `already exists (by ${submittingStudent.user?.name})`;
    } else {
      const placeholderName = `seed-syed-submission-${Date.now()}.txt`;
      fs.writeFileSync(
        path.join(__dirname, '..', 'uploads', placeholderName),
        'API Integration Task — submission.\nFetches posts from JSONPlaceholder, renders them in a list with loading/error states.\nDemo file for the Titan Institute Portal seed data.\n'
      );

      await Submission.create({
        assignment: assignment2._id,
        student: submittingStudent._id,
        description:
          "I used the Fetch API with async/await to pull posts from JSONPlaceholder, added a loading spinner and an error banner for failed requests, and rendered the list with a simple card layout. Repo link and write-up attached below.",
        links: ['https://github.com/demo-student/api-integration-task'],
        files: [`/uploads/${placeholderName}`],
        submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'pending',
      });
      submissionResult = `created (by ${submittingStudent.user?.name})`;
    }
  }

  // --- Quiz (on the Web Development batch) ---
  const { quiz, created: quizCreated } = await upsertQuiz({
    title: 'HTML & CSS Fundamentals Quiz',
    description: 'Quick check on core HTML/CSS concepts covered so far.',
    durationMinutes: 20,
    status: 'published',
    publishedAt: new Date(),
    questions: [
      {
        text: 'Which CSS property controls the size of text?',
        type: 'single',
        options: ['font-size', 'text-style', 'font-weight', 'text-size'],
        correctOptions: [0],
        points: 5,
      },
      {
        text: 'Which of the following are valid CSS length units? (select all that apply)',
        type: 'multiple',
        options: ['px', 'em', '%', 'kg'],
        correctOptions: [0, 1, 2],
        points: 5,
      },
    ],
    course: webDevBatch.course._id,
    batch: webDevBatch._id,
    trainer: trainer._id,
  });

  await mongoose.connection.close();

  console.log('Seed complete for Syed Sammar Abbas (safe to re-run, no duplicates):');
  console.log({
    trainer: `${user.name} <${user.email}>`,
    batches: { webDev: webDevBatch.batchCode, modWeb: modWebBatch.batchCode },
    assignments: [assignment1.title, assignment2.title],
    submission: submissionResult,
    quiz: `${quiz.title} (${quizCreated ? 'created' : 'already existed'}, status=${quiz.status}, totalMarks=${quiz.totalMarks})`,
    note:
      "Quiz attempts/results were NOT seeded — the app has no student-facing quiz-taking feature or attempt/result model yet (Quiz is trainer-authored content only: draft/scheduled/published + questions). Adding one would mean introducing a new schema/feature, which is outside this task's 'no DB structure changes' constraint.",
  });
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
