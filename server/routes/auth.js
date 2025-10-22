const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Course = require('../models/Course');
const Level = require('../models/Level');
const { body, validationResult } = require('express-validator');
const { sendTokenResponse, protect } = require('../middleware/auth');
const { validateAndSanitize } = require('../middleware/security');

// Generate unique account ID for non-student users
const generateAccountId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit number
};

// Generate recovery code for admin dashboard
const generateRecoveryCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-character code
};

// @route   POST /api/auth/register
// @desc    Register user (students only through this route)
// @access  Public
router.post('/register', [
  body('firstName').notEmpty().trim().escape(),
  body('lastName').notEmpty().trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('admissionNumber').notEmpty().trim().toUpperCase(),
  body('course').notEmpty(),
  body('level').notEmpty(),
  body('termsAccepted').isBoolean().equals('true')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      firstName,
      middleName,
      lastName,
      email,
      password,
      admissionNumber,
      course,
      level,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      termsAccepted
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [
        { email },
        { admissionNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or admission number already exists'
      });
    }

    // Verify course and level exist
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid course selected'
      });
    }

    const levelExists = await Level.findById(level);
    if (!levelExists) {
      return res.status(400).json({
        success: false,
        message: 'Invalid level selected'
      });
    }

    // Create user
    const user = await User.create({
      firstName,
      middleName,
      lastName,
      email,
      password,
      role: 'student',
      admissionNumber,
      course,
      level,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      termsAccepted,
      status: 'active'
    });

    // Update course enrollment count
    await Course.findByIdAndUpdate(course, {
      $inc: { currentEnrollment: 1 }
    });

    sendTokenResponse(user, 201, res, 'Registration successful');

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('identifier').notEmpty().trim(), // Can be admission number or account ID
  body('course').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, identifier, course, password } = req.body;

    // Check if password is provided (only for non-student initial login)
    if (!password && !identifier) {
      return res.status(400).json({
        success: false,
        message: 'Please provide login credentials'
      });
    }

    // Find user based on role
    let user;
    
    // Check if it's a student (using admission number) or staff (using account ID)
    const isStudent = /^[A-Z0-9]+$/.test(identifier) && identifier.length > 6;
    
    if (isStudent) {
      user = await User.findOne({
        email,
        admissionNumber: identifier.toUpperCase(),
        course,
        role: 'student'
      }).select('+password').populate('course level');
    } else {
      user = await User.findOne({
        email,
        accountId: identifier,
        course,
        $or: [
          { role: 'teacher' },
          { role: 'admin' },
          { role: 'finance' },
          { role: 'gatepass' }
        ]
      }).select('+password').populate('course');
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password if provided
    if (password) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }

    // Check if account is active
    if (user.status !== 'active' && user.status !== 'graduated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact administration.'
      });
    }

    sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Generate password reset code
// @access  Public
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail(),
  body('identifier').notEmpty().trim(),
  body('course').notEmpty()
], async (req, res) => {
  try {
    const { email, identifier, course } = req.body;

    // Find user
    let user;
    const isStudent = /^[A-Z0-9]+$/.test(identifier) && identifier.length > 6;
    
    if (isStudent) {
      user = await User.findOne({
        email,
        admissionNumber: identifier.toUpperCase(),
        course,
        role: 'student'
      });
    } else {
      user = await User.findOne({
        email,
        accountId: identifier,
        course
      }).select('+passwordResetCode +passwordResetExpires');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with these credentials'
      });
    }

    // Generate reset code
    let resetCode;
    
    if (user.role === 'student') {
      // For students, allow direct password reset
      resetCode = 'STUDENT_RESET';
    } else {
      // For staff, generate 8-digit code that admin can see
      resetCode = generateRecoveryCode();
      
      // Store the code in the database
      user.passwordResetCode = resetCode;
      user.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: user.role === 'student' 
        ? 'Password reset allowed. Please enter your new password.'
        : 'Recovery code generated. Please contact admin for the code.',
      requiresCode: user.role !== 'student',
      userId: user._id
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: error.message
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with code or directly for students
// @access  Public
router.post('/reset-password', [
  body('userId').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const { userId, newPassword, resetCode } = req.body;

    const user = await User.findById(userId).select('+passwordResetCode +passwordResetExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid reset request'
      });
    }

    // For non-students, verify the reset code
    if (user.role !== 'student') {
      if (!resetCode || user.passwordResetCode !== resetCode) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset code'
        });
      }

      if (user.passwordResetExpires < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'Reset code has expired. Please request a new one.'
        });
      }
    }

    // Update password
    user.password = newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, (req, res) => {
  res
    .status(200)
    .cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    })
    .json({
      success: true,
      message: 'Logged out successfully'
    });
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('course level assignedCourses');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/update-password
// @desc    Update password
// @access  Private
router.put('/update-password', [
  protect,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res, 'Password updated successfully');

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
});

module.exports = router;
