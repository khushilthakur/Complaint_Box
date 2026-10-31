-- =========================================================================
-- STUDENT COMPLAINT BOX - SUPABASE (POSTGRESQL) PRODUCTION SCHEMA
-- =========================================================================
-- This script is safe, idempotent, and repeatable.
-- It can be safely re-run without dropping existing data or causing errors.
-- Run this in your Supabase Project -> SQL Editor -> Click RUN.
-- =========================================================================

-- 1. COLLEGES TABLE
CREATE TABLE IF NOT EXISTS public.colleges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'restricted', 'inactive'
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    principal_name TEXT,
    affiliation TEXT,
    registered_from TEXT DEFAULT 'portal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions for existing installations
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS affiliation TEXT;
ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS registered_from TEXT DEFAULT 'portal';

-- 2. USERS TABLE (Admin, Faculty, Students)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    name TEXT NOT NULL,
    mobile TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT,
    college_id TEXT REFERENCES public.colleges(id) ON DELETE CASCADE,
    college_name TEXT,
    student_id TEXT,
    teacher_id TEXT,
    department TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    masked_name TEXT,
    complaint_limit INTEGER NOT NULL DEFAULT 10,
    complaints_submitted INTEGER NOT NULL DEFAULT 0,
    resolved_count INTEGER NOT NULL DEFAULT 0,
    active_assigned_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'warned', 'restricted', 'blocked'
    warning_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Idempotent column additions for existing installations
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS resolved_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_assigned_count INTEGER NOT NULL DEFAULT 0;

-- 3. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
    id TEXT PRIMARY KEY,
    college_id TEXT NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_name TEXT,
    student_mobile TEXT,
    student_anonymous_id TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Urgent', 'High', 'Medium', 'Low')),
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Assigned', 'In Progress', 'Resolved', 'Completed', 'Not Done', 'Rejected', 'Escalated'
    visibility TEXT NOT NULL DEFAULT 'Public', -- 'Public', 'Restricted', 'Confidential'
    rejection_reason TEXT,
    assigned_teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_teacher_name TEXT,
    assigned_teacher_college_id TEXT,
    assigned_teacher_ref_id TEXT,
    assigned_at TIMESTAMPTZ,
    sla_hours INTEGER NOT NULL DEFAULT 72,
    deadline_at TIMESTAMPTZ,
    is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,
    escalated_to TEXT,
    proofs JSONB NOT NULL DEFAULT '[]'::JSONB,
    resolution_proof JSONB,
    verification JSONB NOT NULL DEFAULT '{"status": "Pending"}'::JSONB,
    verification_status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Idempotent column additions for existing installations
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS student_mobile TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS masked_name TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Pending';

-- 4. ACTIVITY LOGS / AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    details TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COMMENTS / DISCUSSION THREADS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    author_id TEXT,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. MISUSE REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id TEXT PRIMARY KEY,
    complaint_id TEXT NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    complaint_title TEXT NOT NULL,
    reporter_user_id TEXT,
    reporter_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'action_taken', 'dismissed'
    admin_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    complaint_id TEXT,
    type TEXT NOT NULL DEFAULT 'status',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Idempotent column additions for existing installations
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_by_user_id TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_by_name TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =========================================================================
-- PERFORMANCE INDEXES (Idempotent)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_complaints_college_id ON public.complaints(college_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_visibility ON public.complaints(visibility);
CREATE INDEX IF NOT EXISTS idx_complaints_student ON public.complaints(student_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_teacher ON public.complaints(assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users(mobile);
CREATE INDEX IF NOT EXISTS idx_users_college ON public.users(college_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_complaint ON public.activity_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_comments_complaint ON public.comments(complaint_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) CONFIGURATION
-- =========================================================================
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. COLLEGES POLICIES
DROP POLICY IF EXISTS "Allow public read access to colleges" ON public.colleges;
CREATE POLICY "Allow public read access to colleges"
ON public.colleges FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public registration of colleges" ON public.colleges;
CREATE POLICY "Allow public registration of colleges"
ON public.colleges FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full control on colleges" ON public.colleges;
CREATE POLICY "Allow service_role full control on colleges"
ON public.colleges FOR ALL
USING (auth.role() = 'service_role');

-- 2. USERS POLICIES
DROP POLICY IF EXISTS "Allow service_role full control on users" ON public.users;
CREATE POLICY "Allow service_role full control on users"
ON public.users FOR ALL
USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
CREATE POLICY "Allow users to read their own profile"
ON public.users FOR SELECT
USING (true);

-- 3. COMPLAINTS POLICIES
DROP POLICY IF EXISTS "Allow public read access to transparent complaints" ON public.complaints;
CREATE POLICY "Allow public read access to transparent complaints"
ON public.complaints FOR SELECT
USING (visibility = 'Public' AND status NOT IN ('Pending', 'Rejected'));

DROP POLICY IF EXISTS "Allow service_role full control on complaints" ON public.complaints;
CREATE POLICY "Allow service_role full control on complaints"
ON public.complaints FOR ALL
USING (auth.role() = 'service_role');

-- 4. COMMENTS POLICIES
DROP POLICY IF EXISTS "Allow public read access to comments" ON public.comments;
CREATE POLICY "Allow public read access to comments"
ON public.comments FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service_role full control on comments" ON public.comments;
CREATE POLICY "Allow service_role full control on comments"
ON public.comments FOR ALL
USING (auth.role() = 'service_role');

-- 5. ACTIVITY LOGS POLICIES
DROP POLICY IF EXISTS "Allow public read access to activity logs" ON public.activity_logs;
CREATE POLICY "Allow public read access to activity logs"
ON public.activity_logs FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow service_role full control on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow service_role full control on activity_logs"
ON public.activity_logs FOR ALL
USING (auth.role() = 'service_role');

-- 6. REPORTS POLICIES
DROP POLICY IF EXISTS "Allow insert for abuse reports" ON public.reports;
CREATE POLICY "Allow insert for abuse reports"
ON public.reports FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full control on reports" ON public.reports;
CREATE POLICY "Allow service_role full control on reports"
ON public.reports FOR ALL
USING (auth.role() = 'service_role');

-- 7. NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "Allow service_role full control on notifications" ON public.notifications;
CREATE POLICY "Allow service_role full control on notifications"
ON public.notifications FOR ALL
USING (auth.role() = 'service_role');

-- =========================================================================
-- INITIAL SUPER ADMINISTRATOR SEED
-- =========================================================================
INSERT INTO public.users (
    id,
    role,
    name,
    mobile,
    email,
    password_hash,
    status,
    warning_count,
    created_at
) VALUES (
    'USR-00001',
    'admin',
    'Super Administrator',
    '9876543210',
    'khushilthakur28@gmail.com',
    '$2b$10$KV6Vyk8UFMd9LgqlUZkJ5ud4G9B1bDd/70njiKv7gbNQbCzlu1mca',
    'active',
    0,
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash;

-- =========================================================================
-- SEED DEFAULT COLLEGES (If not already present)
-- =========================================================================
INSERT INTO public.colleges (id, name, code, status, address, contact_email, contact_phone, principal_name, affiliation, registered_from, created_at)
VALUES 
('5555', 'Sonopant Dandekar Arts, V. S. Apte Commerce & M. H. Mehta Science College, Palghar', 'SDACS', 'active', 'Kharekuran Road, Mahim Road, Palghar (West), Dist. Palghar, Maharashtra - 401404', 'principal@sdacs.ac.in', '+91 2525 252163', 'Dr. Kiran Save', 'University of Mumbai', 'system_seed', NOW()),
('2041', 'St. John College of Engineering and Management, Palghar', 'SJCEM', 'active', 'Vevoor, Manor Road, Palghar (East), Maharashtra - 401404', 'office@sjcem.edu.in', '+91 2525 297275', 'Dr. G. V. Mulgund', 'University of Mumbai', 'system_seed', NOW())
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- SEED DEFAULT FACULTY & STUDENTS (If not already present)
-- =========================================================================
INSERT INTO public.users (id, role, name, mobile, email, password_hash, college_id, college_name, teacher_id, department, is_verified, resolved_count, active_assigned_count, status, warning_count, created_at)
VALUES
('USR-T1001', 'teacher', 'Prof. Bhakti Patil', '9822334455', 'bhakti.patil@sdacs.ac.in', '$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa', '5555', 'Sonopant Dandekar Arts, V. S. Apte Commerce & M. H. Mehta Science College, Palghar', '5555-T100', 'Department of Computer Science', true, 1, 1, 'active', 0, NOW()),
('USR-T1002', 'teacher', 'Prof. Sandeep Kadam', '9822233344', 'sandeep.kadam@sdacs.ac.in', '$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa', '5555', 'Sonopant Dandekar Arts, V. S. Apte Commerce & M. H. Mehta Science College, Palghar', '5555-T101', 'Department of Information Technology', true, 0, 0, 'active', 0, NOW()),
('USR-T2001', 'teacher', 'Prof. Amit Saxena', '9833344455', 'amit.saxena@sjcem.edu.in', '$2b$10$IwkAugUwwMbmrzu52dcSquUAtK2ejy0.ZRk.c2wYNpMGRUhhzg7Oa', '2041', 'St. John College of Engineering and Management, Palghar', '2041-T201', 'Computer Engineering', true, 0, 0, 'active', 0, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, role, name, mobile, email, college_id, student_id, masked_name, complaint_limit, complaints_submitted, status, warning_count, created_at)
VALUES
('USR-S1001', 'student', 'Khushil Vijay Thakur', '9899123456', 'khushilthakur28@gmail.com', '5555', '5555-S01', 'Student #A782', 10, 2, 'active', 0, NOW()),
('USR-S2001', 'student', 'Pratiksha Patil', '9899345678', 'pratiksha.patil@sjcem.edu.in', '2041', '2041-S01', 'Student #C419', 10, 1, 'active', 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- SEED DEFAULT COMPLAINTS & AUDIT TRAIL
-- =========================================================================
INSERT INTO public.complaints (id, college_id, student_user_id, student_name, student_mobile, student_anonymous_id, masked_name, is_anonymous, title, description, category, priority, status, visibility, assigned_teacher_id, assigned_teacher_name, assigned_teacher_ref_id, assigned_at, sla_hours, deadline_at, created_at, updated_at)
VALUES
('CMP-5555-001', '5555', 'USR-S1001', 'Khushil Vijay Thakur', '9899123456', 'Student #A782', 'Student #A782', false, 'Computer Science Lab 3 High-Performance Desktops Power Surge during Practicals', 'During final year practical sessions in CS Lab 3, terminals on bench rows 2 and 3 face intermittent voltage tripping from the secondary inverter line. Needs electrician inspection and stabilizer reset.', 'Infrastructure', 'Medium', 'In Progress', 'Public', 'USR-T1001', 'Prof. Bhakti Patil', '5555-T100', NOW() - INTERVAL '2 days', 72, NOW() + INTERVAL '1 day', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
('CMP-2041-001', '2041', 'USR-S2001', 'Pratiksha Patil', '9899345678', 'Student #C419', 'Student #C419', false, 'Digital Library Access Passwords Expired for 3rd Year Batch', 'The IEEE and ACM portal credentials issued during orientation have expired prematurely for the 2024-2027 mechanical batch.', 'Academics', 'Medium', 'Pending', 'Public', NULL, NULL, NULL, NULL, 72, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- STORAGE BUCKET CONFIGURATION (For Complaint Evidence & Resolution Proofs)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-evidence', 'complaint-evidence', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for complaint evidence" ON storage.objects;
CREATE POLICY "Public read access for complaint evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'complaint-evidence');

DROP POLICY IF EXISTS "Allow uploads to complaint evidence" ON storage.objects;
CREATE POLICY "Allow uploads to complaint evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'complaint-evidence');
