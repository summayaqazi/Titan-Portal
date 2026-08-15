const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../utils/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.STUDENT,
      required: true,
      index: true,
    },
    phone: { type: String, trim: true },
    avatar: { type: String },
    // Optional campus assignment for campus-level roles (e.g. ADMIN) — drives
    // the Country/City/Campus display on the Profile page. Unused by
    // SUPER_ADMIN.
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  // A Student promoted from an approved Registration arrives here with its
  // password already bcrypt-hashed (Registration.passwordHash — hashed at
  // submission time so a pending Registration never stores a plaintext
  // password at rest; see registerAndEnroll in public.controller.js and
  // updateRegistrationStatus in registration.controller.js). Re-hashing an
  // already-hashed value here would corrupt it, so recognize a bcrypt hash
  // by its own format and pass it through unchanged instead. A real
  // plaintext password (every other caller of User.create/save) never
  // matches this pattern, so this is a no-op for them.
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
