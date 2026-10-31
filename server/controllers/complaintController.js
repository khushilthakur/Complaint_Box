const db = require('../db');
const { maskComplaintPrivacy } = require('../middleware/authMiddleware');

// SLA hours lookup by priority
const SLA_HOURS = {
  Urgent: 24,
  High: 48,
  Medium: 72,
  Low: 168
};

/**
 * Get public complaints for transparency portal
 * Specification:
 * - Anyone can view approved/public complaints without login.
 * - Sensitive complaints marked Confidential are hidden from public.
 * - Search by Complaint ID, College ID, College name, Category, Priority, Status.
 * - Student's real identity is strictly hidden.
 */
exports.getPublicComplaints = (req, res) => {
  const { search, collegeId, category, priority, status, dateFrom, dateTo } = req.query;
  const complaints = db.get('complaints');
  const colleges = db.get('colleges');
  const collegesMap = new Map(colleges.map(c => [c.id, c.name]));

  let filtered = complaints.filter(c => {
    // Only approved/public lifecycle items (exclude Pending, Rejected, or Confidential from public board)
    // However, if user is admin, allow them to view all
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      if (c.status === 'Pending' || c.status === 'Rejected' || c.visibility === 'Confidential') {
        return false;
      }
    }
    return true;
  });

  // Filter by College ID
  if (collegeId) {
    filtered = filtered.filter(c => c.collegeId === collegeId.trim());
  }

  // Filter by Category
  if (category && category !== 'All') {
    filtered = filtered.filter(c => c.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by Priority
  if (priority && priority !== 'All') {
    filtered = filtered.filter(c => c.priority.toLowerCase() === priority.toLowerCase());
  }

  // Filter by Status
  if (status && status !== 'All') {
    filtered = filtered.filter(c => c.status.toLowerCase() === status.toLowerCase());
  }

  // Search by Complaint ID, College Name, or Title/Desc
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(c => {
      const colName = (collegesMap.get(c.collegeId) || '').toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.collegeId.toLowerCase().includes(q) ||
        colName.includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }

  // Date filtering
  if (dateFrom) {
    const fromTime = new Date(dateFrom).getTime();
    filtered = filtered.filter(c => new Date(c.createdAt).getTime() >= fromTime);
  }
  if (dateTo) {
    const toTime = new Date(dateTo).getTime();
    filtered = filtered.filter(c => new Date(c.createdAt).getTime() <= toTime);
  }

  // Mask student details and attach college name
  const result = filtered.map(c => {
    const masked = maskComplaintPrivacy(c, req.user);
    masked.collegeName = collegesMap.get(c.collegeId) || `College ${c.collegeId}`;
    return masked;
  });

  return res.json({ complaints: result, count: result.length });
};

/**
 * Get detailed complaint by ID with activity log and comments
 */
exports.getComplaintById = (req, res) => {
  const { id } = req.params;
  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint with ID ${id} not found` });
  }

  // Check confidential visibility
  if (complaint.visibility === 'Confidential') {
    const isAllowed = req.user && (
      req.user.role === 'admin' ||
      req.user.id === complaint.studentUserId ||
      req.user.id === complaint.assignedTeacherId
    );
    if (!isAllowed) {
      return res.status(403).json({ error: 'This complaint is confidential and restricted to authorized personnel.' });
    }
  }

  const colleges = db.get('colleges');
  const college = colleges.find(c => c.id === complaint.collegeId);
  const masked = maskComplaintPrivacy(complaint, req.user);
  masked.collegeName = college ? college.name : `College ${complaint.collegeId}`;

  // Get activity history
  const activities = db.find('activityLogs', a => a.complaintId === id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Get comments
  const comments = db.find('comments', c => c.complaintId === id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return res.json({
    complaint: masked,
    activities,
    comments
  });
};

/**
 * Get complaints created by the logged-in student
 */
exports.getMyComplaints = (req, res) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student login required' });
  }

  const complaints = db.find('complaints', c => c.studentUserId === req.user.id);
  const colleges = db.get('colleges');
  const collegesMap = new Map(colleges.map(c => [c.id, c.name]));

  const result = complaints.map(c => {
    const masked = maskComplaintPrivacy(c, req.user);
    masked.collegeName = collegesMap.get(c.collegeId) || `College ${c.collegeId}`;
    return masked;
  });

  return res.json({ complaints: result });
};

/**
 * Get complaints assigned to logged-in teacher
 */
exports.getTeacherComplaints = (req, res) => {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher login required' });
  }

  const complaints = db.find('complaints', c => c.assignedTeacherId === req.user.id);
  const colleges = db.get('colleges');
  const collegesMap = new Map(colleges.map(c => [c.id, c.name]));

  const result = complaints.map(c => {
    const masked = maskComplaintPrivacy(c, req.user);
    masked.collegeName = collegesMap.get(c.collegeId) || `College ${c.collegeId}`;
    return masked;
  });

  return res.json({ complaints: result });
};

/**
 * Submit a new complaint (Student only)
 * Specifications:
 * - Must provide College ID
 * - Verifies entered College ID belongs to student's registered college
 * - Cannot submit to another college
 * - Only active colleges can receive complaints
 * - Check quota: maximum limit of 10 complaints (or extended limit)
 * - Generate unique Complaint ID (e.g. CMP12345)
 * - Initial status: Pending (goes to admin for review)
 * - Anonymous option
 * - Support optional proof attachment
 */
exports.createComplaint = (req, res) => {
  const user = req.user;
  if (!user || user.role !== 'student') {
    return res.status(403).json({ error: 'Only registered students can submit complaints.' });
  }

  if (user.status === 'blocked' || user.status === 'restricted') {
    return res.status(403).json({ error: `Your account is currently ${user.status}. You cannot submit new complaints.` });
  }

  const { collegeId, title, description, category, priority, isAnonymous, proofUrl, proofName } = req.body;

  if (!collegeId || !title || !description || !category) {
    return res.status(400).json({ error: 'College ID, Title, Description, and Category are required.' });
  }

  const cleanCollegeId = collegeId.trim();

  // Rule: Verify entered College ID matches student's registered college
  if (cleanCollegeId !== user.collegeId) {
    return res.status(400).json({
      error: `College ID mismatch: You are registered under College ${user.collegeId}. You cannot submit a complaint for College ${cleanCollegeId}.`
    });
  }

  // Rule: College must be active
  const college = db.findById('colleges', cleanCollegeId);
  if (!college) {
    return res.status(404).json({ error: `College ${cleanCollegeId} does not exist.` });
  }
  if (college.status !== 'active') {
    return res.status(400).json({ error: `College ${college.name} is currently ${college.status}. Cannot receive new complaints.` });
  }

  // Rule: Check complaint limit (starts at 10)
  const currentSubmitted = user.complaintsSubmitted || 0;
  const currentLimit = user.complaintLimit || 10;
  if (currentSubmitted >= currentLimit) {
    return res.status(403).json({
      error: `Complaint limit of ${currentLimit} reached. Please contact your college administrator to extend your quota (+10 complaints).`
    });
  }

  // Generate unique Complaint ID
  let compId;
  do {
    compId = `CMP-${Math.floor(10000 + Math.random() * 90000)}`;
  } while (db.findById('complaints', compId));

  const validPriority = ['Low', 'Medium', 'High', 'Urgent'].includes(priority) ? priority : 'Medium';
  const validCategory = [
    'Academic',
    'Infrastructure',
    'Hostel',
    'Examination',
    'Fees/Administration',
    'Harassment/Safety',
    'Library',
    'Transport',
    'Other'
  ].includes(category) ? category : 'Other';

  // Sensitive category protection check
  const isSensitive = validCategory === 'Harassment/Safety';

  const newComplaint = {
    id: compId,
    collegeId: cleanCollegeId,
    studentUserId: user.id,
    studentAnonymousId: user.maskedName || `Student #${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
    isAnonymous: Boolean(isAnonymous),
    title: title.trim(),
    description: description.trim(),
    category: validCategory,
    priority: validPriority,
    status: 'Pending', // Initial status is always Pending for Admin review
    visibility: isSensitive ? 'Restricted' : 'Public', // Auto-protect sensitive complaints
    rejectionReason: null,
    assignedTeacherId: null,
    assignedTeacherName: null,
    assignedTeacherCollegeId: null,
    assignedTeacherRefId: null,
    assignedAt: null,
    slaHours: SLA_HOURS[validPriority] || 72,
    deadlineAt: null,
    isEscalated: false,
    escalatedAt: null,
    escalationReason: null,
    proofs: proofUrl ? [
      {
        id: `prf-${Date.now()}`,
        name: proofName || 'Evidence_attachment',
        url: proofUrl,
        uploadedByRole: 'student',
        uploadedAt: new Date().toISOString()
      }
    ] : [],
    resolutionProof: null,
    verification: {
      status: 'Pending'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.insert('complaints', newComplaint);

  // Increment student complaintsSubmitted count
  db.update('users', user.id, {
    complaintsSubmitted: currentSubmitted + 1
  });

  // Log activity
  const actorDisplay = isAnonymous ? 'Anonymous Student' : user.maskedName;
  db.logActivity(
    compId,
    'SUBMITTED',
    'student',
    actorDisplay,
    `Complaint submitted for College ${cleanCollegeId} (Category: ${validCategory}, Priority: ${validPriority}). Quota used: ${currentSubmitted + 1}/${currentLimit}.`
  );

  // Notify student
  db.notify(
    user.id,
    'student',
    'Complaint Submitted Successfully',
    `Your complaint ${compId} has been submitted and is under Admin review.`,
    compId,
    'submission'
  );

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'New Complaint Awaiting Review',
    `New complaint ${compId} submitted for ${college.name} (${validCategory} - ${validPriority}).`,
    compId,
    'submission'
  );

  const masked = maskComplaintPrivacy(newComplaint, user);
  return res.status(201).json({
    success: true,
    message: `Complaint ${compId} registered successfully`,
    complaint: masked,
    remainingQuota: currentLimit - (currentSubmitted + 1)
  });
};

/**
 * Admin Review: Approve or Reject complaint
 * Specification:
 * - Pending -> Approved or Rejected
 * - If Rejected, admin MUST provide a valid reason
 * - Rejection reason recorded, student notified
 * - Admin can set visibility (Public, Restricted, Confidential)
 */
exports.reviewComplaint = (req, res) => {
  const { id } = req.params;
  const { action, reason, visibility } = req.body; // action: 'approve' | 'reject'

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  if (action === 'reject') {
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A valid rejection reason is mandatory when rejecting a complaint.' });
    }

    const updated = db.update('complaints', id, {
      status: 'Rejected',
      rejectionReason: reason.trim()
    });

    db.logActivity(
      id,
      'REJECTED',
      'admin',
      'Administrator',
      `Complaint rejected. Reason: ${reason.trim()}`
    );

    // Notify student with reason
    db.notify(
      complaint.studentUserId,
      'student',
      'Complaint Rejected by Admin',
      `Your complaint ${id} was rejected. Reason: ${reason.trim()}`,
      id,
      'rejection'
    );

    return res.json({ success: true, message: 'Complaint rejected', complaint: updated });
  }

  if (action === 'approve') {
    const validVisibility = ['Public', 'Restricted', 'Confidential'].includes(visibility) 
      ? visibility 
      : complaint.visibility || 'Public';

    const updated = db.update('complaints', id, {
      status: 'Approved',
      visibility: validVisibility,
      rejectionReason: null
    });

    db.logActivity(
      id,
      'APPROVED',
      'admin',
      'Administrator',
      `Complaint approved for investigation. Visibility set to: ${validVisibility}.`
    );

    // Notify student
    db.notify(
      complaint.studentUserId,
      'student',
      'Complaint Approved',
      `Your complaint ${id} has been approved by Admin and is queued for teacher assignment.`,
      id,
      'approval'
    );

    return res.json({ success: true, message: 'Complaint approved', complaint: updated });
  }

  return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
};

/**
 * Admin Assign Teacher
 * Specification:
 * - Admin selects a suitable teacher from the same college
 * - Teacher receives a notification
 * - Teacher name and Teacher ID become visible
 * - Resolution timer starts when assigned!
 * - Deadline calculated according to priority SLA
 */
exports.assignTeacher = (req, res) => {
  const { id } = req.params;
  const { teacherId } = req.body;

  if (!teacherId) {
    return res.status(400).json({ error: 'Teacher selection is required' });
  }

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const teacher = db.findById('users', teacherId);
  if (!teacher || teacher.role !== 'teacher') {
    return res.status(400).json({ error: 'Selected user is not a valid teacher' });
  }

  // Rule: Teacher must belong to the SAME college as complaint
  if (teacher.collegeId !== complaint.collegeId) {
    return res.status(400).json({
      error: `Teacher ${teacher.name} belongs to College ${teacher.collegeId}, but complaint is for College ${complaint.collegeId}. Must assign from the same college.`
    });
  }

  // Rule: Teacher can only handle up to 10 active complaints; must complete them before receiving more
  const activeTeacherComplaints = db.find('complaints', c => 
    c.assignedTeacherId === teacher.id && 
    c.status !== 'Completed' && 
    c.status !== 'Rejected'
  );
  if (activeTeacherComplaints.length >= 10) {
    return res.status(400).json({
      error: `Teacher ${teacher.name} already has ${activeTeacherComplaints.length} active complaints assigned. They must complete these complaints before receiving more.`
    });
  }

  const now = new Date();
  const slaHours = complaint.slaHours || SLA_HOURS[complaint.priority] || 72;
  const deadline = new Date(now.getTime() + slaHours * 3600000);

  const updated = db.update('complaints', id, {
    assignedTeacherId: teacher.id,
    assignedTeacherName: teacher.name,
    assignedTeacherCollegeId: teacher.collegeId,
    assignedTeacherRefId: teacher.teacherId,
    assignedAt: now.toISOString(),
    deadlineAt: deadline.toISOString(),
    status: 'In Progress' // Moves to In Progress upon assignment
  });

  db.logActivity(
    id,
    'ASSIGNED',
    'admin',
    'Administrator',
    `Assigned to ${teacher.name} (Teacher ID: ${teacher.teacherId}). Resolution timer started (${slaHours}h SLA).`
  );

  // Notify teacher
  db.notify(
    teacher.id,
    'teacher',
    'New Complaint Assigned to You',
    `You have been assigned ${id}: "${complaint.title.substring(0, 35)}...". SLA: ${slaHours} hours.`,
    id,
    'assignment'
  );

  // Notify student
  db.notify(
    complaint.studentUserId,
    'student',
    'Teacher Assigned to Your Complaint',
    `Teacher ${teacher.name} (${teacher.teacherId}) has been assigned to work on your complaint.`,
    id,
    'assignment'
  );

  return res.json({
    success: true,
    message: `Assigned to ${teacher.name}`,
    complaint: updated
  });
};

/**
 * Teacher progress update / note
 */
exports.teacherUpdate = (req, res) => {
  const { id } = req.params;
  const { note, newStatus, proofUrl, proofName } = req.body;

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const updates = {};
  if (newStatus && ['In Progress', 'Assigned'].includes(newStatus)) {
    updates.status = newStatus;
  }

  if (proofUrl) {
    const proofs = complaint.proofs || [];
    proofs.push({
      id: `prf-${Date.now()}`,
      name: proofName || 'Teacher_Evidence',
      url: proofUrl,
      uploadedByRole: 'teacher',
      uploadedAt: new Date().toISOString()
    });
    updates.proofs = proofs;
  }

  const updated = db.update('complaints', id, updates);

  // Log activity
  db.logActivity(
    id,
    'UPDATE_POSTED',
    'teacher',
    req.user?.name || complaint.assignedTeacherName || 'Assigned Teacher',
    note || 'Posted progress update on complaint.'
  );

  // Add official comment if note provided
  if (note && note.trim()) {
    db.insert('comments', {
      id: `cmt-${Date.now()}`,
      complaintId: id,
      userId: req.user?.id,
      authorName: req.user?.name || complaint.assignedTeacherName,
      authorRole: 'teacher',
      isOfficial: true,
      text: note.trim(),
      createdAt: new Date().toISOString()
    });
  }

  // Notify student
  db.notify(
    complaint.studentUserId,
    'student',
    'Teacher Posted Progress Update',
    `Update on ${id}: ${note ? note.substring(0, 50) + '...' : 'Status updated.'}`,
    id,
    'update'
  );

  return res.json({ success: true, complaint: updated });
};

/**
 * Teacher Resolution: Mark complaint as Resolved with proof
 * Specification:
 * - Teacher provides proof or an explanation
 * - Attached to complaint
 * - Status moves to 'Resolved'
 * - Does NOT permanently close - moves to verification!
 */
exports.resolveComplaint = (req, res) => {
  const { id } = req.params;
  const { explanation, proofUrl } = req.body;

  if (!explanation || !explanation.trim()) {
    return res.status(400).json({ error: 'Resolution explanation/proof description is required.' });
  }

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const now = new Date();
  const resolutionProof = {
    text: explanation.trim(),
    proofUrl: proofUrl || null,
    resolvedBy: req.user?.name || complaint.assignedTeacherName || 'Teacher',
    resolvedAt: now.toISOString()
  };

  const updated = db.update('complaints', id, {
    status: 'Resolved',
    resolvedAt: now.toISOString(),
    resolutionProof,
    verification: {
      status: 'Pending',
      verifiedBy: null,
      verifiedAt: null,
      feedback: null
    }
  });

  db.logActivity(
    id,
    'RESOLVED',
    'teacher',
    req.user?.name || complaint.assignedTeacherName || 'Teacher',
    `Marked as Resolved. Proof/Explanation: ${explanation.trim().substring(0, 80)}... Verification requested.`
  );

  // Notify student to verify
  db.notify(
    complaint.studentUserId,
    'student',
    'Complaint Marked Resolved - Action Needed',
    `Teacher has submitted resolution proof for ${id}. Please verify whether it is Done or Not Done.`,
    id,
    'proof'
  );

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'Complaint Resolved by Teacher',
    `${complaint.assignedTeacherName} has marked ${id} as Resolved. Awaiting verification.`,
    id,
    'status'
  );

  return res.json({
    success: true,
    message: 'Complaint marked as Resolved. Verification pending from student.',
    complaint: updated
  });
};

/**
 * Resolution Verification: Student or Admin verifies result
 * Specification:
 * - Done -> Officially 'Completed'
 * - Not Done -> Problem still exists, moves back to 'In Progress' (or 'Not Done')
 * - Pending -> Waiting
 */
exports.verifyResolution = (req, res) => {
  const { id } = req.params;
  const { decision, feedback } = req.body; // decision: 'Done' | 'Not Done'

  if (!['Done', 'Not Done'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be "Done" or "Not Done".' });
  }

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const now = new Date();
  const isDone = decision === 'Done';

  const verification = {
    status: decision,
    verifiedBy: req.user?.role === 'admin' ? 'Administrator' : 'Student',
    verifiedAt: now.toISOString(),
    feedback: feedback ? feedback.trim() : (isDone ? 'Resolution confirmed by student.' : 'Problem still persists.')
  };

  const updates = {
    verification,
    status: isDone ? 'Completed' : 'In Progress', // If Not Done, returns to In Progress
    completedAt: isDone ? now.toISOString() : null
  };

  const updated = db.update('complaints', id, updates);

  db.logActivity(
    id,
    isDone ? 'COMPLETED' : 'VERIFIED',
    req.user?.role || 'student',
    req.user?.role === 'admin' ? 'Administrator' : 'Student',
    isDone
      ? 'Resolution verified as Done. Complaint officially completed and closed.'
      : `Resolution rejected (Not Done). Reason: ${feedback || 'Problem still exists'}. Returned to In Progress.`
  );

  // Notify assigned teacher
  if (complaint.assignedTeacherId) {
    db.notify(
      complaint.assignedTeacherId,
      'teacher',
      isDone ? 'Complaint Completed' : 'Resolution Marked Not Done',
      isDone 
        ? `Complaint ${id} was verified as Done by student and is now Closed.`
        : `Student flagged ${id} as Not Done: "${feedback || 'Problem still exists'}". Please follow up.`,
      id,
      'status'
    );
  }

  // Notify student if done
  if (isDone) {
    db.notify(
      complaint.studentUserId,
      'student',
      'Complaint Completed',
      `Complaint ${id} has been officially completed. Thank you for your feedback.`,
      id,
      'completion'
    );
  }

  return res.json({
    success: true,
    message: isDone ? 'Complaint marked as Completed.' : 'Complaint returned to In Progress.',
    complaint: updated
  });
};

/**
 * Escalate complaint (Admin or SLA monitor)
 * Specification:
 * - Timer exceeded or Admin escalation
 * - Alert sent, escalated to higher authority (e.g. Principal)
 * - Escalation history recorded
 */
exports.escalateComplaint = (req, res) => {
  const { id } = req.params;
  const { reason, escalatedTo } = req.body;

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const now = new Date();
  const escalationTarget = escalatedTo ? escalatedTo.trim() : 'College Principal & Grievance Cell';
  const escalationReason = reason ? reason.trim() : 'Resolution timer exceeded SLA threshold.';

  const updated = db.update('complaints', id, {
    isEscalated: true,
    escalatedAt: now.toISOString(),
    escalationReason,
    escalatedTo: escalationTarget,
    status: complaint.status === 'Completed' || complaint.status === 'Resolved' ? complaint.status : 'Escalated'
  });

  db.logActivity(
    id,
    'ESCALATED',
    'admin',
    req.user?.name || 'Administrator',
    `Escalated to ${escalationTarget}. Reason: ${escalationReason}`
  );

  // Notify student
  db.notify(
    complaint.studentUserId,
    'student',
    'Complaint Escalated to Higher Authority',
    `Your complaint ${id} has been escalated to ${escalationTarget} for urgent resolution.`,
    id,
    'escalation'
  );

  // Notify teacher
  if (complaint.assignedTeacherId) {
    db.notify(
      complaint.assignedTeacherId,
      'teacher',
      'ESCALATION WARNING',
      `Complaint ${id} has been escalated to ${escalationTarget} due to resolution delay.`,
      id,
      'escalation'
    );
  }

  return res.json({
    success: true,
    message: `Complaint escalated to ${escalationTarget}`,
    complaint: updated
  });
};

/**
 * Add a comment to a complaint
 * Specification:
 * - Anyone can comment on eligible public complaints
 * - Teachers provide updates through comments
 * - Admin official information through comments
 * - Admin & teacher comments clearly highlighted (isOfficial = true)
 * - Comments remain available even after completed
 */
exports.addComment = (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const user = req.user;
  const authorRole = user ? user.role : 'public';
  const isOfficial = authorRole === 'teacher' || authorRole === 'admin';

  let authorName;
  if (!user) {
    authorName = 'Public Visitor';
  } else if (user.role === 'student') {
    authorName = complaint.isAnonymous ? 'Anonymous Student' : (user.maskedName || 'Student');
  } else {
    authorName = user.name;
  }

  const newComment = {
    id: `cmt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    complaintId: id,
    userId: user ? user.id : 'guest',
    authorName,
    authorRole,
    isOfficial,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };

  db.insert('comments', newComment);

  db.logActivity(
    id,
    'COMMENT_ADDED',
    authorRole,
    authorName,
    `Added comment: "${text.trim().substring(0, 45)}..."`
  );

  return res.status(201).json({
    success: true,
    comment: newComment
  });
};

/**
 * Report complaint for misuse/spam/abuse
 * Specification:
 * - Fake complaints, spam, abusive content, inappropriate comments, misleading
 * - Sent to admin for review
 */
exports.reportComplaint = (req, res) => {
  const { id } = req.params;
  const { reason, details } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Report reason is required.' });
  }

  const complaint = db.findById('complaints', id);
  if (!complaint) {
    return res.status(404).json({ error: `Complaint ${id} not found` });
  }

  const newReport = {
    id: `rep-${Date.now()}`,
    complaintId: id,
    reportedByUserId: req.user ? req.user.id : 'anonymous_guest',
    reportedByName: req.user ? req.user.name : 'Public User',
    reason, // Fake Complaint | Spam | Abusive Content | Inappropriate Comments | Misleading Information
    details: details ? details.trim() : '',
    status: 'pending',
    adminAction: null,
    createdAt: new Date().toISOString()
  };

  db.insert('reports', newReport);

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'New Abuse/Misuse Report Filed',
    `Complaint ${id} has been reported for: "${reason}". Please review.`,
    id,
    'warning'
  );

  return res.status(201).json({
    success: true,
    message: 'Report submitted. The administration will inspect this complaint.',
    report: newReport
  });
};
