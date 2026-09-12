/**
 * Agent 18 - Sample Database Automated Test Suite
 * Tests SQLite initialization, schema creation, sample journal queries,
 * metric matching, verification run recording, and database status reporting.
 */

const assert = require('assert');
const sampleDatabase = require('../src/db/sampleDatabase');

async function runDatabaseTests() {
  const testResults = [];

  function recordTest(name, passed, details = '') {
    testResults.push({ name, passed, details });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Database Test] ${status}: ${name} ${details ? `(${details})` : ''}`);
  }

  console.log('\n======================================================');
  console.log('  RUNNING SAMPLE DATABASE TEST SUITE (SQLite Node Native)');
  console.log('======================================================\n');

  // Test 1: SQLite Connection & Status
  try {
    const status = sampleDatabase.getDatabaseStatus();
    assert.strictEqual(status.connected, true, 'Database should be connected');
    assert.ok(status.tableCounts.journals >= 8, 'Should have at least 8 seeded journals');
    assert.ok(status.tableCounts.metrics >= 15, 'Should have seeded metrics');
    recordTest('SQLite Connection & Status Report', true, `${status.tableCounts.journals} journals, ${status.tableCounts.metrics} metrics`);
  } catch (err) {
    recordTest('SQLite Connection & Status Report', false, err.message);
  }

  // Test 2: Journal Lookup by ISSN (Nature)
  try {
    const journal = sampleDatabase.getJournalByIdOrIssn('0028-0836');
    assert.ok(journal, 'Nature record should be retrieved by print ISSN');
    assert.strictEqual(journal.journal_name, 'Nature');
    assert.ok(journal.metrics.length >= 3, 'Nature should have JCR, CiteScore, SJR metrics');
    recordTest('Journal Lookup by Print ISSN (Nature)', true, `Found ${journal.journal_name} with ${journal.metrics.length} metrics`);
  } catch (err) {
    recordTest('Journal Lookup by Print ISSN (Nature)', false, err.message);
  }

  // Test 3: Fuzzy / Search Filtering
  try {
    const results = sampleDatabase.searchJournals('Pattern Analysis');
    assert.ok(results.length > 0, 'Search for Pattern Analysis should return matches');
    assert.strictEqual(results[0].journal_name, 'IEEE Transactions on Pattern Analysis and Machine Intelligence');
    recordTest('Database Fuzzy Search & Term Filtering', true, `Matched ${results[0].journal_name}`);
  } catch (err) {
    recordTest('Database Fuzzy Search & Term Filtering', false, err.message);
  }

  // Test 4: Verification Run Recording into SQLite
  try {
    const testRecord = {
      id: `REQ-TEST-DB-${Date.now()}`,
      verified_at: new Date().toISOString(),
      journal_name: 'Nature',
      issn: '0028-0836',
      status: 'VERIFIED',
      mode: 'PARTIAL',
      risk_level: 'LOW',
      risk_score: 0,
      recommendation: 'ACCEPT',
      jcr_quartile: 'Q1',
      citescore_quartile: 'Q1',
      sjr_quartile: 'Q1'
    };

    const success = sampleDatabase.recordVerificationRun(testRecord);
    assert.strictEqual(success, true, 'Recording run in SQLite should succeed');

    const recentRuns = sampleDatabase.getRecentRuns(5);
    const found = recentRuns.find(r => r.id === testRecord.id);
    assert.ok(found, 'Recorded run should be retrievable from SQLite history');
    recordTest('SQLite Verification Run Persistence & History Query', true, `Persisted run ID ${found.id}`);
  } catch (err) {
    recordTest('SQLite Verification Run Persistence & History Query', false, err.message);
  }

  // Test 5: Re-seed Database Integrity
  try {
    const status = sampleDatabase.resetAndSeed();
    assert.strictEqual(status.connected, true);
    assert.ok(status.tableCounts.journals >= 8);
    recordTest('SQLite Database Reset & Re-Seed Integrity', true, `Re-seeded ${status.tableCounts.journals} journals`);
  } catch (err) {
    recordTest('SQLite Database Reset & Re-Seed Integrity', false, err.message);
  }

  const passedCount = testResults.filter(t => t.passed).length;
  console.log(`\n[Database Test Suite Summary]: ${passedCount} / ${testResults.length} Tests Passed.\n`);

  return {
    total: testResults.length,
    passed: passedCount,
    failed: testResults.length - passedCount,
    results: testResults
  };
}

if (require.main === module) {
  runDatabaseTests();
}

module.exports = { runDatabaseTests };
