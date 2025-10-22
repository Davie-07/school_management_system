const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const Exam = require('../models/Exam');
const Fee = require('../models/Fee');
const Schedule = require('../models/Schedule');
const Announcement = require('../models/Announcement');
const Report = require('../models/Report');
const Gatepass = require('../models/Gatepass');
const Quote = require('../models/Quote');
const { protect } = require('../middleware/auth');
const { getDayOfWeek, getCurrentAcademicYear, getCurrentTerm } = require('../utils/helpers');

// @route   GET /api/dashboard/student
// @desc    Get student dashboard data
// @access  Private/Student
router.get('/student', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'This dashboard is for students only'
      });
    }

    const [
      examResults,
      feeStatus,
      upcomingSchedules,
      announcements,
      dailyQuote,
      attendance
    ] = await Promise.all([
      // Get recent exam results
      Exam.find({
        'results.student': req.user._id,
        'results.published': true
      })
      .select('title examType term date results')
      .sort('-date')
      .limit(5)
      .lean(),

      // Get current fee status
      Fee.findOne({
        student: req.user._id,
        academicYear: getCurrentAcademicYear(),
        term: getCurrentTerm()
      }),

      // Get upcoming schedules
      Schedule.find({
        course: req.user.course,
        level: req.user.level,
        date: { $gte: new Date() },
        status: { $ne: 'cancelled' }
      })
      .populate('teacher', 'firstName lastName')
      .sort('date startTime')
      .limit(10),

      // Get unread announcements count
      Announcement.countDocuments({
        status: 'published',
        'readBy.user': { $ne: req.user._id },
        $or: [
          { 'targetAudience.roles': 'all' },
          { 'targetAudience.roles': 'student' },
          { 'targetAudience.courses': req.user.course },
          { 'targetAudience.levels': req.user.level }
        ]
      }),

      // Get daily quote
      Quote.getDailyQuote(getDayOfWeek()),

      // Calculate attendance rate
      Schedule.aggregate([
        {
          $match: {
            course: req.user.course,
            level: req.user.level,
            date: { $lte: new Date() },
            status: 'completed'
          }
        },
        {
          $project: {
            attended: {
              $filter: {
                input: '$attendees',
                as: 'attendee',
                cond: {
                  $and: [
                    { $eq: ['$$attendee.student', req.user._id] },
                    { $in: ['$$attendee.status', ['present', 'late']] }
                  ]
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            attendedClasses: {
              $sum: { $cond: [{ $gt: [{ $size: '$attended' }, 0] }, 1, 0] }
            }
          }
        }
      ])
    ]);

    // Process exam results
    const processedResults = examResults.map(exam => {
      const studentResult = exam.results.find(
        r => r.student.toString() === req.user._id.toString()
      );
      return {
        title: exam.title,
        examType: exam.examType,
        term: exam.term,
        date: exam.date,
        score: studentResult?.score,
        percentage: studentResult?.percentage,
        grade: studentResult?.grade
      };
    });

    // Calculate average grade
    const validResults = processedResults.filter(r => r.percentage);
    const averagePercentage = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.percentage, 0) / validResults.length
      : 0;

    // Calculate attendance rate
    const attendanceRate = attendance[0] 
      ? (attendance[0].attendedClasses / attendance[0].totalClasses * 100).toFixed(1)
      : 0;

    const dashboardData = {
      user: {
        name: req.user.fullName,
        firstName: req.user.firstName,
        admissionNumber: req.user.admissionNumber,
        course: await Course.findById(req.user.course).select('name'),
        profilePicture: req.user.profilePicture
      },
      stats: {
        attendanceRate: `${attendanceRate}%`,
        averageGrade: averagePercentage >= 80 ? 'A' :
                      averagePercentage >= 70 ? 'B' :
                      averagePercentage >= 60 ? 'C' :
                      averagePercentage >= 50 ? 'D' : 'E',
        feeBalance: feeStatus?.balance || 0,
        upcomingExams: await Exam.countDocuments({
          course: req.user.course,
          level: req.user.level,
          date: { $gte: new Date() },
          status: 'scheduled'
        })
      },
      recentExams: processedResults,
      upcomingSchedules: upcomingSchedules.slice(0, 5),
      feeStatus: {
        totalAmount: feeStatus?.totalAmount || 0,
        paidAmount: feeStatus?.totalPaid || 0,
        balance: feeStatus?.balance || 0,
        paymentStatus: feeStatus?.paymentStatus || 'unpaid',
        dueDate: feeStatus?.dueDate
      },
      unreadAnnouncements: announcements,
      dailyQuote
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/teacher
// @desc    Get teacher dashboard data
// @access  Private/Teacher
router.get('/teacher', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'This dashboard is for teachers only'
      });
    }

    const [
      assignedCourses,
      todaySchedules,
      upcomingExams,
      pendingReports,
      studentCount,
      recentExamStats
    ] = await Promise.all([
      // Get assigned courses
      Course.find({ _id: { $in: req.user.assignedCourses } })
        .select('name code currentEnrollment'),

      // Get today's schedules
      Schedule.find({
        teacher: req.user._id,
        date: {
          $gte: new Date().setHours(0, 0, 0, 0),
          $lt: new Date().setHours(23, 59, 59, 999)
        }
      })
      .populate('course level')
      .sort('startTime'),

      // Get upcoming exams
      Exam.find({
        teacher: req.user._id,
        date: { $gte: new Date() },
        status: { $in: ['scheduled', 'marked'] }
      })
      .select('title examType date status')
      .sort('date')
      .limit(5),

      // Get pending reports (exam misprints)
      Report.find({
        targetDashboard: 'teacher',
        status: 'pending',
        reportType: 'exam_misprint'
      })
      .populate('reporter', 'firstName lastName')
      .limit(5),

      // Count total students in assigned courses
      User.countDocuments({
        role: 'student',
        course: { $in: req.user.assignedCourses }
      }),

      // Get recent exam statistics
      Exam.aggregate([
        {
          $match: {
            teacher: req.user._id,
            status: 'published'
          }
        },
        {
          $unwind: '$results'
        },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$results.percentage' },
            totalExams: { $addToSet: '$_id' },
            totalStudentsMarked: { $sum: 1 }
          }
        }
      ])
    ]);

    const dashboardData = {
      user: {
        name: req.user.fullName,
        firstName: req.user.firstName,
        accountId: req.user.accountId,
        profilePicture: req.user.profilePicture
      },
      stats: {
        totalCourses: assignedCourses.length,
        totalStudents: studentCount,
        todayClasses: todaySchedules.length,
        pendingExams: upcomingExams.filter(e => e.status === 'scheduled').length,
        unmarkedExams: upcomingExams.filter(e => e.status === 'marked').length
      },
      assignedCourses,
      todaySchedules,
      upcomingExams,
      pendingReports,
      examStatistics: recentExamStats[0] || {
        averageScore: 0,
        totalExams: [],
        totalStudentsMarked: 0
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/admin
// @desc    Get admin dashboard data
// @access  Private/Admin
router.get('/admin', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This dashboard is for administrators only'
      });
    }

    const [
      userStats,
      courseStats,
      feeStats,
      systemHealth,
      recentActivities,
      pendingReports
    ] = await Promise.all([
      // User statistics
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),

      // Course statistics
      Course.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalEnrollment: { $sum: '$currentEnrollment' }
          }
        }
      ]),

      // Fee collection statistics
      Fee.aggregate([
        {
          $match: {
            academicYear: getCurrentAcademicYear(),
            term: getCurrentTerm()
          }
        },
        {
          $group: {
            _id: null,
            totalExpected: { $sum: '$totalAmount' },
            totalCollected: { $sum: '$totalPaid' },
            totalBalance: { $sum: '$balance' },
            paidCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            },
            partialCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'partial'] }, 1, 0] }
            },
            unpaidCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] }
            }
          }
        }
      ]),

      // System health (recovery codes, active sessions, etc.)
      User.aggregate([
        {
          $match: {
            passwordResetCode: { $exists: true, $ne: null }
          }
        },
        {
          $count: 'activeRecoveryCodes'
        }
      ]),

      // Recent activities (last 10 logins)
      User.find({ lastLogin: { $exists: true } })
        .select('firstName lastName role lastLogin')
        .sort('-lastLogin')
        .limit(10),

      // Pending reports
      Report.countDocuments({ status: 'pending' })
    ]);

    // Process statistics
    const usersByRole = {};
    userStats.forEach(stat => {
      usersByRole[stat._id] = stat.count;
    });

    const dashboardData = {
      user: {
        name: req.user.fullName,
        firstName: req.user.firstName,
        accountId: req.user.accountId,
        profilePicture: req.user.profilePicture
      },
      stats: {
        totalUsers: Object.values(usersByRole).reduce((a, b) => a + b, 0),
        students: usersByRole.student || 0,
        teachers: usersByRole.teacher || 0,
        staff: (usersByRole.admin || 0) + (usersByRole.finance || 0) + (usersByRole.gatepass || 0),
        activeCourses: courseStats.find(s => s._id === 'active')?.count || 0,
        totalEnrollment: courseStats.reduce((sum, s) => sum + s.totalEnrollment, 0)
      },
      feeCollection: feeStats[0] || {
        totalExpected: 0,
        totalCollected: 0,
        totalBalance: 0,
        paidCount: 0,
        partialCount: 0,
        unpaidCount: 0
      },
      systemHealth: {
        activeRecoveryCodes: systemHealth[0]?.activeRecoveryCodes || 0,
        pendingReports
      },
      recentActivities
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/finance
// @desc    Get finance dashboard data
// @access  Private/Finance
router.get('/finance', protect, async (req, res) => {
  try {
    if (req.user.role !== 'finance') {
      return res.status(403).json({
        success: false,
        message: 'This dashboard is for finance officers only'
      });
    }

    const [
      todayCollection,
      monthlyCollection,
      defaulters,
      paymentTrends,
      gatepassStats
    ] = await Promise.all([
      // Today's collection
      Fee.aggregate([
        {
          $unwind: '$payments'
        },
        {
          $match: {
            'payments.paymentDate': {
              $gte: new Date().setHours(0, 0, 0, 0),
              $lt: new Date().setHours(23, 59, 59, 999)
            }
          }
        },
        {
          $group: {
            _id: '$payments.paymentMethod',
            amount: { $sum: '$payments.amount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Monthly collection trend
      Fee.aggregate([
        {
          $unwind: '$payments'
        },
        {
          $match: {
            'payments.paymentDate': {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$payments.paymentDate' }
            },
            amount: { $sum: '$payments.amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Top defaulters
      Fee.find({
        academicYear: getCurrentAcademicYear(),
        term: getCurrentTerm(),
        balance: { $gt: 0 }
      })
      .populate('student', 'firstName lastName admissionNumber')
      .sort('-balance')
      .limit(10),

      // Payment trends by method
      Fee.aggregate([
        {
          $unwind: '$payments'
        },
        {
          $group: {
            _id: '$payments.paymentMethod',
            total: { $sum: '$payments.amount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Gatepass statistics
      Fee.countDocuments({
        'gatepassStatus.allowed': true,
        academicYear: getCurrentAcademicYear(),
        term: getCurrentTerm()
      })
    ]);

    // Calculate totals
    const todayTotal = todayCollection.reduce((sum, c) => sum + c.amount, 0);
    const monthTotal = monthlyCollection.reduce((sum, c) => sum + c.amount, 0);

    const dashboardData = {
      user: {
        name: req.user.fullName,
        firstName: req.user.firstName,
        accountId: req.user.accountId,
        profilePicture: req.user.profilePicture
      },
      stats: {
        todayCollection: todayTotal,
        monthCollection: monthTotal,
        activeDefaulters: defaulters.length,
        allowedGatepasses: gatepassStats
      },
      todayBreakdown: todayCollection,
      monthlyTrend: monthlyCollection,
      topDefaulters: defaulters.map(d => ({
        student: d.student,
        balance: d.balance,
        totalAmount: d.totalAmount,
        paidAmount: d.totalPaid
      })),
      paymentMethods: paymentTrends
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// @route   GET /api/dashboard/gatepass
// @desc    Get gatepass dashboard data
// @access  Private/Gatepass
router.get('/gatepass', protect, async (req, res) => {
  try {
    if (req.user.role !== 'gatepass') {
      return res.status(403).json({
        success: false,
        message: 'This dashboard is for gatepass officers only'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todayVerifications,
      weekStats,
      activeReceipts,
      recentVerifications
    ] = await Promise.all([
      // Today's verifications
      Gatepass.aggregate([
        {
          $match: {
            verificationTime: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: '$verificationStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      // This week's statistics
      Gatepass.aggregate([
        {
          $match: {
            verificationTime: {
              $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$verificationTime' }
            },
            verified: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
            },
            denied: {
              $sum: { $cond: [{ $eq: ['$verificationStatus', 'denied'] }, 1, 0] }
            }
          }
        },
        { $sort: { '_id': 1 } }
      ]),

      // Active receipts (not expired and not used)
      Gatepass.countDocuments({
        verificationStatus: 'verified',
        expiryTime: { $gt: new Date() },
        usedAt: null
      }),

      // Recent verifications
      Gatepass.find()
        .populate('student', 'firstName lastName admissionNumber')
        .sort('-verificationTime')
        .limit(10)
    ]);

    // Process today's stats
    const todayStats = {
      verified: 0,
      denied: 0,
      total: 0
    };
    
    todayVerifications.forEach(stat => {
      todayStats[stat._id] = stat.count;
      todayStats.total += stat.count;
    });

    const dashboardData = {
      user: {
        name: req.user.fullName,
        firstName: req.user.firstName,
        accountId: req.user.accountId,
        profilePicture: req.user.profilePicture
      },
      stats: {
        todayVerified: todayStats.verified,
        todayDenied: todayStats.denied,
        todayTotal: todayStats.total,
        activeReceipts
      },
      weeklyTrend: weekStats,
      recentVerifications: recentVerifications.map(v => ({
        student: v.student,
        status: v.verificationStatus,
        time: v.verificationTime,
        receiptNumber: v.receiptNumber,
        used: !!v.usedAt
      })),
      operatingStatus: {
        isOpen: today.getDay() >= 1 && today.getDay() <= 5 && 
                new Date().getHours() >= 6 && new Date().getHours() < 17,
        currentTime: new Date(),
        operatingHours: 'Monday - Friday, 6:00 AM - 5:00 PM'
      }
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

module.exports = router;
