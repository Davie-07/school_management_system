const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  targetAudience: {
    roles: [{
      type: String,
      enum: ['all', 'student', 'teacher', 'admin', 'finance', 'gatepass']
    }],
    courses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    }],
    levels: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Level'
    }],
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

announcementSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
announcementSchema.index({ 'targetAudience.roles': 1 });
announcementSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
