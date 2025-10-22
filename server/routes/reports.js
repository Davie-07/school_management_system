const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/reports
// @desc    Get reports
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { reportType, status, priority, targetDashboard } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.reporter = req.user._id;
    } else if (req.user.role === 'teacher') {
      query.$or = [
        { targetDashboard: 'teacher' },
        { targetUser: req.user._id },
        { reporter: req.user._id }
      ];
    } else if (req.user.role === 'finance') {
      query.targetDashboard = 'finance';
    }
    
    // Apply additional filters
    if (reportType) query.reportType = reportType;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (targetDashboard) query.targetDashboard = targetDashboard;

    const reports = await Report.find(query)
      .populate('reporter', 'firstName lastName admissionNumber role')
      .populate('targetUser', 'firstName lastName')
      .populate('relatedExam', 'title')
      .populate('response.respondedBy', 'firstName lastName')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// @route   GET /api/reports/:id
// @desc    Get single report
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('reporter', 'firstName lastName admissionNumber email role')
      .populate('targetUser', 'firstName lastName')
      .populate('relatedExam')
      .populate('response.respondedBy', 'firstName lastName')
      .populate('readBy.user', 'firstName lastName');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check authorization
    const canView = 
      req.user.role === 'admin' ||
      report.reporter._id.toString() === req.user._id.toString() ||
      report.targetUser?._id.toString() === req.user._id.toString() ||
      (req.user.role === 'teacher' && report.targetDashboard === 'teacher') ||
      (req.user.role === 'finance' && report.targetDashboard === 'finance');

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report'
      });
    }

    // Mark as read
    const alreadyRead = report.readBy.some(
      r => r.user._id.toString() === req.user._id.toString()
    );

    if (!alreadyRead && report.reporter._id.toString() !== req.user._id.toString()) {
      report.readBy.push({
        user: req.user._id,
        readAt: Date.now()
      });
      await report.save();
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

// @route   POST /api/reports
// @desc    Create report
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const reportData = {
      ...req.body,
      reporter: req.user._id
    };

    // Validate target dashboard based on report type
    if (req.body.reportType === 'exam_misprint') {
      reportData.targetDashboard = 'teacher';
    }

    const report = await Report.create(reportData);
    
    await report.populate('reporter targetUser relatedExam');

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating report',
      error: error.message
    });
  }
});

// @route   PUT /api/reports/:id/respond
// @desc    Respond to report
// @access  Private
router.put('/:id/respond', protect, async (req, res) => {
  try {
    const { message, action, status = 'resolved' } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check authorization
    const canRespond = 
      req.user.role === 'admin' ||
      report.targetUser?._id.toString() === req.user._id.toString() ||
      (req.user.role === 'teacher' && report.targetDashboard === 'teacher') ||
      (req.user.role === 'finance' && report.targetDashboard === 'finance');

    if (!canRespond) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this report'
      });
    }

    // Update report
    report.response = {
      respondedBy: req.user._id,
      message,
      action,
      respondedAt: Date.now()
    };
    report.status = status;

    await report.save();
    
    await report.populate('reporter targetUser response.respondedBy');

    res.status(200).json({
      success: true,
      message: 'Response submitted successfully',
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error responding to report',
      error: error.message
    });
  }
});

// @route   PUT /api/reports/:id/status
// @desc    Update report status
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check authorization
    const canUpdate = 
      req.user.role === 'admin' ||
      report.targetUser?._id.toString() === req.user._id.toString() ||
      (req.user.role === 'teacher' && report.targetDashboard === 'teacher') ||
      (req.user.role === 'finance' && report.targetDashboard === 'finance');

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this report'
      });
    }

    report.status = status;
    await report.save();

    res.status(200).json({
      success: true,
      message: `Report status updated to ${status}`,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating report status',
      error: error.message
    });
  }
});

// @route   DELETE /api/reports/:id
// @desc    Delete report
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check ownership or admin
    if (req.user.role !== 'admin' && 
        report.reporter.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this report'
      });
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting report',
      error: error.message
    });
  }
});

// @route   GET /api/reports/stats
// @desc    Get reports statistics
// @access  Private/Admin
router.get('/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const [typeStats, statusStats, priorityStats] = await Promise.all([
      // By type
      Report.aggregate([
        {
          $group: {
            _id: '$reportType',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // By status
      Report.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // By priority
      Report.aggregate([
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const stats = {
      byType: {},
      byStatus: {},
      byPriority: {},
      total: 0
    };

    typeStats.forEach(stat => {
      stats.byType[stat._id] = stat.count;
      stats.total += stat.count;
    });

    statusStats.forEach(stat => {
      stats.byStatus[stat._id] = stat.count;
    });

    priorityStats.forEach(stat => {
      stats.byPriority[stat._id] = stat.count;
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// @route   GET /api/reports/unread/count
// @desc    Get unread reports count
// @access  Private
router.get('/unread/count', protect, async (req, res) => {
  try {
    let query = {
      'readBy.user': { $ne: req.user._id },
      status: { $ne: 'resolved' }
    };

    // Filter based on user role
    if (req.user.role === 'teacher') {
      query.$or = [
        { targetDashboard: 'teacher' },
        { targetUser: req.user._id }
      ];
    } else if (req.user.role === 'finance') {
      query.targetDashboard = 'finance';
    } else if (req.user.role !== 'admin') {
      // Regular users shouldn't see unread count for reports
      return res.status(200).json({
        success: true,
        unreadCount: 0
      });
    }

    const count = await Report.countDocuments(query);

    res.status(200).json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
});

module.exports = router;
