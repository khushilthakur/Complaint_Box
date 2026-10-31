// Initial seed data matching documentation for Multi-College Student Complaint Management System

const seedData = {
  colleges: [
    {
      id: "5555",
      name: "ABC College of Engineering",
      code: "ABC",
      status: "active",
      address: "12 Institutional Area, South Campus",
      contactEmail: "contact@abc.edu",
      contactPhone: "+91 11 2345 6789",
      principalName: "Dr. K. S. Ramanujan",
      affiliation: "State Technical University",
      registeredFrom: "system_seed",
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
    },
    {
      id: "2041",
      name: "Delhi Institute of Technology",
      code: "DIT",
      status: "active",
      address: "44 Knowledge Park, Sector 62",
      contactEmail: "info@dit.edu",
      contactPhone: "+91 11 9876 5432",
      principalName: "Dr. Sunita Deshmukh",
      affiliation: "Central Technological University",
      registeredFrom: "system_seed",
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
    }
  ],

  users: [
    // System Super Admin
    {
      id: "USR-00001",
      role: "admin",
      name: "Super Administrator",
      mobile: "9876543210",
      email: "khushilthakur28@gmail.com",
      passwordHash: "$2b$10$KV6Vyk8UFMd9LgqlUZkJ5ud4G9B1bDd/70njiKv7gbNQbCzlu1mca", // 557858466179=2131
      status: "active",
      warningCount: 0,
      createdAt: new Date(Date.now() - 100 * 86400000).toISOString()
    },
    // Faculty 1 (ABC College - 5555)
    {
      id: "USR-T1001",
      role: "teacher",
      name: "Prof. Rajesh Verma",
      mobile: "9811122233",
      email: "rajesh.verma@abc.edu",
      collegeId: "5555",
      collegeName: "ABC College of Engineering",
      teacherId: "5555-T100",
      department: "Computer Science & Engineering",
      passwordHash: "$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa", // Teacher@123
      status: "active",
      isVerified: true,
      resolvedCount: 1,
      activeAssignedCount: 1,
      warningCount: 0,
      createdAt: new Date(Date.now() - 80 * 86400000).toISOString()
    },
    // Faculty 2 (ABC College - 5555)
    {
      id: "USR-T1002",
      role: "teacher",
      name: "Dr. Meenakshi Sundaram",
      mobile: "9822233344",
      email: "meenakshi@abc.edu",
      collegeId: "5555",
      collegeName: "ABC College of Engineering",
      teacherId: "5555-T101",
      department: "Electrical & Electronics",
      passwordHash: "$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa", // Teacher@123
      status: "active",
      isVerified: true,
      resolvedCount: 0,
      activeAssignedCount: 0,
      warningCount: 0,
      createdAt: new Date(Date.now() - 75 * 86400000).toISOString()
    },
    // Faculty 3 (Delhi Tech - 2041)
    {
      id: "USR-T2001",
      role: "teacher",
      name: "Prof. Amit Saxena",
      mobile: "9833344455",
      email: "amit.saxena@dit.edu",
      collegeId: "2041",
      collegeName: "Delhi Institute of Technology",
      teacherId: "2041-T201",
      department: "Mechanical Engineering",
      passwordHash: "$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa", // Teacher@123
      status: "active",
      isVerified: true,
      resolvedCount: 0,
      activeAssignedCount: 0,
      warningCount: 0,
      createdAt: new Date(Date.now() - 70 * 86400000).toISOString()
    },
    // Registered Student 1 (ABC College - 5555)
    {
      id: "USR-S1001",
      role: "student",
      name: "Aarav Sharma",
      mobile: "9899123456",
      email: "aarav.sharma@student.abc.edu",
      collegeId: "5555",
      studentId: "5555-S01",
      maskedName: "Student #A782",
      complaintLimit: 10,
      complaintsSubmitted: 2,
      status: "active",
      warningCount: 0,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
    },
    // Registered Student 2 (Delhi Tech - 2041)
    {
      id: "USR-S2001",
      role: "student",
      name: "Sneha Patel",
      mobile: "9899345678",
      email: "sneha.patel@student.dit.edu",
      collegeId: "2041",
      studentId: "2041-S01",
      maskedName: "Student #C419",
      complaintLimit: 10,
      complaintsSubmitted: 1,
      status: "active",
      warningCount: 0,
      createdAt: new Date(Date.now() - 50 * 86400000).toISOString()
    }
  ],

  complaints: [
    {
      id: "CMP-5555-001",
      title: "Campus Wi-Fi Unstable in Central Library Study Hall",
      description: "Students studying on the 2nd floor library frequently get disconnected from the campus network during peak study hours. Requires router inspection and signal repeater check.",
      category: "Infrastructure",
      priority: "Medium",
      status: "In Progress",
      collegeId: "5555",
      studentUserId: "USR-S1001",
      studentName: "Aarav Sharma",
      studentMobile: "9899123456",
      maskedName: "Student #A782",
      assignedTeacherId: "5555-T100",
      assignedTeacherName: "Prof. Rajesh Verma",
      assignedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      slaHours: 24,
      deadlineAt: new Date(Date.now() + 12 * 3600000).toISOString(),
      verificationStatus: null,
      createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 12 * 3600000).toISOString()
    },
    {
      id: "CMP-5555-002",
      title: "Broken Bench and Projector Socket in Lecture Hall 3B",
      description: "The rear bench in Hall 3B has loose fittings and the electrical plug socket for laptop presentations trips the breaker.",
      category: "Maintenance",
      priority: "High",
      status: "Completed",
      collegeId: "5555",
      studentUserId: "USR-S1001",
      studentName: "Aarav Sharma",
      studentMobile: "9899123456",
      maskedName: "Student #A782",
      assignedTeacherId: "5555-T100",
      assignedTeacherName: "Prof. Rajesh Verma",
      assignedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
      slaHours: 24,
      deadlineAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      resolvedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
      resolutionProof: "Maintenance team replaced the damaged socket and secured bench frame with new anchors. Verified working.",
      verificationStatus: "Done",
      studentFeedback: "Fixed properly, thank you!",
      createdAt: new Date(Date.now() - 50 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 28 * 3600000).toISOString()
    },
    {
      id: "CMP-2041-001",
      title: "Digital Library Access Passwords Expired for 3rd Year Batch",
      description: "The IEEE and ACM portal credentials issued during orientation have expired prematurely for the 2024-2027 mechanical batch.",
      category: "Academics",
      priority: "Medium",
      status: "Pending",
      collegeId: "2041",
      studentUserId: "USR-S2001",
      studentName: "Sneha Patel",
      studentMobile: "9899345678",
      maskedName: "Student #C419",
      assignedTeacherId: null,
      assignedTeacherName: null,
      verificationStatus: null,
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 3600000).toISOString()
    }
  ],

  activityLogs: [
    {
      id: "ACT-001",
      complaintId: "CMP-5555-001",
      actorRole: "student",
      actorName: "Student #A782",
      action: "Submitted Complaint",
      details: "Grievance registered under ABC College of Engineering",
      timestamp: new Date(Date.now() - 14 * 3600000).toISOString()
    },
    {
      id: "ACT-002",
      complaintId: "CMP-5555-001",
      actorRole: "admin",
      actorName: "Super Administrator",
      action: "Approved & Assigned",
      details: "Assigned to Prof. Rajesh Verma with 24h SLA",
      timestamp: new Date(Date.now() - 12 * 3600000).toISOString()
    }
  ],

  activities: [],
  comments: [],
  reports: [],
  notifications: []
};

module.exports = seedData;
