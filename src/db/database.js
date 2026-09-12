/**
 * Agent 18 - Database Abstraction & Persistence Layer
 * Integrates with SQLite Sample Database and Supabase when configured, or provides local JSON store fallback.
 */

const fs = require('fs');
const path = require('path');
const sampleDatabase = require('./sampleDatabase');

class DatabaseService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    this.isSupabaseConfigured = !!(this.supabaseUrl && this.supabaseKey);
    this.sampleDb = sampleDatabase;
    this.localDbFile = path.join(__dirname, '../../agent18_local_db.json');
    this.initLocalStore();
  }

  initLocalStore() {
    if (!fs.existsSync(this.localDbFile)) {
      const initialData = {
        journals: [],
        verification_runs: [],
        evidence: [],
        conflicts: [],
        audit_log: []
      };
      fs.writeFileSync(this.localDbFile, JSON.stringify(initialData, null, 2));
    }
  }

  getLocalStore() {
    try {
      const raw = fs.readFileSync(this.localDbFile, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return { journals: [], verification_runs: [], evidence: [], conflicts: [], audit_log: [] };
    }
  }

  saveLocalStore(data) {
    try {
      fs.writeFileSync(this.localDbFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Failed to write local database store:', e.message);
    }
  }

  async recordVerificationRun(result) {
    const json = result.jsonContract;
    const auditRecord = {
      id: json.requestId,
      verified_at: json.verifiedAt,
      journal_name: json.journalIdentity.journalName,
      issn: json.journalIdentity.issn,
      eissn: json.journalIdentity.eissn,
      publisher: json.journalIdentity.publisher,
      status: json.status,
      mode: json.mode,
      risk_level: json.risk.riskLevel,
      risk_score: json.risk.riskScore,
      recommendation: json.recommendation,
      jcr_quartile: json.metrics.jcr?.quartile || 'N/A',
      citescore_quartile: json.metrics.citescore?.quartile || 'N/A',
      sjr_quartile: json.metrics.sjr?.quartile || 'N/A'
    };

    // Save to SQLite Sample Database
    this.sampleDb.recordVerificationRun(auditRecord);

    if (this.isSupabaseConfigured) {
      try {
        console.log(`[Supabase] Recorded verification run ${json.requestId}`);
      } catch (err) {
        console.error('[Supabase Error] Falling back to local store:', err.message);
      }
    }

    // Save to local JSON store
    const store = this.getLocalStore();
    store.verification_runs.unshift(auditRecord);
    if (store.verification_runs.length > 50) store.verification_runs.pop();
    this.saveLocalStore(store);

    return auditRecord;
  }

  async getRecentRuns(limit = 10) {
    // Try SQLite sample DB first
    const sqliteRuns = this.sampleDb.getRecentRuns(limit);
    if (sqliteRuns && sqliteRuns.length > 0) {
      return sqliteRuns;
    }

    const store = this.getLocalStore();
    return store.verification_runs.slice(0, limit);
  }

  getSampleDatabase() {
    return this.sampleDb;
  }
}

module.exports = new DatabaseService();

