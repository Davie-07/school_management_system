# 🚀 Quick Start Guide - Kandara Technical College System

## Backend Setup (5 Minutes)

### Step 1: MongoDB Atlas Setup
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a free M0 cluster
4. Add database user (save username/password!)
5. Allow network access from anywhere (0.0.0.0/0)
6. Get your connection string

### Step 2: Configure Database Connection
1. Open `server/.env`
2. Replace the MONGODB_URI with your connection string:
```
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/kandara_tech_college?retryWrites=true&w=majority
```

### Step 3: Install & Run
Open terminal/command prompt in the kandara-tech-college folder:

```bash
# Install dependencies
cd server
npm install

# Seed the database (first time only)
node seed.js

# Start the server
npm start
```

The server will start on http://localhost:5000

## Frontend Access

Open `client/index.html` in your browser or use VS Code Live Server.

## Login Credentials

After running `node seed.js`, you'll have these accounts:

| Role | Email | Account ID | Password |
|------|-------|------------|----------|
| Admin | admin@ktc.ac.ke | 100001 | Admin@2025 |
| Finance | finance@ktc.ac.ke | 200001 | Finance@2025 |
| Gatepass | gatepass@ktc.ac.ke | 300001 | Gate@2025 |
| Teacher | teacher1@ktc.ac.ke | 400001 | Teacher@2025 |

**Note**: For non-student logins, select any course from the dropdown when logging in.

## Test the System

1. **Test Admin Login**:
   - Go to login page
   - Click "Staff" tab
   - Enter email, account ID, any course, and password
   - You should see the admin dashboard

2. **Create a Student**:
   - As admin, create a student account
   - Or use the registration page to register as a student

3. **Test API**:
   - Open browser console
   - Check network tab for API calls
   - All should return 200/201 status codes

## Troubleshooting

### Server won't start?
- Check MongoDB URI is correct
- Ensure port 5000 is not in use
- Check console for error messages

### Can't connect to database?
- Verify MongoDB Atlas network access settings
- Check username/password in connection string
- Ensure database name is `kandara_tech_college`

### Login fails?
- Use exact credentials from seed.js output
- For staff: use Account ID, not admission number
- Ensure you selected a course from dropdown

## Next Steps

The backend is fully functional! You can now:
1. Create the frontend dashboards
2. Test all API endpoints
3. Add more sample data
4. Customize the system

## Support Files

- `README.md` - Full documentation
- `server/seed.js` - Database initialization
- `server/.env` - Configuration (update MongoDB URI!)
- API routes in `server/routes/` folder

---

**Backend Status: ✅ COMPLETE**
- All models created
- All API routes implemented  
- Security measures in place
- Database seed ready
- Authentication working

**Frontend Status: 🚧 IN PROGRESS**
- Basic pages created (index, login, register)
- Dashboards need to be implemented
