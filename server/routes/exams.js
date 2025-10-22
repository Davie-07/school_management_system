const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { getCurrentTerm } = require('../utils/helpers');

// @route   GET /api/exams
// @desc    Get exams
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { course, level, teacher, examType, term, status } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'student') {
      query.course = req.user.course;
      query.level = req.user.level;
      query.status = 'published';
    } else if (req.user.role === 'teacher') {
      query.teacher = req.user._id;
    }
    
    // Apply additional filters
    if (course) query.course = course;
    if (level) query.level = level;
    if (teacher) query.teacher = teacher;
    if (examType) query.examType = examType;
    if (term) query.term = term;
    if (status) query.status = status;

    const exams = await Exam.find(query)
      .populate('teacher course level')
      .sort('-date');

    res.status(200).json({
      success: true,
      count: exams.length,
      data: exams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching exams',
      error: error.message
    });
  }
});

// @route   GET /api/exams/:id
// @desc    Get single exam
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('teacher course level')
      .populate('results.student', 'firstName lastName admissionNumber')
      .populate('results.markedBy', 'firstName lastName');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Students can only see published results
    if (req.user.role === 'student') {
      exam.results = exam.results.filter(r => 
        r.student._id.toString() === req.user._id.toString() && r.published
      );
    }

    res.status(200).json({
      success: true,
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching exam',
      error: error.message
    });
  }
});

// @route   POST /api/exams
// @desc    Create exam
// @access  Private/Teacher/Admin
router.post('/', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const examData = {
      ...req.body,
      teacher: req.user.role === 'teacher' ? req.user._id : req.body.teacher,
      term: req.body.term || getCurrentTerm() + ' ' + new Date().getFullYear()
    };

    // Validate teacher has access to the course
    if (req.user.role === 'teacher') {
      const teacher = await User.findById(req.user._id);
      if (!teacher.assignedCourses.includes(req.body.course)) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this course'
        });
      }
    }

    const exam = await Exam.create(examData);
    
    await exam.populate('teacher course level');

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating exam',
      error: error.message
    });
  }
});

// @route   PUT /api/exams/:id
// @desc    Update exam
// @access  Private/Teacher/Admin
router.put('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this exam'
      });
    }

    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('teacher course level');

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: updatedExam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating exam',
      error: error.message
    });
  }
});

// @route   POST /api/exams/:id/results
// @desc    Add/Update exam results
// @access  Private/Teacher
router.post('/:id/results', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { results } = req.body; // Array of { studentId, score, remarks }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to add results for this exam'
      });
    }

    // Process each result
    for (const result of results) {
      const percentage = (result.score / exam.totalMarks) * 100;
      const grade = exam.calculateGrade(percentage);
      
      const existingResultIndex = exam.results.findIndex(
        r => r.student.toString() === result.studentId
      );

      const resultData = {
        student: result.studentId,
        score: result.score,
        percentage,
        grade,
        remarks: result.remarks,
        markedBy: req.user._id,
        markedAt: Date.now()
      };

      if (existingResultIndex > -1) {
        exam.results[existingResultIndex] = { 
          ...exam.results[existingResultIndex].toObject(),
          ...resultData 
        };
      } else {
        exam.results.push(resultData);
      }
    }

    exam.status = 'marked';
    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Results added successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding results',
      error: error.message
    });
  }
});

// @route   POST /api/exams/:id/publish
// @desc    Publish exam results
// @access  Private/Teacher
router.post('/:id/publish', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish results for this exam'
      });
    }

    // Mark all results as published
    exam.results.forEach(result => {
      result.published = true;
      result.publishedAt = Date.now();
    });

    exam.status = 'published';
    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Results published successfully',
      data: exam
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error publishing results',
      error: error.message
    });
  }
});

// @route   GET /api/exams/student/:studentId
// @desc    Get student's exam results
// @access  Private
router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Check authorization
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these results'
      });
    }

    const exams = await Exam.find({
      'results.student': studentId,
      'results.published': true
    })
    .populate('course level teacher')
    .select('title examType term date totalMarks results')
    .lean();

    // Filter to show only the specific student's results
    const studentResults = exams.map(exam => {
      const studentResult = exam.results.find(
        r => r.student.toString() === studentId
      );
      
      return {
        ...exam,
        results: studentResult ? [studentResult] : []
      };
    }).filter(exam => exam.results.length > 0);

    res.status(200).json({
      success: true,
      count: studentResults.length,
      data: studentResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student results',
      error: error.message
    });
  }
});

// @route   POST /api/exams/:id/report-misprint
// @desc    Report exam misprint
// @access  Private/Student
router.post('/:id/report-misprint', protect, authorize('student'), async (req, res) => {
  try {
    const { issue } = req.body;

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Find student's result
    const resultIndex = exam.results.findIndex(
      r => r.student.toString() === req.user._id.toString()
    );

    if (resultIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'No result found for this student'
      });
    }

    // Add misprint report
    exam.results[resultIndex].misprints.push({
      reportedBy: req.user._id,
      issue,
      reportedAt: Date.now()
    });

    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Misprint reported successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reporting misprint',
      error: error.message
    });
  }
});

// @route   PUT /api/exams/:examId/resolve-misprint/:misprintId
// @desc    Resolve exam misprint
// @access  Private/Teacher
router.put('/:examId/resolve-misprint/:misprintId', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { resolution, newScore } = req.body;

    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && exam.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to resolve misprints for this exam'
      });
    }

    // Find and update the misprint
    let misprintFound = false;
    
    exam.results.forEach(result => {
      const misprint = result.misprints.id(req.params.misprintId);
      if (misprint) {
        misprint.resolved = true;
        misprint.resolvedBy = req.user._id;
        misprint.resolvedAt = Date.now();
        misprint.resolution = resolution;
        
        // Update score if provided
        if (newScore !== undefined) {
          result.score = newScore;
          result.percentage = (newScore / exam.totalMarks) * 100;
          result.grade = exam.calculateGrade(result.percentage);
        }
        
        misprintFound = true;
      }
    });

    if (!misprintFound) {
      return res.status(404).json({
        success: false,
        message: 'Misprint not found'
      });
    }

    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Misprint resolved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resolving misprint',
      error: error.message
    });
  }
});

module.exports = router;
