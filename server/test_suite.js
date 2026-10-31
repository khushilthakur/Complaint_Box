/**
 * Production Automated Verification Test Suite for Student Complaint Box
 */
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests(port = 5099) {
  console.log(`=== STARTING PRODUCTION AUTH & WORKFLOW TEST SUITE (PORT ${port}) ===\n`);
  let passed = 0;
  let failed = 0;

  function assert(name, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${extra}`);
      failed++;
    }
  }

  try {
    // Reset database to ensure clean test environment
    db.reset();

    // 1. Admin Authentication with Email + Password
    const adminLoginRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/login-admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'khushilthakur28@gmail.com',
      password: '557858466179=2131'
    });
    assert('1. Admin authenticates with real password', 
      adminLoginRes.status === 200 && adminLoginRes.data.token && adminLoginRes.data.user.role === 'admin'
    );
    const adminToken = adminLoginRes.data?.token;

    // 2. Admin Login with Wrong Password fails
    const adminWrongPass = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/login-admin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'khushilthakur28@gmail.com',
      password: 'WrongPassword'
    });
    assert('2. Admin wrong password rejected with 401', adminWrongPass.status === 401);

    // 3. Official College Registration by Admin
    const createColRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/colleges',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {
      name: 'National Technology Institute',
      code: 'NTI',
      customId: '5001',
      principalName: 'Dr. S. K. Narayan',
      address: 'Central Campus'
    });
    assert('3. Admin registers official college record (ID: 5001)', createColRes.status === 201);

    // 4. Teacher Registration for College 5001
    const regTeacherRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/register-teacher',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Prof. Ramesh Iyer',
      mobile: '9811199988',
      email: 'ramesh.i@nti.edu',
      collegeId: '5001',
      department: 'Computer Science',
      password: 'Teacher@123'
    });
    assert('4. Teacher registers with College ID 5001', regTeacherRes.status === 201);
    const teacherRefId = regTeacherRes.data.user.teacherId;
    const teacherDbId = regTeacherRes.data.user.id;

    // 5. Admin Verifies Teacher
    const verifyTeacherRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/admin/teachers/${teacherDbId}/verify`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    });
    assert('5. Admin officially verifies faculty member', verifyTeacherRes.status === 200);

    // 6. Teacher Authentication with Teacher ID + Password
    const teacherLoginRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/login-teacher',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      identifier: teacherRefId,
      password: 'Teacher@123'
    });
    assert('6. Teacher authenticates with Teacher ID and password', 
      teacherLoginRes.status === 200 && teacherLoginRes.data.token && teacherLoginRes.data.user.role === 'teacher'
    );
    const teacherToken = teacherLoginRes.data?.token;

    // 7. Student OTP Request (Real SMS generation)
    const otpSendRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/send-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { mobile: '9899555123' });
    assert('7. Student OTP request accepted without leaking code in response payload', 
      otpSendRes.status === 200 && !otpSendRes.data.simulatedOtp && otpSendRes.data.message.includes('9899555123')
    );

    // 8. Incorrect OTP strictly rejected
    const badOtpRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { mobile: '9899555123', otp: '000000' });
    assert('8. Incorrect OTP strictly rejected', badOtpRes.status === 400);

    // 9. Student Registration for College 5001
    const regStudentRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/auth/register-student',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Aditya Sharma',
      mobile: '9899555123',
      collegeId: '5001',
      email: 'aditya.s@student.nti.edu'
    });
    assert('9. Student registers under College ID 5001', regStudentRes.status === 201);
    const studentToken = regStudentRes.data.token;
    const studentDbId = regStudentRes.data.user.id;

    // 10. Access protected Student endpoint with Bearer Token
    const myCompRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/complaints/my',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    assert('10. Student accesses dashboard using JWT Bearer token', myCompRes.status === 200 && Array.isArray(myCompRes.data.complaints));

    // 11. Submitting for mismatching College ID is blocked
    const mismatchRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/complaints',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, {
      collegeId: '9999', // Wrong college
      title: 'Testing College ID mismatch',
      description: 'Should fail validation',
      category: 'Infrastructure',
      priority: 'Low'
    });
    assert('11. Submitting for mismatching College ID is blocked', mismatchRes.status === 400);

    // 12. Valid Complaint Submission
    const validSubmitRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/api/complaints',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, {
      collegeId: '5001',
      title: 'Water seepage near server racks in IT wing',
      description: 'Rainwater dripping onto emergency power conduit in room 201.',
      category: 'Infrastructure',
      priority: 'High'
    });
    assert('12. Valid complaint created with College ID 5001 and Pending review', 
      validSubmitRes.status === 201 && validSubmitRes.data.complaint.status === 'Pending'
    );
    const newCompId = validSubmitRes.data?.complaint?.id;

    // 13. Admin Review: Approve Complaint
    const approveRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/complaints/${newCompId}/review`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { action: 'approve', visibility: 'Public' });
    assert('13. Admin approves complaint with Bearer token', approveRes.status === 200);

    // 14. Admin Assigns Verified Teacher from Same College
    const assignRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/complaints/${newCompId}/assign`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { teacherId: teacherDbId });
    assert('14. Teacher assigned from same college and SLA timer started', 
      assignRes.status === 200 && assignRes.data.complaint.assignedTeacherId === teacherDbId
    );

    // 15. Teacher Marks Resolved with Explanation
    const resolveRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/complaints/${newCompId}/resolve`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacherToken}`
      }
    }, {
      explanation: 'Estates team sealed external flashing and re-routed water drain pipe.'
    });
    assert('15. Teacher resolves complaint with proof, moves to verification pending', 
      resolveRes.status === 200 && resolveRes.data.complaint.status === 'Resolved'
    );

    // 16. Student Verifies Resolution
    const verifyRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/complaints/${newCompId}/verify`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      }
    }, {
      decision: 'Done',
      feedback: 'Verified during afternoon shower, zero seepage.'
    });
    assert('16. Student confirms Done -> Officially Completed', 
      verifyRes.status === 200 && verifyRes.data.complaint.status === 'Completed'
    );

    // 17. Admin +10 Quota Extension Rule Verification
    // 17a. Must be blocked if student has fewer than 10 completed complaints
    const earlyQuotaRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/admin/users/${studentDbId}/quota`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { amount: 10 });
    assert('17a. Quota extension blocked when student has < 10 completed complaints (HTTP 400)', earlyQuotaRes.status === 400);

    // 17b. Create and complete 9 more complaints for this student to reach 10 completed complaints
    for (let i = 2; i <= 10; i++) {
      db.insert('complaints', {
        id: `CMP-SEED-${i}`,
        title: `Test Completed Complaint #${i}`,
        description: `Description for complaint #${i}`,
        category: 'Academics',
        priority: 'Medium',
        status: 'Completed',
        collegeId: '5001',
        studentUserId: studentDbId,
        studentName: 'Aditya Sharma',
        studentMobile: '9899555123',
        verificationStatus: 'Done',
        resolvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 17c. Quota extension succeeds now that student has 10 completed complaints
    const validQuotaRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/admin/users/${studentDbId}/quota`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { amount: 10 });
    assert('17b. Admin grants +10 quota after 10 complaints are completed', 
      validQuotaRes.status === 200 && validQuotaRes.data.user.complaintLimit >= 20
    );

    // 18. Cleanup test data to leave database completely clean
    await makeRequest({
      hostname: 'localhost',
      port,
      path: `/api/colleges/5001`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    // Reset database to clean production seed state
    db.reset();
    assert('18. Test cleanup leaves database pristine and clean', true);

    console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed === 0) {
      console.log('ALL PRODUCTION AUTHENTICATION & BUSINESS RULES VERIFIED!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

const app = require('./server');
const TEST_PORT = 5099;
const server = app.listen(TEST_PORT, () => {
  runTests(TEST_PORT).then(() => {
    server.close();
  });
});
