// Student Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    const user = getUser();
    if (!user || user.role !== 'student') {
        showAlert('Unauthorized access', 'error');
        window.location.href = '../login.html';
        return;
    }

    // Initialize dashboard
    initializeStudentDashboard();
});

async function initializeStudentDashboard() {
    try {
        showLoading(true);
        
        // Load dashboard data
        const dashboardData = await apiRequest('/dashboard/student', {
            method: 'GET'
        });

        if (dashboardData.success) {
            updateDashboardUI(dashboardData.data);
            loadTimetable();
            loadAnnouncements();
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

function updateDashboardUI(data) {
    // Update user info
    if (data.user) {
        document.getElementById('studentName').textContent = data.user.name || 'Student';
        document.getElementById('admissionNo').textContent = data.user.admissionNumber || 'N/A';
        document.getElementById('welcomeName').textContent = data.user.firstName || 'Student';
        document.getElementById('studentCourse').textContent = data.user.course?.name || 'N/A';
        
        const initials = (data.user.firstName?.charAt(0) || 'S') + 
                        (data.user.name?.split(' ').pop().charAt(0) || '');
        document.getElementById('userInitials').textContent = initials.toUpperCase();
    }

    // Update stats
    if (data.stats) {
        document.getElementById('attendanceRate').textContent = data.stats.attendanceRate;
        document.getElementById('averageGrade').textContent = data.stats.averageGrade;
        document.getElementById('feeBalance').textContent = formatCurrency(data.stats.feeBalance);
        document.getElementById('upcomingExams').textContent = data.stats.upcomingExams;
    }

    // Update daily quote
    if (data.dailyQuote) {
        document.getElementById('dailyQuote').textContent = data.dailyQuote.text;
        document.getElementById('quoteAuthor').textContent = `- ${data.dailyQuote.author}`;
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
}

// Load timetable
async function loadTimetable() {
    try {
        const response = await apiRequest('/schedules/timetable', {
            method: 'GET'
        });

        if (response.success) {
            displayTimetable(response.data);
        }
    } catch (error) {
        console.error('Error loading timetable:', error);
    }
}

function displayTimetable(timetableData) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const times = ['8:00-9:00', '9:00-10:00', '10:00-11:00', '11:00-12:00', 
                  '12:00-1:00', '2:00-3:00', '3:00-4:00', '4:00-5:00'];
    
    const grid = document.getElementById('timetableGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Header row
    const headerRow = document.createElement('div');
    headerRow.className = 'timetable-row header';
    headerRow.innerHTML = '<div class="timetable-cell time-header">Time</div>';
    days.forEach(day => {
        headerRow.innerHTML += `<div class="timetable-cell day-header">${day}</div>`;
    });
    grid.appendChild(headerRow);
    
    // Time rows
    times.forEach(time => {
        const row = document.createElement('div');
        row.className = 'timetable-row';
        row.innerHTML = `<div class="timetable-cell time-cell">${time}</div>`;
        
        days.forEach(day => {
            const schedule = timetableData[day]?.find(s => s.startTime === time.split('-')[0]);
            if (schedule) {
                row.innerHTML += `
                    <div class="timetable-cell class-cell">
                        <div class="class-item">
                            <strong>${schedule.title}</strong><br>
                            <small>${schedule.venue}</small>
                        </div>
                    </div>
                `;
            } else if (time === '12:00-1:00') {
                row.innerHTML += '<div class="timetable-cell lunch-cell">LUNCH</div>';
            } else {
                row.innerHTML += '<div class="timetable-cell empty-cell">-</div>';
            }
        });
        grid.appendChild(row);
    });
}

// Load exam results
async function loadExamResults() {
    try {
        showSection('results');
        const response = await apiRequest(`/exams/student/${getUser().id}`, {
            method: 'GET'
        });

        if (response.success) {
            displayExamResults(response.data);
        }
    } catch (error) {
        console.error('Error loading exam results:', error);
        showAlert('Failed to load exam results', 'error');
    }
}

function displayExamResults(results) {
    const container = document.getElementById('examResultsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p class="no-data">No exam results available</p>';
        return;
    }
    
    results.forEach(exam => {
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        
        const result = exam.results[0];
        const gradeColor = result.grade === 'A' ? 'green' : 
                          result.grade === 'B' ? 'blue' : 
                          result.grade === 'C' ? 'orange' : 'red';
        
        resultCard.innerHTML = `
            <div class="result-header">
                <h4>${exam.title}</h4>
                <span class="exam-type">${exam.examType}</span>
            </div>
            <div class="result-body">
                <div class="result-stats">
                    <div class="stat">
                        <span class="label">Score</span>
                        <span class="value">${result.score}/${exam.totalMarks}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Percentage</span>
                        <span class="value">${result.percentage?.toFixed(1)}%</span>
                    </div>
                    <div class="stat">
                        <span class="label">Grade</span>
                        <span class="value grade-${gradeColor}">${result.grade}</span>
                    </div>
                </div>
                <div class="result-footer">
                    <small>${formatDate(exam.date)}</small>
                    <button class="btn btn-sm" onclick="reportMisprint('${exam._id}')">
                        Report Issue
                    </button>
                </div>
            </div>
        `;
        container.appendChild(resultCard);
    });
}

// Load fee status
async function loadFeeStatus() {
    try {
        showSection('fees');
        const response = await apiRequest(`/fees/student/${getUser().id}`, {
            method: 'GET'
        });

        if (response.success) {
            displayFeeStatus(response.data);
        }
    } catch (error) {
        console.error('Error loading fee status:', error);
        showAlert('Failed to load fee information', 'error');
    }
}

function displayFeeStatus(feeData) {
    if (!feeData.records || feeData.records.length === 0) {
        document.getElementById('feeContent').innerHTML = '<p class="no-data">No fee records found</p>';
        return;
    }
    
    const currentFee = feeData.records[0];
    
    // Update fee summary
    document.getElementById('totalFees').textContent = formatCurrency(feeData.totalFees);
    document.getElementById('totalPaid').textContent = formatCurrency(feeData.totalPaid);
    document.getElementById('totalBalance').textContent = formatCurrency(feeData.totalBalance);
    
    // Draw pie chart
    drawFeeChart(currentFee.totalPaid, currentFee.balance);
    
    // Display payment history
    displayPaymentHistory(currentFee.payments);
}

function drawFeeChart(paid, balance) {
    const canvas = document.getElementById('feeChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const total = paid + balance;
    const paidPercentage = (paid / total) * 100;
    const balancePercentage = (balance / total) * 100;
    
    // Simple pie chart drawing
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw paid portion
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI/2, (paidPercentage * 2 * Math.PI / 100) - Math.PI/2);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = '#4CAF50';
    ctx.fill();
    
    // Draw balance portion
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, (paidPercentage * 2 * Math.PI / 100) - Math.PI/2, Math.PI * 1.5);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = '#FF6B35';
    ctx.fill();
    
    // Draw labels
    ctx.fillStyle = '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Paid: ${paidPercentage.toFixed(1)}%`, centerX - 60, centerY + radius + 30);
    ctx.fillText(`Balance: ${balancePercentage.toFixed(1)}%`, centerX + 60, centerY + radius + 30);
}

function displayPaymentHistory(payments) {
    const container = document.getElementById('paymentHistory');
    if (!container) return;
    
    if (!payments || payments.length === 0) {
        container.innerHTML = '<tr><td colspan="4">No payments recorded</td></tr>';
        return;
    }
    
    container.innerHTML = payments.map(payment => `
        <tr>
            <td>${formatDate(payment.paymentDate)}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>${payment.paymentMethod}</td>
            <td>${payment.receiptNumber}</td>
        </tr>
    `).join('');
}

// Generate security receipt
async function generateSecurityReceipt() {
    try {
        showLoading(true);
        const response = await apiRequest('/gatepass/student-receipt', {
            method: 'POST'
        });

        if (response.success) {
            showAlert('Security receipt generated successfully!', 'success');
            displayReceipt(response.data);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to generate receipt', 'error');
    } finally {
        showLoading(false);
    }
}

function displayReceipt(receiptData) {
    const modal = createModal('Security Receipt', `
        <div class="receipt-container">
            <div class="receipt-header">
                <h2 class="school-name">KANDARA TECHNICAL COLLEGE</h2>
                <h3>Security Receipt</h3>
            </div>
            <div class="receipt-body">
                <div class="receipt-info">
                    <p><strong>Receipt Number:</strong> ${receiptData.receiptNumber}</p>
                    <p><strong>Valid Until:</strong> ${new Date(receiptData.expiryTime).toLocaleString()}</p>
                </div>
                <div class="receipt-code">
                    <h1>${receiptData.code}</h1>
                    <p>Present this code at the gate</p>
                </div>
            </div>
            <div class="receipt-footer">
                <p>This receipt is valid for 2 hours</p>
            </div>
        </div>
    `, [
        {
            label: 'Print',
            onclick: 'window.print()',
            class: 'btn-secondary'
        },
        {
            label: 'Close',
            onclick: 'closeModal(this)'
        }
    ]);
}

// Submit report
async function submitReport() {
    const reportData = {
        reportType: document.getElementById('reportType').value,
        targetDashboard: document.getElementById('targetDashboard').value,
        subject: document.getElementById('reportSubject').value,
        description: document.getElementById('reportDescription').value,
        priority: document.getElementById('reportPriority').value
    };

    if (!reportData.reportType || !reportData.subject || !reportData.description) {
        showAlert('Please fill in all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await apiRequest('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });

        if (response.success) {
            showAlert('Report submitted successfully!', 'success');
            document.getElementById('reportForm').reset();
            loadMyReports();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to submit report', 'error');
    } finally {
        showLoading(false);
    }
}

// Load announcements
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
        container.innerHTML = '<p class="no-data">No announcements at this time</p>';
        return;
    }
    
    container.innerHTML = announcements.slice(0, 5).map(announcement => `
        <div class="announcement-item priority-${announcement.priority}">
            <h4>${announcement.title}</h4>
            <p>${announcement.content.substring(0, 150)}...</p>
            <small>${formatDate(announcement.createdAt)}</small>
        </div>
    `).join('');
}
