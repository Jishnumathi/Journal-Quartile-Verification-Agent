/**
 * Agent 18 - Express REST Server & Integration API Entry Point
 * Implements security controls, rate limiting, request size limits, Idempotency-Key header handling,
 * institutional policy endpoints, manual re-verification triggers, and downstream integration contracts.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const VerificationController = require('./src/services/verificationController');
const DatabaseService = require('./src/db/database');
const institutionalPolicyManager = require('./src/services/institutionalPolicyManager');
const reverificationScheduler = require('./src/services/reverificationScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middlewares
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple Rate Limiting Middleware (100 requests per 15 minutes per IP)
const rateLimitMap = new Map();
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxRequests = 100;

    const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many verification requests. Please try again later.'
      });
    }
  }
  next();
});

// Idempotency Key Storage
const idempotencyStore = new Map();

const verifier = new VerificationController();

// API Endpoint 1: Verify Journal (with Idempotency-Key Support)
app.post('/api/verify', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  if (idempotencyKey) {
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    const existing = idempotencyStore.get(idempotencyKey);

    if (existing) {
      if (existing.payloadHash === payloadHash) {
        return res.json(existing.response);
      } else {
        return res.status(409).json({
          error: 'Idempotency Conflict',
          message: `Idempotency key "${idempotencyKey}" was previously used with a different request payload.`
        });
      }
    }
  }

  try {
    const result = await verifier.verify(req.body);
    await DatabaseService.recordVerificationRun(result);

    if (idempotencyKey) {
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
      idempotencyStore.set(idempotencyKey, {
        payloadHash,
        response: result,
        createdAt: Date.now()
      });
    }

    return res.json(result);
  } catch (err) {
    console.error('Verification Error:', err);
    return res.status(500).json({
      error: 'Verification Pipeline Error',
      message: err.message
    });
  }
});

// API Endpoint 2: Manual / On-Demand Re-Verification Trigger
app.post('/api/reverify', async (req, res) => {
  try {
    const result = await reverificationScheduler.reverifyNow(verifier, req.body);
    await DatabaseService.recordVerificationRun(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Re-verification Failed', message: err.message });
  }
});

// API Endpoint 3: Institutional Approved-Venue List Management (GET, POST, DELETE)
app.get('/api/institutional-list', (req, res) => {
  const venues = institutionalPolicyManager.getApprovedVenues();
  return res.json({ venues });
});

app.post('/api/institutional-list', (req, res) => {
  try {
    const entry = institutionalPolicyManager.addApprovedVenue(req.body);
    return res.status(201).json({ message: 'Approved venue added successfully', entry });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete('/api/institutional-list/:id', (req, res) => {
  const success = institutionalPolicyManager.removeApprovedVenue(req.params.id);
  if (success) {
    return res.json({ message: `Venue ${req.params.id} removed from approved list.` });
  } else {
    return res.status(404).json({ error: 'Venue ID not found' });
  }
});

// API Endpoint 4: Downstream Agent Integrations (Agents 17, 20, 21, 59)
app.post('/api/integration/agent18-result', async (req, res) => {
  try {
    const result = await verifier.verify(req.body);
    const contract = result.jsonContract;

    const downstreamPayload = {
      agent: '18',
      journal: {
        canonical_name: contract.journalIdentity.journalName,
        issn: contract.journalIdentity.issn,
        eissn: contract.journalIdentity.eissn,
        publisher: contract.journalIdentity.publisher,
        official_url: contract.journalIdentity.officialUrl
      },
      verification: {
        status: contract.status,
        verified_at: contract.verifiedAt,
        valid_until: contract.validUntil,
        recommendation: contract.recommendation
      },
      indexing: contract.indexing,
      metrics: {
        jif: contract.metrics.jcr,
        citescore: contract.metrics.citescore,
        sjr: contract.metrics.sjr
      },
      quartiles: contract.metrics.all,
      risk: contract.risk,
      policy: contract.policyEvaluation,
      alternatives: contract.alternatives,
      evidence: contract.evidence
    };

    return res.json(downstreamPayload);
  } catch (err) {
    return res.status(500).json({ error: 'Integration Request Failed', message: err.message });
  }
});

// API Endpoint 5: System Health & Key Configuration Status
app.get('/api/health', (req, res) => {
  const embeddingEngine = require('./src/services/embeddingEngine');
  const vectorStore = require('./src/services/vectorStore');

  return res.json({
    status: 'HEALTHY',
    agent: 'Agent 18 — Journal Quartile Verification Agent (Master Enterprise Edition)',
    timestamp: new Date().toISOString(),
    database: DatabaseService.getSampleDatabase().getDatabaseStatus(),
    configuredIntegrations: {
      crossref: true,
      openalex: true,
      scopus: !!process.env.SCOPUS_API_KEY,
      clarivate: !!process.env.CLARIVATE_API_KEY,
      jcr: !!(process.env.CLARIVATE_API_KEY || process.env.JCR_API_KEY),
      sjr: !!process.env.SJR_API_KEY,
      sqliteSampleDb: true,
      supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    },
    rag: {
      active: true,
      embeddingProvider: embeddingEngine.getMode(),
      vectorStoreMode: vectorStore.getMode()
    }
  });
});

// API Endpoint 5.1: Sample Database Status
app.get('/api/database/status', (req, res) => {
  const status = DatabaseService.getSampleDatabase().getDatabaseStatus();
  return res.json(status);
});

// API Endpoint 5.2: Sample Database Journal Search & List
app.get('/api/database/journals', (req, res) => {
  const query = req.query.q || req.query.search || req.query.term;
  if (query) {
    const results = DatabaseService.getSampleDatabase().searchJournals(query);
    return res.json({ query, count: results.length, journals: results });
  }
  const journals = DatabaseService.getSampleDatabase().getAllJournals();
  return res.json({ count: journals.length, journals });
});

// API Endpoint 5.3: Sample Database Journal Details with Metrics
app.get('/api/database/journals/:id', (req, res) => {
  const journal = DatabaseService.getSampleDatabase().getJournalByIdOrIssn(req.params.id);
  if (!journal) {
    return res.status(404).json({ error: 'Journal not found in sample database' });
  }
  return res.json({ journal });
});

// API Endpoint 5.4: Reset & Seed Sample Database
app.post('/api/database/seed', (req, res) => {
  try {
    const status = DatabaseService.getSampleDatabase().resetAndSeed();
    return res.json({ message: 'Sample database reset and re-seeded successfully', status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// API Endpoint 6: Verification History / Audit Log
app.get('/api/history', async (req, res) => {
  try {
    const runs = await DatabaseService.getRecentRuns(20);
    return res.json({ runs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// API Endpoint 7: Run Automated Test Suite
app.get('/api/tests/run', async (req, res) => {
  try {
    const runTests = require('./tests/run-tests');
    const results = await runTests.executeAllTests();
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`   AGENT 18 — Journal Quartile Verification Agent   `);
  console.log(`   Server running on http://localhost:${PORT}      `);
  console.log(`====================================================`);
});
