const path = require('path');
require('./services/loadEnv');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const multer = require('multer');

const { authMiddleware, requireRole } = require('./middleware/authMiddleware');
const authController = require('./controllers/authController');
const collegeController = require('./controllers/collegeController');
const complaintController = require('./controllers/complaintController');
const adminController = require('./controllers/adminController');
const notificationController = require('./controllers/notificationController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for development
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads setup
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${safeName}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Static uploads route
app.use('/uploads', express.static(UPLOADS_DIR));

// Apply global auth context middleware
app.use(authMiddleware);

// --- ROUTES ---

// File Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    success: true,
    fileUrl,
    filename: req.file.originalname
  });
});

// Auth endpoints
app.post('/api/auth/send-otp', authController.sendOtp);
app.post('/api/auth/verify-otp', authController.verifyOtp);
app.post('/api/auth/register-student', authController.registerStudent);
app.post('/api/auth/login-teacher', authController.loginTeacher);
app.post('/api/auth/register-teacher', authController.registerTeacher);
app.post('/api/auth/login-admin', authController.loginAdmin);
app.get('/api/auth/me', authController.getMe);

// College endpoints
app.get('/api/colleges', collegeController.getColleges);
app.get('/api/colleges/rankings', collegeController.getRankings);
app.get('/api/colleges/:id', collegeController.getCollegeById);
app.post('/api/colleges/register', collegeController.registerCollege); // Public registration from Front Page
app.post('/api/colleges', requireRole('admin'), collegeController.createCollege);
app.patch('/api/colleges/:id', requireRole('admin'), collegeController.updateCollege);
app.delete('/api/colleges/:id', requireRole('admin'), collegeController.deleteCollege);

// Complaint endpoints
app.get('/api/complaints/public', complaintController.getPublicComplaints);
app.get('/api/complaints/my', requireRole('student'), complaintController.getMyComplaints);
app.get('/api/complaints/teacher', requireRole('teacher'), complaintController.getTeacherComplaints);
app.get('/api/complaints/:id', complaintController.getComplaintById);

app.post('/api/complaints', requireRole('student'), complaintController.createComplaint);
app.patch('/api/complaints/:id/review', requireRole('admin'), complaintController.reviewComplaint);
app.patch('/api/complaints/:id/assign', requireRole('admin'), complaintController.assignTeacher);
app.patch('/api/complaints/:id/teacher-update', requireRole('teacher'), complaintController.teacherUpdate);
app.post('/api/complaints/:id/resolve', requireRole('teacher'), complaintController.resolveComplaint);
app.post('/api/complaints/:id/verify', complaintController.verifyResolution);
app.post('/api/complaints/:id/escalate', requireRole('admin'), complaintController.escalateComplaint);
app.post('/api/complaints/:id/comments', complaintController.addComment);
app.post('/api/complaints/:id/report', complaintController.reportComplaint);

// Admin endpoints
app.get('/api/admin/analytics', requireRole('admin'), adminController.getAnalytics);
app.get('/api/admin/users', requireRole('admin'), adminController.getAllUsers);
app.patch('/api/admin/users/:id/quota', requireRole('admin'), adminController.extendQuota);
app.patch('/api/admin/users/:id/sanction', requireRole('admin'), adminController.setUserSanction);
app.patch('/api/admin/teachers/:id/verify', requireRole('admin'), adminController.verifyTeacher);
app.get('/api/admin/reports', requireRole('admin'), adminController.getReports);
app.post('/api/admin/reports/:id/action', requireRole('admin'), adminController.handleReport);

// Notification endpoints
app.get('/api/notifications', notificationController.getNotifications);
app.patch('/api/notifications/:id/read', notificationController.markAsRead);
app.post('/api/notifications/read-all', notificationController.markAllAsRead);

// Serve frontend if built
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Student Complaint Box backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;

