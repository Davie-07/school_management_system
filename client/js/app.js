// API Base URL
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

// Storage Keys
const STORAGE_KEYS = {
  TOKEN: 'ktc_token',
  USER: 'ktc_user',
  THEME: 'ktc_theme'
};

// Get stored token
const getToken = () => localStorage.getItem(STORAGE_KEYS.TOKEN);

// Get stored user
const getUser = () => {
  const user = localStorage.getItem(STORAGE_KEYS.USER);
  return user ? JSON.parse(user) : null;
};

// Save token and user
const saveAuthData = (token, user) => {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

// Clear auth data
const clearAuthData = () => {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
};

// Check if user is authenticated
const isAuthenticated = () => {
  return getToken() !== null;
};

// Redirect based on user role
const redirectToDashboard = (role) => {
  const dashboards = {
    admin: '/dashboards/admin.html',
    teacher: '/dashboards/teacher.html',
    student: '/dashboards/student.html',
    finance: '/dashboards/finance.html',
    gatepass: '/dashboards/gatepass.html'
  };
  
  window.location.href = dashboards[role] || '/';
};

// API Request Helper
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Show Alert
const showAlert = (message, type = 'info', duration = 3000) => {
  const alertContainer = document.getElementById('alert-container') || createAlertContainer();
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 1.2rem;">&times;</button>
  `;
  
  alertContainer.appendChild(alert);
  
  if (duration > 0) {
    setTimeout(() => {
      alert.remove();
    }, duration);
  }
};

// Create alert container if it doesn't exist
const createAlertContainer = () => {
  const container = document.createElement('div');
  container.id = 'alert-container';
  container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
  document.body.appendChild(container);
  return container;
};

// Show Loading
const showLoading = (show = true) => {
  let loader = document.getElementById('global-loader');
  
  if (show) {
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;';
      loader.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
  } else {
    if (loader) {
      loader.style.display = 'none';
    }
  }
};

// Format Date
const formatDate = (dateString, format = 'short') => {
  const date = new Date(dateString);
  
  if (format === 'short') {
    return date.toLocaleDateString('en-US');
  }
  
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (format === 'time') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  return date.toISOString();
};

// Format Currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount);
};

// Theme Management
const initTheme = () => {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggleIcon(savedTheme);
};

const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  updateThemeToggleIcon(newTheme);
};

const updateThemeToggleIcon = (theme) => {
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' 
      ? '<svg width="24" height="24" fill="currentColor"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
      : '<svg width="24" height="24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
};

// Mobile Menu Toggle
const toggleMobileMenu = () => {
  const navMenu = document.querySelector('.nav-menu');
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  
  if (navMenu && menuToggle) {
    navMenu.classList.toggle('active');
    menuToggle.classList.toggle('active');
  }
};

// Logout Function
const logout = async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuthData();
    window.location.href = '/login.html';
  }
};

// Protected Route Check
const checkAuth = () => {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
};

// Form Validation
const validateForm = (formId) => {
  const form = document.getElementById(formId);
  if (!form) return false;
  
  const inputs = form.querySelectorAll('[required]');
  let isValid = true;
  
  inputs.forEach(input => {
    const value = input.value.trim();
    const errorElement = input.nextElementSibling;
    
    if (!value) {
      isValid = false;
      input.classList.add('error');
      if (errorElement && errorElement.classList.contains('form-error')) {
        errorElement.textContent = 'This field is required';
      }
    } else {
      input.classList.remove('error');
      if (errorElement && errorElement.classList.contains('form-error')) {
        errorElement.textContent = '';
      }
    }
    
    // Email validation
    if (input.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        isValid = false;
        input.classList.add('error');
        if (errorElement && errorElement.classList.contains('form-error')) {
          errorElement.textContent = 'Invalid email format';
        }
      }
    }
    
    // Password validation
    if (input.type === 'password' && value && value.length < 6) {
      isValid = false;
      input.classList.add('error');
      if (errorElement && errorElement.classList.contains('form-error')) {
        errorElement.textContent = 'Password must be at least 6 characters';
      }
    }
  });
  
  return isValid;
};

// Create Modal
const createModal = (title, content, actions = []) => {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal(this)">&times;</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      ${actions.length > 0 ? `
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          ${actions.map(action => `
            <button class="btn ${action.class || ''}" onclick="${action.onclick}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('active'), 10);
  
  return modal;
};

// Close Modal
const closeModal = (element) => {
  const modal = element.closest('.modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
};

// Debounce Function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Search Function
const searchTable = (inputId, tableId) => {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  
  if (!input || !table) return;
  
  input.addEventListener('input', debounce((e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }, 300));
};

// Sort Table
const sortTable = (tableId, columnIndex) => {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  const rows = Array.from(tbody.getElementsByTagName('tr'));
  
  const sortedRows = rows.sort((a, b) => {
    const aText = a.cells[columnIndex].textContent.trim();
    const bText = b.cells[columnIndex].textContent.trim();
    
    // Check if numeric
    const aNum = parseFloat(aText);
    const bNum = parseFloat(bText);
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }
    
    return aText.localeCompare(bText);
  });
  
  // Check if already sorted
  const th = table.getElementsByTagName('th')[columnIndex];
  const isAscending = !th.classList.contains('sort-asc');
  
  // Remove all sort classes
  Array.from(table.getElementsByTagName('th')).forEach(header => {
    header.classList.remove('sort-asc', 'sort-desc');
  });
  
  if (!isAscending) {
    sortedRows.reverse();
    th.classList.add('sort-desc');
  } else {
    th.classList.add('sort-asc');
  }
  
  // Re-append sorted rows
  sortedRows.forEach(row => tbody.appendChild(row));
};

// Pagination
class Pagination {
  constructor(containerId, itemsPerPage = 10) {
    this.container = document.getElementById(containerId);
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.items = [];
  }
  
  setItems(items) {
    this.items = items;
    this.currentPage = 1;
    this.render();
  }
  
  render() {
    if (!this.container) return;
    
    const totalPages = Math.ceil(this.items.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const visibleItems = this.items.slice(start, end);
    
    // Render items (implement based on specific use case)
    this.renderItems(visibleItems);
    
    // Render pagination controls
    this.renderControls(totalPages);
  }
  
  renderItems(items) {
    // Override this method in specific implementations
  }
  
  renderControls(totalPages) {
    const controlsId = `${this.container.id}-controls`;
    let controls = document.getElementById(controlsId);
    
    if (!controls) {
      controls = document.createElement('div');
      controls.id = controlsId;
      controls.className = 'pagination-controls';
      this.container.parentElement.appendChild(controls);
    }
    
    controls.innerHTML = `
      <button onclick="pagination.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${this.currentPage} of ${totalPages}</span>
      <button onclick="pagination.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
  }
  
  goToPage(page) {
    const totalPages = Math.ceil(this.items.length / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.render();
    }
  }
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();
  
  // Add theme toggle button if not exists
  if (!document.querySelector('.theme-toggle')) {
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.onclick = toggleTheme;
    themeToggle.setAttribute('aria-label', 'Toggle theme');
    document.body.appendChild(themeToggle);
    updateThemeToggleIcon(document.documentElement.getAttribute('data-theme'));
  }
  
  // Add mobile menu event listeners
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', toggleMobileMenu);
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    const navMenu = document.querySelector('.nav-menu');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    if (navMenu && menuToggle && !navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
      navMenu.classList.remove('active');
      menuToggle.classList.remove('active');
    }
  });
});
