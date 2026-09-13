/**
 * Agent 18 - Master Automated Test Runner (Executing all 40 mandated tests)
 */

const VerificationController = require('../src/services/verificationController');
const RagTestSuite = require('./rag-tests');
const ExpandedTestSuite = require('./expanded-tests');
const DatabaseTestSuite = require('./database-tests');
const SubagentTestSuite = require('./subagent-tests');

class TestRunner {
  static async executeAllTests() {
    const verifier = new VerificationController();
    const results = [];
    let passed = 0;

    console.log('\n======================================================');
    console.log('   AGENT 18 — MASTER AUTOMATED TEST RUNNER           ');
    console.log('======================================================\n');

    // TEST 1: Valid ISSN (Nature: 0028-0836)
    try {
      const res = await verifier.verify({ issn: '0028-0836', mode: 'PARTIAL' });
      const ok = res.jsonContract.journalIdentity.identityStatus === 'VERIFIED' || res.jsonContract.journalIdentity.identityStatus === 'PARTIALLY_VERIFIED';
      results.push({ test: 'TEST 1: Valid ISSN (Nature)', pass: ok, status: res.jsonContract.status });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 1: Valid ISSN', pass: false, error: e.message });
    }

    // TEST 2: Valid eISSN (Nature Online: 1476-4687)
    try {
      const res = await verifier.verify({ eissn: '1476-4687', mode: 'PARTIAL' });
      const ok = res.jsonContract.journalIdentity.identityStatus === 'VERIFIED' || res.jsonContract.journalIdentity.identityStatus === 'PARTIALLY_VERIFIED';
      results.push({ test: 'TEST 2: Valid eISSN (Nature)', pass: ok, status: res.jsonContract.status });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 2: Valid eISSN', pass: false, error: e.message });
    }

    // TEST 3: Valid Journal Name
    try {
      const res = await verifier.verify({ journalName: 'Nature', mode: 'PARTIAL' });
      const ok = res.jsonContract.journalIdentity.journalName.toLowerCase().includes('nature');
      results.push({ test: 'TEST 3: Valid Journal Name', pass: ok, title: res.jsonContract.journalIdentity.journalName });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 3: Valid Journal Name', pass: false, error: e.message });
    }

    // TEST 4: Wrong ISSN + Valid Title (Conflict Test)
    try {
      const res = await verifier.verify({ journalName: 'Nature', issn: '0003-6951', mode: 'PARTIAL' });
      const ok = res.jsonContract.status === 'CONFLICTING' || res.jsonContract.status === 'AMBIGUOUS' || res.jsonContract.risk.riskLevel === 'HIGH' || res.jsonContract.conflicts.length > 0 || res.jsonContract.journalIdentity.notes.some(n => n.includes('differs'));
      results.push({ test: 'TEST 4: Wrong ISSN + Valid Title', pass: ok, status: res.jsonContract.status });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 4: Wrong ISSN + Valid Title', pass: false, error: e.message });
    }

    // TEST 5: CFP Text Claim Extraction ("Scopus Q1")
    try {
      const res = await verifier.verify({ cfp: 'Submit your manuscript to our Scopus Q1 journal with JCR Q1 Impact Factor.', mode: 'PARTIAL' });
      const claimsExtracted = res.jsonContract.evidence.some(e => e.source === 'User CFP Text');
      results.push({ test: 'TEST 5: CFP Claim Extraction', pass: claimsExtracted, claimsCount: res.jsonContract.evidence.length });
      if (claimsExtracted) passed++;
    } catch (e) {
      results.push({ test: 'TEST 5: CFP Claim Extraction', pass: false, error: e.message });
    }

    // TEST 6: Scopus Unavailable Fallback
    try {
      delete process.env.SCOPUS_API_KEY;
      const res = await verifier.verify({ issn: '0028-0836', mode: 'PARTIAL' });
      const scopusStatus = res.jsonContract.evidence.find(e => e.source === 'Scopus')?.status;
      const ok = scopusStatus === 'UNAVAILABLE' && res.jsonContract.status !== 'ERROR';
      results.push({ test: 'TEST 6: Scopus Unavailable Fallback', pass: ok, scopusStatus });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 6: Scopus Unavailable Fallback', pass: false, error: e.message });
    }

    // TEST 7: JCR Q1 + CiteScore Q2 Explainable Difference
    try {
      const ConflictDetector = require('../src/services/conflictDetector');
      const mockMetrics = {
        jcr: { database: 'JCR', quartile: 'Q1', year: 2025, category: 'AI' },
        citescore: { database: 'Scopus', quartile: 'Q2', year: 2025, category: 'CS' }
      };
      const confRes = ConflictDetector.detectConflicts({ cfpClaims: [] }, {}, [], mockMetrics);
      const ok = confRes.status === 'EXPLAINABLE_DIFFERENCE' && confRes.conflicts.some(c => c.type === 'METRIC_SYSTEM_DIFFERENCE');
      results.push({ test: 'TEST 7: JCR Q1 vs CiteScore Q2 Explainable Difference', pass: ok, status: confRes.status });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 7: JCR Q1 vs CiteScore Q2 Explainable Difference', pass: false, error: e.message });
    }

    // TEST 8: Journal Not Found
    try {
      const res = await verifier.verify({ journalName: 'XyZ123NonExistentJournalTitle999', mode: 'PARTIAL' });
      const ok = res.jsonContract.status === 'NOT_VERIFIED' || res.jsonContract.journalIdentity.identityStatus === 'NOT_FOUND';
      results.push({ test: 'TEST 8: Journal Not Found', pass: ok, status: res.jsonContract.status });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 8: Journal Not Found', pass: false, error: e.message });
    }

    // TEST 9: Two Journals with Similar Titles (Ambiguous Identity)
    try {
      const IdentityResolver = require('../src/services/identityResolver');
      const mockAdapters = [
        { status: 'AVAILABLE', source: 'Crossref', journal: { title: 'Journal of Clinical Oncology' } },
        { status: 'AVAILABLE', source: 'OpenAlex', journal: { title: 'Journal of Surgical Oncology' } }
      ];
      const identity = IdentityResolver.resolve({ journalName: 'Journal of Oncology' }, mockAdapters);
      const ok = identity.identityConfidence < 60 || identity.identityStatus === 'AMBIGUOUS' || identity.identityStatus === 'PARTIALLY_VERIFIED';
      results.push({ test: 'TEST 9: Similar Titles Ambiguity', pass: ok, status: identity.identityStatus });
      if (ok) passed++;
    } catch (e) {
      results.push({ test: 'TEST 9: Similar Titles Ambiguity', pass: false, error: e.message });
    }

    // TEST 10: Mock Mode Labeling
    try {
      const res = await verifier.verify({ journalName: 'IEEE TPAMI', mode: 'MOCK' });
      const mockLabeled = res.jsonContract.mode === 'MOCK' && res.markdownReport.includes('MOCK DATA NOTICE');
      results.push({ test: 'TEST 10: Mock Mode Labeling', pass: mockLabeled, mode: res.jsonContract.mode });
      if (mockLabeled) passed++;
    } catch (e) {
      results.push({ test: 'TEST 10: Mock Mode Labeling', pass: false, error: e.message });
    }

    console.log(`Core Engine Results: ${passed} / 10 tests passed.\n`);

    // Run RAG Suite (5 Tests)
    const ragResults = await RagTestSuite.runAllRagTests();

    // Run Sample Database Suite (5 Tests)
    const dbResults = await DatabaseTestSuite.runDatabaseTests();

    // Run Expanded Suite (30 Tests)
    const expandedResults = await ExpandedTestSuite.runExpandedTests();

    // Run Subagent & Orchestrator Suite (20 Tests)
    const subagentResults = await SubagentTestSuite.runSubagentTests();

    const totalPassed = passed + ragResults.passed + dbResults.passed + expandedResults.passed + subagentResults.passed;
    const totalCount = 10 + ragResults.total + dbResults.total + expandedResults.total + subagentResults.total;

    console.log(`======================================================`);
    console.log(`  FINAL MASTER RESULTS: ${totalPassed} / ${totalCount} TESTS PASSED`);
    console.log(`======================================================\n`);

    return {
      passed: totalPassed,
      total: totalCount,
      failed: totalCount - totalPassed,
      core: { passed, total: 10, results },
      rag: ragResults,
      database: dbResults,
      expanded: expandedResults,
      subagent: subagentResults
    };
  }
}

if (require.main === module) {
  TestRunner.executeAllTests();
}

module.exports = TestRunner;
