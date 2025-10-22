const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level',
    required: true
  },
  unit: {
    name: String,
    code: String
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true // Format: "09:00"
  },
  endTime: {
    type: String,
    required: true // Format: "11:00"
  },
  venue: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['lecture', 'lab', 'tutorial', 'exam', 'assignment', 'event'],
    default: 'lecture'
  },
  recurringPattern: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  recurringEndDate: {
    type: Date
  },
  attendees: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'absent'
    },
    markedAt: Date
  }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  notes: {
    type: String
  },
  cancelReason: {
    type: String
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

scheduleSchema.index({ teacher: 1, date: 1 });
scheduleSchema.index({ course: 1, level: 1, date: 1 });
scheduleSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
