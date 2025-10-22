// Finance Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    const user = getUser();
    if (!user || user.role !== 'finance') {
        showAlert('Unauthorized access', 'error');
        window.location.href = '../login.html';
        return;
    }

    // Initialize dashboard
    initializeFinanceDashboard();
});

async function initializeFinanceDashboard() {
    try {
        showLoading(true);
        
        // Load dashboard data
        const dashboardData = await apiRequest('/dashboard/finance', {
            method: 'GET'
        });

        if (dashboardData.success) {
            updateFinanceDashboardUI(dashboardData.data);
            drawMonthlyChart(dashboardData.data.monthlyTrend);
            loadCourses();
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

function updateFinanceDashboardUI(data) {
    // Update user info
    const user = getUser();
    document.getElementById('financeName').textContent = user.fullName || 'Finance Officer';
    document.getElementById('accountId').textContent = `ID: ${user.accountId || 'N/A'}`;
    
    const initials = (user.firstName?.charAt(0) || 'F') + (user.lastName?.charAt(0) || 'O');
    document.getElementById('userInitials').textContent = initials.toUpperCase();

    // Update stats
    if (data.stats) {
        document.getElementById('todayCollection').textContent = formatCurrency(data.stats.todayCollection || 0);
        document.getElementById('monthCollection').textContent = formatCurrency(data.stats.monthCollection || 0);
        document.getElementById('activeDefaulters').textContent = data.stats.activeDefaulters || 0;
        document.getElementById('allowedGatepasses').textContent = data.stats.allowedGatepasses || 0;
    }

    // Update today's breakdown
    if (data.todayBreakdown) {
        displayTodayBreakdown(data.todayBreakdown);
    }

    // Display top defaulters
    if (data.topDefaulters) {
        displayTopDefaulters(data.topDefaulters);
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
        case 'fees':
            loadFeeRecords();
            break;
        case 'defaulters':
            loadDefaulters();
            break;
        case 'reports':
            loadReportOptions();
            break;
    }
}

// Display today's collection breakdown
function displayTodayBreakdown(breakdown) {
    const container = document.getElementById('todayBreakdown');
    if (!container) return;

    if (!breakdown || breakdown.length === 0) {
        container.innerHTML = '<p class="no-data">No collections today</p>';
        return;
    }

    container.innerHTML = `
        <div class="breakdown-list">
            ${breakdown.map(item => `
                <div class="breakdown-item" style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-light);">
                    <span>${item._id}</span>
                    <strong>${formatCurrency(item.amount)}</strong>
                    <span class="badge">${item.count} payments</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Display top defaulters
function displayTopDefaulters(defaulters) {
    const container = document.getElementById('topDefaultersList');
    if (!container) return;

    if (!defaulters || defaulters.length === 0) {
        container.innerHTML = '<p class="no-data">No defaulters found</p>';
        return;
    }

    container.innerHTML = defaulters.slice(0, 5).map(defaulter => `
        <div class="defaulter-item" style="padding: 10px; border-bottom: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <strong>${defaulter.student?.firstName} ${defaulter.student?.lastName}</strong><br>
                    <small>${defaulter.student?.admissionNumber} - ${defaulter.student?.course?.name}</small>
                </div>
                <div style="text-align: right;">
                    <strong style="color: var(--error);">${formatCurrency(defaulter.balance)}</strong><br>
                    <small>Total: ${formatCurrency(defaulter.totalAmount)}</small>
                </div>
            </div>
        </div>
    `).join('');
}

// Draw monthly collection chart
function drawMonthlyChart(data) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(data || {}),
            datasets: [{
                label: 'Daily Collection',
                data: Object.values(data || {}),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Load fee records
async function loadFeeRecords() {
    try {
        const response = await apiRequest('/fees', {
            method: 'GET'
        });

        if (response.success) {
            displayFeeRecords(response.data);
        }
    } catch (error) {
        console.error('Error loading fee records:', error);
        showAlert('Failed to load fee records', 'error');
    }
}

function displayFeeRecords(fees) {
    const tbody = document.getElementById('feesTableBody');
    if (!tbody) return;

    if (!fees || fees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No fee records found</td></tr>';
        return;
    }

    tbody.innerHTML = fees.map(fee => `
        <tr>
            <td>${fee.student?.admissionNumber || '-'}</td>
            <td>${fee.student?.firstName} ${fee.student?.lastName}</td>
            <td>${fee.course?.name || '-'}</td>
            <td>${formatCurrency(fee.totalAmount)}</td>
            <td>${formatCurrency(fee.totalPaid)}</td>
            <td>${formatCurrency(fee.balance)}</td>
            <td>
                <span class="badge badge-${fee.paymentStatus}">
                    ${fee.paymentStatus}
                </span>
            </td>
            <td>
                <button class="btn btn-sm" onclick="viewFeeDetails('${fee._id}')">View</button>
                <button class="btn btn-sm" onclick="showPaymentModal('${fee._id}')">Payment</button>
            </td>
        </tr>
    `).join('');
}

// Load student fee details for payment
let currentFeeRecord = null;

async function loadStudentFeeDetails() {
    const admissionNo = document.getElementById('paymentAdmissionNo').value;
    if (!admissionNo) {
        showAlert('Please enter admission number', 'error');
        return;
    }

    try {
        showLoading(true);
        
        // Find student
        const studentResponse = await apiRequest(`/users?admissionNumber=${admissionNo}`, {
            method: 'GET'
        });

        if (!studentResponse.data || studentResponse.data.length === 0) {
            showAlert('Student not found', 'error');
            return;
        }

        const student = studentResponse.data[0];
        
        // Get fee record
        const feeResponse = await apiRequest(`/fees/student/${student._id}`, {
            method: 'GET'
        });

        if (feeResponse.success && feeResponse.data.records.length > 0) {
            currentFeeRecord = feeResponse.data.records[0];
            displayStudentFeeInfo(student, currentFeeRecord);
            document.getElementById('studentFeeDetails').style.display = 'block';
        } else {
            showAlert('No fee record found for this student', 'error');
        }
    } catch (error) {
        console.error('Error loading student details:', error);
        showAlert('Failed to load student details', 'error');
    } finally {
        showLoading(false);
    }
}

function displayStudentFeeInfo(student, feeRecord) {
    const container = document.getElementById('studentInfo');
    if (!container) return;

    container.innerHTML = `
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
                <strong>Name:</strong> ${student.firstName} ${student.lastName}
            </div>
            <div>
                <strong>Admission No:</strong> ${student.admissionNumber}
            </div>
            <div>
                <strong>Course:</strong> ${student.course?.name || '-'}
            </div>
            <div>
                <strong>Email:</strong> ${student.email}
            </div>
            <div>
                <strong>Total Fees:</strong> ${formatCurrency(feeRecord.totalAmount)}
            </div>
            <div>
                <strong>Paid:</strong> ${formatCurrency(feeRecord.totalPaid)}
            </div>
            <div>
                <strong>Balance:</strong> <span style="color: ${feeRecord.balance > 0 ? 'var(--error)' : 'var(--success)'}">
                    ${formatCurrency(feeRecord.balance)}
                </span>
            </div>
            <div>
                <strong>Status:</strong> <span class="badge badge-${feeRecord.paymentStatus}">
                    ${feeRecord.paymentStatus}
                </span>
            </div>
        </div>
    `;
}

// Record payment
async function recordPayment() {
    if (!currentFeeRecord) {
        showAlert('Please load student details first', 'error');
        return;
    }

    const paymentData = {
        amount: parseFloat(document.getElementById('paymentAmount').value),
        paymentMethod: document.getElementById('paymentMethod').value,
        referenceNumber: document.getElementById('referenceNumber').value,
        notes: document.getElementById('paymentNotes').value
    };

    if (!paymentData.amount || !paymentData.referenceNumber) {
        showAlert('Please fill all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest(`/fees/${currentFeeRecord._id}/payment`, {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });

        if (response.success) {
            showAlert(`Payment recorded successfully! Receipt: ${response.receiptNumber}`, 'success');
            document.getElementById('paymentForm').reset();
            loadStudentFeeDetails(); // Reload to show updated balance
        }
    } catch (error) {
        showAlert(error.message || 'Failed to record payment', 'error');
    } finally {
        showLoading(false);
    }
}

// Gatepass management
async function searchGatepassStudent() {
    const admissionNo = document.getElementById('gatepassSearch').value;
    if (!admissionNo) {
        showAlert('Please enter admission number', 'error');
        return;
    }

    try {
        showLoading(true);
        
        // Find student and fee record
        const studentResponse = await apiRequest(`/users?admissionNumber=${admissionNo}`, {
            method: 'GET'
        });

        if (!studentResponse.data || studentResponse.data.length === 0) {
            showAlert('Student not found', 'error');
            return;
        }

        const student = studentResponse.data[0];
        const feeResponse = await apiRequest(`/fees/student/${student._id}`, {
            method: 'GET'
        });

        if (feeResponse.success && feeResponse.data.records.length > 0) {
            displayGatepassStudentInfo(student, feeResponse.data.records[0]);
            document.getElementById('gatepassStudentDetails').style.display = 'block';
        }
    } catch (error) {
        showAlert('Failed to load student details', 'error');
    } finally {
        showLoading(false);
    }
}

function displayGatepassStudentInfo(student, feeRecord) {
    const container = document.getElementById('gatepassStudentInfo');
    if (!container) return;

    const gatepassStatus = feeRecord.gatepassStatus || {};
    
    container.innerHTML = `
        <div class="info-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            <div>
                <strong>Name:</strong> ${student.firstName} ${student.lastName}
            </div>
            <div>
                <strong>Admission No:</strong> ${student.admissionNumber}
            </div>
            <div>
                <strong>Fee Balance:</strong> 
                <span style="color: ${feeRecord.balance > 0 ? 'var(--error)' : 'var(--success)'}">
                    ${formatCurrency(feeRecord.balance)}
                </span>
            </div>
            <div>
                <strong>Payment Status:</strong> 
                <span class="badge badge-${feeRecord.paymentStatus}">${feeRecord.paymentStatus}</span>
            </div>
            <div>
                <strong>Current Gatepass Status:</strong> 
                <span class="badge badge-${gatepassStatus.allowed ? 'success' : 'error'}">
                    ${gatepassStatus.allowed ? 'Allowed' : 'Denied'}
                </span>
            </div>
            ${gatepassStatus.allowedUntil ? `
                <div>
                    <strong>Allowed Until:</strong> ${formatDate(gatepassStatus.allowedUntil)}
                </div>
            ` : ''}
        </div>
    `;

    // Store fee record ID for update
    window.currentGatepassFeeId = feeRecord._id;
}

async function updateGatepassStatus() {
    if (!window.currentGatepassFeeId) {
        showAlert('Please search for a student first', 'error');
        return;
    }

    const status = document.getElementById('gatepassStatus').value;
    const gatepassData = {
        allowed: status === 'allow',
        reason: document.getElementById('gatepassReason').value
    };

    if (status === 'allow' && document.getElementById('allowUntilDate').value) {
        gatepassData.allowedUntil = document.getElementById('allowUntilDate').value;
    }

    try {
        showLoading(true);
        const response = await apiRequest(`/fees/${window.currentGatepassFeeId}/gatepass`, {
            method: 'PUT',
            body: JSON.stringify(gatepassData)
        });

        if (response.success) {
            showAlert('Gatepass status updated successfully!', 'success');
            searchGatepassStudent(); // Reload to show updated status
        }
    } catch (error) {
        showAlert(error.message || 'Failed to update gatepass status', 'error');
    } finally {
        showLoading(false);
    }
}

// Load defaulters
async function loadDefaulters() {
    try {
        const minBalance = document.getElementById('minBalance')?.value || 1000;
        const course = document.getElementById('defaulterCourseFilter')?.value || '';
        
        let url = `/fees/reports/defaulters?minimumBalance=${minBalance}`;
        if (course) url += `&course=${course}`;
        
        const response = await apiRequest(url, {
            method: 'GET'
        });

        if (response.success) {
            displayDefaulters(response.data);
        }
    } catch (error) {
        console.error('Error loading defaulters:', error);
        showAlert('Failed to load defaulters', 'error');
    }
}

function displayDefaulters(data) {
    const tbody = document.getElementById('defaultersTableBody');
    if (!tbody) return;

    if (!data.defaulters || data.defaulters.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No defaulters found</td></tr>';
        return;
    }

    tbody.innerHTML = data.defaulters.map(defaulter => `
        <tr>
            <td>${defaulter.student?.admissionNumber || '-'}</td>
            <td>${defaulter.student?.firstName} ${defaulter.student?.lastName}</td>
            <td>${defaulter.course?.name || '-'}</td>
            <td>${defaulter.student?.phoneNumber || defaulter.student?.email || '-'}</td>
            <td>${formatCurrency(defaulter.totalAmount)}</td>
            <td>${formatCurrency(defaulter.totalPaid)}</td>
            <td style="color: var(--error);">${formatCurrency(defaulter.balance)}</td>
            <td>
                <button class="btn btn-sm" onclick="contactDefaulter('${defaulter.student?._id}')">Contact</button>
            </td>
        </tr>
    `).join('');
}

// Load courses for filters
async function loadCourses() {
    try {
        const response = await apiRequest('/courses', {
            method: 'GET'
        });

        if (response.success) {
            const courseFilters = document.querySelectorAll('#defaulterCourseFilter, #reportCourse');
            courseFilters.forEach(select => {
                if (select) {
                    select.innerHTML = '<option value="">All Courses</option>';
                    response.data.forEach(course => {
                        select.innerHTML += `<option value="${course._id}">${course.name}</option>`;
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}
