const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Student = require('../models/Student');
const Trainer = require('../models/Trainer');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Campus = require('../models/Campus');
const City = require('../models/City');
const Slot = require('../models/Slot');
const Enrollment = require('../models/Enrollment');
const TrainerAttendance = require('../models/TrainerAttendance');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { ROLES } = require('./constants');

// Upserts reference data (no password hashing involved) so re-running the
// seed updates existing demo records in place instead of duplicating them.
const upsertMany = async (Model, key, docs) => {
  const results = [];
  for (const doc of docs) {
    const filter = {};
    for (const k of key) filter[k] = doc[k];
    // eslint-disable-next-line no-await-in-loop
    const record = await Model.findOneAndUpdate(
      filter,
      { $set: doc },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    results.push(record);
  }
  return results;
};

// Finds-or-creates a User so the password hashing pre-save hook always runs.
const findOrCreateUser = async (data) => {
  let user = await User.findOne({ email: data.email });
  if (!user) {
    user = await User.create(data);
  }
  return user;
};

// Two realistic demo submissions purely for exercising the Assignment
// Submissions review workflow (approve/reject/feedback). Gated on a global
// existence check — never runs (and never duplicates) once any submission
// exists, matching every other seed*() helper's "safe to re-run" contract.
// Skipped gracefully (not an error) if there are no real assignments yet to
// attach them to, since this script never creates assignments itself.
const seedSampleSubmissions = async () => {
  const existingCount = await Submission.countDocuments();
  if (existingCount > 0) {
    return { created: 0, note: 'submissions already exist — skipped' };
  }

  const assignments = await Assignment.find({}).limit(2);
  if (assignments.length === 0) {
    return { created: 0, note: 'no assignments to attach submissions to yet' };
  }

  // One real placeholder file so the "uploaded file" case is genuinely
  // functional in the UI (opens a real file), not a dangling path.
  const placeholderName = `seed-submission-${Date.now()}.txt`;
  fs.writeFileSync(
    path.join(__dirname, '..', 'uploads', placeholderName),
    'Demo submission file — Titan Institute Portal seed data.\nStands in for a real student upload.\n'
  );

  const SUBMISSION_DEFS = [
    {
      description:
        'I have completed the assignment as per the given requirements. Please review and let me know if any changes are needed.',
      links: ['https://github.com/demo-student/assignment-submission'],
      files: [],
      status: 'pending',
      daysAgo: 2,
    },
    {
      description:
        'Attached is my completed submission. I followed the reference materials shared in class and tested everything before submitting.',
      links: [],
      files: [`/uploads/${placeholderName}`],
      status: 'approved',
      feedback: 'Great work! Well structured and meets all requirements.',
      daysAgo: 1,
    },
  ];

  const usedPairs = new Set();
  let created = 0;

  for (let i = 0; i < SUBMISSION_DEFS.length; i += 1) {
    const def = SUBMISSION_DEFS[i];
    const assignment = assignments[i % assignments.length];

    // Prefer a student actually enrolled in this assignment's own batch;
    // fall back to any other real student rather than reusing the same
    // (assignment, student) pair twice (that pair is unique on Submission).
    // eslint-disable-next-line no-await-in-loop
    const enrollments = await Enrollment.find({ batch: assignment.batch });
    let studentId = enrollments.map((e) => e.student).find((id) => !usedPairs.has(`${assignment._id}:${id}`));
    if (!studentId) {
      // eslint-disable-next-line no-await-in-loop
      const fallbackStudents = await Student.find({}).limit(20);
      studentId = fallbackStudents.map((s) => s._id).find((id) => !usedPairs.has(`${assignment._id}:${id}`));
    }
    if (!studentId) continue;
    usedPairs.add(`${assignment._id}:${studentId}`);

    const submittedAt = new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000);
    // eslint-disable-next-line no-await-in-loop
    const trainer = def.feedback ? await Trainer.findById(assignment.trainer) : null;

    // eslint-disable-next-line no-await-in-loop
    await Submission.findOneAndUpdate(
      { assignment: assignment._id, student: studentId },
      {
        $set: {
          assignment: assignment._id,
          student: studentId,
          description: def.description,
          links: def.links,
          files: def.files,
          submittedAt,
          status: def.status,
          ...(def.feedback
            ? { feedback: def.feedback, feedbackBy: trainer?.user, feedbackAt: new Date(submittedAt.getTime() + 60 * 60 * 1000) }
            : {}),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    created += 1;
  }

  return { created };
};

const CITY_DEFS = [
  { name: 'Karachi', province: 'Sindh' },
  { name: 'Lahore', province: 'Punjab' },
  { name: 'Islamabad', province: 'Islamabad Capital Territory' },
  { name: 'Faisalabad', province: 'Punjab' },
];

const COURSE_DEFS = [
  { name: 'Web Development', code: 'WEBDEV', durationInMonths: 6, fee: 45000 },
  { name: 'Mobile App Development', code: 'MOBDEV', durationInMonths: 6, fee: 50000 },
  { name: 'Graphic Designing', code: 'GFXDS', durationInMonths: 4, fee: 30000 },
  { name: 'Digital Marketing', code: 'DGMKT', durationInMonths: 3, fee: 25000 },
  { name: 'Cloud Computing', code: 'CLDCMP', durationInMonths: 5, fee: 55000 },
  { name: 'Cyber Security', code: 'CYBRSEC', durationInMonths: 6, fee: 60000 },
];

const SLOT_DEFS = [
  { label: 'Morning 9-11', startTime: '09:00', endTime: '11:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], isActive: true },
  { label: 'Afternoon 12-2', startTime: '12:00', endTime: '14:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], isActive: true },
  { label: 'Evening 4-6', startTime: '16:00', endTime: '18:00', days: ['Mon', 'Wed', 'Fri'], isActive: true },
  { label: 'Evening 6-8', startTime: '18:00', endTime: '20:00', days: ['Tue', 'Thu', 'Sat'], isActive: false },
];

const ENROLLMENT_STATUS_CYCLE = [
  'enrolled',
  'enrolled',
  'completed',
  'pending',
  'enrolled',
  'dropout',
  'enrolled',
  'approved',
  'enrolled',
  'certified',
];

const seedDemoData = async () => {
  const cities = await upsertMany(City, ['name'], CITY_DEFS);
  const cityByName = Object.fromEntries(cities.map((c) => [c.name, c]));

  const campusDefs = [
    { name: 'Karachi Main Campus', city: cityByName.Karachi._id, address: 'Shahrah-e-Faisal, Karachi' },
    { name: 'Karachi North Campus', city: cityByName.Karachi._id, address: 'North Nazimabad, Karachi' },
    { name: 'Lahore Gulberg Campus', city: cityByName.Lahore._id, address: 'Gulberg III, Lahore' },
    { name: 'Islamabad Blue Area Campus', city: cityByName.Islamabad._id, address: 'Blue Area, Islamabad' },
    { name: 'Faisalabad Campus', city: cityByName.Faisalabad._id, address: 'Susan Road, Faisalabad' },
  ];
  const campuses = await upsertMany(Campus, ['name'], campusDefs);

  const courses = await upsertMany(Course, ['code'], COURSE_DEFS);

  const slots = await upsertMany(Slot, ['label'], SLOT_DEFS);
  const activeSlots = slots.filter((s) => s.isActive);

  const trainers = [];
  for (let i = 0; i < 6; i += 1) {
    const email = `trainer${i + 1}@titan.com`;
    // eslint-disable-next-line no-await-in-loop
    const user = await findOrCreateUser({
      name: `Trainer ${i + 1}`,
      email,
      password: 'Trainer123',
      role: ROLES.TRAINER,
      phone: `030000000${i}`,
    });

    const campus = campuses[i % campuses.length];
    const course = courses[i % courses.length];
    // eslint-disable-next-line no-await-in-loop
    const trainer = await Trainer.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          user: user._id,
          campuses: [campus._id],
          specialization: [course.name],
          courses: [course._id],
          qualification: 'MSc Computer Science',
          hourlyRate: 1500 + i * 100,
          bio: `<p>${course.name} instructor with hands-on industry experience.</p>`,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    trainers.push(trainer);
  }

  const batchDefs = courses.flatMap((course, courseIndex) => {
    const campus = campuses[courseIndex % campuses.length];
    const trainer = trainers[courseIndex % trainers.length];
    const slot = activeSlots[courseIndex % activeSlots.length];

    return [
      {
        batchCode: `${course.code}-B1`,
        course: course._id,
        campus: campus._id,
        trainer: trainer._id,
        slot: slot._id,
        startDate: new Date('2026-02-01'),
        capacity: 30,
        status: 'ongoing',
        registrationOpen: courseIndex % 3 !== 0,
      },
      {
        batchCode: `${course.code}-B2`,
        course: course._id,
        campus: campuses[(courseIndex + 1) % campuses.length]._id,
        trainer: trainers[(courseIndex + 1) % trainers.length]._id,
        slot: activeSlots[(courseIndex + 1) % activeSlots.length]._id,
        startDate: new Date('2026-05-01'),
        capacity: 25,
        status: 'upcoming',
        registrationOpen: true,
      },
    ];
  });
  const batches = await upsertMany(Batch, ['batchCode'], batchDefs);

  const students = [];
  const studentUsers = [];
  const cityList = Object.values(cityByName);
  for (let i = 0; i < 36; i += 1) {
    const email = `student${i + 1}@titan.com`;
    // eslint-disable-next-line no-await-in-loop
    const user = await findOrCreateUser({
      name: `Student ${i + 1}`,
      email,
      password: 'Student123',
      role: ROLES.STUDENT,
      phone: `031100000${i}`,
    });
    studentUsers.push(user);

    const qualifications = ['matric', 'intermediate', 'bachelors', 'masters'];
    const employmentStatuses = ['unemployed', 'employed', 'self_employed', 'student'];

    // eslint-disable-next-line no-await-in-loop
    const student = await Student.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          user: user._id,
          fatherName: `Father of Student ${i + 1}`,
          gender: i % 2 === 0 ? 'male' : 'female',
          city: cityList[i % cityList.length]._id,
          isActive: true,
          cnic: `${(42000 + i).toString().padStart(5, '0')}-${(1000000 + i).toString().padStart(7, '0')}-${i % 10}`,
          highestQualification: qualifications[i % qualifications.length],
          institute: `Institute of ${cityList[i % cityList.length].name}`,
          yearOfCompletion: 2018 + (i % 6),
          employmentStatus: employmentStatuses[i % employmentStatuses.length],
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    students.push(student);
  }

  let enrollmentCount = 0;
  for (let i = 0; i < students.length; i += 1) {
    const primaryBatch = batches[i % batches.length];
    const status = ENROLLMENT_STATUS_CYCLE[i % ENROLLMENT_STATUS_CYCLE.length];

    // eslint-disable-next-line no-await-in-loop
    await Enrollment.findOneAndUpdate(
      { student: students[i]._id, course: primaryBatch.course, batch: primaryBatch._id },
      {
        $set: {
          student: students[i]._id,
          course: primaryBatch.course,
          batch: primaryBatch._id,
          campus: primaryBatch.campus,
          trainer: primaryBatch.trainer,
          slot: primaryBatch.slot,
          rollNumber: `TP-${1000 + i}`,
          status,
          paymentStatus: status === 'enrolled' || status === 'completed' || status === 'certified' ? 'paid' : 'partial',
          admissionDate: new Date('2026-02-05'),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    enrollmentCount += 1;

    // Give roughly a third of students a second enrollment in a different
    // course/batch so "enrolled students" (distinct) differs from total
    // enrollment rows, and campus/course analytics have varied totals.
    if (i % 3 === 0) {
      const secondaryBatch = batches[(i + 4) % batches.length];
      if (secondaryBatch.batchCode !== primaryBatch.batchCode) {
        // eslint-disable-next-line no-await-in-loop
        await Enrollment.findOneAndUpdate(
          { student: students[i]._id, course: secondaryBatch.course, batch: secondaryBatch._id },
          {
            $set: {
              student: students[i]._id,
              course: secondaryBatch.course,
              batch: secondaryBatch._id,
              campus: secondaryBatch.campus,
              trainer: secondaryBatch.trainer,
              slot: secondaryBatch.slot,
              rollNumber: `TP-${2000 + i}`,
              status: 'enrolled',
              paymentStatus: 'paid',
              admissionDate: new Date('2026-03-10'),
            },
          },
          { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        enrollmentCount += 1;
      }
    }
  }

  const slotById = new Map(slots.map((s) => [s._id.toString(), s]));
  const STATUS_CYCLE = ['pending', 'verified', 'rejected', 'verified', 'pending'];
  let trainerAttendanceCount = 0;

  for (let t = 0; t < trainers.length; t += 1) {
    const trainer = trainers[t];
    const assignedBatch = batches.find((b) => b.trainer && b.trainer.toString() === trainer._id.toString());
    if (!assignedBatch) continue;
    const slot = assignedBatch.slot ? slotById.get(assignedBatch.slot.toString()) : null;
    if (!slot) continue;

    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);

    for (let d = 0; d < 5; d += 1) {
      const date = new Date();
      date.setDate(date.getDate() - (d + 1));
      date.setHours(0, 0, 0, 0);

      // Every third record arrives 20 minutes late; the rest are on time.
      const lateOffset = d % 3 === 0 ? 20 : 0;
      const checkInTime = new Date(date);
      checkInTime.setHours(startHour, startMinute + lateOffset, 0, 0);
      const checkOutTime = new Date(date);
      checkOutTime.setHours(endHour, endMinute, 0, 0);

      // eslint-disable-next-line no-await-in-loop
      await TrainerAttendance.findOneAndUpdate(
        { trainer: trainer._id, batch: assignedBatch._id, date },
        {
          $set: {
            trainer: trainer._id,
            batch: assignedBatch._id,
            date,
            checkInTime,
            checkOutTime,
            durationMinutes: Math.round((checkOutTime - checkInTime) / 60000),
            expectedStartTime: slot.startTime,
            isLate: lateOffset > 10,
            lateMinutes: lateOffset > 10 ? lateOffset : 0,
            status: STATUS_CYCLE[d % STATUS_CYCLE.length],
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      );
      trainerAttendanceCount += 1;
    }
  }

  const submissionResult = await seedSampleSubmissions();

  return {
    cities: cities.length,
    campuses: campuses.length,
    courses: courses.length,
    slots: slots.length,
    trainers: trainers.length,
    batches: batches.length,
    students: students.length,
    enrollments: enrollmentCount,
    trainerAttendance: trainerAttendanceCount,
    submissions: submissionResult,
  };
};

module.exports = seedDemoData;
