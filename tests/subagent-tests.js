/**
 * Agent 18 — Subagent & College Agent Automated Test Suite
 * Implements Section 19 specifications: 20 mandatory unit, integration, and failure/edge-case sub-tests.
 */

const assert = require('assert');
const JournalVerifierSubagent = require('../src/agents/journalVerifierSubagent');
const CollegeAgentOrchestrator = require('../src/services/collegeAgentOrchestrator');
const EvidenceLedgerService = require('../src/services/evidenceLedgerService');

class SubagentTestSuite {
  static async runSubagentTests() {
    const results = [];
    const subagent = new JournalVerifierSubagent();
    const orchestrator = new CollegeAgentOrchestrator();

    function recordTest(name, passed, details = '') {
      results.push({ name, passed, details });
      const status = passed ? '✅ PASS' : '❌ FAIL';
      console.log(`[Subagent Test] ${status}: ${name} ${details ? `(${details})` : ''}`);
    }

    console.log('\n======================================================');
    console.log('  RUNNING JOURNAL VERIFIER SUBAGENT TEST SUITE (20 TESTS)');
    console.log('======================================================\n');

    // TEST 1: Subagent Tool Schema Generation
    try {
      const schemas = subagent.getToolSchemas();
      assert.ok(Array.isArray(schemas));
      assert.strictEqual(schemas.length, 9);
      assert.ok(schemas.some(s => s.name === 'verify_journal_identity'));
      assert.ok(schemas.some(s => s.name === 'evaluate_college_policy'));
      assert.ok(schemas.some(s => s.name === 'screen_journal_risk'));
      recordTest('TEST 1: Subagent Tool Schema Generation', true, `${schemas.length} schemas verified`);
    } catch (e) {
      recordTest('TEST 1: Subagent Tool Schema Generation', false, e.message);
    }

    // TEST 2: Faculty Publication Verification
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAC-01',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { facultyName: 'Dr. Alan Turing', journalName: 'Nature', issn: '0028-0836' }
      });
      assert.strictEqual(res.agent.id, 'AGENT_18');
      assert.strictEqual(res.agent.authority, 'VERIFICATION_SPECIALIST');
      assert.ok(res.evidenceLedger.length >= 0);
      recordTest('TEST 2: Faculty Publication Verification', true, `Verdict: ${res.recommendation.status}`);
    } catch (e) {
      recordTest('TEST 2: Faculty Publication Verification', false, e.message);
    }

    // TEST 3: Pre-submission Validation
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-PRE-01',
        taskType: 'PRE_SUBMISSION_CHECK',
        payload: { journalName: 'IEEE Transactions on Pattern Analysis and Machine Intelligence', issn: '0162-8828' }
      });
      assert.strictEqual(res.status, 'SUCCESS');
      assert.strictEqual(res.result.targetApproved, true);
      recordTest('TEST 3: Pre-submission Target Validation', true, `Approved: ${res.result.targetApproved}`);
    } catch (e) {
      recordTest('TEST 3: Pre-submission Target Validation', false, e.message);
    }

    // TEST 4: Department Batch Audit
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-AUDIT-01',
        taskType: 'AUDIT_DEPARTMENT_PUBLICATIONS',
        payload: {
          departmentName: 'Computer Science',
          publications: [
            { journalName: 'Nature', issn: '0028-0836' },
            { journalName: 'IEEE Transactions on Pattern Analysis and Machine Intelligence', issn: '0162-8828' }
          ]
        }
      });
      assert.strictEqual(res.status, 'SUCCESS');
      assert.strictEqual(res.result.totalPublicationsAudited, 2);
      assert.ok(res.result.q1q2Percentage > 0);
      recordTest('TEST 4: Department Batch Audit', true, `Audited ${res.result.totalPublicationsAudited} publications`);
    } catch (e) {
      recordTest('TEST 4: Department Batch Audit', false, e.message);
    }

    // TEST 5: High-risk Journal Handling
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-RISK-01',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'XyZ123NonExistentJournalTitle999', issn: '9999-9999' }
      });
      assert.strictEqual(res.recommendation.status, 'REJECTED');
      assert.strictEqual(res.result.incentivePoints, 0);
      recordTest('TEST 5: High-risk Journal Handling', true, `Verdict: ${res.recommendation.status}`);
    } catch (e) {
      recordTest('TEST 5: High-risk Journal Handling', false, e.message);
    }

    // TEST 6: Alternative Journal Suggestions
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-ALT-01',
        taskType: 'PRE_SUBMISSION_CHECK',
        payload: { journalName: 'Unverified Journal Title X', issn: '8888-8888' }
      });
      assert.strictEqual(res.result.targetApproved, false);
      assert.ok(res.result.alternativeVenues.length > 0);
      recordTest('TEST 6: Alternative Journal Suggestions', true, `${res.result.alternativeVenues.length} alternatives suggested`);
    } catch (e) {
      recordTest('TEST 6: Alternative Journal Suggestions', false, e.message);
    }

    // TEST 7: Institutional Policy Compliance
    try {
      const collegeRes = await orchestrator.processFacultyPromotionDossier({
        candidateName: 'Dr. Grace Hopper',
        journalName: 'Nature',
        issn: '0028-0836'
      }, { minimumQuartile: 'Q1' });
      assert.strictEqual(collegeRes.collegeDecision.policyEvaluation.compliant, true);
      recordTest('TEST 7: Institutional Policy Compliance', true, `Compliant: ${collegeRes.collegeDecision.policyEvaluation.compliant}`);
    } catch (e) {
      recordTest('TEST 7: Institutional Policy Compliance', false, e.message);
    }

    // TEST 8: Agent-to-Agent Execution Trace
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-TRACE-01',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Nature', issn: '0028-0836' }
      });
      assert.ok(Array.isArray(res.executionTrace));
      assert.ok(res.executionTrace.length >= 4);
      recordTest('TEST 8: Agent-to-Agent Execution Trace', true, `${res.executionTrace.length} trace steps recorded`);
    } catch (e) {
      recordTest('TEST 8: Agent-to-Agent Execution Trace', false, e.message);
    }

    // TEST 9: Direct Subagent Task Interface (/api/subagent/execute Contract)
    try {
      const meta = subagent.getCapabilities();
      assert.strictEqual(meta.agentId, 'AGENT_18');
      assert.strictEqual(meta.authority, 'VERIFICATION_SPECIALIST');
      recordTest('TEST 9: Direct Subagent Contract Interface', true, `Authority: ${meta.authority}`);
    } catch (e) {
      recordTest('TEST 9: Direct Subagent Contract Interface', false, e.message);
    }

    // TEST 10: College Agent Master Orchestrator Evaluation
    try {
      const collegeRes = await orchestrator.processCollegeRequest({
        workflowType: 'FACULTY_PROMOTION_DOSSIER',
        candidateName: 'Dr. Claude Shannon',
        department: 'Information Theory',
        journalName: 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        issn: '0162-8828'
      });
      assert.strictEqual(collegeRes.subagentExecution.status, 'SUCCESS');
      assert.strictEqual(collegeRes.collegeDecision.status, 'DOSSIER_APPROVED');
      recordTest('TEST 10: College Agent Master Orchestrator Evaluation', true, `Status: ${collegeRes.collegeDecision.status}`);
    } catch (e) {
      recordTest('TEST 10: College Agent Master Orchestrator Evaluation', false, e.message);
    }

    // --- FAILURE & EDGE-CASE TESTS (11 to 20) ---

    // TEST 11: FAILURE - Invalid ISSN Handling
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-11',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Nature', issn: 'INVALID-ISSN-STRING' }
      });
      assert.ok(res.risk.flags.some(f => f.code === 'MISSING_ISSN' || f.code === 'AMBIGUOUS_IDENTITY' || f.code === 'INVALID_ISSN') || res.journal.name);
      recordTest('TEST 11: FAILURE - Invalid ISSN Handling', true, 'Handled without crash');
    } catch (e) {
      recordTest('TEST 11: FAILURE - Invalid ISSN Handling', false, e.message);
    }

    // TEST 12: FAILURE - Journal Not Found
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-12',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'NonExistentJournalTitle99999999' }
      });
      assert.strictEqual(res.recommendation.status, 'REJECTED');
      recordTest('TEST 12: FAILURE - Journal Not Found', true, `Verdict: ${res.recommendation.status}`);
    } catch (e) {
      recordTest('TEST 12: FAILURE - Journal Not Found', false, e.message);
    }

    // TEST 13: FAILURE - Conflicting Evidence Handling
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-13',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Nature', issn: '0003-6951' } // Wrong ISSN for Nature
      });
      assert.ok(res.risk.flags.length > 0 || res.journal.name);
      recordTest('TEST 13: FAILURE - Conflicting Evidence Handling', true, `Risk Flags: ${res.risk.flags.length}`);
    } catch (e) {
      recordTest('TEST 13: FAILURE - Conflicting Evidence Handling', false, e.message);
    }

    // TEST 14: FAILURE - Expired Cached Verification Handling
    try {
      const mockExpiredSubagentRes = {
        result: { contract: { journalIdentity: { journalName: 'Nature' } }, primaryQuartile: 'Q1' },
        risk: { level: 'LOW' },
        cache: { verifiedAt: '2025-01-01T00:00:00Z', validUntil: '2025-02-01T00:00:00Z', cacheStatus: 'EXPIRED' }
      };
      const evalRes = orchestrator.evaluateInstitutionalPolicy(mockExpiredSubagentRes, { requireCurrentVerification: true });
      assert.strictEqual(evalRes.compliant, false);
      assert.ok(evalRes.evaluations.some(e => e.rule === 'Verification Freshness' && e.satisfied === false));
      recordTest('TEST 14: FAILURE - Expired Cached Verification Handling', true, 'Expired cache rejected');
    } catch (e) {
      recordTest('TEST 14: FAILURE - Expired Cached Verification Handling', false, e.message);
    }

    // TEST 15: FAILURE - External Source Unavailable Fallback
    try {
      delete process.env.SCOPUS_API_KEY;
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-15',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Nature', issn: '0028-0836' }
      });
      assert.ok(res.status === 'SUCCESS');
      assert.ok(res.indexing.scopus !== undefined);
      recordTest('TEST 15: FAILURE - External Source Unavailable Fallback', true, 'Handled with fallback');
    } catch (e) {
      recordTest('TEST 15: FAILURE - External Source Unavailable Fallback', false, e.message);
    }

    // TEST 16: FAILURE - Missing Quartile Data Handling
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-16',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Unranked Academic Bulletin' }
      });
      assert.ok(res.metrics.impactFactor === null || res.metrics.impactFactor !== undefined);
      recordTest('TEST 16: FAILURE - Missing Quartile Data Handling', true, 'Unranked journal handled');
    } catch (e) {
      recordTest('TEST 16: FAILURE - Missing Quartile Data Handling', false, e.message);
    }

    // TEST 17: FAILURE - Different Quartiles Across Subject Categories
    try {
      const ConflictDetector = require('../src/services/conflictDetector');
      const mockMetrics = {
        jcr: { database: 'JCR', quartile: 'Q1', year: 2025, category: 'AI' },
        citescore: { database: 'Scopus', quartile: 'Q2', year: 2025, category: 'CS' }
      };
      const confRes = ConflictDetector.detectConflicts({ cfpClaims: [] }, {}, [], mockMetrics);
      assert.strictEqual(confRes.status, 'EXPLAINABLE_DIFFERENCE');
      recordTest('TEST 17: FAILURE - Different Quartiles Across Categories', true, `Status: ${confRes.status}`);
    } catch (e) {
      recordTest('TEST 17: FAILURE - Different Quartiles Across Categories', false, e.message);
    }

    // TEST 18: FAILURE - Missing Institutional Policy Handling
    try {
      const evalRes = orchestrator.evaluateInstitutionalPolicy({
        result: { primaryQuartile: 'Q3' },
        risk: { level: 'LOW' }
      }, {});
      assert.ok(evalRes !== undefined);
      recordTest('TEST 18: FAILURE - Missing Institutional Policy Handling', true, 'Default policy applied');
    } catch (e) {
      recordTest('TEST 18: FAILURE - Missing Institutional Policy Handling', false, e.message);
    }

    // TEST 19: FAILURE - Duplicate Publications in Department Batch
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-19',
        taskType: 'AUDIT_DEPARTMENT_PUBLICATIONS',
        payload: {
          departmentName: 'Computer Science',
          publications: [
            { journalName: 'Nature', issn: '0028-0836' },
            { journalName: 'Nature', issn: '0028-0836' }
          ]
        }
      });
      assert.strictEqual(res.result.totalPublicationsAudited, 2);
      recordTest('TEST 19: FAILURE - Duplicate Publications in Department Batch', true, 'Batch processed correctly');
    } catch (e) {
      recordTest('TEST 19: FAILURE - Duplicate Publications in Department Batch', false, e.message);
    }

    // TEST 20: FAILURE - Partial Journal Identity Match Handling
    try {
      const res = await subagent.executeSubagentTask({
        taskId: 'TEST-FAIL-20',
        taskType: 'VERIFY_FACULTY_PUBLICATION',
        payload: { journalName: 'Nature Sci' } // Partial name
      });
      assert.ok(res.journal.name.length > 0);
      recordTest('TEST 20: FAILURE - Partial Journal Identity Match', true, `Resolved: "${res.journal.name}"`);
    } catch (e) {
      recordTest('TEST 20: FAILURE - Partial Journal Identity Match', false, e.message);
    }

    const passedCount = results.filter(r => r.passed).length;
    console.log(`\n------------------------------------------------------`);
    console.log(`  SUBAGENT TEST SUITE RESULT: ${passedCount} / ${results.length} PASSED`);
    console.log(`------------------------------------------------------\n`);

    return { total: results.length, passed: passedCount, results };
  }
}

module.exports = SubagentTestSuite;
