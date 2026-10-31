const db = require('../db');

/**
 * System analytics overview
 */
exports.getAnalytics = (req, res) => {
  const complaints = db.get('complaints');
  const colleges = db.get('colleges');
  const users = db.get('users');
  const reports = db.get('reports');

  const total = complaints.length;
  const pending = complaints.filter(c => c.status === 'Pending').length;
  const inProgress = complaints.filter(c => ['Approved', 'Assigned', 'In Progress', 'Not Done'].includes(c.status)).length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const completed = complaints.filter(c => c.status === 'Completed').length;
  const rejected = complaints.filter(c => c.status === 'Rejected').length;
  const escalated = complaints.filter(c => c.isEscalated || c.status === 'Escalated').length;

  // Category breakdown
  const categoryMap = {};
  complaints.forEach(c => {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
  });

  // Priority breakdown
  const priorityMap = {};
  complaints.forEach(c => {
    priorityMap[c.priority] = (priorityMap[c.priority] || 0) + 1;
  });

  // Turnaround hours calculation
  const completedList = complaints.filter(c => c.status === 'Completed' && c.assignedAt && c.completedAt);
  let avgTurnaroundHours = 0;
  if (completedList.length > 0) {
    const totalHours = completedList.reduce((acc, c) => {
      return acc + (new Date(c.completedAt).getTime() - new Date(c.assignedAt).getTime()) / 3600000;
    }, 0);
    avgTurnaroundHours = Math.round((totalHours / completedList.length) * 10) / 10;
  }

  const eligibleForRate = total - rejected;
  const systemResolutionRate = eligibleForRate > 0 
    ? Math.round(((resolved + completed) / eligibleForRate) * 100) 
    : 0;

  return res.json({
    metrics: {
      totalComplaints: total,
      pendingReview: pending,
      inProgress,
      resolved,
      completed,
      rejected,
      escalated,
      systemResolutionRate,
      avgTurnaroundHours,
      totalColleges: colleges.length,
      totalStudents: users.filter(u => u.role === 'student').length,
      totalTeachers: users.filter(u => u.role === 'teacher').length,
      pendingReports: reports.filter(r => r.status === 'pending').length
    },
    categoryBreakdown: categoryMap,
    priorityBreakdown: priorityMap
  });
};

/**
 * Get all users for Admin management
 * Note: Admin is the ONLY role that can view real student identities & contact numbers!
 */
exports.getAllUsers = (req, res) => {
  const users = db.get('users');
  const colleges = db.get('colleges');
  const complaints = db.get('complaints');
  const collegesMap = new Map(colleges.map(c => [c.id, c.name]));

  const enriched = users.map(u => {
    const userComplaints = complaints.filter(c => c.studentUserId === u.id);
    const completedCount = userComplaints.filter(c => c.status === 'Completed').length;
    const activeCount = userComplaints.filter(c => c.status !== 'Completed' && c.status !== 'Rejected').length;
    return {
      ...u,
      collegeName: collegesMap.get(u.collegeId) || 'N/A',
      completedComplaintsCount: completedCount,
      activeComplaintsCount: activeCount
    };
  });

  return res.json({
    students: enriched.filter(u => u.role === 'student'),
    teachers: enriched.filter(u => u.role === 'teacher'),
    admins: enriched.filter(u => u.role === 'admin')
  });
};

/**
 * Extend Student Complaint Quota (+10)
 * Specification:
 * - Admin controls the student's available complaint quota
 * - Rule: Admin can ONLY give 10 more complaints after the 10 complaints are completed!
 */
exports.extendQuota = (req, res) => {
  const { id } = req.params;
  const { amount = 10 } = req.body;

  const user = db.findById('users', id);
  if (!user || user.role !== 'student') {
    return res.status(404).json({ error: 'Student not found' });
  }

  // Check student completed complaints count
  const complaints = db.get('complaints');
  const studentComplaints = complaints.filter(c => c.studentUserId === id);
  const completedCount = studentComplaints.filter(c => c.status === 'Completed').length;

  // RULE: Admin can only give 10 more complaints after the 10 completed
  if (completedCount < 10) {
    return res.status(400).json({
      error: `Cannot extend quota: Student has only ${completedCount}/10 completed complaint(s). All 10 complaints must be completed before granting 10 more complaints.`
    });
  }

  const activeUnresolved = studentComplaints.filter(c => c.status !== 'Completed' && c.status !== 'Rejected').length;
  if (activeUnresolved > 0) {
    return res.status(400).json({
      error: `Cannot extend quota: Student still has ${activeUnresolved} ongoing complaint(s). All previous complaints must be completed before granting 10 more complaints.`
    });
  }

  const newLimit = (user.complaintLimit || 10) + Number(amount);
  const updated = db.update('users', id, { complaintLimit: newLimit });

  // Send notification to student
  db.notify(
    user.id,
    'student',
    'Complaint Quota Extended',
    `Your administrator has granted you an additional ${amount} complaints after verifying your completed complaints. Your new limit is ${newLimit}.`,
    null,
    'limit'
  );

  return res.json({
    success: true,
    message: `Quota for ${user.name} extended to ${newLimit} complaints.`,
    user: updated
  });
};

/**
 * Manage User Misuse / Sanctions
 * Specification:
 * - Warning -> Restriction -> Block
 */
exports.setUserSanction = (req, res) => {
  const { id } = req.params;
  const { status, warningNote } = req.body; // status: 'active' | 'warned' | 'restricted' | 'blocked'

  const user = db.findById('users', id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const updates = { status };
  if (status === 'warned') {
    updates.warningCount = (user.warningCount || 0) + 1;
  }

  const updated = db.update('users', id, updates);

  // Notify user
  db.notify(
    user.id,
    user.role,
    `Account Status Update: ${status.toUpperCase()}`,
    warningNote || `Your account status has been set to ${status} by the administrator.`,
    null,
    'warning'
  );

  return res.json({
    success: true,
    message: `User status set to ${status}`,
    user: updated
  });
};

/**
 * Verify Teacher Account
 */
exports.verifyTeacher = (req, res) => {
  const { id } = req.params;
  const teacher = db.findById('users', id);
  if (!teacher || teacher.role !== 'teacher') {
    return res.status(404).json({ error: 'Teacher not found' });
  }

  const updated = db.update('users', id, { isVerified: true });

  db.notify(
    teacher.id,
    'teacher',
    'Account Verified',
    'Your teacher account has been verified by the administrator. You can now accept complaint assignments.',
    null,
    'approval'
  );

  return res.json({
    success: true,
    message: `Teacher ${teacher.name} verified successfully`,
    teacher: updated
  });
};

/**
 * Get and manage abuse reports
 */
exports.getReports = (req, res) => {
  const reports = db.get('reports');
  const complaints = db.get('complaints');
  const complaintsMap = new Map(complaints.map(c => [c.id, c.title]));

  const enriched = reports.map(r => ({
    ...r,
    complaintTitle: complaintsMap.get(r.complaintId) || 'Unknown Complaint'
  }));

  return res.json({ reports: enriched });
};

/**
 * Act on a report
 */
exports.handleReport = (req, res) => {
  const { id } = req.params;
  const { action, note, markFake } = req.body; // action: 'dismissed' | 'action_taken'

  const report = db.findById('reports', id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const updatedReport = db.update('reports', id, {
    status: action || 'action_taken',
    adminAction: note || 'Reviewed and handled by administrator'
  });

  // If marked as fake complaint
  if (markFake && report.complaintId) {
    const comp = db.findById('complaints', report.complaintId);
    if (comp) {
      db.update('complaints', comp.id, {
        status: 'Rejected',
        rejectionReason: 'Flagged as Fake / Malicious Complaint following student code review.'
      });

      // Penalize student
      const student = db.findById('users', comp.studentUserId);
      if (student) {
        db.update('users', student.id, {
          warningCount: (student.warningCount || 0) + 1,
          status: (student.warningCount || 0) >= 2 ? 'restricted' : 'warned'
        });

        db.notify(
          student.id,
          'student',
          'PENALTY: Fake Complaint Warning',
          `Your complaint ${comp.id} was found to be fake/spam. A strike has been added to your record.`,
          comp.id,
          'warning'
        );
      }
    }
  }

  return res.json({ success: true, report: updatedReport });
};

