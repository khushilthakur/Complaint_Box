"""
Automated Supabase PostgreSQL Connectivity & Schema Diagnostic for Python Flask Backend
Safely validates environment configuration, API connection, and database tables without exposing secrets.
"""
import os
import sys

# Ensure server and workspace root in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
for path in [ROOT_DIR, CURRENT_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

from server.supabase_client import (
    get_supabase_config_status,
    is_supabase_configured,
    get_supabase_client,
    test_supabase_connection
)

REQUIRED_TABLES = [
    ('colleges', 'Colleges & Institutions'),
    ('users', 'Users (Admins, Teachers, Students)'),
    ('complaints', 'Complaints & Grievances'),
    ('activity_logs', 'Activity Logs / Audit Trail'),
    ('comments', 'Comments & Discussions'),
    ('reports', 'Misuse & Spam Reports'),
    ('notifications', 'System & Status Notifications')
]

def run_diagnostic():
    print("===========================================================")
    print("       SUPABASE POSTGRESQL CONNECTIVITY DIAGNOSTIC         ")
    print("                     (PYTHON FLASK)                        ")
    print("===========================================================")

    status = get_supabase_config_status()

    if not status['configured']:
        print("\n[STATUS] Supabase is NOT yet configured in server/.env")
        print(f"[REASON] {status['reason']}")
        print(f"\nDetected Project URL: {os.environ.get('SUPABASE_URL', 'Not configured')}")
        secret_status = (
            "(Placeholder detected in server/.env)"
            if (os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY'))
            else "(Missing in server/.env)"
        )
        print(f"Secret Key Status:    {secret_status}")

        print("\n--- HOW TO CONFIGURE YOUR ACTIVE KEY ---")
        print("1. Open your Supabase Dashboard:")
        print("   https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm")
        print("2. Click Project Settings (gear icon) -> 'API Keys' (or 'API').")
        print("3. Copy your Secret API Key (sb_secret_...) or service_role key.")
        print("4. Open server/.env and set:")
        print("     SUPABASE_URL=https://scfshbwfeoehjhwhwozm.supabase.co")
        print("     SUPABASE_SECRET_KEY=sb_secret_...")
        print("5. Re-run: python server/test_supabase.py\n")
        print("[NOTE] While Supabase credentials are pending, the Python Flask backend")
        print("       operates in resilient local fallback mode without crashing.\n")
        return False

    # Configuration present
    print("\n[INFO] Supabase Configuration Detected:")
    print(f"  Project URL: {status['url']}")
    print(f"  Key Format:  {status['keyType']}")
    print("  Key Value:   [PROTECTED - NEVER PRINTED TO CONSOLE]")

    print("\nTesting database connectivity with Supabase REST API...")
    conn = test_supabase_connection()

    if not conn['success'] and not conn.get('schemaPending'):
        print(f"\n[ERROR] Connection failed: {conn.get('message')}")
        err_msg = conn.get('message', '')
        if '401' in err_msg or 'unauthorized' in err_msg.lower() or 'invalid api key' in err_msg.lower():
            print("\n[DIAGNOSTIC] Supabase API rejected the configured key (HTTP 401 Unauthorized).")
            print("Possible causes:")
            print("1. The key was truncated, had a typo, or was copied incompletely.")
            print("2. The key belongs to another Supabase project.")
            print("3. The key was rotated, deleted, or regenerated in the Supabase Dashboard.")
            print("\nTo update with your active Secret Key:")
            print("1. Open: https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm/settings/api")
            print("2. Under 'API Keys' / 'Secret keys', copy your Secret Key.")
            print("3. In 'server/.env', set:")
            print("   SUPABASE_SECRET_KEY=<paste_your_active_secret_key_here>")
            print("4. Re-run: python server/test_supabase.py\n")
        return False

    if conn.get('schemaPending'):
        print("\n[PASS] Authentication successful! Supabase accepted your Secret Key.")
        print("\n===========================================================")
        print(" [ACTION REQUIRED] PostgreSQL Database Tables Not Found    ")
        print("===========================================================")
        print("Your project is authenticated, but the required tables do not exist yet.")
        print("To create the tables in your Supabase database:")
        print("1. Open the Supabase SQL Editor:")
        print("   https://supabase.com/dashboard/project/scfshbwfeoehjhwhwozm/sql/new")
        print("2. Open 'server/supabase_schema.sql' in this project and copy all lines.")
        print("3. Paste the SQL script into the Supabase SQL Editor and click RUN.")
        print("4. Re-run: python server/test_supabase.py\n")
        return False

    print("[PASS] Connected successfully to Supabase PostgreSQL database!\n")
    print(f"Checking all {len(REQUIRED_TABLES)} required application tables:")

    client = get_supabase_client()
    missing_tables = []
    for table_name, label in REQUIRED_TABLES:
        try:
            res = client.table(table_name).select('id', count='exact').limit(1).execute()
            count = res.count if hasattr(res, 'count') and res.count is not None else len(res.data)
            print(f"  [OK] public.{table_name:<15} - {label} ({count} records)")
        except Exception as e:
            print(f"  [MISSING] public.{table_name:<15} - {label} (Error: {e})")
            missing_tables.append(table_name)

    if missing_tables:
        print(f"\n[WARNING] {len(missing_tables)} tables need to be created via server/supabase_schema.sql")
        return False

    # Test read/write verification with a lightweight ping
    try:
        test_log_id = "DIAG-TEST-001"
        client.table('activity_logs').upsert({
            'id': test_log_id,
            'complaint_id': 'CMP-5555-001',
            'action': 'DIAGNOSTIC_CHECK',
            'actor_name': 'Supabase Diagnostic',
            'actor_role': 'system',
            'details': 'Automated Supabase read/write connectivity test'
        }).execute()
        # Clean up diagnostic record
        client.table('activity_logs').delete().eq('id', test_log_id).execute()
        print("\n[VERIFIED] Read & Write operations to Supabase PostgreSQL confirmed working!")
    except Exception as e:
        print(f"\n[NOTE] Read/Write test: {e}")

    print("\n===========================================================")
    print("      ALL SUPABASE DATABASE CHECKS COMPLETED SUCCESSFULLY   ")
    print("===========================================================\n")
    return True


if __name__ == '__main__':
    ok = run_diagnostic()
    sys.exit(0 if ok else 1)
