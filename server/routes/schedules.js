const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/schedules
// @desc    Get schedules
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { teacher, course, level, date, status, type } = req.query;
    
    let query = {};
    
    // Filter based on user role
    if (req.user.role === 'teacher') {
      query.teacher = req.user._id;
    } else if (req.user.role === 'student') {
      query.course = req.user.course;
      query.level = req.user.level;
    }
    
    // Apply additional filters
    if (teacher) query.teacher = teacher;
    if (course) query.course = course;
    if (level) query.level = level;
    if (status) query.status = status;
    if (type) query.type = type;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    const schedules = await Schedule.find(query)
      .populate('teacher course level')
      .sort('date startTime');

    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching schedules',
      error: error.message
    });
  }
});

// @route   GET /api/schedules/timetable
// @desc    Get weekly timetable
// @access  Private
router.get('/timetable', protect, async (req, res) => {
  try {
    const { week } = req.query;
    
    // Calculate week start and end
    const startDate = week ? new Date(week) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate.setDate(diff);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5); // Monday to Friday

    let query = {
      date: { $gte: startDate, $lt: endDate }
    };

    // Filter based on user role
    if (req.user.role === 'student') {
      query.course = req.user.course;
      query.level = req.user.level;
    } else if (req.user.role === 'teacher') {
      query.teacher = req.user._id;
    }

    const schedules = await Schedule.find(query)
      .populate('teacher course level')
      .sort('date startTime');

    // Organize by day and time
    const timetable = {};
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    days.forEach(day => {
      timetable[day] = [];
    });

    schedules.forEach(schedule => {
      const dayName = days[schedule.date.getDay() - 1];
      if (dayName) {
        timetable[dayName].push(schedule);
      }
    });

    res.status(200).json({
      success: true,
      week: startDate.toISOString().split('T')[0],
      data: timetable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching timetable',
      error: error.message
    });
  }
});

// @route   GET /api/schedules/:id
// @desc    Get single schedule
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate('teacher course level attendees.student');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching schedule',
      error: error.message
    });
  }
});

// @route   POST /api/schedules
// @desc    Create schedule (teachers and admin)
// @access  Private
router.post('/', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const scheduleData = {
      ...req.body,
      teacher: req.user.role === 'teacher' ? req.user._id : req.body.teacher
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

    // Check for scheduling conflicts
    const conflict = await Schedule.findOne({
      date: scheduleData.date,
      $or: [
        {
          teacher: scheduleData.teacher,
          $or: [
            {
              startTime: { $lte: scheduleData.startTime },
              endTime: { $gt: scheduleData.startTime }
            },
            {
              startTime: { $lt: scheduleData.endTime },
              endTime: { $gte: scheduleData.endTime }
            }
          ]
        },
        {
          venue: scheduleData.venue,
          $or: [
            {
              startTime: { $lte: scheduleData.startTime },
              endTime: { $gt: scheduleData.startTime }
            },
            {
              startTime: { $lt: scheduleData.endTime },
              endTime: { $gte: scheduleData.endTime }
            }
          ]
        }
      ]
    });

    if (conflict) {
      return res.status(400).json({
        success: false,
        message: 'Schedule conflict detected. Teacher or venue is already booked at this time.'
      });
    }

    const schedule = await Schedule.create(scheduleData);
    
    await schedule.populate('teacher course level');

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating schedule',
      error: error.message
    });
  }
});

// @route   PUT /api/schedules/:id
// @desc    Update schedule
// @access  Private
router.put('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this schedule'
      });
    }

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('teacher course level');

    res.status(200).json({
      success: true,
      message: 'Schedule updated successfully',
      data: updatedSchedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating schedule',
      error: error.message
    });
  }
});

// @route   DELETE /api/schedules/:id
// @desc    Delete schedule
// @access  Private
router.delete('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this schedule'
      });
    }

    await schedule.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Schedule deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting schedule',
      error: error.message
    });
  }
});

// @route   POST /api/schedules/:id/attendance
// @desc    Mark attendance
// @access  Private/Teacher
router.post('/:id/attendance', protect, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, status } = req.body;

    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check ownership
    if (schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark attendance for this schedule'
      });
    }

    // Find or create attendance record
    const attendanceIndex = schedule.attendees.findIndex(
      a => a.student.toString() === studentId
    );

    if (attendanceIndex > -1) {
      schedule.attendees[attendanceIndex].status = status;
      schedule.attendees[attendanceIndex].markedAt = Date.now();
    } else {
      schedule.attendees.push({
        student: studentId,
        status,
        markedAt: Date.now()
      });
    }

    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
});

// @route   POST /api/schedules/:id/cancel
// @desc    Cancel schedule
// @access  Private
router.post('/:id/cancel', protect, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { reason } = req.body;

    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    // Check ownership
    if (req.user.role === 'teacher' && schedule.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this schedule'
      });
    }

    schedule.status = 'cancelled';
    schedule.cancelReason = reason;
    await schedule.save();

    res.status(200).json({
      success: true,
      message: 'Schedule cancelled successfully',
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling schedule',
      error: error.message
    });
  }
});

module.exports = router;
