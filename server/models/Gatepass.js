const mongoose = require('mongoose');

const gatepassSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admissionNumber: {
    type: String,
    required: true,
    uppercase: true
  },
  verificationCode: {
    type: String,
    required: true,
    unique: true
  },
  receiptNumber: {
    type: String,
    required: true,
    unique: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verificationTime: {
    type: Date,
    default: Date.now
  },
  verificationDay: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    required: true
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'denied', 'expired', 'used'],
    default: 'verified'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    required: true
  },
  feeDetails: {
    totalAmount: Number,
    paidAmount: Number,
    balance: Number,
    allowedUntil: Date // For partial payments
  },
  message: {
    type: String,
    required: true // Verification message displayed
  },
  expiryTime: {
    type: Date,
    required: true // 2 hours from creation
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  usedAt: {
    type: Date // When the student actually passed through the gate
  },
  duplicateAttempts: [{
    attemptTime: Date,
    deniedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }],
  operatingHours: {
    start: {
      type: String,
      default: '06:00'
    },
    end: {
      type: String,
      default: '17:00'
    }
  },
  notes: {
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

// Set expiry time (2 hours from creation)
gatepassSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiryTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    
    // Get day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const dayName = days[today.getDay()];
    
    // Only allow Monday-Friday
    if (dayName === 'Sunday' || dayName === 'Saturday') {
      return next(new Error('Gatepass can only be issued Monday through Friday'));
    }
    
    this.verificationDay = dayName;
    
    // Check operating hours (6am - 5pm)
    const hours = today.getHours();
    if (hours < 6 || hours >= 17) {
      return next(new Error('Gatepass can only be issued between 6:00 AM and 5:00 PM'));
    }
  }
  next();
});

// Generate verification message
gatepassSchema.methods.generateMessage = function() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (this.paymentStatus === 'paid') {
    return `${this.student.fullName} has been verified at ${timeString}`;
  } else if (this.paymentStatus === 'partial' && this.feeDetails.allowedUntil) {
    const allowedDate = new Date(this.feeDetails.allowedUntil).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    return `${this.student.fullName} has been verified, allowed until ${allowedDate}`;
  } else {
    return `${this.student.fullName} - Verification denied: Unpaid fees`;
  }
};

gatepassSchema.index({ student: 1, verificationTime: -1 });
gatepassSchema.index({ admissionNumber: 1 });
gatepassSchema.index({ verificationCode: 1 });
gatepassSchema.index({ receiptNumber: 1 });
gatepassSchema.index({ expiryTime: 1 });
gatepassSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('Gatepass', gatepassSchema);
