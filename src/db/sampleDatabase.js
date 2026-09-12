/**
 * Agent 18 - Sample Database Service (SQLite Integration)
 * Utilizes Node.js native `node:sqlite` module for standalone relational persistence,
 * querying, multi-table schema management, and sample journal dataset seeding.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class SampleDatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '../../agent18_sample_database.sqlite');
    this.initDatabase();
  }

  initDatabase() {
    try {
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.createTables();
      this.seedInitialData();
      console.log(`[SampleDatabase] SQLite database initialized at ${this.dbPath}`);
    } catch (err) {
      console.error('[SampleDatabase Initialization Error]:', err.message);
    }
  }

  createTables() {
    const createJournalsTable = `
      CREATE TABLE IF NOT EXISTS journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_name TEXT NOT NULL,
        issn TEXT UNIQUE,
        eissn TEXT,
        publisher TEXT,
        official_url TEXT,
        subject_area TEXT,
        indexed_scopus INTEGER DEFAULT 0,
        indexed_wos INTEGER DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createMetricsTable = `
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_id INTEGER NOT NULL,
        database_name TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL,
        quartile TEXT,
        year INTEGER,
        FOREIGN KEY (journal_id) REFERENCES journals (id) ON DELETE CASCADE
      );
    `;

    const createPredatoryPatternsTable = `
      CREATE TABLE IF NOT EXISTS predatory_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_name TEXT NOT NULL,
        indicator_type TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        description TEXT NOT NULL
      );
    `;

    const createApprovedVenuesTable = `
      CREATE TABLE IF NOT EXISTS approved_venues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        journal_name TEXT NOT NULL,
        issn TEXT UNIQUE NOT NULL,
        added_by TEXT DEFAULT 'Institutional Admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createVerificationRunsTable = `
      CREATE TABLE IF NOT EXISTS verification_runs (
        id TEXT PRIMARY KEY,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        journal_name TEXT,
        issn TEXT,
        eissn TEXT,
        publisher TEXT,
        status TEXT NOT NULL,
        mode TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        recommendation TEXT NOT NULL,
        jcr_quartile TEXT,
        citescore_quartile TEXT,
        sjr_quartile TEXT
      );
    `;

    this.db.exec(createJournalsTable);
    this.db.exec(createMetricsTable);
    this.db.exec(createPredatoryPatternsTable);
    this.db.exec(createApprovedVenuesTable);
    this.db.exec(createVerificationRunsTable);
  }

  seedInitialData() {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM journals');
    const { count } = countStmt.get();

    if (count > 0) return; // Already seeded

    console.log('[SampleDatabase] Seeding sample journal records...');

    const sampleJournals = [
      {
        journal_name: 'Nature',
        issn: '0028-0836',
        eissn: '1476-4687',
        publisher: 'Springer Nature',
        official_url: 'https://www.nature.com/nature',
        subject_area: 'Multidisciplinary Sciences',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Premier international weekly journal publishing top-tier peer-reviewed research across all science disciplines.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 50.5, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 68.2, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 15.4, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        issn: '0162-8828',
        eissn: '1939-3539',
        publisher: 'IEEE',
        official_url: 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34',
        subject_area: 'Computer Science, Artificial Intelligence',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Top-tier journal covering computer vision, pattern recognition, machine learning, and image analysis.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 20.8, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 36.1, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 4.8, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'Scientometrics',
        issn: '0138-9130',
        eissn: '1588-2861',
        publisher: 'Springer',
        official_url: 'https://link.springer.com/journal/11192',
        subject_area: 'Library & Information Science, Computer Science Applications',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'International journal focusing on quantitative aspects of science, communication, and science policy.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 3.8, quartile: 'Q2', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 6.5, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 1.2, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'PLOS ONE',
        issn: '1932-6203',
        eissn: '1932-6203',
        publisher: 'Public Library of Science',
        official_url: 'https://journals.plos.org/plosone/',
        subject_area: 'Multidisciplinary Sciences',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Inclusive open access journal publishing rigorous primary research from all natural sciences and medicine.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 3.7, quartile: 'Q2', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 5.9, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 0.8, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'Journal of Big Data',
        issn: '2196-1115',
        eissn: '2196-1115',
        publisher: 'SpringerOpen',
        official_url: 'https://journalofbigdata.springeropen.com/',
        subject_area: 'Computer Science, Data Analytics',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Open access journal dedicated to big data analytics, deep learning, cloud computing, and scalability.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 10.8, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 16.5, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 2.1, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'International Journal of Advanced Research in Computer Science',
        issn: '0976-5697',
        eissn: '2249-0701',
        publisher: 'Fake Academic Publishing House',
        official_url: 'http://www.ijarcs-fake.org',
        subject_area: 'General Engineering',
        indexed_scopus: 0,
        indexed_wos: 0,
        description: 'Unindexed venue claiming false Scopus Q1 status and fake impact factors in CFP marketing.',
        metrics: [
          { database_name: 'Unconfirmed Claim', metric_name: 'Fake Impact Factor', value: 7.5, quartile: 'Q1 (Unverified)', year: 2024 }
        ]
      },
      {
        journal_name: 'Physical Review Letters',
        issn: '0031-9007',
        eissn: '1079-7114',
        publisher: 'American Physical Society',
        official_url: 'https://journals.aps.org/prl/',
        subject_area: 'Physics, Astronomy',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Leading international journal for brief, high-impact letters covering foundational physics.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 8.8, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 14.2, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 3.4, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'Cell',
        issn: '0092-8674',
        eissn: '1097-4172',
        publisher: 'Cell Press / Elsevier',
        official_url: 'https://www.cell.com/cell/home',
        subject_area: 'Biochemistry, Cell Biology, Molecular Biology',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'Premier journal in life sciences publishing discoveries across experimental biology.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 45.5, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 70.1, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 18.2, quartile: 'Q1', year: 2024 }
        ]
      },
      {
        journal_name: 'The Lancet',
        issn: '0140-6736',
        eissn: '1474-547X',
        publisher: 'Elsevier',
        official_url: 'https://www.thelancet.com/',
        subject_area: 'General Medicine, Clinical Research',
        indexed_scopus: 1,
        indexed_wos: 1,
        description: 'One of the world\'s highest-impact general medical journals.',
        metrics: [
          { database_name: 'JCR', metric_name: 'Impact Factor', value: 98.4, quartile: 'Q1', year: 2024 },
          { database_name: 'Scopus', metric_name: 'CiteScore', value: 115.0, quartile: 'Q1', year: 2024 },
          { database_name: 'SCImago SJR', metric_name: 'SJR', value: 22.5, quartile: 'Q1', year: 2024 }
        ]
      }
    ];

    const insertJournal = this.db.prepare(`
      INSERT INTO journals (journal_name, issn, eissn, publisher, official_url, subject_area, indexed_scopus, indexed_wos, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMetric = this.db.prepare(`
      INSERT INTO metrics (journal_id, database_name, metric_name, value, quartile, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    sampleJournals.forEach(j => {
      const result = insertJournal.run(
        j.journal_name,
        j.issn,
        j.eissn || null,
        j.publisher,
        j.official_url,
        j.subject_area,
        j.indexed_scopus,
        j.indexed_wos,
        j.description
      );

      const journalId = result.lastInsertRowid;

      if (j.metrics && j.metrics.length > 0) {
        j.metrics.forEach(m => {
          insertMetric.run(journalId, m.database_name, m.metric_name, m.value, m.quartile, m.year);
        });
      }
    });

    // Seed Predatory Indicator Patterns
    const insertPattern = this.db.prepare(`
      INSERT INTO predatory_patterns (pattern_name, indicator_type, risk_score, description)
      VALUES (?, ?, ?, ?)
    `);

    insertPattern.run(
      'False Scopus Indexing Claim',
      'FALSE_INDEXING_CLAIM',
      35,
      'CFP or website claims indexing in Scopus when not present in official Elsevier database.'
    );
    insertPattern.run(
      'Fake Impact Factor Metric',
      'UNAUTHORIZED_METRIC_CLAIM',
      25,
      'Claims fabricated impact factor numbers issued by unaccredited third-party rating agencies.'
    );
    insertPattern.run(
      'Guaranteed Rapid Peer Review (< 48 hrs)',
      'SUSPICIOUS_EDITORIAL_PRACTICE',
      30,
      'Offers unrealistically rapid publication timelines compromising rigorous peer review.'
    );

    // Seed Approved Institutional Venues
    const insertApproved = this.db.prepare(`
      INSERT INTO approved_venues (journal_name, issn, added_by)
      VALUES (?, ?, ?)
    `);
    insertApproved.run('Nature', '0028-0836', 'Institutional Research Office');
    insertApproved.run('IEEE Transactions on Pattern Analysis and Machine Intelligence', '0162-8828', 'Computer Science Dept Committee');
    insertApproved.run('Scientometrics', '0138-9130', 'Academic Quality Council');

    console.log('[SampleDatabase] Database successfully populated with sample data.');
  }

  getDatabaseStatus() {
    try {
      const tables = ['journals', 'metrics', 'predatory_patterns', 'approved_venues', 'verification_runs'];
      const counts = {};

      tables.forEach(table => {
        const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        counts[table] = row ? row.count : 0;
      });

      return {
        connected: true,
        engine: 'SQLite (Node.js native node:sqlite)',
        dbPath: this.dbPath,
        tableCounts: counts,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        connected: false,
        engine: 'SQLite (Node.js native node:sqlite)',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  getAllJournals(limit = 20) {
    const stmt = this.db.prepare(`
      SELECT j.*, 
        COUNT(m.id) as metrics_count
      FROM journals j
      LEFT JOIN metrics m ON j.id = m.journal_id
      GROUP BY j.id
      ORDER BY j.journal_name ASC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  getJournalByIdOrIssn(query) {
    if (!query) return null;
    
    let stmt = this.db.prepare(`
      SELECT * FROM journals WHERE issn = ? OR eissn = ? OR id = ? OR LOWER(journal_name) = LOWER(?) LIMIT 1
    `);
    const journal = stmt.get(query, query, query, query);

    if (!journal) {
      // Fuzzy / Substring search fallback
      const fuzzyStmt = this.db.prepare(`
        SELECT * FROM journals WHERE LOWER(journal_name) LIKE LOWER(?) LIMIT 1
      `);
      return fuzzyStmt.get(`%${query}%`);
    }

    if (journal) {
      const metricsStmt = this.db.prepare(`SELECT * FROM metrics WHERE journal_id = ?`);
      journal.metrics = metricsStmt.all(journal.id);
    }

    return journal;
  }

  searchJournals(searchTerm) {
    if (!searchTerm) return this.getAllJournals();

    const stmt = this.db.prepare(`
      SELECT j.*, 
        COUNT(m.id) as metrics_count
      FROM journals j
      LEFT JOIN metrics m ON j.id = m.journal_id
      WHERE LOWER(j.journal_name) LIKE LOWER(?) 
         OR j.issn LIKE ? 
         OR j.eissn LIKE ? 
         OR LOWER(j.publisher) LIKE LOWER(?)
      GROUP BY j.id
      ORDER BY j.journal_name ASC
      LIMIT 20
    `);

    const term = `%${searchTerm}%`;
    return stmt.all(term, term, term, term);
  }

  recordVerificationRun(record) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO verification_runs (
          id, verified_at, journal_name, issn, eissn, publisher, status, mode, risk_level, risk_score, recommendation, jcr_quartile, citescore_quartile, sjr_quartile
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          verified_at = excluded.verified_at,
          status = excluded.status,
          risk_level = excluded.risk_level,
          risk_score = excluded.risk_score
      `);

      stmt.run(
        record.id,
        record.verified_at || new Date().toISOString(),
        record.journal_name || '',
        record.issn || '',
        record.eissn || '',
        record.publisher || '',
        record.status || 'UNKNOWN',
        record.mode || 'PARTIAL',
        record.risk_level || 'LOW',
        record.risk_score || 0,
        record.recommendation || 'ACCEPT',
        record.jcr_quartile || 'N/A',
        record.citescore_quartile || 'N/A',
        record.sjr_quartile || 'N/A'
      );
      return true;
    } catch (err) {
      console.error('[SampleDatabase Record Verification Run Error]:', err.message);
      return false;
    }
  }

  getRecentRuns(limit = 20) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM verification_runs ORDER BY verified_at DESC LIMIT ?
      `);
      return stmt.all(limit);
    } catch (err) {
      console.error('[SampleDatabase getRecentRuns Error]:', err.message);
      return [];
    }
  }

  resetAndSeed() {
    this.db.exec('DROP TABLE IF EXISTS metrics;');
    this.db.exec('DROP TABLE IF EXISTS journals;');
    this.db.exec('DROP TABLE IF EXISTS predatory_patterns;');
    this.db.exec('DROP TABLE IF EXISTS approved_venues;');
    this.db.exec('DROP TABLE IF EXISTS verification_runs;');
    this.createTables();
    this.seedInitialData();
    return this.getDatabaseStatus();
  }
}

module.exports = new SampleDatabaseService();
