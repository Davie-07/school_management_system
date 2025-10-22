// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    const user = getUser();
    if (!user || user.role !== 'admin') {
        showAlert('Unauthorized access', 'error');
        window.location.href = '../login.html';
        return;
    }

    // Initialize dashboard
    initializeAdminDashboard();
});

async function initializeAdminDashboard() {
    try {
        showLoading(true);
        
        // Load dashboard data
        const dashboardData = await apiRequest('/dashboard/admin', {
            method: 'GET'
        });

        if (dashboardData.success) {
            updateAdminDashboardUI(dashboardData.data);
            loadUsers();
            loadCourses();
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

function updateAdminDashboardUI(data) {
    // Update user info
    const user = getUser();
    document.getElementById('adminName').textContent = user.fullName || 'Administrator';
    document.getElementById('accountId').textContent = `ID: ${user.accountId || 'N/A'}`;
    
    const initials = (user.firstName?.charAt(0) || 'A') + (user.lastName?.charAt(0) || 'D');
    document.getElementById('userInitials').textContent = initials.toUpperCase();

    // Update stats
    if (data.stats) {
        document.getElementById('totalUsers').textContent = data.stats.totalUsers || 0;
        document.getElementById('totalStudents').textContent = data.stats.students || 0;
        document.getElementById('totalTeachers').textContent = data.stats.teachers || 0;
        document.getElementById('activeCourses').textContent = data.stats.activeCourses || 0;
    }

    // Update system health
    if (data.systemHealth) {
        document.getElementById('pendingReports').textContent = data.systemHealth.pendingReports || 0;
    }

    // Update recent activities
    if (data.recentActivities) {
        displayRecentActivities(data.recentActivities);
    }

    // Update date and time
    updateDateTime();
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
        case 'users':
            loadUsers();
            break;
        case 'courses':
            loadCourses();
            break;
        case 'announcements':
            loadAnnouncements();
            break;
        case 'reports':
            loadReports();
            break;
        case 'security':
            loadSecurityData();
            break;
    }
}

// Load Users
async function loadUsers() {
    try {
        const response = await apiRequest('/users', {
            method: 'GET'
        });

        if (response.success) {
            displayUsers(response.data);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showAlert('Failed to load users', 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.fullName || `${user.firstName} ${user.lastName}`}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${user.role}</span></td>
            <td>${user.admissionNumber || user.accountId || '-'}</td>
            <td>
                <span class="status status-${user.status}">
                    ${user.status}
                </span>
            </td>
            <td>
                <button class="btn btn-sm" onclick="editUser('${user._id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="toggleUserStatus('${user._id}', '${user.status}')">
                    ${user.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
            </td>
        </tr>
    `).join('');
}

// Filter Users
function filterUsers() {
    const roleFilter = document.getElementById('roleFilter').value;
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase();
    
    const rows = document.querySelectorAll('#usersTableBody tr');
    rows.forEach(row => {
        const role = row.querySelector('.badge')?.textContent;
        const text = row.textContent.toLowerCase();
        
        const matchesRole = !roleFilter || role === roleFilter;
        const matchesSearch = !searchTerm || text.includes(searchTerm);
        
        row.style.display = matchesRole && matchesSearch ? '' : 'none';
    });
}

// Create User Modal
async function showCreateUserModal() {
    // Load courses first
    const coursesResponse = await apiRequest('/courses', { method: 'GET' });
    
    const modal = createModal('Create New User', `
        <form id="createUserForm">
            <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-control" id="userRole" onchange="toggleUserFields()">
                    <option value="">Select Role</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="finance">Finance Officer</option>
                    <option value="gatepass">Gatepass Officer</option>
                    <option value="admin">Administrator</option>
                </select>
            </div>
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label class="form-label">First Name</label>
                    <input type="text" class="form-control" id="firstName" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Last Name</label>
                    <input type="text" class="form-control" id="lastName" required>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="userEmail" required>
            </div>
            <div class="form-group" id="admissionNumberGroup" style="display: none;">
                <label class="form-label">Admission Number</label>
                <input type="text" class="form-control" id="admissionNumber">
            </div>
            <div class="form-group">
                <label class="form-label">Course</label>
                <select class="form-control" id="userCourse">
                    <option value="">Select Course</option>
                    ${coursesResponse.data.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" class="form-control" id="userPassword" value="TempPass@123">
            </div>
        </form>
    `, [
        {
            label: 'Create User',
            onclick: 'createUser()',
            class: ''
        },
        {
            label: 'Cancel',
            onclick: 'closeModal(this)',
            class: 'btn-secondary'
        }
    ]);
}

function toggleUserFields() {
    const role = document.getElementById('userRole').value;
    const admissionGroup = document.getElementById('admissionNumberGroup');
    
    if (role === 'student') {
        admissionGroup.style.display = 'block';
    } else {
        admissionGroup.style.display = 'none';
    }
}

async function createUser() {
    const userData = {
        role: document.getElementById('userRole').value,
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('userEmail').value,
        course: document.getElementById('userCourse').value,
        password: document.getElementById('userPassword').value
    };

    if (userData.role === 'student') {
        userData.admissionNumber = document.getElementById('admissionNumber').value;
    }

    if (!userData.role || !userData.firstName || !userData.lastName || !userData.email || !userData.course) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (response.success) {
            showAlert('User created successfully!', 'success');
            document.querySelector('.modal').remove();
            loadUsers();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create user', 'error');
    } finally {
        showLoading(false);
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = currentStatus === 'active' ? 'suspend' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const response = await apiRequest(`/users/${userId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });

        if (response.success) {
            showAlert(`User ${action}d successfully!`, 'success');
            loadUsers();
        }
    } catch (error) {
        showAlert(error.message || `Failed to ${action} user`, 'error');
    }
}

// Load Courses
async function loadCourses() {
    try {
        const response = await apiRequest('/courses', {
            method: 'GET'
        });

        if (response.success) {
            displayCourses(response.data);
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showAlert('Failed to load courses', 'error');
    }
}

function displayCourses(courses) {
    const container = document.getElementById('coursesList');
    if (!container) return;

    if (!courses || courses.length === 0) {
        container.innerHTML = '<p class="no-data">No courses found</p>';
        return;
    }

    container.innerHTML = `
        <div class="courses-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${courses.map(course => `
                <div class="course-card card">
                    <h3>${course.name}</h3>
                    <p><strong>Code:</strong> ${course.code}</p>
                    <p><strong>Department:</strong> ${course.department}</p>
                    <p><strong>Duration:</strong> ${course.duration}</p>
                    <p><strong>Enrollment:</strong> ${course.currentEnrollment}/${course.maxStudents}</p>
                    <p><strong>Fee per Term:</strong> ${formatCurrency(course.fees?.perTerm || 0)}</p>
                    <div class="course-actions" style="margin-top: 15px;">
                        <button class="btn btn-sm" onclick="editCourse('${course._id}')">Edit</button>
                        <button class="btn btn-sm btn-secondary" onclick="viewCourseDetails('${course._id}')">View</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function showCreateCourseModal() {
    const modal = createModal('Create New Course', `
        <form id="createCourseForm">
            <div class="form-group">
                <label class="form-label">Course Name</label>
                <input type="text" class="form-control" id="courseName" required>
            </div>
            <div class="form-group">
                <label class="form-label">Course Code</label>
                <input type="text" class="form-control" id="courseCode" required style="text-transform: uppercase;">
            </div>
            <div class="form-group">
                <label class="form-label">Department</label>
                <input type="text" class="form-control" id="department" required>
            </div>
            <div class="form-group">
                <label class="form-label">Duration</label>
                <select class="form-control" id="duration">
                    <option value="2 years">2 Years</option>
                    <option value="3 years">3 Years</option>
                    <option value="4 years">4 Years</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="description" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Fee per Term (KES)</label>
                <input type="number" class="form-control" id="feePerTerm" required>
            </div>
            <div class="form-group">
                <label class="form-label">Max Students</label>
                <input type="number" class="form-control" id="maxStudents" value="100">
            </div>
        </form>
    `, [
        {
            label: 'Create Course',
            onclick: 'createCourse()',
            class: ''
        },
        {
            label: 'Cancel',
            onclick: 'closeModal(this)',
            class: 'btn-secondary'
        }
    ]);
}

async function createCourse() {
    const courseData = {
        name: document.getElementById('courseName').value,
        code: document.getElementById('courseCode').value.toUpperCase(),
        department: document.getElementById('department').value,
        duration: document.getElementById('duration').value,
        description: document.getElementById('description').value,
        fees: {
            perTerm: parseFloat(document.getElementById('feePerTerm').value),
            perYear: parseFloat(document.getElementById('feePerTerm').value) * 3,
            total: parseFloat(document.getElementById('feePerTerm').value) * 3 * parseInt(document.getElementById('duration').value)
        },
        maxStudents: parseInt(document.getElementById('maxStudents').value)
    };

    if (!courseData.name || !courseData.code || !courseData.department) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/courses', {
            method: 'POST',
            body: JSON.stringify(courseData)
        });

        if (response.success) {
            showAlert('Course created successfully!', 'success');
            document.querySelector('.modal').remove();
            loadCourses();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create course', 'error');
    } finally {
        showLoading(false);
    }
}

// Load Announcements
async function loadAnnouncements() {
    try {
        const response = await apiRequest('/announcements', {
            method: 'GET'
        });

        if (response.success) {
            displayAnnouncements(response.data);
        }
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

function displayAnnouncements(announcements) {
    const container = document.getElementById('announcementsList');
    if (!container) return;
    
    if (!announcements || announcements.length === 0) {
        container.innerHTML = '<p class="no-data">No announcements found</p>';
        return;
    }
    
    container.innerHTML = announcements.map(announcement => `
        <div class="announcement-item priority-${announcement.priority}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h4>${announcement.title}</h4>
                    <p>${announcement.content.substring(0, 200)}...</p>
                    <small>Created on ${formatDate(announcement.createdAt)} • Priority: ${announcement.priority}</small>
                </div>
                <div>
                    <button class="btn btn-sm" onclick="editAnnouncement('${announcement._id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAnnouncement('${announcement._id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function showCreateAnnouncementModal() {
    const modal = createModal('Create Announcement', `
        <form id="createAnnouncementForm">
            <div class="form-group">
                <label class="form-label">Title</label>
                <input type="text" class="form-control" id="announcementTitle" required>
            </div>
            <div class="form-group">
                <label class="form-label">Content</label>
                <textarea class="form-control" id="announcementContent" rows="5" required></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-control" id="announcementPriority">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Target Audience</label>
                <select class="form-control" id="targetAudience" multiple>
                    <option value="all" selected>All Users</option>
                    <option value="student">Students</option>
                    <option value="teacher">Teachers</option>
                    <option value="finance">Finance</option>
                    <option value="gatepass">Gatepass</option>
                </select>
            </div>
        </form>
    `, [
        {
            label: 'Create',
            onclick: 'createAnnouncement()',
            class: ''
        },
        {
            label: 'Cancel',
            onclick: 'closeModal(this)',
            class: 'btn-secondary'
        }
    ]);
}

async function createAnnouncement() {
    const selectedRoles = Array.from(document.getElementById('targetAudience').selectedOptions)
        .map(option => option.value);

    const announcementData = {
        title: document.getElementById('announcementTitle').value,
        content: document.getElementById('announcementContent').value,
        priority: document.getElementById('announcementPriority').value,
        targetAudience: {
            roles: selectedRoles
        }
    };

    if (!announcementData.title || !announcementData.content) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData)
        });

        if (response.success) {
            showAlert('Announcement created successfully!', 'success');
            document.querySelector('.modal').remove();
            loadAnnouncements();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to create announcement', 'error');
    } finally {
        showLoading(false);
    }
}

// Display Recent Activities
function displayRecentActivities(activities) {
    const container = document.getElementById('recentActivities');
    if (!container) return;

    if (!activities || activities.length === 0) {
        container.innerHTML = '<p class="no-data">No recent activities</p>';
        return;
    }

    container.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item" style="padding: 10px; border-bottom: 1px solid var(--border-light);">
            <strong>${activity.firstName} ${activity.lastName}</strong> (${activity.role})
            <br>
            <small>Last login: ${formatDate(activity.lastLogin, 'time')} on ${formatDate(activity.lastLogin)}</small>
        </div>
    `).join('');
}
