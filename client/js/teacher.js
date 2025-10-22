// Teacher Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    const user = getUser();
    if (!user || user.role !== 'teacher') {
        showAlert('Unauthorized access', 'error');
        window.location.href = '../login.html';
        return;
    }

    // Initialize dashboard
    initializeTeacherDashboard();
});

async function initializeTeacherDashboard() {
    try {
        showLoading(true);
        
        // Load dashboard data
        const dashboardData = await apiRequest('/dashboard/teacher', {
            method: 'GET'
        });

        if (dashboardData.success) {
            updateTeacherDashboardUI(dashboardData.data);
            loadTodaySchedule(dashboardData.data.todaySchedules);
            loadAssignedCourses(dashboardData.data.assignedCourses);
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

function updateTeacherDashboardUI(data) {
    // Update user info
    const user = getUser();
    document.getElementById('teacherName').textContent = user.fullName || 'Teacher';
    document.getElementById('accountId').textContent = `ID: ${user.accountId || 'N/A'}`;
    
    const initials = (user.firstName?.charAt(0) || 'T') + (user.lastName?.charAt(0) || '');
    document.getElementById('userInitials').textContent = initials.toUpperCase();

    // Update stats
    if (data.stats) {
        document.getElementById('totalCourses').textContent = data.stats.totalCourses || 0;
        document.getElementById('totalStudents').textContent = data.stats.totalStudents || 0;
        document.getElementById('todayClasses').textContent = data.stats.todayClasses || 0;
        document.getElementById('pendingExams').textContent = data.stats.pendingExams || 0;
    }

    // Update date and time
    updateDateTime();
    
    // Load recent misprints
    if (data.pendingReports) {
        displayRecentMisprints(data.pendingReports);
    }
}

function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Update time every minute
setInterval(updateDateTime, 60000);

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = 'block';
    }
    
    // Update sidebar active state
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });

    // Load section-specific data
    switch(sectionId) {
        case 'schedule':
            loadMySchedule();
            break;
        case 'students':
            loadMyStudents();
            break;
        case 'exams':
            loadExams();
            break;
        case 'attendance':
            loadSchedulesForAttendance();
            break;
        case 'reports':
            loadReports();
            break;
        case 'announcements':
            loadAnnouncements();
            break;
    }
}

// Load Today's Schedule
function loadTodaySchedule(schedules) {
    const container = document.getElementById('todaySchedule');
    if (!container) return;

    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<p class="no-data">No classes scheduled for today</p>';
        return;
    }

    container.innerHTML = schedules.map(schedule => `
        <div class="schedule-item">
            <div class="schedule-time">
                ${schedule.startTime} - ${schedule.endTime}
            </div>
            <div class="schedule-details">
                <strong>${schedule.title}</strong><br>
                ${schedule.course?.name} - ${schedule.level?.name}<br>
                Venue: ${schedule.venue}
            </div>
        </div>
    `).join('');
}

// Load Assigned Courses
let assignedCourses = [];

function loadAssignedCourses(courses) {
    assignedCourses = courses || [];
    
    // Update course filter
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        courseFilter.innerHTML = '<option value="">All Courses</option>';
        assignedCourses.forEach(course => {
            courseFilter.innerHTML += `<option value="${course._id}">${course.name}</option>`;
        });
    }
}

// Load Students
async function loadMyStudents() {
    try {
        const courseId = document.getElementById('courseFilter')?.value || '';
        const url = courseId ? `/courses/${courseId}/students` : '/users?role=student';
        
        const response = await apiRequest(url, {
            method: 'GET'
        });

        if (response.success) {
            displayStudents(response.data);
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showAlert('Failed to load students', 'error');
    }
}

function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No students found</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr>
            <td>${student.admissionNumber || '-'}</td>
            <td>${student.fullName || `${student.firstName} ${student.lastName}`}</td>
            <td>${student.course?.name || '-'}</td>
            <td>${student.level?.name || '-'}</td>
            <td>${student.email}</td>
            <td>
                <button class="btn btn-sm" onclick="viewStudent('${student._id}')">View</button>
                <button class="btn btn-sm" onclick="contactStudent('${student._id}')">Contact</button>
            </td>
        </tr>
    `).join('');
}

// Load Exams
async function loadExams() {
    try {
        const response = await apiRequest('/exams', {
            method: 'GET'
        });

        if (response.success) {
            displayExams(response.data);
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        showAlert('Failed to load exams', 'error');
    }
}

function displayExams(exams) {
    const container = document.getElementById('examsList');
    if (!container) return;

    if (!exams || exams.length === 0) {
        container.innerHTML = '<p class="no-data">No exams found</p>';
        return;
    }

    container.innerHTML = exams.map(exam => `
        <div class="exam-card card">
            <div class="exam-header">
                <h3>${exam.title}</h3>
                <span class="badge badge-${exam.status}">${exam.status}</span>
            </div>
            <div class="exam-details">
                <p><strong>Type:</strong> ${exam.examType}</p>
                <p><strong>Course:</strong> ${exam.course?.name}</p>
                <p><strong>Level:</strong> ${exam.level?.name}</p>
                <p><strong>Date:</strong> ${formatDate(exam.date)}</p>
                <p><strong>Total Marks:</strong> ${exam.totalMarks}</p>
            </div>
            <div class="exam-actions">
                ${exam.status === 'scheduled' ? `
                    <button class="btn btn-sm" onclick="markExam('${exam._id}')">Mark Results</button>
                ` : ''}
                ${exam.status === 'marked' ? `
                    <button class="btn btn-sm" onclick="publishResults('${exam._id}')">Publish Results</button>
                ` : ''}
                <button class="btn btn-sm btn-secondary" onclick="viewExamDetails('${exam._id}')">View Details</button>
            </div>
        </div>
    `).join('');
}

// Create Schedule Modal
async function showCreateScheduleModal() {
    const modal = createModal('Create Class Schedule', `
        <form id="createScheduleForm">
            <div class="form-group">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" id="scheduleTitle" required>
            </div>
            <div class="form-group">
                <label class="form-label">Course</label>
                <select class="form-control" id="scheduleCourse" onchange="loadCourseLevels()">
                    <option value="">Select Course</option>
                    ${assignedCourses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Level</label>
                <select class="form-control" id="scheduleLevel">
                    <option value="">Select Level</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-control" id="scheduleDate" required>
            </div>
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label class="form-label">Start Time</label>
                    <input type="time" class="form-control" id="startTime" required>
                </div>
                <div class="form-group">
                    <label class="form-label">End Time</label>
                    <input type="time" class="form-control" id="endTime" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Venue</label>
                <input type="text" class="form-control" id="venue" required>
            </div>
            <div class="form-group">
                <label class="form-label">Type</label>
                <select class="form-control" id="scheduleType">
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="exam">Exam</option>
                </select>
            </div>
        </form>
    `, [
        {
            label: 'Create Schedule',
            onclick: 'createSchedule()',
            class: ''
        },
        {
            label: 'Cancel',
            onclick: 'closeModal(this)',
            class: 'btn-secondary'
        }
    ]);
}

async function createSchedule() {
    const scheduleData = {
        title: document.getElementById('scheduleTitle').value,
        course: document.getElementById('scheduleCourse').value,
        level: document.getElementById('scheduleLevel').value,
        date: document.getElementById('scheduleDate').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        venue: document.getElementById('venue').value,
        type: document.getElementById('scheduleType').value
    };

    if (!scheduleData.title || !scheduleData.course || !scheduleData.date) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/schedules', {
            method: 'POST',
            body: JSON.stringify(scheduleData)
        });

        if (response.success) {
            showAlert('Schedule created successfully!', 'success');
            document.querySelector('.modal').remove();
            loadMySchedule();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create schedule', 'error');
    } finally {
        showLoading(false);
    }
}

// Create Exam Modal
async function showCreateExamModal() {
    const modal = createModal('Create Exam', `
        <form id="createExamForm">
            <div class="form-group">
                <label class="form-label">Exam Title</label>
                <input type="text" class="form-control" id="examTitle" required>
            </div>
            <div class="form-group">
                <label class="form-label">Exam Type</label>
                <select class="form-control" id="examType">
                    <option value="CAT">CAT</option>
                    <option value="midterm">Midterm</option>
                    <option value="final">Final Exam</option>
                    <option value="supplementary">Supplementary</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Course</label>
                <select class="form-control" id="examCourse" onchange="loadCourseLevels('exam')">
                    <option value="">Select Course</option>
                    ${assignedCourses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Level</label>
                <select class="form-control" id="examLevel">
                    <option value="">Select Level</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" class="form-control" id="examDate" required>
            </div>
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label class="form-label">Total Marks</label>
                    <input type="number" class="form-control" id="totalMarks" value="100" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Pass Mark</label>
                    <input type="number" class="form-control" id="passMark" value="50" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Duration (minutes)</label>
                <input type="number" class="form-control" id="duration" value="120" required>
            </div>
            <div class="form-group">
                <label class="form-label">Venue</label>
                <input type="text" class="form-control" id="examVenue" required>
            </div>
        </form>
    `, [
        {
            label: 'Create Exam',
            onclick: 'createExam()',
            class: ''
        },
        {
            label: 'Cancel',
            onclick: 'closeModal(this)',
            class: 'btn-secondary'
        }
    ]);
}

async function createExam() {
    const examData = {
        title: document.getElementById('examTitle').value,
        examType: document.getElementById('examType').value,
        course: document.getElementById('examCourse').value,
        level: document.getElementById('examLevel').value,
        date: document.getElementById('examDate').value,
        totalMarks: parseInt(document.getElementById('totalMarks').value),
        passMark: parseInt(document.getElementById('passMark').value),
        duration: parseInt(document.getElementById('duration').value),
        venue: document.getElementById('examVenue').value
    };

    if (!examData.title || !examData.course || !examData.date) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/exams', {
            method: 'POST',
            body: JSON.stringify(examData)
        });

        if (response.success) {
            showAlert('Exam created successfully!', 'success');
            document.querySelector('.modal').remove();
            loadExams();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create exam', 'error');
    } finally {
        showLoading(false);
    }
}

// Load course levels
async function loadCourseLevels(type = 'schedule') {
    const courseId = document.getElementById(type === 'exam' ? 'examCourse' : 'scheduleCourse').value;
    const levelSelect = document.getElementById(type === 'exam' ? 'examLevel' : 'scheduleLevel');
    
    if (!courseId) {
        levelSelect.innerHTML = '<option value="">Select Level</option>';
        return;
    }
    
    try {
        const response = await apiRequest(`/courses/${courseId}/levels`, {
            method: 'GET'
        });
        
        if (response.success) {
            levelSelect.innerHTML = '<option value="">Select Level</option>';
            response.data.forEach(level => {
                levelSelect.innerHTML += `<option value="${level._id}">${level.name}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading levels:', error);
    }
}

// Display recent misprints
function displayRecentMisprints(reports) {
    const container = document.getElementById('recentMisprints');
    if (!container) return;

    if (!reports || reports.length === 0) {
        container.innerHTML = '<p class="no-data">No pending misprint reports</p>';
        return;
    }

    container.innerHTML = reports.map(report => `
        <div class="report-item">
            <strong>${report.reporter?.firstName} ${report.reporter?.lastName}</strong>
            <p>${report.subject}</p>
            <button class="btn btn-sm" onclick="viewReport('${report._id}')">Review</button>
        </div>
    `).join('');
}
