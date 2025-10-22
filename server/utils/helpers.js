const crypto = require('crypto');

// Generate unique IDs
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(4).toString('hex');
  return `${prefix}${timestamp}${randomStr}`.toUpperCase();
};

// Generate receipt number
const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RCP-${year}${month}${day}-${random}`;
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount);
};

// Calculate percentage
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

// Get current academic year
const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Academic year starts in January
  if (month >= 1 && month <= 12) {
    return `${year}`;
  }
  return `${year}`;
};

// Get current term
const getCurrentTerm = () => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 1 && month <= 4) return 'Term 1';
  if (month >= 5 && month <= 8) return 'Term 2';
  if (month >= 9 && month <= 12) return 'Term 3';
  
  return 'Term 1';
};

// Validate email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Kenyan format)
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^(\+254|0)[17]\d{8}$/;
  return phoneRegex.test(phone);
};

// Get grade from percentage
const getGradeFromPercentage = (percentage) => {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

// Get grade points
const getGradePoints = (grade) => {
  const gradePoints = {
    'A': 4.0,
    'B': 3.0,
    'C': 2.0,
    'D': 1.0,
    'E': 0.5,
    'F': 0.0
  };
  return gradePoints[grade] || 0.0;
};

// Calculate GPA
const calculateGPA = (grades) => {
  if (!grades || grades.length === 0) return 0.0;
  
  let totalPoints = 0;
  let totalCreditHours = 0;
  
  grades.forEach(grade => {
    const points = getGradePoints(grade.grade);
    const creditHours = grade.creditHours || 1;
    totalPoints += points * creditHours;
    totalCreditHours += creditHours;
  });
  
  if (totalCreditHours === 0) return 0.0;
  return (totalPoints / totalCreditHours).toFixed(2);
};

// Paginate results
const paginate = (array, pageNumber = 1, pageSize = 10) => {
  const startIndex = (pageNumber - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  return {
    data: array.slice(startIndex, endIndex),
    currentPage: pageNumber,
    totalPages: Math.ceil(array.length / pageSize),
    totalItems: array.length,
    hasNext: endIndex < array.length,
    hasPrev: pageNumber > 1
  };
};

// Get operating hours status
const isWithinOperatingHours = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const hour = now.getHours();
  
  // Check if it's Monday-Friday (1-5)
  if (day === 0 || day === 6) {
    return {
      isOpen: false,
      message: 'Closed on weekends'
    };
  }
  
  // Check if it's between 6 AM and 5 PM
  if (hour >= 6 && hour < 17) {
    return {
      isOpen: true,
      message: 'Open'
    };
  }
  
  return {
    isOpen: false,
    message: 'Closed - Operating hours: 6:00 AM - 5:00 PM'
  };
};

// Format date
const formatDate = (date, format = 'short') => {
  const d = new Date(date);
  
  if (format === 'short') {
    return d.toLocaleDateString('en-US');
  }
  
  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (format === 'time') {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  return d.toISOString();
};

// Get day of week
const getDayOfWeek = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
};

// Check if date is in the past
const isDateInPast = (date) => {
  return new Date(date) < new Date();
};

// Check if date is today
const isToday = (date) => {
  const today = new Date();
  const compareDate = new Date(date);
  return today.toDateString() === compareDate.toDateString();
};

// Generate random color for charts
const generateChartColor = (index) => {
  const colors = [
    '#4CAF50', // Green
    '#FF9800', // Orange
    '#2196F3', // Blue
    '#F44336', // Red
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FFC107', // Amber
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#E91E63'  // Pink
  ];
  return colors[index % colors.length];
};

module.exports = {
  generateUniqueId,
  generateReceiptNumber,
  formatCurrency,
  calculatePercentage,
  getCurrentAcademicYear,
  getCurrentTerm,
  isValidEmail,
  isValidPhoneNumber,
  getGradeFromPercentage,
  getGradePoints,
  calculateGPA,
  paginate,
  isWithinOperatingHours,
  formatDate,
  getDayOfWeek,
  isDateInPast,
  isToday,
  generateChartColor
};
