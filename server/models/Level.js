const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  year: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 2
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

levelSchema.index({ course: 1, year: 1, semester: 1 });

module.exports = mongoose.model('Level', levelSchema);
