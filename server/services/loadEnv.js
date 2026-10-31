const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * Canonical environment loader.
 * Exclusively loads from the canonical configuration file: server/.env
 * (with fallback to root .env if running from an alternative working directory).
 *
 * Supports both newer Supabase Secret keys (sb_secret_...) and legacy service_role keys,
 * under either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.
 */
function loadEnvironment() {
  const serverEnv = path.join(__dirname, '..', '.env');
  const rootEnv = path.join(__dirname, '..', '..', '.env');

  const envPath = fs.existsSync(serverEnv) ? serverEnv : (fs.existsSync(rootEnv) ? rootEnv : null);

  if (envPath) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const parsed = dotenv.parse(content);

      // Check if user pasted a raw key on an unassigned line
      let rawKey = null;
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          (trimmed.startsWith('sb_secret_') || trimmed.startsWith('eyJ')) &&
          !trimmed.includes('=')
        ) {
          rawKey = trimmed;
          break;
        }
      }

      // Populate parsed keys into process.env
      for (const [key, value] of Object.entries(parsed)) {
        process.env[key] = value;
      }

      // If raw key was detected without an explicit variable assignment, bind it
      if (rawKey && (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
        process.env.SUPABASE_SECRET_KEY = rawKey;
        process.env.SUPABASE_SERVICE_ROLE_KEY = rawKey;
      }

      // Normalize key aliases between SUPABASE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY
      const activeKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
      if (activeKey) {
        process.env.SUPABASE_SECRET_KEY = activeKey;
        process.env.SUPABASE_SERVICE_ROLE_KEY = activeKey;
      }

      return envPath;
    } catch (err) {
      console.error('[LOAD_ENV] Error loading environment from', envPath, err.message);
    }
  }

  if (!process.env.PORT) {
    process.env.PORT = '5000';
  }

  return null;
}

loadEnvironment();

module.exports = {
  loadEnvironment
};
