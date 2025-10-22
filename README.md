# Kandara Technical College - School Management System

A comprehensive school management system designed for Kandara Technical College with separate dashboards for students, teachers, administrators, finance officers, and security gate pass management.

## 🌟 Features

### Core Dashboards
- **Admin Dashboard**: User management, course creation, system monitoring
- **Teacher Dashboard**: Class scheduling, exam management, student tracking
- **Student Dashboard**: Timetables, exam results, fee status, reports
- **Finance Dashboard**: Fee management, payment tracking, gatepass authorization
- **Gatepass Dashboard**: Student verification, security receipt generation

### Key Features
- 🔐 Secure authentication system with role-based access
- 📚 Course and level management
- 📅 Dynamic scheduling and timetable system
- 📊 Exam results and performance tracking
- 💰 Fee payment management
- 🎫 Security gatepass system with time-based validity
- 📢 Targeted announcement system
- 📱 Mobile-responsive design
- 🌓 Light/Dark mode support

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account
- npm or yarn package manager

### MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for a free account

2. **Create a Cluster**
   - Click "Build a Cluster"
   - Choose the free tier (M0)
   - Select your preferred region
   - Name your cluster

3. **Configure Database Access**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Create a username and password (save these!)
   - Set privileges to "Read and write to any database"

4. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add your specific server IP

5. **Get Connection String**
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `myFirstDatabase` with `kandara_tech_college`

### Installation

1. **Clone or Download the Project**
   ```bash
   cd "SCHOOL MANAGEMENT SYST/kandara-tech-college"
   ```

2. **Install Backend Dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Configure Environment Variables**
   - Open `server/.env` file
   - Replace the MongoDB URI with your connection string:
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/kandara_tech_college?retryWrites=true&w=majority
   ```
   
   Example:
   ```env
   MONGODB_URI=mongodb+srv://ktcadmin:SecurePass123@cluster0.abcdef.mongodb.net/kandara_tech_college?retryWrites=true&w=majority
   ```

4. **Seed the Database** (First time setup)
   ```bash
   cd server
   node seed.js
   ```
   This will create:
   - Default admin, finance, gatepass, and teacher accounts
   - Sample courses and levels
   - Daily quotes
   - Welcome announcement

5. **Start the Backend Server**
   ```bash
   cd server
   npm start
   ```
   The server will run on http://localhost:5000

6. **Open the Frontend**
   - Open `client/index.html` in your browser
   - Or use a local server (e.g., Live Server in VS Code)

## 📝 Default Login Credentials

After running the seed script, use these credentials to log in:

### Admin Account
- Email: admin@ktc.ac.ke
- Account ID: 100001
- Password: Admin@2025
- Course: Select any

### Finance Officer
- Email: finance@ktc.ac.ke
- Account ID: 200001
- Password: Finance@2025
- Course: Select Business Administration

### Gatepass Officer
- Email: gatepass@ktc.ac.ke
- Account ID: 300001
- Password: Gate@2025
- Course: Select Information Technology

### Teacher Account
- Email: teacher1@ktc.ac.ke
- Account ID: 400001
- Password: Teacher@2025
- Course: Select Information Technology

**⚠️ IMPORTANT: Change these passwords after first login!**

## 🔧 Configuration

### Email Configuration (Optional)
To enable email notifications, update the email settings in `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Security Configuration
The system includes:
- Input sanitization against SQL/NoSQL injection
- XSS protection
- Rate limiting
- CSRF protection
- Secure password hashing
- JWT authentication

### Operating Hours
Gatepass system operates:
- Monday to Friday
- 6:00 AM to 5:00 PM
- Security receipts valid for 2 hours

## 📁 Project Structure

```
kandara-tech-college/
├── server/
│   ├── config/         # Database configuration
│   ├── models/         # MongoDB models
│   ├── routes/         # API routes
│   ├── middleware/     # Security and auth middleware
│   ├── utils/          # Helper functions
│   ├── server.js       # Main server file
│   ├── seed.js         # Database seeding script
│   └── .env            # Environment variables
├── client/
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│   ├── dashboards/     # Dashboard HTML files
│   ├── index.html      # Landing page
│   ├── login.html      # Login page
│   └── register.html   # Registration page
└── README.md           # This file
```

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - Student registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password recovery
- `POST /api/auth/reset-password` - Reset password

### Users
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create user (Admin/Teacher)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Courses
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course (Admin only)
- `PUT /api/courses/:id` - Update course (Admin only)
- `GET /api/courses/:id/levels` - Get course levels

### Schedules
- `GET /api/schedules` - Get schedules
- `POST /api/schedules` - Create schedule (Teacher/Admin)
- `GET /api/schedules/timetable` - Get weekly timetable

### Exams
- `GET /api/exams` - Get exams
- `POST /api/exams` - Create exam (Teacher/Admin)
- `POST /api/exams/:id/results` - Add exam results
- `POST /api/exams/:id/publish` - Publish results

### Fees
- `GET /api/fees` - Get fee records
- `POST /api/fees/:id/payment` - Record payment
- `PUT /api/fees/:id/gatepass` - Update gatepass status

### Gatepass
- `POST /api/gatepass/verify` - Verify student
- `GET /api/gatepass/receipt/:code` - Get receipt by code
- `POST /api/gatepass/student-receipt` - Generate student receipt

### Dashboard
- `GET /api/dashboard/student` - Student dashboard data
- `GET /api/dashboard/teacher` - Teacher dashboard data
- `GET /api/dashboard/admin` - Admin dashboard data
- `GET /api/dashboard/finance` - Finance dashboard data
- `GET /api/dashboard/gatepass` - Gatepass dashboard data

## 🔒 Security Features

1. **Input Validation & Sanitization**
   - All inputs are validated and sanitized
   - Protection against SQL/NoSQL injection
   - XSS prevention

2. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control
   - Session management

3. **Rate Limiting**
   - API rate limiting
   - Brute force protection on login

4. **Data Protection**
   - Passwords hashed with bcrypt
   - Sensitive data encryption
   - Secure HTTPS in production

## 📱 Mobile Responsiveness

The system is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🎨 Theme Support

- Light Mode: White background with dark text
- Dark Mode: Black background with light text
- School colors: Orange (branding), Green (buttons)

## 🤝 Support

For issues or questions:
1. Check the console for error messages
2. Verify MongoDB Atlas connection
3. Ensure all dependencies are installed
4. Check that the server is running

## 📄 License

This project is developed for Kandara Technical College.

## 🙏 Acknowledgments

- Kandara Technical College for the opportunity
- MongoDB Atlas for database hosting
- All contributors and testers

---

**Note**: This is a development version. For production deployment:
1. Use environment-specific configurations
2. Enable HTTPS
3. Set up proper backup systems
4. Configure monitoring and logging
5. Update default passwords
6. Restrict network access in MongoDB Atlas
