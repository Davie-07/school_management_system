const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const Level = require('../models/Level');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/courses
// @desc    Get all courses
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, department } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (department) query.department = department;

    const courses = await Course.find(query)
      .populate('levels teachers')
      .sort('name');

    res.status(200).json({
      success: true,
      count: courses.length,
      data: courses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching courses',
      error: error.message
    });
  }
});

// @route   GET /api/courses/:id
// @desc    Get single course
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('levels teachers');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching course',
      error: error.message
    });
  }
});

// @route   POST /api/courses
// @desc    Create course (admin only)
// @access  Private/Admin
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const courseData = {
      ...req.body,
      createdBy: req.user._id
    };

    const course = await Course.create(courseData);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Course code already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating course',
      error: error.message
    });
  }
});

// @route   PUT /api/courses/:id
// @desc    Update course
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating course',
      error: error.message
    });
  }
});

// @route   DELETE /api/courses/:id
// @desc    Delete course (admin only)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    // Check if there are students enrolled
    const enrolledStudents = await User.countDocuments({ 
      course: req.params.id,
      role: 'student'
    });

    if (enrolledStudents > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course with ${enrolledStudents} enrolled students`
      });
    }

    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Delete associated levels
    await Level.deleteMany({ course: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting course',
      error: error.message
    });
  }
});

// @route   POST /api/courses/:id/assign-teacher
// @desc    Assign teacher to course
// @access  Private/Admin
router.post('/:id/assign-teacher', protect, authorize('admin'), async (req, res) => {
  try {
    const { teacherId } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // Add course to teacher's assigned courses
    if (!teacher.assignedCourses.includes(req.params.id)) {
      teacher.assignedCourses.push(req.params.id);
      await teacher.save();
    }

    // Add teacher to course
    if (!course.teachers.includes(teacherId)) {
      course.teachers.push(teacherId);
      await course.save();
    }

    res.status(200).json({
      success: true,
      message: 'Teacher assigned to course successfully',
      data: course
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning teacher',
      error: error.message
    });
  }
});

// @route   GET /api/courses/:id/levels
// @desc    Get all levels for a course
// @access  Public
router.get('/:id/levels', async (req, res) => {
  try {
    const levels = await Level.find({ course: req.params.id })
      .sort('year semester');

    res.status(200).json({
      success: true,
      count: levels.length,
      data: levels
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching levels',
      error: error.message
    });
  }
});

// @route   POST /api/courses/:id/levels
// @desc    Create level for course
// @access  Private/Admin
router.post('/:id/levels', protect, authorize('admin'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const levelData = {
      ...req.body,
      course: req.params.id
    };

    const level = await Level.create(levelData);

    // Add level to course
    course.levels.push(level._id);
    await course.save();

    res.status(201).json({
      success: true,
      message: 'Level created successfully',
      data: level
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating level',
      error: error.message
    });
  }
});

// @route   GET /api/courses/:id/students
// @desc    Get students enrolled in a course
// @access  Private
router.get('/:id/students', protect, async (req, res) => {
  try {
    const { level } = req.query;
    
    let query = { 
      course: req.params.id,
      role: 'student'
    };
    
    if (level) query.level = level;

    const students = await User.find(query)
      .select('-password')
      .populate('level')
      .sort('firstName lastName');

    res.status(200).json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

module.exports = router;
