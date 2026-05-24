/**
 * @module tasks/telemetry
 * @description Periodic telemetry data collection and upload — mirrors `app.tasks.telemetry`
 * from the Clojure backend.
 *
 * Collects instance statistics (user counts, file counts, team averages) and
 * audit event batches, then uploads them to the configured telemetry endpoint.
 *
 * ### Configuration
 *
 * - `PENPOT_TELEMETRY_ENABLED` — Enable telemetry collection (default: `false`).
 * - `PENPOT_TELEMETRY_URI` — Telemetry endpoint URL (default: `https://telemetry.penpot.app/`).
 * - `PENPOT_TELEMETRY_REFERER` — Referer header value (default: empty, uses public URI).
 *
 * ### Task registration
 *
 * The `telemetry` task is registered in the scheduler and runs approximately
 * every 3 hours. It is controlled by the `telemetry` feature flag.
 */

import { config, flagEnabled } from '../config/index.js';
import { getInstanceProp } from '../setup/index.js';

const TELEMETRY_SOURCE = 'penpot-backend-js';
const BATCH_SIZE = 10000;
const GC_MAX_AGE_DAYS = 7;

/**
 * Collect instance statistics from the database.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 * @returns {object} Statistics object.
 */
function collectStats(pool) {
  const today = new Date().toISOString().substring(0, 10);

  const count = (sql) => {
    const row = pool.get(sql);
    return row ? (row.cnt || row.total || 0) : 0;
  };

  const totalTeams = count('SELECT COUNT(*) AS cnt FROM team');
  const totalProjects = count('SELECT COUNT(*) AS cnt FROM project WHERE deleted_at IS NULL');
  const totalFiles = count('SELECT COUNT(*) AS cnt FROM file WHERE deleted_at IS NULL');
  const totalUsers = count('SELECT COUNT(*) AS cnt FROM profile WHERE deleted_at IS NULL');
  const totalFonts = count("SELECT COUNT(*) AS cnt FROM team_font_variant WHERE deleted_at IS NULL");
  const totalComments = count('SELECT COUNT(*) AS cnt FROM comment');
  const totalFileChanges = count("SELECT COUNT(*) AS cnt FROM file_change WHERE date(created_at) = date(?)", [today]);
  const totalTouchedFiles = count("SELECT COUNT(DISTINCT file_id) AS cnt FROM file_change WHERE date(created_at) = date(?)", [today]);

  let teamAverages = {};
  try {
    teamAverages = {
      avgProjectsPerTeam: count('SELECT AVG(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM project WHERE deleted_at IS NULL GROUP BY team_id)'),
      maxProjectsPerTeam: count('SELECT MAX(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM project WHERE deleted_at IS NULL GROUP BY team_id)'),
      avgFilesPerProject: count('SELECT AVG(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM file WHERE deleted_at IS NULL GROUP BY project_id)'),
      maxFilesPerProject: count('SELECT MAX(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM file WHERE deleted_at IS NULL GROUP BY project_id)'),
      avgUsersPerTeam: count("SELECT AVG(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM team_profile_rel WHERE is_member = '1' GROUP BY team_id)"),
      maxUsersPerTeam: count("SELECT MAX(cnt) AS cnt FROM (SELECT COUNT(*) AS cnt FROM team_profile_rel WHERE is_member = '1' GROUP BY team_id)"),
    };
  } catch {
    // Averages may fail if tables are empty
  }

  let emailDomains = [];
  try {
    const rows = pool.query("SELECT DISTINCT SUBSTR(email, INSTR(email, '@') + 1) AS domain FROM profile WHERE deleted_at IS NULL AND email LIKE '%@%'");
    emailDomains = rows.map(r => r.domain).filter(Boolean);
  } catch {
    // Ignore if email column structure differs
  }

  let authProviders = [];
  try {
    const rows = pool.query("SELECT auth_source, COUNT(*) AS cnt FROM profile WHERE deleted_at IS NULL GROUP BY auth_source");
    authProviders = rows.map(r => ({ source: r.auth_source || 'unknown', count: r.cnt }));
  } catch {
    // Ignore
  }

  const eventCounters = {};
  try {
    const rows = pool.query(
      "SELECT name, COUNT(*) AS cnt FROM audit_log WHERE source LIKE 'telemetry:%' AND date(created_at) = date(?) GROUP BY name",
      [today]
    );
    for (const row of rows) {
      eventCounters[row.name] = row.cnt;
    }
  } catch {
    // Ignore
  }

  return {
    source: TELEMETRY_SOURCE,
    instanceId: getInstanceProp(pool, 'instance-id') || 'unknown',
    publicUri: config.http.publicUri || config.publicUri,
    totalTeams,
    totalProjects,
    totalFiles,
    totalUsers,
    totalFonts,
    totalComments,
    totalFileChanges,
    totalTouchedFiles,
    ...teamAverages,
    emailDomains,
    authProviders,
    eventCounters,
    osArch: process.arch,
    osName: process.platform,
    osVersion: process.version,
    runtimeCpus: navigator?.hardwareConcurrency || require('os').cpus()?.length || 0,
    trackedAt: today,
  };
}

/**
 * Send telemetry stats to the configured endpoint.
 *
 * @param {object} stats - Statistics object.
 * @param {string} type - Payload type (`telemetry-legacy-report` or `telemetry-events`).
 * @returns {Promise<boolean>} `true` if the upload succeeded.
 */
async function sendTelemetry(stats, type) {
  const uri = config.telemetry.uri;
  if (!uri) return false;

  const payload = { type, data: stats };

  try {
    const response = await fetch(uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status > 206) {
      console.error(`[telemetry] Upload failed with status ${response.status}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[telemetry] Upload error: ${err.message}`);
    return false;
  }
}

/**
 * Garbage-collect old telemetry audit_log events.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
function gcTelemetryEvents(pool) {
  const cutoff = new Date(Date.now() - GC_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  try {
    pool.run("DELETE FROM audit_log WHERE source LIKE 'telemetry:%' AND created_at < ?", [cutoff]);
  } catch {
    // Ignore errors during GC
  }
}

/**
 * Collect and send audit event batches to the telemetry endpoint.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool
 */
async function collectAndSendAuditEvents(pool) {
  const rows = pool.query(
    "SELECT id, name, source, type, tracked_at, created_at, profile_id, props, context FROM audit_log WHERE source LIKE 'telemetry:%' ORDER BY created_at ASC LIMIT ?",
    [BATCH_SIZE]
  );

  if (rows.length === 0) return;

  const events = rows.map(row => ({
    id: row.id,
    name: row.name,
    source: row.source,
    type: row.type,
    trackedAt: row.tracked_at,
    createdAt: row.created_at,
    profileId: row.profile_id,
    props: row.props ? (typeof row.props === 'string' ? JSON.parse(row.props) : row.props) : {},
    context: row.context ? (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) : {},
  }));

  const sent = await sendTelemetry({ events }, 'telemetry-events');
  if (sent) {
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    pool.run(`DELETE FROM audit_log WHERE id IN (${placeholders})`, ids);
  }
}

/**
 * Execute the telemetry task: collect stats, upload, and GC old events.
 *
 * @param {import('../db/sqlite.js').DatabasePool} pool - Database pool.
 */
export async function runTelemetryTask(pool) {
  const telemetryEnabled = flagEnabled('telemetry') || config.telemetry.enabled;
  if (!telemetryEnabled) {
    // Even if telemetry is disabled, still GC old telemetry events
    gcTelemetryEvents(pool);
    return;
  }

  // GC old telemetry events
  gcTelemetryEvents(pool);

  // Randomize start time slightly (0-10 seconds) to avoid thundering herd
  const delay = Math.floor(Math.random() * 10000);
  await new Promise(resolve => setTimeout(resolve, delay));

  // Collect and send legacy stats report
  const stats = collectStats(pool);
  await sendTelemetry(stats, 'telemetry-legacy-report');

  // Collect and send audit event batches
  await collectAndSendAuditEvents(pool);
}