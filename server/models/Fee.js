const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  academicYear: {
    type: String,
    required: true // e.g., "2025"
  },
  term: {
    type: String,
    required: true // e.g., "Term 1"
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
  feeStructure: {
    tuition: {
      type: Number,
      default: 0
    },
    registration: {
      type: Number,
      default: 0
    },
    library: {
      type: Number,
      default: 0
    },
    laboratory: {
      type: Number,
      default: 0
    },
    examination: {
      type: Number,
      default: 0
    },
    medical: {
      type: Number,
      default: 0
    },
    activity: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  totalAmount: {
    type: Number,
    required: true
  },
  payments: [{
    amount: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'mpesa', 'cheque', 'card'],
      required: true
    },
    referenceNumber: {
      type: String,
      required: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true
    },
    notes: String
  }],
  totalPaid: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid', 'overpaid'],
    default: 'unpaid'
  },
  dueDate: {
    type: Date,
    required: true
  },
  gatepassStatus: {
    allowed: {
      type: Boolean,
      default: false
    },
    allowedUntil: {
      type: Date
    },
    reason: {
      type: String
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastUpdated: {
      type: Date
    }
  },
  penalty: {
    amount: {
      type: Number,
      default: 0
    },
    reason: String,
    appliedDate: Date
  },
  waivers: [{
    amount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedDate: {
      type: Date,
      default: Date.now
    }
  }],
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

// Calculate totals before saving
feeSchema.pre('save', function(next) {
  // Calculate total fee amount
  const feeStructure = this.feeStructure;
  this.totalAmount = Object.values(feeStructure).reduce((sum, value) => sum + value, 0);
  
  // Calculate total paid
  this.totalPaid = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Calculate balance
  this.balance = this.totalAmount - this.totalPaid;
  
  // Update payment status
  if (this.balance <= 0) {
    this.paymentStatus = this.balance < 0 ? 'overpaid' : 'paid';
  } else if (this.totalPaid > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
  
  next();
});

feeSchema.index({ student: 1, academicYear: 1, term: 1 });
feeSchema.index({ paymentStatus: 1 });
feeSchema.index({ 'gatepassStatus.allowed': 1 });

module.exports = mongoose.model('Fee', feeSchema);
