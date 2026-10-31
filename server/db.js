const fs = require('fs');
const path = require('path');

// Ensure environment variables are loaded robustly
require('./services/loadEnv');

const seedData = require('./seedData');
const {
  supabase,
  getSupabaseClient,
  isSupabaseConfigured,
  toCamelCase,
  toSnakeCase,
  COLLECTION_TO_TABLE,
  TABLE_TO_COLLECTION,
  testSupabaseConnection
} = require('./services/supabaseClient');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let cache = null;

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      if (content.trim()) {
        cache = JSON.parse(content);
        if (!cache.activityLogs) {
          cache.activityLogs = cache.activities || [];
        }
        return cache;
      }
    }
  } catch (err) {
    console.error('Error loading DB file, falling back to seed:', err.message);
  }

  // Deep clone seedData
  cache = JSON.parse(JSON.stringify(seedData));
  if (!cache.activityLogs) {
    cache.activityLogs = cache.activities || [];
  }
  saveDatabase();
  return cache;
}

function saveDatabase() {
  if (!cache) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB file:', err.message);
  }
}

/**
 * Hydrate in-memory and local state from Supabase PostgreSQL
 */
async function syncFromSupabase() {
  if (!isSupabaseConfigured()) {
    return false;
  }
  const client = getSupabaseClient();
  if (!client) {
    return false;
  }
  try {
    console.log('[SUPABASE] Checking and hydrating state from Supabase PostgreSQL...');
    const [
      collegesRes,
      usersRes,
      complaintsRes,
      activityRes,
      commentsRes,
      reportsRes,
      notifsRes
    ] = await Promise.all([
      client.from('colleges').select('*'),
      client.from('users').select('*'),
      client.from('complaints').select('*'),
      client.from('activity_logs').select('*'),
      client.from('comments').select('*'),
      client.from('reports').select('*'),
      client.from('notifications').select('*')
    ]);

    if (collegesRes.error || usersRes.error) {
      console.warn('[SUPABASE] Note: Could not query Supabase tables (' + (collegesRes.error || usersRes.error).message + ').');
      console.warn('[SUPABASE] Run server/supabase_schema.sql in the Supabase SQL Editor to initialize cloud tables.');
      return false;
    }

    if (!cache) loadDatabase();

    cache.colleges = (collegesRes.data || []).map(toCamelCase);
    cache.users = (usersRes.data || []).map(toCamelCase);
    cache.complaints = (complaintsRes.data || []).map(toCamelCase);
    cache.activityLogs = (activityRes.data || []).map(toCamelCase);
    cache.comments = (commentsRes.data || []).map(toCamelCase);
    cache.reports = (reportsRes.data || []).map(toCamelCase);
    cache.notifications = (notifsRes.data || []).map(toCamelCase);

    // If users table in Supabase is completely empty, ensure root Admin USR-00001 is present
    if (cache.users.length === 0 && seedData.users) {
      console.log('[SUPABASE] Seeding root Super Administrator to Supabase...');
      for (const u of seedData.users) {
        await client.from('users').upsert(toSnakeCase(u));
      }
      cache.users = JSON.parse(JSON.stringify(seedData.users));
    }

    saveDatabase();
    console.log(`[SUPABASE] Connected & synchronized: ${cache.colleges.length} colleges, ${cache.users.length} users, ${cache.complaints.length} complaints.`);
    return true;
  } catch (err) {
    console.error('[SUPABASE] Hydration error:', err.message);
    return false;
  }
}

// Check SLA expiration dynamically on active complaints
function checkSlaBreaches() {
  if (!cache || !cache.complaints) return;
  const now = new Date();
  let changed = false;

  cache.complaints.forEach(cmp => {
    if ((cmp.status === 'Assigned' || cmp.status === 'In Progress') && cmp.deadlineAt && !cmp.isEscalated) {
      const deadline = new Date(cmp.deadlineAt);
      if (now > deadline) {
        cmp.isEscalated = true;
        cmp.escalatedAt = now.toISOString();
        cmp.escalationReason = `Resolution timer exceeded SLA (${cmp.slaHours}h)`;
        cmp.escalatedTo = "Principal & College Grievance Cell";
        changed = true;

        // Async sync escalation to Supabase if configured
        if (isSupabaseConfigured()) {
          const client = getSupabaseClient();
          if (client) {
            client.from('complaints').update({
              is_escalated: true,
              escalated_at: cmp.escalatedAt,
              escalation_reason: cmp.escalationReason,
              escalated_to: cmp.escalatedTo
            }).eq('id', cmp.id).then(() => {}).catch(() => {});
          }
        }

        // Add activity log
        if (cache.activityLogs) {
          const act = {
            id: `act-auto-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            complaintId: cmp.id,
            action: "ESCALATED",
            actorRole: "system",
            actorName: "System SLA Monitor",
            details: `Timer exceeded ${cmp.slaHours}h threshold without resolution. Auto-escalated to College Principal.`,
            timestamp: now.toISOString()
          };
          cache.activityLogs.push(act);
          if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
              client.from('activity_logs').upsert(toSnakeCase(act)).then(() => {}).catch(() => {});
            }
          }
        }

        // Add admin notification
        if (cache.notifications) {
          const notif = {
            id: `notif-esc-${Date.now()}`,
            userId: "USR-00001",
            role: "admin",
            title: "Automatic Escalation Triggered",
            message: `Complaint ${cmp.id} (${cmp.title.substring(0, 30)}...) has breached its SLA and is escalated.`,
            complaintId: cmp.id,
            type: "escalation",
            isRead: false,
            createdAt: now.toISOString()
          };
          cache.notifications.push(notif);
          if (isSupabaseConfigured()) {
            const client = getSupabaseClient();
            if (client) {
              client.from('notifications').upsert(toSnakeCase(notif)).then(() => {}).catch(() => {});
            }
          }
        }
      }
    }
  });

  if (changed) {
    saveDatabase();
  }
}

// Initialize on startup
loadDatabase();
if (isSupabaseConfigured()) {
  syncFromSupabase();
}
checkSlaBreaches();
// Check SLAs periodically every 30 seconds
setInterval(checkSlaBreaches, 30000);

const db = {
  get(collection) {
    if (!cache) loadDatabase();
    return cache[collection] || [];
  },

  find(collection, predicate) {
    const list = this.get(collection);
    return list.filter(predicate);
  },

  findOne(collection, predicate) {
    const list = this.get(collection);
    return list.find(predicate) || null;
  },

  findById(collection, id) {
    return this.findOne(collection, item => item.id === id);
  },

  insert(collection, item) {
    if (!cache) loadDatabase();
    if (!cache[collection]) cache[collection] = [];
    cache[collection].unshift(item);
    saveDatabase();

    // Async sync to Supabase if configured
    if (isSupabaseConfigured()) {
      const tableName = COLLECTION_TO_TABLE[collection];
      const client = getSupabaseClient();
      if (tableName && client) {
        client.from(tableName).upsert(toSnakeCase(item)).then(({ error }) => {
          if (error) {
            console.error(`[SUPABASE] Error syncing insert to ${tableName}:`, error.message);
          }
        }).catch(err => {
          console.error(`[SUPABASE] Sync insert exception:`, err.message);
        });
      }
    }

    return item;
  },

  update(collection, id, updates) {
    if (!cache) loadDatabase();
    const list = cache[collection] || [];
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return null;

    list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
    saveDatabase();

    // Async sync to Supabase if configured
    if (isSupabaseConfigured()) {
      const tableName = COLLECTION_TO_TABLE[collection];
      const client = getSupabaseClient();
      if (tableName && client) {
        const snakeUpdates = toSnakeCase(updates);
        snakeUpdates.updated_at = new Date().toISOString();
        client.from(tableName).update(snakeUpdates).eq('id', id).then(({ error }) => {
          if (error) {
            console.error(`[SUPABASE] Error syncing update to ${tableName}:`, error.message);
          }
        }).catch(err => {
          console.error(`[SUPABASE] Sync update exception:`, err.message);
        });
      }
    }

    return list[index];
  },

  delete(collection, id) {
    if (!cache) loadDatabase();
    if (!cache[collection]) return false;
    const initialLen = cache[collection].length;
    cache[collection] = cache[collection].filter(item => item.id !== id);
    if (cache[collection].length !== initialLen) {
      saveDatabase();

      // Async sync to Supabase if configured
      if (isSupabaseConfigured()) {
        const tableName = COLLECTION_TO_TABLE[collection];
        const client = getSupabaseClient();
        if (tableName && client) {
          client.from(tableName).delete().eq('id', id).then(({ error }) => {
            if (error) {
              console.error(`[SUPABASE] Error syncing delete to ${tableName}:`, error.message);
            }
          }).catch(err => {
            console.error(`[SUPABASE] Sync delete exception:`, err.message);
          });
        }
      }

      return true;
    }
    return false;
  },

  reset() {
    cache = JSON.parse(JSON.stringify(seedData));
    if (!cache.activityLogs) {
      cache.activityLogs = cache.activities || [];
    }
    saveDatabase();
    return cache;
  },

  // Helper to log complaint action
  logActivity(complaintId, action, actorRole, actorName, details) {
    return this.insert('activityLogs', {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      complaintId,
      action,
      actorRole,
      actorName,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Helper to send notification
  notify(userId, role, title, message, complaintId, type = 'status') {
    return this.insert('notifications', {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      role,
      title,
      message,
      complaintId,
      type,
      isRead: false,
      createdAt: new Date().toISOString()
    });
  },

  // Dual-mode utility exports
  supabase,
  getSupabase: getSupabaseClient,
  isSupabaseConfigured,
  syncFromSupabase,
  testConnection: testSupabaseConnection
};

module.exports = db;
