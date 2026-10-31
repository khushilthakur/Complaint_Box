const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ensure environment variables are loaded robustly
require('./loadEnv');

// Table name mappings: internal collection -> Supabase table
const COLLECTION_TO_TABLE = {
  colleges: 'colleges',
  users: 'users',
  complaints: 'complaints',
  activityLogs: 'activity_logs',
  comments: 'comments',
  reports: 'reports',
  notifications: 'notifications'
};

const TABLE_TO_COLLECTION = {
  colleges: 'colleges',
  users: 'users',
  complaints: 'complaints',
  activity_logs: 'activityLogs',
  comments: 'comments',
  reports: 'reports',
  notifications: 'notifications'
};

/**
 * Returns configuration diagnosis without exposing secrets
 */
function getSupabaseConfigStatus() {
  const rawUrl = process.env.SUPABASE_URL || '';
  const rawKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  const url = rawUrl.trim().replace(/^["']|["']$/g, '');
  const key = rawKey.trim().replace(/^["']|["']$/g, '');

  if (!url) {
    return { configured: false, reason: 'SUPABASE_URL is not set in server/.env' };
  }
  if (!key) {
    return { configured: false, reason: 'SUPABASE_SECRET_KEY is not set in server/.env' };
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { configured: false, reason: 'SUPABASE_URL must begin with https://' };
  }
  if (
    url.includes('your-project') ||
    url.includes('your-project-ref') ||
    url.includes('your-project-id') ||
    url.includes('xxxx.supabase.co')
  ) {
    return { configured: false, reason: 'SUPABASE_URL contains placeholder domain' };
  }
  if (
    key.includes('your-service-role-key') ||
    key.includes('your_new_secret_key') ||
    key.includes('your-supabase-service-role-secret-key-here') ||
    key.includes('your-supabase-anon-public-key-here') ||
    key.includes('PASTE_YOUR_') ||
    key.includes('eyJh......') ||
    key.includes('sb_secret_......') ||
    key.length < 20
  ) {
    return { configured: false, reason: 'SUPABASE_SECRET_KEY is still a placeholder value in server/.env' };
  }

  let keyType = 'Secret API Key';
  if (key.startsWith('sb_secret_')) {
    keyType = 'Secret API Key (sb_secret_...)';
  } else if (key.startsWith('sb_publishable_')) {
    keyType = 'Publishable API Key (sb_publishable_...)';
  } else if (key.startsWith('eyJ')) {
    keyType = 'Legacy service_role (JWT)';
  }

  return {
    configured: true,
    url,
    keyType
  };
}

/**
 * Validates if Supabase is properly configured in environment variables
 */
function isSupabaseConfigured() {
  return getSupabaseConfigStatus().configured;
}

let supabaseInstance = null;
let lastInitUrl = null;
let lastInitKey = null;

/**
 * Obtains or creates the Supabase client instance
 */
function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = (process.env.SUPABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (supabaseInstance && lastInitUrl === url && lastInitKey === key) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    lastInitUrl = url;
    lastInitKey = key;
    return supabaseInstance;
  } catch (err) {
    console.error('[SUPABASE] Initialization error:', err.message);
    supabaseInstance = null;
    return null;
  }
}

// Transparent proxy to allow direct calls like supabase.from(...) while supporting dynamic initialization
const supabaseProxy = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      return undefined;
    }
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

// Convert snake_case string to camelCase
function snakeToCamelStr(str) {
  return str.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

// Convert camelCase string to snake_case
function camelToSnakeStr(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Recursively convert object keys to camelCase
function toCamelCase(item) {
  if (item === null || item === undefined || typeof item !== 'object') {
    return item;
  }
  if (Array.isArray(item)) {
    return item.map(toCamelCase);
  }
  const result = {};
  for (const [key, value] of Object.entries(item)) {
    const camelKey = snakeToCamelStr(key);
    // Don't convert inner keys for generic JSON fields like 'data' in reports
    if (key === 'data' && typeof value === 'object') {
      result[camelKey] = value;
    } else {
      result[camelKey] = toCamelCase(value);
    }
  }
  return result;
}

// Convert object keys to snake_case for Supabase insertion/updating
function toSnakeCase(item) {
  if (item === null || item === undefined || typeof item !== 'object') {
    return item;
  }
  if (Array.isArray(item)) {
    return item.map(toSnakeCase);
  }
  const result = {};
  for (const [key, value] of Object.entries(item)) {
    const snakeKey = camelToSnakeStr(key);
    // Don't convert inner keys of generic JSON fields
    if (key === 'data' && typeof value === 'object') {
      result[snakeKey] = value;
    } else {
      result[snakeKey] = toSnakeCase(value);
    }
  }
  return result;
}

/**
 * Test connectivity with Supabase project without exposing secrets
 */
async function testSupabaseConnection() {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    return { success: false, authenticated: false, schemaPending: false, message: status.reason };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, authenticated: false, schemaPending: false, message: 'Failed to initialize Supabase client instance.' };
  }
  try {
    const { data, error, status: httpStatus } = await client.from('colleges').select('id').limit(1);
    if (error) {
      if (
        error.code === '42P01' ||
        (error.message && error.message.toLowerCase().includes('relation') && error.message.toLowerCase().includes('does not exist'))
      ) {
        return {
          success: true,
          authenticated: true,
          schemaPending: true,
          message: 'Authenticated successfully with Supabase! (Database tables need to be created via server/supabase_schema.sql)'
        };
      }
      return {
        success: false,
        authenticated: false,
        schemaPending: false,
        code: error.code,
        status: httpStatus,
        message: error.message
      };
    }
    return {
      success: true,
      authenticated: true,
      schemaPending: false,
      message: 'Successfully connected and verified Supabase PostgreSQL database.'
    };
  } catch (err) {
    return { success: false, authenticated: false, schemaPending: false, message: err.message };
  }
}

module.exports = {
  supabase: supabaseProxy,
  getSupabaseClient,
  getSupabase: getSupabaseClient,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  toCamelCase,
  toSnakeCase,
  testSupabaseConnection,
  COLLECTION_TO_TABLE,
  TABLE_TO_COLLECTION
};
