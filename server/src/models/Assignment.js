const mongoose = require('mongoose');

// Schema only for now — the Trainer Dashboard needs a real (live) "Total
// Assignments" count. Full CRUD (controller/routes/UI) lands in the
// dedicated Assignments phase, which will extend this same model rather
// than create a new one.
const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    referenceLinks: [{ type: String, trim: true }],
    referenceImages: [{ type: String }],
    topic: { type: String, trim: true },
    dueDate: { type: Date },
    attachments: [{ type: String }],

    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assignment', assignmentSchema);
