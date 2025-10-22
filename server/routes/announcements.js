const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/announcements
// @desc    Get announcements
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, priority } = req.query;
    
    let query = {
      status: status || 'published',
      $or: [
        { validUntil: { $gte: new Date() } },
        { validUntil: null }
      ]
    };
    
    // Filter based on user role and audience
    if (req.user.role === 'student') {
      query.$and = [
        {
          $or: [
            { 'targetAudience.roles': 'all' },
            { 'targetAudience.roles': 'student' },
            { 'targetAudience.courses': req.user.course },
            { 'targetAudience.levels': req.user.level },
            { 'targetAudience.specificUsers': req.user._id }
          ]
        }
      ];
    } else {
      query.$and = [
        {
          $or: [
            { 'targetAudience.roles': 'all' },
            { 'targetAudience.roles': req.user.role },
            { 'targetAudience.specificUsers': req.user._id }
          ]
        }
      ];
    }
    
    if (priority) query.priority = priority;

    const announcements = await Announcement.find(query)
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt')
      .limit(50);

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message
    });
  }
});

// @route   GET /api/announcements/:id
// @desc    Get single announcement
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('targetAudience.courses', 'name code')
      .populate('targetAudience.levels', 'name')
      .populate('readBy.user', 'firstName lastName');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Mark as read
    const alreadyRead = announcement.readBy.some(
      r => r.user._id.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      announcement.readBy.push({
        user: req.user._id,
        readAt: Date.now()
      });
      await announcement.save();
    }

    res.status(200).json({
      success: true,
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message
    });
  }
});

// @route   POST /api/announcements
// @desc    Create announcement
// @access  Private/Admin/Teacher
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const announcementData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Teachers can only target their students
    if (req.user.role === 'teacher' && req.body.targetAudience) {
      if (req.body.targetAudience.roles && 
          !req.body.targetAudience.roles.includes('student')) {
        return res.status(403).json({
          success: false,
          message: 'Teachers can only send announcements to students'
        });
      }
    }

    const announcement = await Announcement.create(announcementData);
    
    await announcement.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message
    });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this announcement'
      });
    }

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: updatedAnnouncement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message
    });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this announcement'
      });
    }

    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message
    });
  }
});

// @route   PUT /api/announcements/:id/archive
// @desc    Archive announcement
// @access  Private
router.put('/:id/archive', protect, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to archive this announcement'
      });
    }

    announcement.status = 'archived';
    await announcement.save();

    res.status(200).json({
      success: true,
      message: 'Announcement archived successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error archiving announcement',
      error: error.message
    });
  }
});

// @route   GET /api/announcements/unread/count
// @desc    Get unread announcements count
// @access  Private
router.get('/unread/count', protect, async (req, res) => {
  try {
    const query = {
      status: 'published',
      $or: [
        { validUntil: { $gte: new Date() } },
        { validUntil: null }
      ],
      'readBy.user': { $ne: req.user._id }
    };
    
    // Filter based on user role and audience
    if (req.user.role === 'student') {
      query.$and = [
        {
          $or: [
            { 'targetAudience.roles': 'all' },
            { 'targetAudience.roles': 'student' },
            { 'targetAudience.courses': req.user.course },
            { 'targetAudience.levels': req.user.level },
            { 'targetAudience.specificUsers': req.user._id }
          ]
        }
      ];
    } else {
      query.$and = [
        {
          $or: [
            { 'targetAudience.roles': 'all' },
            { 'targetAudience.roles': req.user.role },
            { 'targetAudience.specificUsers': req.user._id }
          ]
        }
      ];
    }

    const count = await Announcement.countDocuments(query);

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
