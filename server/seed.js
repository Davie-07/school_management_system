const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config();

// Models
const User = require('./models/User');
const Course = require('./models/Course');
const Level = require('./models/Level');
const Quote = require('./models/Quote');
const Announcement = require('./models/Announcement');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const seedData = async () => {
  try {
    console.log('Starting database seed...');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing data...');
    await User.deleteMany({ email: { $in: ['admin@ktc.ac.ke', 'finance@ktc.ac.ke', 'gatepass@ktc.ac.ke', 'teacher1@ktc.ac.ke'] }});
    await Course.deleteMany({});
    await Level.deleteMany({});
    await Quote.deleteMany({});

    // Create Courses
    console.log('Creating courses...');
    const courses = await Course.create([
      {
        name: 'Information Technology',
        code: 'IT',
        description: 'Comprehensive IT program covering software development, networking, and database management',
        department: 'Technology',
        duration: '3 years',
        fees: {
          total: 150000,
          perTerm: 50000,
          perYear: 150000
        },
        maxStudents: 200,
        status: 'active'
      },
      {
        name: 'Electrical Engineering',
        code: 'EE',
        description: 'Advanced electrical engineering program with focus on power systems and electronics',
        department: 'Engineering',
        duration: '3 years',
        fees: {
          total: 180000,
          perTerm: 60000,
          perYear: 180000
        },
        maxStudents: 150,
        status: 'active'
      },
      {
        name: 'Mechanical Engineering',
        code: 'ME',
        description: 'Comprehensive mechanical engineering program covering design, manufacturing, and automation',
        department: 'Engineering',
        duration: '3 years',
        fees: {
          total: 180000,
          perTerm: 60000,
          perYear: 180000
        },
        maxStudents: 150,
        status: 'active'
      },
      {
        name: 'Business Administration',
        code: 'BA',
        description: 'Business administration program with focus on management, finance, and entrepreneurship',
        department: 'Business',
        duration: '2 years',
        fees: {
          total: 120000,
          perTerm: 40000,
          perYear: 120000
        },
        maxStudents: 250,
        status: 'active'
      },
      {
        name: 'Hospitality Management',
        code: 'HM',
        description: 'Hospitality and tourism management program with practical training',
        department: 'Hospitality',
        duration: '2 years',
        fees: {
          total: 100000,
          perTerm: 35000,
          perYear: 100000
        },
        maxStudents: 100,
        status: 'active'
      }
    ]);

    // Create Levels for each course
    console.log('Creating levels...');
    for (const course of courses) {
      const levels = [];
      const duration = parseInt(course.duration);
      
      // Create levels based on duration
      for (let year = 1; year <= duration; year++) {
        for (let semester = 1; semester <= 2; semester++) {
          const level = await Level.create({
            name: `Year ${year} - Semester ${semester}`,
            code: `${course.code}-Y${year}S${semester}`,
            year: year,
            semester: semester,
            course: course._id,
            description: `Year ${year}, Semester ${semester} for ${course.name}`,
            status: 'active'
          });
          levels.push(level._id);
        }
      }
      
      // Update course with levels
      course.levels = levels;
      await course.save();
    }

    // Create Admin User
    console.log('Creating admin user...');
    const adminUser = await User.create({
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@ktc.ac.ke',
      password: 'Admin@2025', // Remember to change this in production
      role: 'admin',
      accountId: '100001',
      course: courses[0]._id, // Assign to IT course
      status: 'active',
      termsAccepted: true
    });

    // Create Finance User
    console.log('Creating finance user...');
    const financeUser = await User.create({
      firstName: 'Finance',
      lastName: 'Officer',
      email: 'finance@ktc.ac.ke',
      password: 'Finance@2025',
      role: 'finance',
      accountId: '200001',
      course: courses[3]._id, // Assign to Business course
      status: 'active',
      termsAccepted: true
    });

    // Create Gatepass User
    console.log('Creating gatepass user...');
    const gatepassUser = await User.create({
      firstName: 'Security',
      lastName: 'Officer',
      email: 'gatepass@ktc.ac.ke',
      password: 'Gate@2025',
      role: 'gatepass',
      accountId: '300001',
      course: courses[0]._id,
      status: 'active',
      termsAccepted: true
    });

    // Create Teacher User
    console.log('Creating teacher user...');
    const teacherUser = await User.create({
      firstName: 'John',
      lastName: 'Teacher',
      email: 'teacher1@ktc.ac.ke',
      password: 'Teacher@2025',
      role: 'teacher',
      accountId: '400001',
      course: courses[0]._id,
      assignedCourses: [courses[0]._id, courses[1]._id],
      status: 'active',
      termsAccepted: true
    });

    // Add teacher to courses
    courses[0].teachers.push(teacherUser._id);
    courses[1].teachers.push(teacherUser._id);
    await courses[0].save();
    await courses[1].save();

    // Create Daily Quotes
    console.log('Creating daily quotes...');
    await Quote.create([
      {
        text: "Education is the most powerful weapon which you can use to change the world.",
        author: "Nelson Mandela",
        category: 'educational',
        dayOfWeek: 'Monday',
        isActive: true
      },
      {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt",
        category: 'motivational',
        dayOfWeek: 'Tuesday',
        isActive: true
      },
      {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill",
        category: 'success',
        dayOfWeek: 'Wednesday',
        isActive: true
      },
      {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
        category: 'wisdom',
        dayOfWeek: 'Thursday',
        isActive: true
      },
      {
        text: "Believe you can and you're halfway there.",
        author: "Theodore Roosevelt",
        category: 'motivational',
        dayOfWeek: 'Friday',
        isActive: true
      },
      {
        text: "Education is not preparation for life; education is life itself.",
        author: "John Dewey",
        category: 'educational',
        dayOfWeek: 'All',
        isActive: true
      },
      {
        text: "The expert in anything was once a beginner.",
        author: "Helen Hayes",
        category: 'motivational',
        dayOfWeek: 'All',
        isActive: true
      }
    ]);

    // Create Welcome Announcement
    console.log('Creating welcome announcement...');
    await Announcement.create({
      title: 'Welcome to Kandara Technical College Management System',
      content: `
        Dear Students and Staff,
        
        We are pleased to announce the launch of our new School Management System. This system will help streamline our academic and administrative processes.
        
        Key Features:
        - Online fee payment tracking
        - Digital timetables and schedules
        - Exam results and performance tracking
        - Security gate pass system
        - Announcement and communication platform
        
        Please ensure you keep your login credentials secure and report any issues to the IT department.
        
        Best regards,
        Administration
      `,
      priority: 'high',
      targetAudience: {
        roles: ['all']
      },
      status: 'published',
      createdBy: adminUser._id
    });

    console.log('Database seed completed successfully!');
    console.log('\n=== Login Credentials ===');
    console.log('Admin: email: admin@ktc.ac.ke, accountId: 100001, password: Admin@2025');
    console.log('Finance: email: finance@ktc.ac.ke, accountId: 200001, password: Finance@2025');
    console.log('Gatepass: email: gatepass@ktc.ac.ke, accountId: 300001, password: Gate@2025');
    console.log('Teacher: email: teacher1@ktc.ac.ke, accountId: 400001, password: Teacher@2025');
    console.log('\nNOTE: Please change these passwords after first login!');
    console.log('========================\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedData();
