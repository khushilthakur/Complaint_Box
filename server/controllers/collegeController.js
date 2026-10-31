const db = require('../db');

/**
 * Calculate detailed statistics and performance metrics for all colleges
 */
function computeCollegeStats() {
  const colleges = db.get('colleges');
  const complaints = db.get('complaints');

  return colleges.map(col => {
    const colComplaints = complaints.filter(c => c.collegeId === col.id);
    const total = colComplaints.length;
    const pending = colComplaints.filter(c => c.status === 'Pending').length;
    const approved = colComplaints.filter(c => c.status === 'Approved').length;
    const assigned = colComplaints.filter(c => c.status === 'Assigned').length;
    const inProgress = colComplaints.filter(c => c.status === 'In Progress' || c.status === 'Not Done').length;
    const resolved = colComplaints.filter(c => c.status === 'Resolved').length;
    const completed = colComplaints.filter(c => c.status === 'Completed').length;
    const rejected = colComplaints.filter(c => c.status === 'Rejected').length;
    const escalated = colComplaints.filter(c => c.isEscalated || c.status === 'Escalated').length;

    // Calculate resolution rate: (Resolved + Completed) / (Total - Rejected) * 100
    const eligibleForResolution = total - rejected;
    const resolvedCount = resolved + completed;
    const resolutionRate = eligibleForResolution > 0 
      ? Math.round((resolvedCount / eligibleForResolution) * 100) 
      : 0;

    // Calculate average resolution time in hours
    const resolvedList = colComplaints.filter(c => (c.resolvedAt || c.completedAt) && c.assignedAt);
    let avgResolutionHours = 0;
    if (resolvedList.length > 0) {
      const totalHours = resolvedList.reduce((acc, c) => {
        const start = new Date(c.assignedAt).getTime();
        const end = new Date(c.resolvedAt || c.completedAt).getTime();
        return acc + Math.max(0, (end - start) / 3600000);
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedList.length) * 10) / 10;
    }

    // Teacher and student counts
    const teacherCount = db.find('users', u => u.collegeId === col.id && u.role === 'teacher').length;
    const studentCount = db.find('users', u => u.collegeId === col.id && u.role === 'student').length;

    return {
      ...col,
      totalComplaints: total,
      pendingComplaints: pending,
      inProgressComplaints: inProgress + assigned,
      resolvedComplaints: resolved,
      completedComplaints: completed,
      rejectedComplaints: rejected,
      escalatedComplaints: escalated,
      resolutionRate,
      avgResolutionHours,
      teacherCount,
      studentCount
    };
  });
}

/**
 * Get all colleges with performance statistics
 */
exports.getColleges = (req, res) => {
  const stats = computeCollegeStats();
  return res.json({ colleges: stats });
};

/**
 * Get single college by ID
 */
exports.getCollegeById = (req, res) => {
  const { id } = req.params;
  const stats = computeCollegeStats();
  const college = stats.find(c => c.id === id);
  if (!college) {
    return res.status(404).json({ error: `College with ID ${id} not found` });
  }
  return res.json({ college });
};

/**
 * Get public college rankings / statistics:
 * 1. Most Active Colleges (based on complaint activity)
 * 2. Highest Pending Complaints (largest unresolved count)
 * 3. Best Resolution Rate (effective resolution %)
 */
exports.getRankings = (req, res) => {
  const stats = computeCollegeStats();

  const mostActive = [...stats].sort((a, b) => b.totalComplaints - a.totalComplaints);
  const highestPending = [...stats].sort((a, b) => b.pendingComplaints - a.pendingComplaints);
  const bestResolution = [...stats].sort((a, b) => b.resolutionRate - a.resolutionRate);

  return res.json({
    rankings: {
      mostActive,
      highestPending,
      bestResolution
    },
    allColleges: stats
  });
};

/**
 * Register a new college (Admin only)
 * Specification:
 * - Each college receives a permanent unique College ID
 * - Maintained by admin
 * - Status: active, inactive, restricted
 */
exports.createCollege = (req, res) => {
  const { name, code, address, contactEmail, contactPhone, principalName, customId, status } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'College Name and Code are required' });
  }

  // Generate unique 4-digit ID or use requested custom permanent ID
  let collegeId = customId ? customId.trim() : null;
  if (collegeId) {
    const existing = db.findById('colleges', collegeId);
    if (existing) {
      return res.status(400).json({ error: `College ID ${collegeId} is already assigned to ${existing.name}` });
    }
  } else {
    // Generate unused 4-digit ID
    let genId;
    do {
      genId = Math.floor(1000 + Math.random() * 9000).toString();
    } while (db.findById('colleges', genId));
    collegeId = genId;
  }

  const newCollege = {
    id: collegeId,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    status: status || 'active', // active, inactive, restricted
    address: address ? address.trim() : 'Campus Address',
    contactEmail: contactEmail ? contactEmail.trim() : `admin@${code.toLowerCase()}.edu`,
    contactPhone: contactPhone ? contactPhone.trim() : '+91 98000 00000',
    principalName: principalName ? principalName.trim() : 'Principal Office',
    createdAt: new Date().toISOString()
  };

  db.insert('colleges', newCollege);

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'College Registered',
    `${newCollege.name} registered with permanent College ID: ${newCollege.id}`,
    null,
    'submission'
  );

  return res.status(201).json({
    success: true,
    message: `College ${newCollege.name} registered with College ID: ${newCollege.id}`,
    college: newCollege
  });
};

/**
 * Update college status or details (Admin only)
 */
exports.updateCollege = (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const college = db.findById('colleges', id);
  if (!college) {
    return res.status(404).json({ error: `College ${id} not found` });
  }

  const updated = db.update('colleges', id, updates);
  return res.json({ success: true, college: updated });
};

/**
 * Delete a college (Admin only)
 */
exports.deleteCollege = (req, res) => {
  const { id } = req.params;
  const college = db.findById('colleges', id);
  if (!college) {
    return res.status(404).json({ error: `College with ID ${id} not found` });
  }

  db.delete('colleges', id);

  // Notify admin
  db.notify(
    'USR-00001',
    'admin',
    'College Removed',
    `College ${college.name} (ID: ${id}) was removed from the registry.`,
    null,
    'status'
  );

  return res.json({
    success: true,
    message: `College "${college.name}" (ID: ${id}) removed successfully.`
  });
};

/**
 * Public College Registration (from Front Page)
 * Anyone representing a college can register their institution
 */
exports.registerCollege = (req, res) => {
  const { name, code, address, contactEmail, contactPhone, principalName, affiliation, customId } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'College Name is required' });
  }

  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'College Code / Acronym is required' });
  }

  // Generate unique 4-digit ID or use requested custom permanent ID
  let collegeId = customId ? customId.trim() : null;
  if (collegeId) {
    const existing = db.findById('colleges', collegeId);
    if (existing) {
      return res.status(400).json({ error: `College ID ${collegeId} is already registered to ${existing.name}` });
    }
  } else {
    // Generate unused 4-digit ID
    let genId;
    let attempts = 0;
    do {
      genId = Math.floor(1000 + Math.random() * 9000).toString();
      attempts++;
    } while (db.findById('colleges', genId) && attempts < 100);
    collegeId = genId;
  }

  const cleanCode = code.trim().toUpperCase();
  const cleanName = name.trim();

  // Check if college code already registered
  const existingCode = db.findOne('colleges', c => c.code === cleanCode);
  if (existingCode) {
    return res.status(400).json({ error: `A college with code "${cleanCode}" is already registered (${existingCode.name}).` });
  }

  const newCollege = {
    id: collegeId,
    name: cleanName,
    code: cleanCode,
    status: 'active', // Immediately usable for student registration, admin can manage/restrict anytime
    address: address ? address.trim() : 'Campus Address',
    contactEmail: contactEmail ? contactEmail.trim() : `contact@${cleanCode.toLowerCase()}.edu`,
    contactPhone: contactPhone ? contactPhone.trim() : '',
    principalName: principalName ? principalName.trim() : 'Principal / Authorized Head',
    affiliation: affiliation ? affiliation.trim() : 'State / Central University',
    registeredFrom: 'front_page',
    createdAt: new Date().toISOString()
  };

  db.insert('colleges', newCollege);

  // Notify Super Admin
  db.notify(
    'USR-00001',
    'admin',
    'New College Registered',
    `${newCollege.name} (${newCollege.code}) registered from front page with Permanent College ID: ${newCollege.id}`,
    null,
    'submission'
  );

  return res.status(201).json({
    success: true,
    message: `College "${newCollege.name}" registered successfully with College ID: ${newCollege.id}!`,
    college: newCollege
  });
};

