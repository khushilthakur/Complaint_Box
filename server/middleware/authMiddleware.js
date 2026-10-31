const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'scb-production-secret-key-multi-college-9988';

/**
 * Extract active user from JWT Bearer token or x-user-id header
 */
function authMiddleware(req, res, next) {
  let userId = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId || decoded.id;
    } catch (err) {
      // Invalid token
      return res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
  } else if (req.headers['x-user-id']) {
    userId = req.headers['x-user-id'];
  }

  if (userId) {
    const user = db.findById('users', userId);
    if (user) {
      if (user.status === 'blocked') {
        return res.status(403).json({ error: 'Your account has been blocked due to system policy violations.' });
      }
      req.user = user;
    }
  }

  next();
}

/**
 * Require specific role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access restricted to ${roles.join(' or ')}.` });
    }
    next();
  };
}

/**
 * Mask student details in complaints based on viewer permissions:
 * - Admin can see student's real identity.
 * - The student author can see their own real identity.
 * - Teachers, other students, and public visitors ONLY see maskedName / "Anonymous Student".
 */
function maskComplaintPrivacy(complaint, viewerUser = null) {
  if (!complaint) return null;
  const isViewerAdmin = viewerUser && viewerUser.role === 'admin';
  const isViewerAuthor = viewerUser && viewerUser.id === complaint.studentUserId;

  const clone = { ...complaint };

  if (isViewerAdmin) {
    const studentUser = db.findById('users', complaint.studentUserId);
    if (studentUser) {
      clone.studentRealDetails = {
        name: studentUser.name,
        mobile: studentUser.mobile,
        email: studentUser.email,
        studentId: studentUser.studentId,
        collegeId: studentUser.collegeId,
        status: studentUser.status,
        complaintLimit: studentUser.complaintLimit,
        complaintsSubmitted: studentUser.complaintsSubmitted
      };
    }
  } else if (isViewerAuthor) {
    const studentUser = db.findById('users', complaint.studentUserId);
    clone.studentRealDetails = {
      name: studentUser?.name,
      studentId: studentUser?.studentId,
      collegeId: studentUser?.collegeId
    };
  } else {
    delete clone.studentUserId;
    delete clone.studentRealDetails;
  }

  // Set the public display name
  if (complaint.isAnonymous) {
    clone.displayName = 'Anonymous Student';
  } else {
    clone.displayName = complaint.studentAnonymousId || 'Student';
  }

  return clone;
}

module.exports = {
  authMiddleware,
  requireRole,
  maskComplaintPrivacy,
  JWT_SECRET
};
