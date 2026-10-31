const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { sendOtpSms } = require('../services/smsService');

const crypto = require('crypto');

// In-memory OTP store: mobile -> { code, expiresAt, attempts, lastSentAt, role }
const otpStore = new Map();

function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, collegeId: user.collegeId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Validates 10-digit Indian Mobile Numbers
 * - Exactly 10 digits
 * - Starts with 6, 7, 8, or 9
 * - Rejects dummy repeating numbers (e.g. 0000000000, 1111111111)
 * - Error message: "Please enter a valid 10-digit Indian mobile number."
 */
function validateIndianMobile(rawMobile) {
  if (!rawMobile || (typeof rawMobile !== 'string' && typeof rawMobile !== 'number')) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }
  const s = String(rawMobile).trim();
  if (/[^0-9+\-\s\(\)]/.test(s)) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  const cleaned = s.replace(/[\s\-\(\)]/g, '');
  let digits = cleaned;
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  } else if (digits.startsWith('+')) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  if (!/^\d{10}$/.test(digits)) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }
  if (!/^[6-9]/.test(digits)) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }
  if (/^(\d)\1{9}$/.test(digits)) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }
  return { valid: true, mobile: digits };
}

/**
 * Send OTP for Student or Teacher
 * Does not require advance registration. Returns generated OTP for display on login page.
 */
exports.sendOtp = async (req, res) => {
  const { mobile, role } = req.body;
  const validation = validateIndianMobile(mobile);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const cleanMobile = validation.mobile;
  const targetRole = (role || 'student').trim().toLowerCase();
  const now = Date.now();
  const stored = otpStore.get(cleanMobile);

  // 30-second cooldown check
  if (stored && (now - (stored.lastSentAt || 0)) < 30000) {
    const remaining = Math.ceil((30000 - (now - stored.lastSentAt)) / 1000);
    return res.status(429).json({
      error: `Please wait ${remaining} seconds before requesting a new OTP.`,
      cooldownRemaining: remaining
    });
  }

  // Generate cryptographically secure random 6-digit OTP
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  otpStore.set(cleanMobile, {
    code: otpCode,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes expiry
    lastSentAt: now,
    attempts: 0,
    role: targetRole
  });

  return res.json({
    success: true,
    otp: otpCode,
    message: 'Your OTP is ready. Enter the code displayed above.',
    expiresInSeconds: 300,
    resendCooldown: 30
  });
};

/**
 * Verify Student or Teacher OTP
 */
exports.verifyOtp = (req, res) => {
  const { mobile, otp, role } = req.body;
  if (!mobile || !otp) {
    return res.status(400).json({ error: 'Mobile number and 6-digit verification code are required.' });
  }

  const validation = validateIndianMobile(mobile);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const cleanOtp = String(otp).trim();
  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
  }

  const cleanMobile = validation.mobile;
  const stored = otpStore.get(cleanMobile);

  if (!stored) {
    return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(cleanMobile);
    return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
  }

  if (stored.attempts >= 5) {
    otpStore.delete(cleanMobile);
    return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
  }

  if (stored.code !== cleanOtp) {
    stored.attempts += 1;
    const remainingAttempts = Math.max(0, 5 - stored.attempts);
    return res.status(400).json({
      error: 'Incorrect OTP. Please try again.',
      attemptsRemaining: remainingAttempts
    });
  }

  const targetRole = (role || stored.role || 'student').trim().toLowerCase();
  // OTP verified successfully! Clear from store immediately to prevent reuse
  otpStore.delete(cleanMobile);

  if (targetRole === 'student') {
    let user = db.findOne('users', u => u.mobile === cleanMobile && u.role === 'student');
    if (!user) {
      // Safely initialize student account
      const colleges = db.find('colleges', c => c.status === 'active');
      const defaultCollege = colleges[0] || { id: '5555', name: 'Default College', code: 'COL' };
      const collegeId = String(defaultCollege.id || '5555');

      const studentsInCol = db.find('users', u => String(u.collegeId) === collegeId && u.role === 'student').length + 1;
      const studentId = `${collegeId}-S${String(studentsInCol).padStart(2, '0')}`;
      const userId = `USR-S${Math.floor(10000 + Math.random() * 90000)}`;
      const maskedName = `Student #${Math.floor(4096 + Math.random() * 61439).toString(16).toUpperCase()}`;

      user = {
        id: userId,
        role: 'student',
        name: `Student ${cleanMobile.slice(-4)}`,
        mobile: cleanMobile,
        email: `${userId.toLowerCase()}@student.${(defaultCollege.code || 'college').toLowerCase()}.edu`,
        collegeId,
        collegeName: defaultCollege.name,
        studentId,
        teacherId: null,
        department: null,
        isVerified: false,
        maskedName,
        complaintLimit: 10,
        complaintsSubmitted: 0,
        resolvedCount: 0,
        activeAssignedCount: 0,
        status: 'active',
        warningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: null
      };
      db.insert('users', user);
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Your account has been blocked due to system policy violations.' });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      user,
      role: 'student',
      token,
      message: 'Login successful. Welcome!'
    });
  } else if (targetRole === 'teacher') {
    let user = db.findOne('users', u => u.mobile === cleanMobile && u.role === 'teacher');
    if (!user) {
      // Create teacher approval request
      const colleges = db.find('colleges', c => c.status === 'active');
      const defaultCollege = colleges[0] || { id: '5555', name: 'Default College', code: 'COL' };
      const collegeId = String(defaultCollege.id || '5555');

      const teachersInCol = db.find('users', u => String(u.collegeId) === collegeId && u.role === 'teacher').length + 1;
      const teacherId = `${collegeId}-T${100 + teachersInCol}`;
      const userId = `USR-T${Math.floor(1000 + Math.random() * 9000)}`;

      user = {
        id: userId,
        role: 'teacher',
        name: `Prof. Teacher ${cleanMobile.slice(-4)}`,
        mobile: cleanMobile,
        email: `teacher.${cleanMobile.slice(-4)}@${(defaultCollege.code || 'college').toLowerCase()}.edu`,
        passwordHash: null,
        collegeId,
        collegeName: defaultCollege.name,
        studentId: null,
        teacherId,
        department: 'Faculty',
        isVerified: false,
        maskedName: null,
        complaintLimit: 10,
        complaintsSubmitted: 0,
        resolvedCount: 0,
        activeAssignedCount: 0,
        status: 'active',
        approvalStatus: 'Waiting for Approval',
        warningCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: null
      };
      db.insert('users', user);
    }

    const isApproved = user.approvalStatus === 'Approved' || (!user.approvalStatus && user.isVerified === true);
    if (isApproved) {
      const token = generateToken(user);
      return res.json({
        success: true,
        user,
        role: 'teacher',
        token,
        message: 'Login successful. Welcome!'
      });
    } else if (user.approvalStatus === 'Not Approved' || user.status === 'rejected') {
      return res.status(403).json({
        error: 'Your account has been rejected or is not approved by Admin.',
        approvalStatus: 'Not Approved'
      });
    } else {
      return res.status(403).json({
        error: 'Your account is waiting for Admin approval.',
        approvalStatus: 'Waiting for Approval'
      });
    }
  } else {
    return res.status(400).json({ error: 'Invalid role specified.' });
  }
};

/**
 * Register a new Student after OTP verification
 */
exports.registerStudent = (req, res) => {
  const { mobile, name, collegeId, email } = req.body;

  if (!mobile || !name || !collegeId) {
    return res.status(400).json({ error: 'Mobile, Full Name, and College ID are required.' });
  }

  const validation = validateIndianMobile(mobile);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const cleanMobile = validation.mobile;

  // If verification OTP was submitted, validate it against the OTP store
  const submittedOtp = req.body.otp ? String(req.body.otp).trim() : '';
  if (submittedOtp) {
    const storedOtp = otpStore.get(cleanMobile);
    const now = Date.now();
    if (!storedOtp || now > storedOtp.expiresAt) {
      return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
    }
    if (storedOtp.code !== submittedOtp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }
    otpStore.delete(cleanMobile);
  }

  const cleanCollegeId = collegeId.trim();

  // Rule: Same mobile number cannot create multiple student accounts
  const existing = db.findOne('users', u => u.mobile === cleanMobile && u.role === 'student');
  if (existing) {
    return res.status(400).json({ error: 'A student account is already registered with this mobile number. Please log in.' });
  }

  // Rule: College must exist and be active
  const college = db.findById('colleges', cleanCollegeId);
  if (!college) {
    return res.status(400).json({ error: `College with ID ${cleanCollegeId} does not exist.` });
  }
  if (college.status !== 'active') {
    return res.status(400).json({ error: `College ${college.name} is currently ${college.status}. Cannot register.` });
  }

  // Generate unique User ID and Student ID related to College ID
  const studentCountInCollege = db.find('users', u => u.collegeId === cleanCollegeId && u.role === 'student').length + 1;
  const studentId = `${cleanCollegeId}-S${String(studentCountInCollege).padStart(2, '0')}`;
  const userId = `USR-${Math.floor(10000 + Math.random() * 90000)}`;
  const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
  const maskedName = `Student #${randomHex}`;

  const newUser = {
    id: userId,
    role: 'student',
    name: name.trim(), // Real identity strictly protected
    mobile: cleanMobile,
    email: email ? email.trim() : `${userId.toLowerCase()}@student.${college.code.toLowerCase()}.edu`,
    collegeId: cleanCollegeId,
    studentId,
    maskedName,
    complaintLimit: 10, // Default limit of 10
    complaintsSubmitted: 0,
    status: 'active',
    warningCount: 0,
    createdAt: new Date().toISOString()
  };

  db.insert('users', newUser);

  db.notify(
    newUser.id,
    'student',
    'Account Registered Successfully',
    `Your student account is active for ${college.name}. Your Student ID is ${studentId}.`,
    null,
    'submission'
  );

  const token = generateToken(newUser);

  return res.status(201).json({
    success: true,
    message: 'Student registered successfully',
    user: newUser,
    token
  });
};

/**
 * Teacher Login with Teacher ID / Mobile / Email + Password
 */
exports.loginTeacher = (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Teacher ID / Email and Password are required.' });
  }

  const cleanId = identifier.trim();
  const teacher = db.findOne('users', u => 
    u.role === 'teacher' && (
      u.teacherId === cleanId || 
      u.email === cleanId || 
      u.mobile === cleanId
    )
  );

  if (!teacher) {
    return res.status(401).json({ error: 'No teacher account found with these credentials.' });
  }

  if (teacher.status === 'blocked') {
    return res.status(403).json({ error: 'Your account has been deactivated. Please contact the administrator.' });
  }

  // Validate password
  const isValid = teacher.passwordHash && bcrypt.compareSync(password, teacher.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password. Please verify your credentials.' });
  }

  const token = generateToken(teacher);
  return res.json({
    success: true,
    message: 'Teacher authenticated successfully',
    user: teacher,
    token
  });
};

/**
 * Teacher Registration
 */
exports.registerTeacher = (req, res) => {
  const { name, mobile, email, collegeId, teacherId: customTeacherId, employeeId, department, designation, password } = req.body;

  if (!name || !mobile || !collegeId || !password) {
    return res.status(400).json({ error: 'Name, Mobile, College ID, and Password are required.' });
  }

  const validation = validateIndianMobile(mobile);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const cleanMobile = validation.mobile;

  // If verification OTP was submitted, validate it against the OTP store
  const submittedOtp = req.body.otp ? String(req.body.otp).trim() : '';
  if (submittedOtp) {
    const storedOtp = otpStore.get(cleanMobile);
    const now = Date.now();
    if (!storedOtp || now > storedOtp.expiresAt) {
      return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
    }
    if (storedOtp.code !== submittedOtp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }
    otpStore.delete(cleanMobile);
  }

  const cleanCollegeId = collegeId.trim();
  const college = db.findById('colleges', cleanCollegeId);
  if (!college) {
    return res.status(400).json({ error: `College with ID ${cleanCollegeId} does not exist.` });
  }

  // Prevent duplicate teacher accounts using the same mobile number
  const existingMob = db.findOne('users', u => u.mobile === cleanMobile);
  if (existingMob) {
    return res.status(400).json({ error: 'An account is already registered with this mobile number. Please log in or use another number.' });
  }

  const teacherCount = db.find('users', u => u.collegeId === cleanCollegeId && u.role === 'teacher').length + 1;
  const teacherId = (customTeacherId || employeeId || '').trim() || `${cleanCollegeId}-T${100 + teacherCount}`;

  // Prevent duplicate teacher accounts using the same Teacher ID / Employee ID
  const existingTid = db.findOne('users', u => u.role === 'teacher' && String(u.teacherId || '').trim().toLowerCase() === teacherId.toLowerCase());
  if (existingTid) {
    return res.status(400).json({ error: `Teacher ID / Employee ID "${teacherId}" is already registered. Please choose a different ID.` });
  }

  const userId = `USR-T${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordHash = bcrypt.hashSync(password, 10);

  const newTeacher = {
    id: userId,
    role: 'teacher',
    name: name.trim(),
    mobile: cleanMobile,
    email: email ? email.trim() : `teacher.${teacherCount}@${college.code.toLowerCase()}.edu`,
    passwordHash,
    collegeId: cleanCollegeId,
    collegeName: college.name,
    teacherId,
    department: department ? department.trim() : 'General Department',
    designation: designation ? designation.trim() : 'Assistant Professor',
    isVerified: false, // Must be verified by Admin
    approvalStatus: 'Waiting for Approval',
    status: 'active',
    resolvedCount: 0,
    activeAssignedCount: 0,
    warningCount: 0,
    createdAt: new Date().toISOString()
  };

  db.insert('users', newTeacher);

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'New Teacher Awaiting Verification',
    `${newTeacher.name} (${teacherId}) has registered for ${college.name}. Please review and approve.`,
    null,
    'update'
  );

  return res.status(201).json({
    success: true,
    message: 'Your registration has been submitted successfully. Please wait for Admin approval.',
    teacherId,
    user: newTeacher
  });
};

/**
 * Admin Login with Email + Password
 */
exports.loginAdmin = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Admin Email and Password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const admin = db.findOne('users', u => u.role === 'admin' && u.email.toLowerCase() === cleanEmail);

  if (!admin) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const isValid = admin.passwordHash && bcrypt.compareSync(password, admin.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid administrator password.' });
  }

  const token = generateToken(admin);
  return res.json({
    success: true,
    message: 'Admin authenticated successfully',
    user: admin,
    token
  });
};

/**
 * Get active user session details
 */
exports.getMe = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
};
