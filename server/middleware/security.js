const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');
const hpp = require('hpp');
const { validationResult } = require('express-validator');

// Sanitize user input to prevent NoSQL injection attacks
const sanitizeInput = (req, res, next) => {
  // Remove any keys that start with '$' or contain '.'
  mongoSanitize.sanitize(req.body);
  mongoSanitize.sanitize(req.query);
  mongoSanitize.sanitize(req.params);
  
  // Recursively sanitize nested objects
  const deepSanitize = (obj) => {
    for (let key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        deepSanitize(obj[key]);
      } else if (typeof obj[key] === 'string') {
        // Remove any script tags and dangerous HTML
        obj[key] = xss(obj[key]);
        
        // Additional sanitization for specific patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
    }
  };
  
  deepSanitize(req.body);
  deepSanitize(req.query);
  
  next();
};

// Validate and sanitize specific fields
const validateAndSanitize = (field, type = 'string') => {
  return (req, res, next) => {
    const value = req.body[field] || req.query[field] || req.params[field];
    
    if (!value && req.body[field] !== false && req.body[field] !== 0) {
      return next();
    }
    
    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return res.status(400).json({
            success: false,
            message: `Invalid email format for ${field}`
          });
        }
        break;
        
      case 'alphanumeric':
        const alphanumericRegex = /^[a-zA-Z0-9]+$/;
        if (!alphanumericRegex.test(value)) {
          return res.status(400).json({
            success: false,
            message: `${field} must contain only letters and numbers`
          });
        }
        break;
        
      case 'number':
        if (isNaN(value)) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a number`
          });
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return res.status(400).json({
            success: false,
            message: `${field} must be a boolean value`
          });
        }
        break;
        
      default:
        // Basic string sanitization
        if (typeof value === 'string') {
          const sanitized = value
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/[^\w\s@.-]/gi, '') // Keep only safe characters
            .trim();
            
          if (req.body[field]) req.body[field] = sanitized;
          if (req.query[field]) req.query[field] = sanitized;
          if (req.params[field]) req.params[field] = sanitized;
        }
    }
    
    next();
  };
};

// Prevent SQL injection patterns
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b)/gi,
    /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    /(\'\s*OR\s*\')/gi
  ];
  
  const checkForSQL = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        for (let pattern of sqlPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (obj[key] && typeof obj[key] === 'object') {
        if (checkForSQL(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };
  
  if (checkForSQL(req.body) || checkForSQL(req.query) || checkForSQL(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected. Request blocked for security reasons.'
    });
  }
  
  next();
};

// Rate limiting configuration for specific routes
const getRateLimitConfig = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return {
    windowMs: windowMs,
    max: maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  };
};

// Validate request data
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

// Security headers
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
  next();
};

module.exports = {
  sanitizeInput,
  validateAndSanitize,
  preventSQLInjection,
  getRateLimitConfig,
  validateRequest,
  securityHeaders,
  mongoSanitize,
  hpp
};
