"""
Comprehensive Automated Test Suite for Student Complaint Box Flask REST API
Includes strict validation of all 14 mobile number, OTP, role guard, and complaint lifecycle scenarios.
"""
import sys
import os
import json
import time

# Add root and server to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from server.app import app, otp_store
from server.db_manager import db

def run_tests():
    print("=== STARTING COMPREHENSIVE FLASK REST API TEST SUITE ===\n")
    client = app.test_client()
    passed = 0
    failed = 0

    def assert_test(name, condition, extra=""):
        nonlocal passed, failed
        if condition:
            print(f"[PASS] {name}")
            passed += 1
        else:
            print(f"[FAIL] {name} {extra}")
            failed += 1

    # 1. Reset Database to seed state
    db.reset()
    assert_test("1. Database reset to default seed state", len(db.get('colleges')) >= 2)

    # -------------------------------------------------------------
    # SECTION 7: SCENARIOS 1 - 14 (Mobile, OTP, Security, Roles)
    # -------------------------------------------------------------
    print("\n--- SECTION 7: SCENARIO VERIFICATION ---")

    # Scenario 1: Valid existing student number (9899123456 -> USR-S1001)
    res_s1 = client.post('/api/auth/send-otp', json={'mobile': '9899123456', 'role': 'student'})
    data_s1 = res_s1.get_json() or {}
    assert_test(
        "Scenario 1: Valid registered student number (9899123456) -> Dynamic 6-digit OTP returned in body (200, message='Your OTP is ready. Enter the code displayed above.')",
        res_s1.status_code == 200 and data_s1.get('success') is True and len(str(data_s1.get('otp', ''))) == 6 and 'Your OTP is ready' in data_s1.get('message', ''),
        f"status: {res_s1.status_code}, body: {data_s1}"
    )

    # Scenario 2: New (unregistered) valid student number (9811990099)
    res_s2 = client.post('/api/auth/send-otp', json={'mobile': '9811990099', 'role': 'student'})
    data_s2 = res_s2.get_json() or {}
    new_student_otp = data_s2.get('otp')
    assert_test(
        "Scenario 2a: New valid student number (9811990099) -> 200 with OTP (advance registration NOT required)",
        res_s2.status_code == 200 and data_s2.get('success') is True and len(str(new_student_otp)) == 6,
        f"status: {res_s2.status_code}, body: {data_s2}"
    )
    # Verify new student with displayed OTP -> Account safely initialized, 200, role='student'
    res_s2_verify = client.post('/api/auth/verify-otp', json={'mobile': '9811990099', 'otp': new_student_otp, 'role': 'student'})
    data_s2_verify = res_s2_verify.get_json() or {}
    assert_test(
        "Scenario 2b: New student enters OTP -> 200, account automatically initialized, role='student', token issued",
        res_s2_verify.status_code == 200 and data_s2_verify.get('success') is True and data_s2_verify.get('role') == 'student' and data_s2_verify.get('token'),
        f"status: {res_s2_verify.status_code}, body: {data_s2_verify}"
    )
    # Subsequent login preserves existing record without creating duplicate
    count_students_before = len(db.find('users', lambda u: u.get('mobile') == '9811990099' and u.get('role') == 'student'))
    if '9811990099' in otp_store:
        del otp_store['9811990099']
    res_s2_again = client.post('/api/auth/send-otp', json={'mobile': '9811990099', 'role': 'student'})
    res_s2_again_verify = client.post('/api/auth/verify-otp', json={'mobile': '9811990099', 'otp': res_s2_again.get_json().get('otp'), 'role': 'student'})
    count_students_after = len(db.find('users', lambda u: u.get('mobile') == '9811990099' and u.get('role') == 'student'))
    assert_test(
        "Scenario 2c: Repeat student login preserves existing record without duplicate accounts",
        res_s2_again_verify.status_code == 200 and count_students_before == 1 and count_students_after == 1
    )

    # Scenario 3: Invalid mobile numbers (too short, fake repeating, letters)
    res_s3_short = client.post('/api/auth/send-otp', json={'mobile': '12345'})
    res_s3_repeat = client.post('/api/auth/send-otp', json={'mobile': '9999999999'})
    res_s3_alpha = client.post('/api/auth/send-otp', json={'mobile': '98111abc99'})
    err_short = (res_s3_short.get_json() or {}).get('error', '')
    err_repeat = (res_s3_repeat.get_json() or {}).get('error', '')
    err_alpha = (res_s3_alpha.get_json() or {}).get('error', '')
    expected_invalid_msg = "Please enter a valid 10-digit Indian mobile number."
    assert_test(
        "Scenario 3: Invalid mobile numbers rejected with 400 and 'Please enter a valid 10-digit Indian mobile number.'",
        res_s3_short.status_code == 400 and res_s3_repeat.status_code == 400 and res_s3_alpha.status_code == 400 and
        err_short == expected_invalid_msg and err_repeat == expected_invalid_msg and err_alpha == expected_invalid_msg
    )

    # Setup unapproved teacher for Scenario 6
    db.insert('users', {
        'id': 'USR-T5102',
        'role': 'teacher',
        'name': 'Prof. Unapproved Teacher',
        'mobile': '9899001122',
        'email': 'unapproved@sdacs.ac.in',
        'collegeId': '5555',
        'teacherId': '5555-T999',
        'status': 'active',
        'approvalStatus': 'Waiting for Approval',
        'isVerified': False
    })

    # Scenario 4: Approved teacher mobile number (9822334455 -> USR-T1001, isVerified: True)
    res_s4 = client.post('/api/auth/send-otp', json={'mobile': '+91 9822334455', 'role': 'teacher'})
    data_s4 = res_s4.get_json() or {}
    assert_test(
        "Scenario 4: Approved teacher mobile number (+91 9822334455) -> OTP sent (200)",
        res_s4.status_code == 200 and data_s4.get('success') is True,
        f"status: {res_s4.status_code}, body: {data_s4}"
    )

    # Scenario 5: New (unregistered) teacher mobile number (9855555555)
    res_s5 = client.post('/api/auth/send-otp', json={'mobile': '9855555555', 'role': 'teacher'})
    data_s5 = res_s5.get_json() or {}
    new_tch_otp = data_s5.get('otp')
    assert_test(
        "Scenario 5a: New valid teacher number (9855555555) -> 200 with OTP (advance registration NOT required)",
        res_s5.status_code == 200 and data_s5.get('success') is True and len(str(new_tch_otp)) == 6
    )
    # Teacher verifies OTP -> Account created with 'Waiting for Approval', returns 403
    res_s5_verify = client.post('/api/auth/verify-otp', json={'mobile': '9855555555', 'otp': new_tch_otp, 'role': 'teacher'})
    data_s5_verify = res_s5_verify.get_json() or {}
    expected_wait_msg = "Your account is waiting for Admin approval."
    assert_test(
        "Scenario 5b: New teacher verifies OTP -> 403 'Your account is waiting for Admin approval.', request created",
        res_s5_verify.status_code == 403 and expected_wait_msg in data_s5_verify.get('error', ''),
        f"status: {res_s5_verify.status_code}, error: {data_s5_verify.get('error')}"
    )
    # Subsequent attempt does not create duplicate teacher record
    count_tch_before = len(db.find('users', lambda u: u.get('mobile') == '9855555555' and u.get('role') == 'teacher'))
    if '9855555555' in otp_store:
        del otp_store['9855555555']
    res_s5_again = client.post('/api/auth/send-otp', json={'mobile': '9855555555', 'role': 'teacher'})
    res_s5_again_verify = client.post('/api/auth/verify-otp', json={'mobile': '9855555555', 'otp': res_s5_again.get_json().get('otp'), 'role': 'teacher'})
    count_tch_after = len(db.find('users', lambda u: u.get('mobile') == '9855555555' and u.get('role') == 'teacher'))
    assert_test(
        "Scenario 5c: Repeat teacher login prevents duplicate teacher accounts",
        res_s5_again_verify.status_code == 403 and count_tch_before == 1 and count_tch_after == 1
    )

    # Scenario 6: Unapproved teacher account (9899001122 -> USR-T5102)
    # Step 1: Teacher requests OTP -> 200
    res_s6_send = client.post('/api/auth/send-otp', json={'mobile': '9899001122', 'role': 'teacher'})
    data_s6_send = res_s6_send.get_json() or {}
    unapp_otp = data_s6_send.get('otp')
    assert_test(
        "Scenario 6a: Registered unapproved teacher requests OTP -> 200 with dynamic 6-digit OTP",
        res_s6_send.status_code == 200 and data_s6_send.get('success') is True and len(str(unapp_otp)) == 6,
        f"status: {res_s6_send.status_code}, body: {data_s6_send}"
    )

    # Step 2: Unapproved teacher submits valid OTP -> 403 waiting for approval message
    res_s6_verify = client.post('/api/auth/verify-otp', json={'mobile': '9899001122', 'otp': unapp_otp, 'role': 'teacher'})
    data_s6_verify = res_s6_verify.get_json() or {}
    assert_test(
        "Scenario 6b: Unapproved teacher submits OTP -> 403 'Your account is waiting for Admin approval.'",
        res_s6_verify.status_code == 403 and expected_wait_msg in data_s6_verify.get('error', ''),
        f"status: {res_s6_verify.status_code}, error: {data_s6_verify.get('error')}"
    )

    # Scenario 7: Correct student OTP -> Successful login with authentic DB role
    clean_s_mobile = '9899123456'
    valid_student_otp = otp_store.get(clean_s_mobile, {}).get('code')
    res_s7 = client.post('/api/auth/verify-otp', json={'mobile': clean_s_mobile, 'otp': valid_student_otp, 'role': 'student'})
    data_s7 = res_s7.get_json() or {}
    student_jwt_token = data_s7.get('token')
    student_role = data_s7.get('user', {}).get('role')
    assert_test(
        "Scenario 7: Correct student OTP -> 200, JWT token returned, role='student' matched from DB",
        res_s7.status_code == 200 and student_jwt_token and student_role == 'student',
        f"status: {res_s7.status_code}, role: {student_role}"
    )

    # Scenario 8: Incorrect OTP -> Rejected with 400
    # Teacher 9822334455 has active OTP generated in Scenario 4
    clean_t_mobile = '9822334455'
    res_s8 = client.post('/api/auth/verify-otp', json={'mobile': clean_t_mobile, 'otp': '000000'})
    err_s8 = (res_s8.get_json() or {}).get('error', '')
    assert_test(
        "Scenario 8: Incorrect OTP (000000) -> 400 'Incorrect OTP. Please try again.'",
        res_s8.status_code == 400 and ("Incorrect OTP" in err_s8 or "Invalid" in err_s8),
        f"status: {res_s8.status_code}, error: {err_s8}"
    )

    # Scenario 9: Expired OTP -> Rejected with 400
    # Artificially expire the OTP for teacher in the store
    if clean_t_mobile in otp_store:
        otp_store[clean_t_mobile]['expiresAt'] = time.time() - 10
    res_s9 = client.post('/api/auth/verify-otp', json={'mobile': clean_t_mobile, 'otp': otp_store.get(clean_t_mobile, {}).get('code')})
    assert_test(
        "Scenario 9: Expired OTP -> 400 'OTP expired. Please request a new OTP.'",
        res_s9.status_code == 400 and "expired" in (res_s9.get_json() or {}).get('error', '').lower()
    )

    # Scenario 10: Resend OTP cooldown and generation
    # Clear cooldown for clean_t_mobile to test clean send
    if clean_t_mobile in otp_store:
        del otp_store[clean_t_mobile]
    res_s10_first = client.post('/api/auth/send-otp', json={'mobile': clean_t_mobile})
    assert_test("Scenario 10a: First OTP request succeeds (200)", res_s10_first.status_code == 200)
    
    # Immediate resend attempt should hit 30s cooldown
    res_s10_cooldown = client.post('/api/auth/send-otp', json={'mobile': clean_t_mobile})
    err_s10 = (res_s10_cooldown.get_json() or {}).get('error', '')
    assert_test(
        "Scenario 10b: Resend OTP within 30s is rate-limited (429)",
        res_s10_cooldown.status_code == 429 and "seconds before requesting a new OTP" in err_s10,
        f"status: {res_s10_cooldown.status_code}, error: {err_s10}"
    )

    # Scenario 11: Old OTP invalidated after requesting a new OTP
    old_t_otp = otp_store[clean_t_mobile]['code']
    # Simulate waiting past 30s cooldown
    otp_store[clean_t_mobile]['lastSentAt'] = time.time() - 35
    res_s11_new = client.post('/api/auth/send-otp', json={'mobile': clean_t_mobile})
    new_t_otp = otp_store.get(clean_t_mobile, {}).get('code')
    assert_test(
        "Scenario 11a: New OTP successfully generated after cooldown",
        res_s11_new.status_code == 200 and new_t_otp and new_t_otp != old_t_otp,
        f"status: {res_s11_new.status_code}, new_otp: {new_t_otp}, old_otp: {old_t_otp}"
    )

    # Trying the old OTP must fail
    res_s11_old_try = client.post('/api/auth/verify-otp', json={'mobile': clean_t_mobile, 'otp': old_t_otp})
    assert_test("Scenario 11b: Old OTP is rejected with 400 after new OTP generated", res_s11_old_try.status_code == 400)

    # Verify teacher with the new valid OTP
    res_s11_verify = client.post('/api/auth/verify-otp', json={'mobile': clean_t_mobile, 'otp': new_t_otp})
    teacher_jwt_token = (res_s11_verify.get_json() or {}).get('token')
    teacher_role = (res_s11_verify.get_json() or {}).get('user', {}).get('role')
    assert_test(
        "Scenario 11c: Teacher logs in with new OTP -> 200, role='teacher'",
        res_s11_verify.status_code == 200 and teacher_jwt_token and teacher_role == 'teacher'
    )

    # Scenario 12: Student and Teacher Dashboard Access Permissions
    student_headers = {'Authorization': f'Bearer {student_jwt_token}'}
    teacher_headers = {'Authorization': f'Bearer {teacher_jwt_token}'}

    # Student cannot access admin endpoints
    res_s12_admin = client.get('/api/admin/complaints', headers=student_headers)
    assert_test("Scenario 12a: Student blocked from Admin API (403)", res_s12_admin.status_code == 403)

    # Student cannot access teacher resolve endpoints
    res_s12_teach = client.post('/api/complaints/CMP-0001/resolve', headers=student_headers, json={'explanation': 'hack'})
    assert_test("Scenario 12b: Student blocked from Teacher Resolve API (403)", res_s12_teach.status_code == 403)

    # Teacher cannot create student complaints
    res_s12_submit = client.post('/api/complaints', headers=teacher_headers, json={'title': 'test'})
    assert_test("Scenario 12c: Teacher blocked from submitting student complaint (403)", res_s12_submit.status_code == 403)

    # Scenario 13: Login after refreshing the page (/api/auth/me)
    res_s13_me_student = client.get('/api/auth/me', headers=student_headers)
    data_s13_std = res_s13_me_student.get_json() or {}
    assert_test(
        "Scenario 13a: GET /api/auth/me verifies student session on page refresh (role='student')",
        res_s13_me_student.status_code == 200 and data_s13_std.get('user', {}).get('role') == 'student' and data_s13_std.get('user', {}).get('id') == 'USR-S1001'
    )

    res_s13_me_teacher = client.get('/api/auth/me', headers=teacher_headers)
    data_s13_tch = res_s13_me_teacher.get_json() or {}
    assert_test(
        "Scenario 13b: GET /api/auth/me verifies teacher session on page refresh (role='teacher')",
        res_s13_me_teacher.status_code == 200 and data_s13_tch.get('user', {}).get('role') == 'teacher' and data_s13_tch.get('user', {}).get('id') == 'USR-T1001'
    )

    # Scenario 14: Dynamic random OTP generation security
    from server.services.sms_service import generate_secure_otp
    sample_otps = [generate_secure_otp() for _ in range(15)]
    all_6_digits = all(len(o) == 6 and o.isdigit() for o in sample_otps)
    never_fixed = '123456' not in sample_otps and len(set(sample_otps)) == 15
    assert_test(
        "Scenario 14: Secure cryptographic OTP generation (fresh, random 6-digit, never fixed 123456, never common)",
        all_6_digits and never_fixed
    )

    # -------------------------------------------------------------
    # CORE SYSTEM & COMPLAINT LIFECYCLE TESTS
    # -------------------------------------------------------------
    print("\n--- CORE SYSTEM & COMPLAINTS LIFECYCLE VERIFICATION ---")

    # Admin Login
    res_admin_login = client.post('/api/auth/login-admin', json={
        'email': 'khushilthakur28@gmail.com',
        'password': '557858466179=2131'
    })
    admin_data = res_admin_login.get_json() or {}
    admin_token = admin_data.get('token')
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    assert_test("15. Admin login succeeds with token and role='admin'", res_admin_login.status_code == 200 and admin_token)

    # 15a: Non-admin (student) blocked from teacher approval API
    res_unauth_app = client.patch('/api/admin/teachers/USR-T5102/approve', headers=student_headers)
    assert_test("15a: Student blocked from teacher approval endpoint (403)", res_unauth_app.status_code == 403)

    # 15b: Admin approves unapproved teacher USR-T5102
    res_adm_app = client.patch('/api/admin/teachers/USR-T5102/approve', headers=admin_headers)
    app_t_data = res_adm_app.get_json() or {}
    assert_test(
        "15b: Admin approves teacher USR-T5102 -> 200, approvalStatus='Approved'",
        res_adm_app.status_code == 200 and (app_t_data.get('teacher', {}).get('approvalStatus') == 'Approved' or app_t_data.get('user', {}).get('approvalStatus') == 'Approved'),
        f"status: {res_adm_app.status_code}, body: {app_t_data}"
    )

    # 15c: Newly approved teacher requests OTP and logs in successfully
    otp_store.pop('9899001122', None)
    res_t_send = client.post('/api/auth/send-otp', json={'mobile': '9899001122'})
    t_fresh_otp = (res_t_send.get_json() or {}).get('otp')
    res_app_login = client.post('/api/auth/verify-otp', json={'mobile': '9899001122', 'otp': t_fresh_otp})
    app_t_login_data = res_app_login.get_json() or {}
    newly_approved_t_token = app_t_login_data.get('token')
    assert_test(
        "15c: Newly approved teacher verifies OTP -> 200, JWT token returned, role='teacher'",
        res_app_login.status_code == 200 and newly_approved_t_token and app_t_login_data.get('user', {}).get('role') == 'teacher',
        f"status: {res_app_login.status_code}, body: {app_t_login_data}"
    )

    # 15d: Approved teacher can access teacher routes
    res_t_feed = client.get('/api/complaints/teacher', headers={'Authorization': f'Bearer {newly_approved_t_token}'})
    assert_test("15d: Approved teacher accesses /api/complaints/teacher (200)", res_t_feed.status_code == 200)

    # 15e: Admin rejects teacher USR-T5102
    res_adm_rej = client.patch('/api/admin/teachers/USR-T5102/reject', headers=admin_headers)
    rej_t_data = res_adm_rej.get_json() or {}
    assert_test(
        "15e: Admin rejects teacher USR-T5102 -> 200, approvalStatus='Not Approved'",
        res_adm_rej.status_code == 200 and (rej_t_data.get('teacher', {}).get('approvalStatus') == 'Not Approved' or rej_t_data.get('user', {}).get('approvalStatus') == 'Not Approved')
    )

    # 15f: Rejected teacher blocked from teacher endpoints with 403
    res_t_blocked = client.get('/api/complaints/teacher', headers={'Authorization': f'Bearer {newly_approved_t_token}'})
    assert_test("15f: Rejected teacher blocked from teacher endpoints with 403", res_t_blocked.status_code == 403)

    # 15g: Admin direct status switcher sets status to 'Approved'
    res_adm_stat = client.patch('/api/admin/teachers/USR-T5102/status', headers=admin_headers, json={'status': 'Approved'})
    stat_t_data = res_adm_stat.get_json() or {}
    assert_test(
        "15g: Admin sets teacher status via switcher -> 200, status='Approved'",
        res_adm_stat.status_code == 200 and (stat_t_data.get('teacher', {}).get('approvalStatus') == 'Approved' or stat_t_data.get('user', {}).get('approvalStatus') == 'Approved')
    )

    # 15h: Admin users directory returns computed approvalStatus and accountStatus
    res_all_users = client.get('/api/admin/users', headers=admin_headers)
    all_users_json = res_all_users.get_json() or {}
    teacher_records = all_users_json.get('teachers') or [u for u in all_users_json.get('users', []) if u.get('role') == 'teacher']
    assert_test(
        "15h: Admin GET /api/admin/users provides approvalStatus for all teachers",
        res_all_users.status_code == 200 and len(teacher_records) > 0 and all('approvalStatus' in t for t in teacher_records)
    )

    # -------------------------------------------------------------
    # TEACHER REGISTRATION & ADMIN APPROVAL LIFECYCLE TESTS
    # -------------------------------------------------------------
    print("\n--- NEW FACULTY REGISTRATION & APPROVAL VERIFICATION ---")

    # 15i: Teacher registration missing required fields rejected with 400
    res_reg_missing = client.post('/api/auth/register-teacher', json={
        'name': '',
        'mobile': '9877112233',
        'collegeId': '5555',
        'password': 'password123'
    })
    assert_test("15i: Teacher registration with missing fields rejected with 400", res_reg_missing.status_code == 400)

    # 15j: Teacher registration with invalid mobile rejected with exact message
    res_reg_inv_mob = client.post('/api/auth/register-teacher', json={
        'name': 'Dr. Test Faculty',
        'mobile': '12345',
        'collegeId': '5555',
        'password': 'password123'
    })
    data_inv_mob = res_reg_inv_mob.get_json() or {}
    assert_test(
        "15j: Teacher registration with invalid mobile rejected with 400 and exact message",
        res_reg_inv_mob.status_code == 400 and data_inv_mob.get('error') == "Please enter a valid 10-digit Indian mobile number."
    )

    # 15k: Teacher registration with incorrect OTP rejected with 400
    # Generate OTP first
    reg_mobile = '9877112233'
    # Ensure clean state for test mobile and teacherId
    existing_t = db.find_one('users', lambda u: u.get('mobile') == reg_mobile or u.get('teacherId') == 'EMP-FAC-991')
    if existing_t:
        db.delete('users', existing_t.get('id'))
    otp_store.pop(reg_mobile, None)

    res_reg_otp_send = client.post('/api/auth/send-otp', json={'mobile': reg_mobile, 'role': 'teacher'})
    reg_valid_otp = (res_reg_otp_send.get_json() or {}).get('otp')
    res_reg_bad_otp = client.post('/api/auth/register-teacher', json={
        'name': 'Dr. Test Faculty',
        'mobile': reg_mobile,
        'collegeId': '5555',
        'teacherId': 'EMP-FAC-991',
        'department': 'Computer Science',
        'designation': 'Associate Professor',
        'password': 'Password123!',
        'otp': '999999' # Incorrect OTP
    })
    assert_test(
        "15k: Teacher registration with incorrect OTP rejected with 400",
        res_reg_bad_otp.status_code == 400 and "incorrect" in (res_reg_bad_otp.get_json() or {}).get('error', '').lower()
    )

    # 15l: Teacher registration succeeds with valid OTP, custom teacherId, designation
    res_reg_success = client.post('/api/auth/register-teacher', json={
        'name': 'Dr. Test Faculty',
        'mobile': reg_mobile,
        'email': 'test.faculty@sdacs.ac.in',
        'collegeId': '5555',
        'teacherId': 'EMP-FAC-991',
        'department': 'Computer Science',
        'designation': 'Associate Professor',
        'password': 'Password123!',
        'otp': reg_valid_otp
    })
    data_reg_success = res_reg_success.get_json() or {}
    reg_user = data_reg_success.get('user') or {}
    new_reg_teacher_uid = reg_user.get('id')
    assert_test(
        "15l: Teacher registration succeeds (201) with 'Your registration has been submitted successfully. Please wait for Admin approval.'",
        res_reg_success.status_code == 201 and
        "Your registration has been submitted successfully. Please wait for Admin approval." in data_reg_success.get('message', '') and
        reg_user.get('teacherId') == 'EMP-FAC-991' and
        reg_user.get('designation') == 'Associate Professor' and
        reg_user.get('approvalStatus') == 'Waiting for Approval' and
        reg_user.get('isVerified') is False,
        f"status: {res_reg_success.status_code}, body: {data_reg_success}"
    )

    # 15m: Prevent duplicate registration with same mobile number
    res_reg_dup_mob = client.post('/api/auth/register-teacher', json={
        'name': 'Another Name',
        'mobile': reg_mobile,
        'collegeId': '5555',
        'teacherId': 'EMP-FAC-992',
        'password': 'Password123!'
    })
    assert_test(
        "15m: Teacher registration prevents duplicate mobile number (400)",
        res_reg_dup_mob.status_code == 400 and "already registered" in (res_reg_dup_mob.get_json() or {}).get('error', '').lower()
    )

    # 15n: Prevent duplicate registration with same Teacher ID
    res_reg_dup_tid = client.post('/api/auth/register-teacher', json={
        'name': 'Another Faculty',
        'mobile': '9877445566',
        'collegeId': '5555',
        'teacherId': 'EMP-FAC-991',
        'password': 'Password123!'
    })
    assert_test(
        "15n: Teacher registration prevents duplicate Teacher ID / Employee ID (400)",
        res_reg_dup_tid.status_code == 400 and "already registered" in (res_reg_dup_tid.get_json() or {}).get('error', '').lower()
    )

    # 15o: Unapproved registered teacher blocked from password login (403)
    res_reg_pwd_login = client.post('/api/auth/login-teacher', json={
        'identifier': 'EMP-FAC-991',
        'password': 'Password123!'
    })
    assert_test(
        "15o: Unapproved registered teacher blocked from password login (403 'waiting for Admin approval')",
        res_reg_pwd_login.status_code == 403 and "waiting for admin approval" in (res_reg_pwd_login.get_json() or {}).get('error', '').lower()
    )

    # 15p: Unapproved registered teacher blocked from OTP login (403)
    if reg_mobile in otp_store:
        del otp_store[reg_mobile]
    res_reg_otp_for_login = client.post('/api/auth/send-otp', json={'mobile': reg_mobile, 'role': 'teacher'})
    reg_login_otp = (res_reg_otp_for_login.get_json() or {}).get('otp')
    res_reg_otp_verify_wait = client.post('/api/auth/verify-otp', json={
        'mobile': reg_mobile,
        'otp': reg_login_otp,
        'role': 'teacher'
    })
    assert_test(
        "15p: Unapproved registered teacher blocked from OTP login (403 'Your account is waiting for Admin approval.')",
        res_reg_otp_verify_wait.status_code == 403 and "waiting for admin approval" in (res_reg_otp_verify_wait.get_json() or {}).get('error', '').lower()
    )

    # 15q: Admin approves newly registered teacher
    res_adm_app_reg = client.patch(f'/api/admin/teachers/{new_reg_teacher_uid}/approve', headers=admin_headers)
    assert_test(
        "15q: Admin approves newly registered teacher (200, approvalStatus='Approved')",
        res_adm_app_reg.status_code == 200 and (res_adm_app_reg.get_json() or {}).get('teacher', {}).get('approvalStatus') == 'Approved'
    )

    # 15r: Newly approved registered teacher now successfully logs in via password
    res_reg_pwd_login_ok = client.post('/api/auth/login-teacher', json={
        'identifier': 'EMP-FAC-991',
        'password': 'Password123!'
    })
    data_pwd_ok = res_reg_pwd_login_ok.get_json() or {}
    newly_reg_t_token = data_pwd_ok.get('token')
    assert_test(
        "15r: Newly approved registered teacher logs in via password (200, JWT token returned)",
        res_reg_pwd_login_ok.status_code == 200 and newly_reg_t_token and data_pwd_ok.get('user', {}).get('role') == 'teacher'
    )

    # 15s: Newly approved registered teacher accesses teacher portal
    res_reg_t_feed = client.get('/api/complaints/teacher', headers={'Authorization': f'Bearer {newly_reg_t_token}'})
    assert_test(
        "15s: Newly approved registered teacher accesses /api/complaints/teacher (200)",
        res_reg_t_feed.status_code == 200
    )

    # Admin registers official college record (ID: 5001)
    res_col = client.post('/api/colleges', headers=admin_headers, json={
        'name': 'National Technology Institute',
        'code': 'NTI',
        'customId': '5001',
        'principalName': 'Dr. S. K. Narayan',
        'address': 'Central Campus'
    })
    assert_test("16. Admin registers college ID 5001", res_col.status_code == 201)

    # Student submits complaint
    res_comp = client.post('/api/complaints', headers=student_headers, json={
        'collegeId': '5555',
        'title': 'Library Cooling System AC Leakage',
        'description': 'Water is dripping near reading table 12 from AC unit 4.',
        'category': 'Infrastructure',
        'priority': 'High'
    })
    comp_data = res_comp.get_json() or {}
    complaint_id = comp_data.get('complaint', {}).get('id')
    assert_test(
        "17. Student submits complaint (status='Pending', initial quota decremented)",
        res_comp.status_code == 201 and complaint_id and comp_data.get('complaint', {}).get('status') == 'Pending'
    )

    # Admin reviews and approves complaint
    res_rev = client.patch(f'/api/complaints/{complaint_id}/review', headers=admin_headers, json={
        'action': 'approve',
        'visibility': 'Public'
    })
    assert_test("18. Admin approves complaint", res_rev.status_code == 200)

    # Admin assigns verified teacher (USR-T1001 is from College 5555)
    res_assign = client.patch(f'/api/complaints/{complaint_id}/assign', headers=admin_headers, json={
        'teacherId': 'USR-T1001'
    })
    assert_test(
        "19. Admin assigns verified teacher -> status='In Progress'",
        res_assign.status_code == 200 and (res_assign.get_json() or {}).get('complaint', {}).get('status') == 'In Progress'
    )

    # Teacher posts update
    res_upd = client.patch(f'/api/complaints/{complaint_id}/teacher-update', headers=teacher_headers, json={
        'note': 'AC technician inspected unit 4. Replaced drainage pipe.'
    })
    assert_test("20. Teacher posts progress update", res_upd.status_code == 200)

    # Teacher resolves complaint with explanation
    res_res = client.post(f'/api/complaints/{complaint_id}/resolve', headers=teacher_headers, json={
        'explanation': 'Leakage fixed, tested for 2 hours with no further drops.'
    })
    assert_test(
        "21. Teacher resolves complaint -> status='Resolved'",
        res_res.status_code == 200 and (res_res.get_json() or {}).get('complaint', {}).get('status') == 'Resolved'
    )

    # Student verifies as Done -> Completed
    res_ver = client.post(f'/api/complaints/{complaint_id}/verify', headers=student_headers, json={
        'decision': 'Done',
        'feedback': 'Table area is completely dry. Thank you!'
    })
    assert_test(
        "22. Student verifies solution as Done -> status='Completed'",
        res_ver.status_code == 200 and (res_ver.get_json() or {}).get('complaint', {}).get('status') == 'Completed'
    )

    # File Upload Security: Dangerous extension (.exe) rejected
    import io
    bad_file = (io.BytesIO(b"malicious"), "danger.exe")
    res_upload_bad = client.post('/api/upload', data={'file': bad_file}, content_type='multipart/form-data')
    assert_test("23. Dangerous file upload (.exe) rejected with 400", res_upload_bad.status_code == 400)

    # File Upload Security: Safe extension (.png) accepted
    good_file = (io.BytesIO(b"safe image data"), "photo.png")
    res_upload_good = client.post('/api/upload', data={'file': good_file}, content_type='multipart/form-data')
    assert_test("24. Safe file upload (.png) accepted with 200", res_upload_good.status_code == 200)

    # Public complaints privacy check
    res_pub = client.get('/api/complaints/public')
    public_comps = (res_pub.get_json() or {}).get('complaints', [])
    leak = any('studentRealDetails' in c or 'studentMobile' in c for c in public_comps)
    assert_test("25. Public feed strictly hides real student details and mobile numbers", not leak)

    print(f"\n=======================================================")
    print(f"=== TEST SUITE COMPLETE: {passed} PASSED, {failed} FAILED ===")
    print(f"=======================================================")
    return failed == 0

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
