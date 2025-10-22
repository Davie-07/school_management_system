const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  middleName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin', 'finance', 'gatepass'],
    required: true
  },
  admissionNumber: {
    type: String,
    unique: true,
    sparse: true, // Only required for students
    uppercase: true
  },
  accountId: {
    type: String,
    unique: true,
    sparse: true // 6-digit ID for non-student accounts
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Level'
  },
  assignedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }], // For teachers
  profilePicture: {
    type: String,
    default: null
  },
  phoneNumber: {
    type: String
  },
  address: {
    type: String
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'graduated', 'inactive'],
    default: 'active'
  },
  termsAccepted: {
    type: Boolean,
    default: false
  },
  passwordResetCode: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
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

// Index for better query performance
userSchema.index({ email: 1, role: 1 });
userSchema.index({ admissionNumber: 1 });
userSchema.index({ accountId: 1 });
userSchema.index({ course: 1, level: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.middleName || ''} ${this.lastName}`.trim();
});

module.exports = mongoose.model('User', userSchema);
