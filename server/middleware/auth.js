const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id)
      .select('-password')
      .populate('course level');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists'
      });
    }

    // Check if user is active
    if (req.user.status !== 'active' && req.user.status !== 'graduated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact administration.'
      });
    }

    // Update last login
    req.user.lastLogin = Date.now();
    await req.user.save({ validateBeforeSave: false });

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
      error: error.message
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user owns the resource
const checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params[paramName]);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      // Check ownership based on role
      let isOwner = false;
      
      if (req.user.role === 'admin') {
        isOwner = true; // Admin can access everything
      } else if (req.user.role === 'teacher') {
        // Teacher can access their assigned courses and students
        if (resource.teacher && resource.teacher.toString() === req.user._id.toString()) {
          isOwner = true;
        } else if (resource.course && req.user.assignedCourses.includes(resource.course)) {
          isOwner = true;
        }
      } else if (req.user.role === 'student') {
        // Student can only access their own resources
        if (resource.student && resource.student.toString() === req.user._id.toString()) {
          isOwner = true;
        } else if (resource._id.toString() === req.user._id.toString()) {
          isOwner = true;
        }
      }

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to access this resource'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        error: error.message
      });
    }
  };
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = generateToken(user._id);

  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        middleName: user.middleName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        admissionNumber: user.admissionNumber,
        accountId: user.accountId,
        course: user.course,
        level: user.level,
        profilePicture: user.profilePicture,
        fullName: user.fullName
      }
    });
};

module.exports = {
  protect,
  authorize,
  checkOwnership,
  generateToken,
  sendTokenResponse
};
