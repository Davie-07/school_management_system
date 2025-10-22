const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const User = require('../models/User');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const { generateReceiptNumber, getCurrentAcademicYear, getCurrentTerm } = require('../utils/helpers');

// @route   GET /api/fees
// @desc    Get fees
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { student, academicYear, term, paymentStatus, course } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.student = req.user._id;
    }
    
    // Apply additional filters
    if (student) query.student = student;
    if (academicYear) query.academicYear = academicYear;
    if (term) query.term = term;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (course) query.course = course;

    const fees = await Fee.find(query)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('course level')
      .populate('payments.receivedBy', 'firstName lastName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: fees.length,
      data: fees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fees',
      error: error.message
    });
  }
});

// @route   GET /api/fees/:id
// @desc    Get single fee record
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate('student', 'firstName lastName admissionNumber email phoneNumber')
      .populate('course level')
      .populate('payments.receivedBy', 'firstName lastName')
      .populate('gatepassStatus.updatedBy', 'firstName lastName');

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found'
      });
    }

    // Check authorization
    if (req.user.role === 'student' && fee.student._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this fee record'
      });
    }

    res.status(200).json({
      success: true,
      data: fee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fee record',
      error: error.message
    });
  }
});

// @route   POST /api/fees
// @desc    Create fee record for student
// @access  Private/Finance/Admin
router.post('/', protect, authorize('finance', 'admin'), async (req, res) => {
  try {
    const {
      student,
      academicYear = getCurrentAcademicYear(),
      term = getCurrentTerm(),
      course,
      level,
      feeStructure
    } = req.body;

    // Check if fee record already exists
    const existingFee = await Fee.findOne({
      student,
      academicYear,
      term
    });

    if (existingFee) {
      return res.status(400).json({
        success: false,
        message: 'Fee record already exists for this student and term'
      });
    }

    // Get course fee structure if not provided
    let finalFeeStructure = feeStructure;
    if (!feeStructure && course) {
      const courseData = await Course.findById(course);
      if (courseData && courseData.fees) {
        finalFeeStructure = {
          tuition: courseData.fees.perTerm || 0,
          registration: 2000,
          library: 1500,
          laboratory: 3000,
          examination: 2500,
          medical: 1000,
          activity: 500,
          other: 0
        };
      }
    }

    const feeData = {
      student,
      academicYear,
      term,
      course,
      level,
      feeStructure: finalFeeStructure,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };

    const fee = await Fee.create(feeData);
    
    await fee.populate('student course level');

    res.status(201).json({
      success: true,
      message: 'Fee record created successfully',
      data: fee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating fee record',
      error: error.message
    });
  }
});

// @route   POST /api/fees/:id/payment
// @desc    Record fee payment
// @access  Private/Finance/Admin
router.post('/:id/payment', protect, authorize('finance', 'admin'), async (req, res) => {
  try {
    const { amount, paymentMethod, referenceNumber, notes } = req.body;

    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found'
      });
    }

    // Generate receipt number
    const receiptNumber = generateReceiptNumber();

    // Add payment
    fee.payments.push({
      amount,
      paymentMethod,
      referenceNumber,
      receiptNumber,
      receivedBy: req.user._id,
      paymentDate: Date.now(),
      notes
    });

    // Save to trigger pre-save hook for calculations
    await fee.save();
    
    await fee.populate('student course level payments.receivedBy');

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      receiptNumber,
      data: fee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error recording payment',
      error: error.message
    });
  }
});

// @route   PUT /api/fees/:id/gatepass
// @desc    Update gatepass status
// @access  Private/Finance/Admin
router.put('/:id/gatepass', protect, authorize('finance', 'admin'), async (req, res) => {
  try {
    const { allowed, allowedUntil, reason } = req.body;

    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found'
      });
    }

    // Update gatepass status
    fee.gatepassStatus = {
      allowed,
      allowedUntil: allowed && allowedUntil ? new Date(allowedUntil) : null,
      reason,
      updatedBy: req.user._id,
      lastUpdated: Date.now()
    };

    await fee.save();
    
    await fee.populate('student course level gatepassStatus.updatedBy');

    res.status(200).json({
      success: true,
      message: `Gatepass ${allowed ? 'allowed' : 'denied'} successfully`,
      data: fee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating gatepass status',
      error: error.message
    });
  }
});

// @route   GET /api/fees/student/:studentId
// @desc    Get all fee records for a student
// @access  Private
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Check authorization
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these fee records'
      });
    }

    const fees = await Fee.find({ student: studentId })
      .populate('course level')
      .populate('payments.receivedBy', 'firstName lastName')
      .sort('-academicYear -term');

    // Calculate totals
    const summary = {
      totalFees: 0,
      totalPaid: 0,
      totalBalance: 0,
      records: fees
    };

    fees.forEach(fee => {
      summary.totalFees += fee.totalAmount;
      summary.totalPaid += fee.totalPaid;
      summary.totalBalance += fee.balance;
    });

    res.status(200).json({
      success: true,
      count: fees.length,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student fee records',
      error: error.message
    });
  }
});

// @route   GET /api/fees/reports/defaulters
// @desc    Get fee defaulters report
// @access  Private/Finance/Admin
router.get('/reports/defaulters', protect, authorize('finance', 'admin'), async (req, res) => {
  try {
    const { course, level, minimumBalance = 1000 } = req.query;

    let query = {
      balance: { $gte: minimumBalance },
      academicYear: getCurrentAcademicYear(),
      term: getCurrentTerm()
    };

    if (course) query.course = course;
    if (level) query.level = level;

    const defaulters = await Fee.find(query)
      .populate('student', 'firstName lastName admissionNumber email phoneNumber')
      .populate('course', 'name code')
      .populate('level', 'name')
      .sort('-balance');

    const summary = {
      totalDefaulters: defaulters.length,
      totalOutstanding: defaulters.reduce((sum, fee) => sum + fee.balance, 0),
      defaulters
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating defaulters report',
      error: error.message
    });
  }
});

// @route   GET /api/fees/reports/collection
// @desc    Get fee collection report
// @access  Private/Finance/Admin
router.get('/reports/collection', protect, authorize('finance', 'admin'), async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;

    let matchStage = {};
    
    if (startDate || endDate) {
      matchStage['payments.paymentDate'] = {};
      if (startDate) matchStage['payments.paymentDate'].$gte = new Date(startDate);
      if (endDate) matchStage['payments.paymentDate'].$lte = new Date(endDate);
    }
    
    if (paymentMethod) {
      matchStage['payments.paymentMethod'] = paymentMethod;
    }

    const fees = await Fee.find(matchStage)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('payments.receivedBy', 'firstName lastName');

    // Calculate collection summary
    let totalCollection = 0;
    const byMethod = {};
    const dailyCollection = {};

    fees.forEach(fee => {
      fee.payments.forEach(payment => {
        // Filter by date if specified
        if (startDate && new Date(payment.paymentDate) < new Date(startDate)) return;
        if (endDate && new Date(payment.paymentDate) > new Date(endDate)) return;
        if (paymentMethod && payment.paymentMethod !== paymentMethod) return;

        totalCollection += payment.amount;
        
        // Group by payment method
        byMethod[payment.paymentMethod] = (byMethod[payment.paymentMethod] || 0) + payment.amount;
        
        // Group by date
        const dateKey = new Date(payment.paymentDate).toISOString().split('T')[0];
        dailyCollection[dateKey] = (dailyCollection[dateKey] || 0) + payment.amount;
      });
    });

    res.status(200).json({
      success: true,
      data: {
        totalCollection,
        collectionByMethod: byMethod,
        dailyCollection,
        period: {
          start: startDate || 'All time',
          end: endDate || 'Current'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating collection report',
      error: error.message
    });
  }
});

// @route   POST /api/fees/:id/waiver
// @desc    Apply fee waiver
// @access  Private/Admin
router.post('/:id/waiver', protect, authorize('admin'), async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: 'Fee record not found'
      });
    }

    // Add waiver
    fee.waivers.push({
      amount,
      reason,
      approvedBy: req.user._id,
      approvedDate: Date.now()
    });

    // Update total amount
    fee.totalAmount -= amount;
    
    // Recalculate balance
    await fee.save();
    
    await fee.populate('student course level waivers.approvedBy');

    res.status(200).json({
      success: true,
      message: 'Fee waiver applied successfully',
      data: fee
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error applying fee waiver',
      error: error.message
    });
  }
});

module.exports = router;
