const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
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
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examType: {
    type: String,
    enum: ['CAT', 'midterm', 'final', 'supplementary', 'special'],
    required: true
  },
  term: {
    type: String,
    required: true // e.g., "Term 1 2025"
  },
  totalMarks: {
    type: Number,
    required: true,
    default: 100
  },
  passMark: {
    type: Number,
    required: true,
    default: 50
  },
  date: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    default: 120
  },
  venue: {
    type: String
  },
  instructions: {
    type: String
  },
  results: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    score: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number
    },
    grade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    remarks: {
      type: String
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    markedAt: {
      type: Date
    },
    published: {
      type: Boolean,
      default: false
    },
    publishedAt: {
      type: Date
    },
    misprints: [{
      reportedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      issue: String,
      reportedAt: Date,
      resolved: {
        type: Boolean,
        default: false
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolvedAt: Date,
      resolution: String
    }]
  }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'marked', 'published', 'cancelled'],
    default: 'scheduled'
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

// Calculate grade based on percentage
examSchema.methods.calculateGrade = function(percentage) {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

examSchema.index({ course: 1, level: 1, examType: 1, term: 1 });
examSchema.index({ teacher: 1, date: 1 });
examSchema.index({ 'results.student': 1 });

module.exports = mongoose.model('Exam', examSchema);
