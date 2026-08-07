const mongoose = require('mongoose');
const { PERMISSION_ACTIONS } = require('../utils/constants');

const permissionEntrySchema = new mongoose.Schema(
  {
    module: { type: String, required: true },
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, uppercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isSystem: { type: Boolean, default: false },
    permissions: [permissionEntrySchema],
  },
  { timestamps: true }
);

roleSchema.methods.can = function can(module, action) {
  if (!PERMISSION_ACTIONS.includes(action)) return false;
  const entry = this.permissions.find((p) => p.module === module);
  return Boolean(entry?.[action]);
};

module.exports = mongoose.model('Role', roleSchema);
