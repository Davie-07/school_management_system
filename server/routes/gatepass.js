const express = require('express');
const router = express.Router();
const Gatepass = require('../models/Gatepass');
const Fee = require('../models/Fee');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { generateReceiptNumber, isWithinOperatingHours, getDayOfWeek } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');

// @route   POST /api/gatepass/verify
// @desc    Verify student for gatepass
// @access  Private/Gatepass
router.post('/verify', protect, authorize('gatepass', 'admin'), async (req, res) => {
  try {
    const { admissionNumber } = req.body;

    // Check operating hours
    const operatingStatus = isWithinOperatingHours();
    if (!operatingStatus.isOpen) {
      return res.status(400).json({
        success: false,
        message: operatingStatus.message
      });
    }

    // Find student
    const student = await User.findOne({ 
      admissionNumber: admissionNumber.toUpperCase(),
      role: 'student' 
    }).populate('course level');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found with this admission number'
      });
    }

    // Check for recent gatepass (prevent duplicates within 2 hours)
    const recentGatepass = await Gatepass.findOne({
      student: student._id,
      verificationTime: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      verificationStatus: 'verified'
    });

    if (recentGatepass) {
      return res.status(400).json({
        success: false,
        message: 'A gatepass was already issued within the last 2 hours',
        gatepass: recentGatepass
      });
    }

    // Get current fee status
    const currentFee = await Fee.findOne({
      student: student._id,
      academicYear: new Date().getFullYear().toString(),
      term: `Term ${Math.floor((new Date().getMonth() / 4) + 1)}`
    });

    if (!currentFee) {
      return res.status(400).json({
        success: false,
        message: 'No fee record found for current term'
      });
    }

    // Check gatepass permission
    let verificationStatus = 'denied';
    let message = '';
    let allowedUntil = null;

    if (currentFee.paymentStatus === 'paid') {
      verificationStatus = 'verified';
      message = `${student.fullName} has been verified at ${new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })}`;
    } else if (currentFee.gatepassStatus.allowed) {
      verificationStatus = 'verified';
      allowedUntil = currentFee.gatepassStatus.allowedUntil;
      
      if (allowedUntil && new Date(allowedUntil) < new Date()) {
        verificationStatus = 'denied';
        message = 'Gatepass permission has expired';
      } else {
        const allowedDate = allowedUntil ? 
          new Date(allowedUntil).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }) : 'end of term';
        message = `${student.fullName} has been verified, allowed until ${allowedDate}`;
      }
    } else {
      verificationStatus = 'denied';
      message = `${student.fullName} - Verification denied: Unpaid fees (Balance: KES ${currentFee.balance})`;
    }

    // Create gatepass record
    const gatepassData = {
      student: student._id,
      admissionNumber: student.admissionNumber,
      verificationCode: uuidv4().substring(0, 8).toUpperCase(),
      receiptNumber: generateReceiptNumber(),
      verifiedBy: req.user._id,
      verificationStatus,
      paymentStatus: currentFee.paymentStatus,
      feeDetails: {
        totalAmount: currentFee.totalAmount,
        paidAmount: currentFee.totalPaid,
        balance: currentFee.balance,
        allowedUntil
      },
      message
    };

    const gatepass = await Gatepass.create(gatepassData);
    
    await gatepass.populate('student verifiedBy');

    res.status(200).json({
      success: verificationStatus === 'verified',
      message,
      data: {
        gatepass,
        student: {
          name: student.fullName,
          admissionNumber: student.admissionNumber,
          course: student.course?.name,
          level: student.level?.name
        },
        receipt: verificationStatus === 'verified' ? {
          number: gatepass.receiptNumber,
          code: gatepass.verificationCode,
          validUntil: gatepass.expiryTime
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying student',
      error: error.message
    });
  }
});

// @route   GET /api/gatepass/receipt/:code
// @desc    Get gatepass receipt by code
// @access  Private
router.get('/receipt/:code', protect, async (req, res) => {
  try {
    const gatepass = await Gatepass.findOne({
      verificationCode: req.params.code.toUpperCase()
    })
    .populate('student', 'firstName lastName admissionNumber course level')
    .populate('verifiedBy', 'firstName lastName');

    if (!gatepass) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Check if expired
    if (new Date() > new Date(gatepass.expiryTime)) {
      gatepass.verificationStatus = 'expired';
      await gatepass.save();
      
      return res.status(400).json({
        success: false,
        message: 'This receipt has expired'
      });
    }

    res.status(200).json({
      success: true,
      data: gatepass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching receipt',
      error: error.message
    });
  }
});

// @route   POST /api/gatepass/use/:code
// @desc    Mark gatepass as used
// @access  Private/Gatepass
router.post('/use/:code', protect, authorize('gatepass', 'admin'), async (req, res) => {
  try {
    const gatepass = await Gatepass.findOne({
      verificationCode: req.params.code.toUpperCase(),
      verificationStatus: 'verified'
    });

    if (!gatepass) {
      return res.status(404).json({
        success: false,
        message: 'Valid gatepass not found'
      });
    }

    // Check if already used
    if (gatepass.usedAt) {
      return res.status(400).json({
        success: false,
        message: 'This gatepass has already been used',
        usedAt: gatepass.usedAt
      });
    }

    // Check if expired
    if (new Date() > new Date(gatepass.expiryTime)) {
      gatepass.verificationStatus = 'expired';
      await gatepass.save();
      
      return res.status(400).json({
        success: false,
        message: 'This gatepass has expired'
      });
    }

    // Mark as used
    gatepass.usedAt = Date.now();
    gatepass.verificationStatus = 'used';
    await gatepass.save();

    res.status(200).json({
      success: true,
      message: 'Gatepass marked as used successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking gatepass as used',
      error: error.message
    });
  }
});

// @route   GET /api/gatepass/history
// @desc    Get gatepass history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const { student, date, status } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.student = req.user._id;
    }
    
    // Apply additional filters
    if (student) query.student = student;
    if (status) query.verificationStatus = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.verificationTime = { $gte: startDate, $lt: endDate };
    }

    const gatepasses = await Gatepass.find(query)
      .populate('student', 'firstName lastName admissionNumber')
      .populate('verifiedBy', 'firstName lastName')
      .sort('-verificationTime')
      .limit(100);

    res.status(200).json({
      success: true,
      count: gatepasses.length,
      data: gatepasses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching gatepass history',
      error: error.message
    });
  }
});

// @route   GET /api/gatepass/today
// @desc    Get today's verifications
// @access  Private/Gatepass/Admin
router.get('/today', protect, authorize('gatepass', 'admin'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const verifications = await Gatepass.find({
      verificationTime: { $gte: today, $lt: tomorrow }
    })
    .populate('student', 'firstName lastName admissionNumber course level')
    .populate('verifiedBy', 'firstName lastName')
    .sort('-verificationTime');

    // Calculate statistics
    const stats = {
      total: verifications.length,
      verified: verifications.filter(v => v.verificationStatus === 'verified').length,
      denied: verifications.filter(v => v.verificationStatus === 'denied').length,
      used: verifications.filter(v => v.usedAt).length,
      pending: verifications.filter(v => v.verificationStatus === 'verified' && !v.usedAt).length
    };

    res.status(200).json({
      success: true,
      date: today.toDateString(),
      stats,
      data: verifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s verifications',
      error: error.message
    });
  }
});

// @route   GET /api/gatepass/stats
// @desc    Get gatepass statistics
// @access  Private/Gatepass/Admin
router.get('/stats', protect, authorize('gatepass', 'admin', 'finance'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateQuery = {};
    if (startDate || endDate) {
      dateQuery.verificationTime = {};
      if (startDate) dateQuery.verificationTime.$gte = new Date(startDate);
      if (endDate) dateQuery.verificationTime.$lte = new Date(endDate);
    }

    const [totalStats, dailyStats] = await Promise.all([
      // Overall statistics
      Gatepass.aggregate([
        { $match: dateQuery },
        {
          $group: {
            _id: '$verificationStatus',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Daily statistics
      Gatepass.aggregate([
        { $match: dateQuery },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$verificationTime' } },
              status: '$verificationStatus'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': -1 } }
      ])
    ]);

    // Process results
    const statistics = {
      overall: {
        verified: 0,
        denied: 0,
        expired: 0,
        used: 0,
        total: 0
      },
      daily: {}
    };

    // Process overall stats
    totalStats.forEach(stat => {
      statistics.overall[stat._id] = stat.count;
      statistics.overall.total += stat.count;
    });

    // Process daily stats
    dailyStats.forEach(stat => {
      if (!statistics.daily[stat._id.date]) {
        statistics.daily[stat._id.date] = {
          verified: 0,
          denied: 0,
          total: 0
        };
      }
      statistics.daily[stat._id.date][stat._id.status] = stat.count;
      statistics.daily[stat._id.date].total += stat.count;
    });

    res.status(200).json({
      success: true,
      period: {
        start: startDate || 'All time',
        end: endDate || 'Current'
      },
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// @route   POST /api/gatepass/student-receipt
// @desc    Generate temporary security receipt for student
// @access  Private/Student
router.post('/student-receipt', protect, authorize('student'), async (req, res) => {
  try {
    // Check operating hours
    const operatingStatus = isWithinOperatingHours();
    if (!operatingStatus.isOpen) {
      return res.status(400).json({
        success: false,
        message: operatingStatus.message
      });
    }

    // Check for recent receipt
    const recentReceipt = await Gatepass.findOne({
      student: req.user._id,
      verificationTime: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      verificationStatus: 'verified'
    });

    if (recentReceipt && new Date() < new Date(recentReceipt.expiryTime)) {
      return res.status(200).json({
        success: true,
        message: 'You already have an active security receipt',
        data: {
          receiptNumber: recentReceipt.receiptNumber,
          code: recentReceipt.verificationCode,
          expiryTime: recentReceipt.expiryTime
        }
      });
    }

    // Get current fee status
    const currentFee = await Fee.findOne({
      student: req.user._id,
      academicYear: new Date().getFullYear().toString(),
      term: `Term ${Math.floor((new Date().getMonth() / 4) + 1)}`
    });

    if (!currentFee) {
      return res.status(400).json({
        success: false,
        message: 'No fee record found for current term'
      });
    }

    // Check if allowed
    if (currentFee.paymentStatus === 'unpaid' && !currentFee.gatepassStatus.allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to generate a security receipt due to unpaid fees'
      });
    }

    // Create receipt
    const gatepassData = {
      student: req.user._id,
      admissionNumber: req.user.admissionNumber,
      verificationCode: uuidv4().substring(0, 8).toUpperCase(),
      receiptNumber: generateReceiptNumber(),
      verifiedBy: req.user._id, // Self-generated
      verificationStatus: 'verified',
      paymentStatus: currentFee.paymentStatus,
      feeDetails: {
        totalAmount: currentFee.totalAmount,
        paidAmount: currentFee.totalPaid,
        balance: currentFee.balance,
        allowedUntil: currentFee.gatepassStatus.allowedUntil
      },
      message: `Security receipt generated for ${req.user.fullName}`
    };

    const gatepass = await Gatepass.create(gatepassData);

    res.status(201).json({
      success: true,
      message: 'Security receipt generated successfully',
      data: {
        receiptNumber: gatepass.receiptNumber,
        code: gatepass.verificationCode,
        expiryTime: gatepass.expiryTime,
        validFor: '2 hours'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating security receipt',
      error: error.message
    });
  }
});

module.exports = router;
