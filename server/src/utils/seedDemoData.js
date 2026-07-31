const User = require('../models/User');
const Student = require('../models/Student');
const Trainer = require('../models/Trainer');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Campus = require('../models/Campus');
const City = require('../models/City');
const Slot = require('../models/Slot');
const Enrollment = require('../models/Enrollment');
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
    // eslint-disable-next-line no-await-in-loop
    const trainer = await Trainer.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          user: user._id,
          campus: campus._id,
          specialization: [courses[i % courses.length].name],
          qualification: 'MSc Computer Science',
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

  return {
    cities: cities.length,
    campuses: campuses.length,
    courses: courses.length,
    slots: slots.length,
    trainers: trainers.length,
    batches: batches.length,
    students: students.length,
    enrollments: enrollmentCount,
  };
};

module.exports = seedDemoData;
