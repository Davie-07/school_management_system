const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  duration: {
    type: String, // e.g., "3 years", "2 years"
    required: true
  },
  levels: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level'
  }],
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  units: [{
    name: String,
    code: String,
    description: String,
    creditHours: Number
  }],
  fees: {
    total: {
      type: Number,
      default: 0
    },
    perTerm: {
      type: Number,
      default: 0
    },
    perYear: {
      type: Number,
      default: 0
    }
  },
  maxStudents: {
    type: Number,
    default: 100
  },
  currentEnrollment: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

courseSchema.index({ code: 1, name: 1 });
courseSchema.index({ status: 1 });

module.exports = mongoose.model('Course', courseSchema);
