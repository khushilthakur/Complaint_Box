# Student Complain Box

> **Multi-College Student Complaint Management System**  
> A centralized, transparent platform where eligible students safely register grievances using their permanent College ID, anyone can view public complaints, and administrators and teachers manage, track, resolve, verify, and escalate complaints.

---

## Key Features

1. **Multi-College Registry & Permanent College IDs**:
   - Each college receives a permanent unique College ID (e.g. `5555`, `2041`, `8812`).
   - College status management (`Active`, `Inactive`, `Restricted`).
2. **Student Privacy Guaranteed**:
   - Real student identity (name, phone, email) is strictly concealed from public users and teachers.
   - Displayed as **"Anonymous Student"** or masked moniker **"Student #A782"**.
   - Only authorized Administrators can access student audit details.
3. **Controlled Filing & 10-Complaint Quota**:
   - Requires College ID validation matching student's registered institution.
   - Initial 10-complaint limit to prevent spam; Admin can grant **`+10 Quota` extensions**.
4. **Teacher Assignment & Live SLA Timers**:
   - Teachers assigned strictly from the same College ID.
   - Real-time resolution countdown timers with automatic escalation upon deadline breach.
5. **Two-Step Verification**:
   - Teacher marks as `Resolved` with proof; Student verifies as **Done** (Completed) or **Not Done** (Reopened).
6. **Public Transparency & College Performance Rankings**:
   - Ranked by **Most Active Colleges**, **Highest Pending Complaints**, and **Best Resolution Rate**.
7. **Misuse Control**:
   - Report spam/fake complaints; Admin progressive sanctioning (`Warning -> Restriction -> Block`).

---

---

---

## Supabase Cloud Database Setup

The backend uses **Python Flask + Supabase PostgreSQL** as its primary cloud backend architecture:
- **Supabase Cloud Mode**: Hydrates, queries, and synchronizes all colleges, users, complaints, activity logs, comments, reports, notifications, and SLA tracking directly to your Supabase PostgreSQL database in real time.
- **Local Fallback Mode**: When Supabase credentials are not yet configured or during local unit testing, it automatically operates with `server/data/db.json` so you can develop and test offline without crashes.

### Step 1: Execute Database Setup Script in Supabase
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project (Project URL: `https://scfshbwfeoehjhwhwozm.supabase.co`).
3. Click the **SQL Editor** tab in the left sidebar (or go to `https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm/sql/new`).
4. Copy the entire contents of [`server/supabase_schema.sql`](server/supabase_schema.sql).
5. Paste into the Supabase SQL Editor and click **RUN**.
   *(This creates all 7 tables, relations, performance indexes, Row Level Security policies, storage bucket `complaint-evidence`, and seeds default Colleges, Super Administrator, faculty, and student accounts without affecting any existing records).*

### Step 2: Configure Supabase Credentials
1. In your Supabase Dashboard, go to **Project Settings** -> **API** (or **API Keys**).
2. Under **Project API keys** / **Secret keys**, copy your **`Secret` API key** (e.g. `sb_secret_...` or service_role key).
3. Open [`server/.env`](server/.env) and set:
   ```env
   PORT=5000
   JWT_SECRET=super-secret-production-key-change-in-prod-7890

   # Your Supabase Project URL
   SUPABASE_URL=https://scfshbwfeoehjhwhwozm.supabase.co

   # Paste your actual secret key below:
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
   > **Security Note:** Never commit `server/.env` to GitHub. The `.gitignore` file already excludes all `.env` files. Secret keys are never printed to console or logs.

### Step 3: Verify Supabase Database Connectivity
Run the Python Supabase diagnostic script (which safely verifies environment configuration, connection, and required tables without exposing secrets):
```powershell
npm run test:supabase
# or directly:
python server/test_supabase.py
```

---

## Getting Started

### 1. Install Dependencies
```powershell
# Install Python backend dependencies
pip install -r requirements.txt

# Install frontend client and root dev dependencies
npm install
npm install --prefix client
```

### 2. Start the Application
Python Flask is the primary backend for all requests:
```powershell
# Run Python Flask API (port 5000) and Vite React frontend (port 3000) concurrently:
npm run dev

# Or run just the Python Flask API:
npm start
# or: python server/app.py
```
- **Frontend (React + Vite)**: [http://localhost:3000](http://localhost:3000)
- **Backend (Python Flask REST API)**: [http://localhost:5000](http://localhost:5000)

### 3. Run Automated Verification Tests
```powershell
# Test 1: Verify Supabase Cloud Connectivity & Tables
npm run test:supabase

# Test 2: Run Full Python Flask API Test Suite (32 tests)
npm test

# Test 3: Build Client Production Bundle
npm run build
```

---

## Deploying to Vercel

This repository is configured for full-stack deployment on Vercel (React + Vite frontend + Python Flask serverless backend).

### 1. Push Code to GitHub / Git Provider
Ensure all project files (including [`vercel.json`](vercel.json) and [`api/index.py`](api/index.py)) are pushed to your repository. Note that `.env` is automatically ignored.

### 2. Import into Vercel
1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Framework Preset: **Vite** (auto-detected).
5. Root Directory: `./` (leave default).

### 3. Add Environment Variables in Vercel
Under **Environment Variables**, add the following 3 variables:

| Variable Name | Description | Example / Location |
|---|---|---|
| `SUPABASE_URL` | Your Supabase Project URL | `https://zlasakmbkpprcswtjzbi.supabase.co` |
| `SUPABASE_SECRET_KEY` | Your Supabase Secret / service_role API key | From Supabase Dashboard -> Project Settings -> API Keys |
| `JWT_SECRET` | Secret key for signing authentication tokens | Any long random string |

### 4. Deploy
Click **Deploy**. Vercel will:
1. Run `npm install` and install client dependencies via `postinstall`.
2. Build the Vite production bundle into `client/dist`.
3. Package `api/index.py` as a Python serverless function with dependencies from `requirements.txt`.
4. Route all `/api/*` traffic to the Python Flask backend and all page traffic to the React SPA frontend.

---

## REST API Endpoints Overview

| Method | Endpoint | Description | Role / Access |
|---|---|---|---|
| `POST` | `/api/upload` | Multipart file upload (evidence/proof attachments) | Public / Authenticated |
| `POST` | `/api/auth/send-otp` | Generate & dispatch SMS OTP to student mobile | Student |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit OTP code | Student |
| `POST` | `/api/auth/register-student` | Register student linked to College ID (10-complaint limit) | Student |
| `POST` | `/api/auth/login-teacher` | Faculty login via Teacher ID/Email/Mobile + password | Faculty |
| `POST` | `/api/auth/register-teacher` | Faculty self-registration (pending Admin verification) | Faculty |
| `POST` | `/api/auth/login-admin` | Admin authentication with email & password | Admin |
| `GET` | `/api/auth/me` | Fetch active profile and session details | Authenticated |
| `GET` | `/api/colleges` | List all colleges with live performance statistics | Public |
| `GET` | `/api/colleges/rankings` | College rankings: Most Active, Highest Pending, Best Resolution Rate | Public |
| `GET` | `/api/colleges/:id` | Get specific college details and metrics | Public |
| `POST` | `/api/colleges/register` | Public portal college onboarding request | Public |
| `POST` | `/api/colleges` | Register official college record | Admin |
| `PATCH` | `/api/colleges/:id` | Update college details / status | Admin |
| `DELETE` | `/api/colleges/:id` | Remove college record | Admin |
| `GET` | `/api/complaints/public` | Public transparency grievances feed (student identity masked) | Public |
| `GET` | `/api/complaints/my` | Retrieve student's own grievances | Student |
| `GET` | `/api/complaints/teacher` | Retrieve teacher's assigned grievances | Teacher |
| `GET` | `/api/complaints/:id` | Get complaint details, activity logs, and comments | Public / Authenticated |
| `POST` | `/api/complaints` | File grievance (validates college ID, enforces 10-quota limit) | Student |
| `PATCH` | `/api/complaints/:id/review` | Admin review (Approve or Reject with mandatory reason) | Admin |
| `PATCH` | `/api/complaints/:id/assign` | Assign teacher from same college & start SLA timer | Admin |
| `PATCH` | `/api/complaints/:id/teacher-update` | Faculty posts progress updates and evidence | Teacher |
| `POST` | `/api/complaints/:id/resolve` | Mark as Resolved with proof & explanation | Teacher |
| `POST` | `/api/complaints/:id/verify` | 2-step verification: `Done` (Completed) or `Not Done` (Reopen) | Student / Admin |
| `POST` | `/api/complaints/:id/escalate` | Escalate overdue or critical complaint to higher authority | Admin |
| `POST` | `/api/complaints/:id/comments` | Post official or public discussion comment | Public / Authenticated |
| `POST` | `/api/complaints/:id/report` | Report fake, spam, or abusive complaint | Public / Authenticated |
| `GET` | `/api/admin/analytics` | High-level system KPI analytics & category breakdowns | Admin |
| `GET` | `/api/admin/users` | List students, faculty, and admins with activity counts | Admin |
| `PATCH` | `/api/admin/users/:id/quota` | Extend student quota (+10) after completed grievances | Admin |
| `PATCH` | `/api/admin/users/:id/sanction` | User sanctions (`active`, `warned`, `restricted`, `blocked`) | Admin |
| `PATCH` | `/api/admin/teachers/:id/verify` | Approve teacher registration | Admin |
| `GET` | `/api/admin/reports` | Review spam / misuse reports | Admin |
| `POST` | `/api/admin/reports/:id/action` | Dismiss report or penalize fake complaint author | Admin |
| `GET` | `/api/notifications` | Fetch unread & recent alerts | Authenticated |
| `PATCH` | `/api/notifications/:id/read` | Mark individual notification as read | Authenticated |
| `POST` | `/api/notifications/read-all` | Mark all notifications as read | Authenticated |

---

## Pre-configured User Accounts

### 🛡️ System Administrator
- **Login Tab**: `Admin`
- **Email**: `khushilthakur28@gmail.com`
- **Password**: `557858466179=2131`

### 👨‍🏫 Faculty / Resolvers
- **Login Tab**: `Faculty`
- **Teacher 1 (ABC College - 5555)**:
  - **Teacher ID**: `5555-T100` (or Mobile: `9811122233`)
  - **Password**: `Teacher@123`
- **Teacher 2 (ABC College - 5555)**:
  - **Teacher ID**: `5555-T101` (or Mobile: `9822233344`)
  - **Password**: `Teacher@123`
- **Teacher 3 (Delhi Tech - 2041)**:
  - **Teacher ID**: `2041-T201` (or Mobile: `9833344455`)
  - **Password**: `Teacher@123`

### 🎓 Registered Students
- **Login Tab**: `Student`
- **Student 1 (ABC College - 5555)**:
  - **Mobile**: `9899123456`
  - *(Enter 10-digit mobile, click Send OTP, and enter the SMS verification code received)*
- **Student 2 (Delhi Tech - 2041)**:
  - **Mobile**: `9899345678`
- **New Student**:
  - Any new 10-digit mobile number can be entered to receive an OTP and link to any registered College ID.
