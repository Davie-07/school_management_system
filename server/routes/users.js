const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const { validateAndSanitize } = require('../middleware/security');

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { role, course, level, status, search } = req.query;
    
    // Build query
    let query = {};
    if (role) query.role = role;
    if (course) query.course = course;
    if (level) query.level = level;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { accountId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('course level assignedCourses')
      .select('-password')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('course level assignedCourses')
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

// @route   POST /api/users
// @desc    Create user (admin for staff, teacher for students)
// @access  Private
router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { role, email, firstName, lastName, middleName, course, level } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Generate account ID for non-student users
    let accountId;
    if (role !== 'student') {
      accountId = Math.floor(100000 + Math.random() * 900000).toString();
      // Ensure unique account ID
      while (await User.findOne({ accountId })) {
        accountId = Math.floor(100000 + Math.random() * 900000).toString();
      }
    }

    // Create user
    const userData = {
      ...req.body,
      accountId,
      createdBy: req.user._id,
      password: req.body.password || 'TempPass123!' // Temporary password
    };

    // Teachers can only create students
    if (req.user.role === 'teacher' && role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Teachers can only create student accounts'
      });
    }

    const user = await User.create(userData);

    // Update course enrollment if student
    if (role === 'student' && course) {
      await Course.findByIdAndUpdate(course, {
        $inc: { currentEnrollment: 1 }
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        ...user.toObject(),
        password: undefined,
        accountId: accountId || user.admissionNumber
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { password, role, ...updateData } = req.body;

    // Only admin can change roles
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can change user roles'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { ...updateData, ...(role && { role }) },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't delete the last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin account'
        });
      }
    }

    await user.deleteOne();

    // Update course enrollment if student
    if (user.role === 'student' && user.course) {
      await Course.findByIdAndUpdate(user.course, {
        $inc: { currentEnrollment: -1 }
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status (suspend/activate)
// @access  Private/Admin
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'suspended', 'graduated', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${status === 'suspended' ? 'suspended' : 'activated'} successfully`,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
});

// @route   GET /api/users/recovery-codes
// @desc    Get password recovery codes (admin only)
// @access  Private/Admin
router.get('/admin/recovery-codes', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({
      passwordResetCode: { $exists: true, $ne: null }
    })
    .select('firstName lastName email accountId passwordResetCode passwordResetExpires')
    .lean();

    const activeRecoveryCodes = users.filter(user => 
      user.passwordResetExpires && new Date(user.passwordResetExpires) > new Date()
    );

    res.status(200).json({
      success: true,
      count: activeRecoveryCodes.length,
      data: activeRecoveryCodes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recovery codes',
      error: error.message
    });
  }
});

module.exports = router;
