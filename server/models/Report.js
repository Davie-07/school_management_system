const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportType: {
    type: String,
    enum: ['exam_misprint', 'suggestion', 'complaint', 'technical_issue', 'other'],
    required: true
  },
  targetDashboard: {
    type: String,
    enum: ['admin', 'teacher', 'finance', 'general'],
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Specific teacher or admin if applicable
  },
  relatedExam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam' // For exam misprint reports
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_review', 'resolved', 'rejected', 'archived'],
    default: 'pending'
  },
  response: {
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    respondedAt: Date,
    action: String // Action taken to resolve the issue
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
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

reportSchema.index({ reporter: 1, status: 1 });
reportSchema.index({ reportType: 1, targetDashboard: 1 });
reportSchema.index({ status: 1, priority: -1 });

module.exports = mongoose.model('Report', reportSchema);
