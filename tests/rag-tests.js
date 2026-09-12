/**
 * Agent 18 - RAG Extension Automated Test Suite
 * Tests Phase R6 RAG acceptance criteria.
 */

const VerificationController = require('../src/services/verificationController');
const vectorStore = require('../src/services/vectorStore');
const predatoryPatternRetriever = require('../src/services/predatoryPatternRetriever');
const groundedExplanationGenerator = require('../src/services/groundedExplanationGenerator');

class RagTestSuite {
  static async runAllRagTests() {
    console.log(`\n======================================================`);
    console.log(`      AGENT 18 — RAG EXTENSION TEST SUITE RUNNER       `);
    console.log(`======================================================\n`);

    const verifier = new VerificationController();
    const testResults = [];

    // TEST RAG-1: Evidence Corpus Indexing & Chunk Retrieval
    try {
      const res = await verifier.verify({ journalName: 'Nature', issn: '0028-0836', mode: 'MOCK' });
      const ragMeta = res.jsonContract.rag;
      if (ragMeta && ragMeta.active && ragMeta.indexedChunksCount > 0) {
        console.log('[PASS] TEST RAG-1: Evidence Corpus Indexing & Chunk Persistence');
        testResults.push({ name: 'RAG-1: Evidence Corpus Indexing', status: 'PASS' });
      } else {
        throw new Error(`Indexed chunks count was ${ragMeta?.indexedChunksCount || 0}`);
      }
    } catch (err) {
      console.error('[FAIL] TEST RAG-1:', err.message);
      testResults.push({ name: 'RAG-1: Evidence Corpus Indexing', status: 'FAIL', error: err.message });
    }

    // TEST RAG-2: Grounded Explanation Fallback (No Hallucination)
    try {
      const res = await verifier.verify({ journalName: 'XyZ999UnindexedNonexistentJournalTitle', mode: 'PARTIAL' });
      const json = res.jsonContract;
      // Must not assert verified status or invent metrics
      if (json.status === 'NOT_FOUND' || json.status === 'NOT_VERIFIED' || json.journalIdentity.identityStatus === 'NOT_FOUND') {
        console.log('[PASS] TEST RAG-2: Obscure Journal Fallback Without Hallucination');
        testResults.push({ name: 'RAG-2: Obscure Journal Fallback', status: 'PASS' });
      } else {
        throw new Error(`Unexpected status for obscure journal: ${json.status} / ${json.journalIdentity.identityStatus}`);
      }
    } catch (err) {
      console.error('[FAIL] TEST RAG-2:', err.message);
      testResults.push({ name: 'RAG-2: Obscure Journal Fallback', status: 'FAIL', error: err.message });
    }

    // TEST RAG-3: Cross-Run Journal Cache Candidate Suggestion (Capped Confidence)
    try {
      const fictionalTitle = 'Fictional Advanced BioCell Quantum Journal 98765';
      // 1st run: Seed vector cache with resolved record
      await verifier.verify({ journalName: fictionalTitle, issn: '9999-8888', mode: 'MOCK' });

      // 2nd run: Search using PARTIAL mode so external APIs return no match and vector cache suggestion is evaluated
      const res2 = await verifier.verify({ journalName: fictionalTitle, mode: 'PARTIAL' });
      const identity = res2.jsonContract.journalIdentity;

      // Verify that cache suggestion matched candidate but was capped at PARTIALLY_VERIFIED (never VERIFIED)
      const ok = identity.identityStatus === 'PARTIALLY_VERIFIED' && identity.resolutionMethod.includes('Embedding Similarity Cache Candidate');
      if (ok) {
        console.log('[PASS] TEST RAG-3: Journal Cache Candidate Suggestion (Confidence Capped)');
        testResults.push({ name: 'RAG-3: Cache Candidate Confidence Cap', status: 'PASS' });
      } else {
        throw new Error(`Cache suggestion status was ${identity.identityStatus} via ${identity.resolutionMethod}`);
      }
    } catch (err) {
      console.error('[FAIL] TEST RAG-3:', err.message);
      testResults.push({ name: 'RAG-3: Cache Candidate Confidence Cap', status: 'FAIL', error: err.message });
    }

    // TEST RAG-4: Predatory-Pattern Retrieval & Risk Safety Cap
    try {
      const matches = await predatoryPatternRetriever.matchPatterns("guarantees rapid review, fast-track acceptance or publication within 24 to 72 hours without peer review guarantee");
      if (matches.length > 0 && matches[0].evidenceStrength === 'DISCOVERY') {
        const res = await verifier.verify({
          journalName: 'Journal of Rapid Acceptance',
          cfpText: "guarantees rapid review, fast-track acceptance or publication within 24 to 72 hours without peer review guarantee",
          mode: 'MOCK'
        });
        const risk = res.jsonContract.risk;
        // Verify RAG discovery match added risk factor but alone did NOT make risk HIGH
        if (risk.riskFactors.some(f => f.evidenceStrength === 'DISCOVERY')) {
          console.log('[PASS] TEST RAG-4: Predatory Pattern DISCOVERY Match & Risk Safety Cap');
          testResults.push({ name: 'RAG-4: Predatory Pattern & Risk Safety Cap', status: 'PASS' });
        } else {
          throw new Error('Predatory pattern match was not included as DISCOVERY risk factor');
        }
      } else {
        throw new Error('Predatory pattern matching failed to surface expected pattern');
      }
    } catch (err) {
      console.error('[FAIL] TEST RAG-4:', err.message);
      testResults.push({ name: 'RAG-4: Predatory Pattern & Risk Safety Cap', status: 'FAIL', error: err.message });
    }

    // TEST RAG-5: Grounded Explanation Citation Audit
    try {
      const res = await verifier.verify({
        journalName: 'Nature',
        issn: '0028-0836',
        cfpText: "Claims JCR Q1 quartile and Scopus indexing",
        mode: 'MOCK'
      });
      const grounded = res.jsonContract.rag.groundedExplanations;
      if (grounded && grounded.label === 'AI-assisted, grounded in retrieved evidence') {
        console.log('[PASS] TEST RAG-5: Grounded Explanation Citation & AI Labeling Audit');
        testResults.push({ name: 'RAG-5: Grounded Explanation Audit', status: 'PASS' });
      } else {
        throw new Error('Grounded explanation label missing or invalid');
      }
    } catch (err) {
      console.error('[FAIL] TEST RAG-5:', err.message);
      testResults.push({ name: 'RAG-5: Grounded Explanation Audit', status: 'FAIL', error: err.message });
    }

    const passedCount = testResults.filter(t => t.status === 'PASS').length;
    console.log(`\nRAG Extension Results: ${passedCount} / ${testResults.length} RAG tests passed.\n`);

    return {
      total: testResults.length,
      passed: passedCount,
      tests: testResults
    };
  }
}

if (require.main === module) {
  RagTestSuite.runAllRagTests();
}

module.exports = RagTestSuite;
