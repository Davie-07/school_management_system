// Gatepass Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    const user = getUser();
    if (!user || user.role !== 'gatepass') {
        showAlert('Unauthorized access', 'error');
        window.location.href = '../login.html';
        return;
    }

    // Initialize dashboard
    initializeGatepassDashboard();
    checkOperatingHours();
    setInterval(checkOperatingHours, 60000); // Check every minute
});

async function initializeGatepassDashboard() {
    try {
        showLoading(true);
        
        // Load dashboard data
        const dashboardData = await apiRequest('/dashboard/gatepass', {
            method: 'GET'
        });

        if (dashboardData.success) {
            updateGatepassDashboardUI(dashboardData.data);
            drawWeeklyChart(dashboardData.data.weeklyTrend);
            displayRecentVerifications(dashboardData.data.recentVerifications);
        }
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showAlert('Failed to load dashboard data', 'error');
    } finally {
        showLoading(false);
    }
}

function updateGatepassDashboardUI(data) {
    // Update user info
    const user = getUser();
    document.getElementById('gatepassName').textContent = user.fullName || 'Security Officer';
    document.getElementById('accountId').textContent = `ID: ${user.accountId || 'N/A'}`;
    
    const initials = (user.firstName?.charAt(0) || 'G') + (user.lastName?.charAt(0) || 'P');
    document.getElementById('userInitials').textContent = initials.toUpperCase();

    // Update stats
    if (data.stats) {
        document.getElementById('todayVerified').textContent = data.stats.todayVerified || 0;
        document.getElementById('todayDenied').textContent = data.stats.todayDenied || 0;
        document.getElementById('todayTotal').textContent = data.stats.todayTotal || 0;
        document.getElementById('activeReceipts').textContent = data.stats.activeReceipts || 0;
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

// Check operating hours
function checkOperatingHours() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const statusDiv = document.getElementById('operatingStatus');
    const statusMessage = document.getElementById('statusMessage');
    
    // Check if it's Monday-Friday (1-5)
    if (day === 0 || day === 6) {
        statusDiv.className = 'alert alert-error';
        statusMessage.textContent = '⚠️ CLOSED - The gate is closed on weekends';
    }
    // Check if it's between 6 AM and 5 PM
    else if (hour >= 6 && hour < 17) {
        statusDiv.className = 'alert alert-success';
        statusMessage.textContent = '✅ OPEN - Gate is operational';
    } else {
        statusDiv.className = 'alert alert-warning';
        statusMessage.textContent = '⚠️ CLOSED - Outside operating hours (6 AM - 5 PM)';
    }
}

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
        case 'history':
            loadHistory();
            break;
        case 'active':
            loadActiveReceipts();
            break;
        case 'reports':
            loadReportData();
            break;
    }
}

// Verify Student
async function verifyStudent() {
    const admissionNo = document.getElementById('verifyAdmissionNo').value.toUpperCase();
    
    if (!admissionNo) {
        showAlert('Please enter admission number', 'error');
        return;
    }

    try {
        showLoading(true);
        
        const response = await apiRequest('/gatepass/verify', {
            method: 'POST',
            body: JSON.stringify({ admissionNumber: admissionNo })
        });

        if (response.success) {
            displayVerificationResult(response.data, 'success');
        } else {
            displayVerificationResult(response, 'error');
        }
    } catch (error) {
        showAlert(error.message || 'Verification failed', 'error');
        displayVerificationResult({
            message: error.message || 'Verification failed',
            student: { admissionNumber: admissionNo }
        }, 'error');
    } finally {
        showLoading(false);
    }
}

function displayVerificationResult(data, status) {
    const resultDiv = document.getElementById('verificationResult');
    const contentDiv = document.getElementById('verificationContent');
    
    resultDiv.style.display = 'block';
    
    const isSuccess = status === 'success' && data.gatepass?.verificationStatus === 'verified';
    
    contentDiv.innerHTML = `
        <div class="verification-result ${isSuccess ? 'success' : 'error'}" 
             style="padding: 30px; text-align: center; border-radius: 10px; 
                    background: ${isSuccess ? 'var(--success)' : 'var(--error)'}; 
                    color: white;">
            <h1 style="font-size: 3rem; margin-bottom: 20px;">
                ${isSuccess ? '✅' : '❌'}
            </h1>
            <h2 style="margin-bottom: 15px;">
                ${isSuccess ? 'VERIFICATION SUCCESSFUL' : 'VERIFICATION DENIED'}
            </h2>
            <p style="font-size: 1.2rem; margin-bottom: 20px;">
                ${data.message}
            </p>
            
            ${data.student ? `
                <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; margin-top: 20px;">
                    <p><strong>Name:</strong> ${data.student.name || 'N/A'}</p>
                    <p><strong>Admission No:</strong> ${data.student.admissionNumber}</p>
                    <p><strong>Course:</strong> ${data.student.course || 'N/A'}</p>
                </div>
            ` : ''}
            
            ${data.receipt ? `
                <div style="background: white; color: var(--text-dark); padding: 20px; border-radius: 8px; margin-top: 20px;">
                    <h3 style="color: var(--primary-orange);">SECURITY RECEIPT</h3>
                    <p><strong>Receipt Number:</strong> ${data.receipt.number}</p>
                    <h1 style="color: var(--primary-orange); font-size: 2.5rem; letter-spacing: 5px; margin: 20px 0;">
                        ${data.receipt.code}
                    </h1>
                    <p><strong>Valid Until:</strong> ${new Date(data.receipt.validUntil).toLocaleString()}</p>
                </div>
            ` : ''}
        </div>
    `;
    
    // Clear the input
    document.getElementById('verifyAdmissionNo').value = '';
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        resultDiv.style.display = 'none';
    }, 10000);
}

// Display recent verifications
function displayRecentVerifications(verifications) {
    const container = document.getElementById('recentVerifications');
    if (!container) return;

    if (!verifications || verifications.length === 0) {
        container.innerHTML = '<p class="no-data">No verifications today</p>';
        return;
    }

    container.innerHTML = verifications.slice(0, 10).map(v => `
        <div class="verification-item" style="padding: 10px; border-bottom: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${v.student?.firstName} ${v.student?.lastName}</strong>
                    <br>
                    <small>${v.student?.admissionNumber} • ${formatDate(v.time, 'time')}</small>
                </div>
                <span class="badge badge-${v.status}">
                    ${v.status}
                </span>
            </div>
        </div>
    `).join('');
}

// Load verification history
async function loadHistory() {
    try {
        const date = document.getElementById('historyDate')?.value;
        const status = document.getElementById('historyStatus')?.value;
        
        let url = '/gatepass/history?';
        if (date) url += `date=${date}&`;
        if (status) url += `status=${status}`;
        
        const response = await apiRequest(url, {
            method: 'GET'
        });

        if (response.success) {
            displayHistory(response.data);
        }
    } catch (error) {
        console.error('Error loading history:', error);
        showAlert('Failed to load history', 'error');
    }
}

function displayHistory(history) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No verification history found</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(h => `
        <tr>
            <td>${formatDate(h.verificationTime, 'time')}</td>
            <td>${h.admissionNumber}</td>
            <td>${h.student?.firstName} ${h.student?.lastName}</td>
            <td>
                <span class="badge badge-${h.verificationStatus}">
                    ${h.verificationStatus}
                </span>
            </td>
            <td>${h.receiptNumber || '-'}</td>
            <td>${h.message || '-'}</td>
            <td>
                ${h.verificationStatus === 'verified' && h.verificationCode ? `
                    <button class="btn btn-sm" onclick="viewReceipt('${h.verificationCode}')">
                        View Receipt
                    </button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

// Load active receipts
async function loadActiveReceipts() {
    try {
        const response = await apiRequest('/gatepass/history?status=verified', {
            method: 'GET'
        });

        if (response.success) {
            const activeReceipts = response.data.filter(r => 
                new Date(r.expiryTime) > new Date() && !r.usedAt
            );
            displayActiveReceipts(activeReceipts);
        }
    } catch (error) {
        console.error('Error loading active receipts:', error);
    }
}

function displayActiveReceipts(receipts) {
    const tbody = document.getElementById('activeReceiptsBody');
    if (!tbody) return;

    if (!receipts || receipts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No active receipts</td></tr>';
        return;
    }

    tbody.innerHTML = receipts.map(r => {
        const expiryTime = new Date(r.expiryTime);
        const now = new Date();
        const isExpiring = (expiryTime - now) < 30 * 60 * 1000; // Less than 30 minutes
        
        return `
            <tr>
                <td style="font-family: monospace; font-weight: bold;">
                    ${r.verificationCode}
                </td>
                <td>${r.student?.firstName} ${r.student?.lastName}</td>
                <td>${r.admissionNumber}</td>
                <td>${formatDate(r.verificationTime)}</td>
                <td class="${isExpiring ? 'text-warning' : ''}">
                    ${formatDate(r.expiryTime, 'time')}
                </td>
                <td>
                    <span class="badge badge-success">Active</span>
                </td>
                <td>
                    <button class="btn btn-sm" onclick="markAsUsed('${r.verificationCode}')">
                        Mark Used
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Mark receipt as used
async function markAsUsed(code) {
    if (!confirm('Mark this receipt as used?')) return;

    try {
        const response = await apiRequest(`/gatepass/use/${code}`, {
            method: 'POST'
        });

        if (response.success) {
            showAlert('Receipt marked as used', 'success');
            loadActiveReceipts();
        }
    } catch (error) {
        showAlert(error.message || 'Failed to mark receipt as used', 'error');
    }
}

// View receipt
async function viewReceipt(code) {
    try {
        const response = await apiRequest(`/gatepass/receipt/${code}`, {
            method: 'GET'
        });

        if (response.success) {
            displayReceiptModal(response.data);
        }
    } catch (error) {
        showAlert(error.message || 'Failed to load receipt', 'error');
    }
}

function displayReceiptModal(receipt) {
    const modal = document.getElementById('receiptModal');
    const content = document.getElementById('receiptModalContent');
    
    content.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <h2 style="color: var(--primary-orange);">KANDARA TECHNICAL COLLEGE</h2>
            <h3>Security Receipt</h3>
            <hr style="margin: 20px 0;">
            
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
                <p><strong>Date:</strong> ${formatDate(receipt.verificationTime, 'long')}</p>
                <p><strong>Student Name:</strong> ${receipt.student?.firstName} ${receipt.student?.lastName}</p>
                <p><strong>Admission No:</strong> ${receipt.admissionNumber}</p>
                <p><strong>Payment Status:</strong> ${receipt.paymentStatus}</p>
            </div>
            
            <div style="background: var(--bg-light); padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h1 style="color: var(--primary-orange); font-size: 3rem; letter-spacing: 10px;">
                    ${receipt.verificationCode}
                </h1>
                <p>Verification Code</p>
            </div>
            
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Valid Until:</strong> ${formatDate(receipt.expiryTime, 'long')} ${formatDate(receipt.expiryTime, 'time')}</p>
                <p><strong>Status:</strong> 
                    <span class="badge badge-${receipt.verificationStatus}">
                        ${receipt.verificationStatus}
                    </span>
                </p>
            </div>
            
            <hr style="margin: 20px 0;">
            <p style="font-style: italic; color: var(--text-light);">
                This receipt is valid for 2 hours from generation
            </p>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeReceiptModal() {
    document.getElementById('receiptModal').style.display = 'none';
}

function printReceipt() {
    window.print();
}

// Draw weekly chart
function drawWeeklyChart(data) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    
    const labels = data.map(d => d._id);
    const verified = data.map(d => d.verified || 0);
    const denied = data.map(d => d.denied || 0);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Verified',
                    data: verified,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Denied',
                    data: denied,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Generate report
async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    if (!startDate || !endDate) {
        showAlert('Please select date range', 'error');
        return;
    }

    try {
        showLoading(true);
        
        const response = await apiRequest(`/gatepass/stats?startDate=${startDate}&endDate=${endDate}`, {
            method: 'GET'
        });

        if (response.success) {
            displayReport(response.data);
        }
    } catch (error) {
        showAlert('Failed to generate report', 'error');
    } finally {
        showLoading(false);
    }
}

function displayReport(data) {
    const resultDiv = document.getElementById('reportResult');
    const contentDiv = document.getElementById('reportContent');
    
    resultDiv.style.display = 'block';
    
    contentDiv.innerHTML = `
        <div class="report-summary">
            <h4>Report Summary</h4>
            <p><strong>Period:</strong> ${data.period.start} to ${data.period.end}</p>
            
            <div class="stats-grid mt-3">
                <div class="stat-card">
                    <div class="stat-value">${data.data.overall.verified}</div>
                    <div class="stat-label">Total Verified</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.data.overall.denied}</div>
                    <div class="stat-label">Total Denied</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.data.overall.total}</div>
                    <div class="stat-label">Total Verifications</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">
                        ${((data.data.overall.verified / data.data.overall.total) * 100).toFixed(1)}%
                    </div>
                    <div class="stat-label">Success Rate</div>
                </div>
            </div>
        </div>
    `;
}
