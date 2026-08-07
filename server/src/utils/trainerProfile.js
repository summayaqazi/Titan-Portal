// Shared between auth.controller.js (embeds this in login/getMe so the
// Trainer portal gets its profile data for free from the existing auth
// flow) and trainerPortal.controller.js (returns the same shape after an
// edit) — one definition, no duplicated field lists.

// Derived, not stored — always a real, deterministic value tied to the
// actual Mongo _id rather than a separate field that would sit blank until
// some future admin-side "assign employee ID" feature exists.
const deriveEmployeeId = (trainerId) => `TRN-${trainerId.toString().slice(-6).toUpperCase()}`;

const toTrainerProfile = (trainer) => ({
  trainerId: trainer._id,
  employeeId: deriveEmployeeId(trainer._id),
  hourlyRate: trainer.hourlyRate,
  bio: trainer.bio,
  socialLinks: trainer.socialLinks,
  profileImage: trainer.profileImage,
  qualification: trainer.qualification,
  specialization: trainer.specialization,
  campuses: trainer.campuses,
  courses: trainer.courses,
});

module.exports = { deriveEmployeeId, toTrainerProfile };
