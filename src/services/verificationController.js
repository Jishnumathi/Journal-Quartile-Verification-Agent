/**
 * Agent 18 - Verification Controller (Master Enterprise Production Implementation)
 * Orchestrates identity resolution, adapter queries (Crossref, OpenAlex, Scopus, Clarivate, JCR, SJR, Publisher),
 * evidence collection, vector indexing, predatory pattern retrieval, grounded explanation generation,
 * conflict analysis, 14-signal risk scoring, alternative journal recommendations, institutional policy checks,
 * cache TTL freshness evaluation, final verdict decisioning, and report rendering.
 */

const InputParser = require('./inputParser');
const IdentityResolver = require('./identityResolver');
const EvidenceEngine = require('./evidenceEngine');
const QuartileEngine = require('./quartileEngine');
const ConflictDetector = require('./conflictDetector');
const FreshnessEngine = require('./freshnessEngine');
const RiskEngine = require('./riskEngine');
const PolicyEvaluator = require('./policyEvaluator');
const ReportGenerator = require('./reportGenerator');

// Enterprise & RAG Services
const embeddingEngine = require('./embeddingEngine');
const vectorStore = require('./vectorStore');
const retrievalIndexer = require('./retrievalIndexer');
const predatoryPatternRetriever = require('./predatoryPatternRetriever');
const groundedExplanationGenerator = require('./groundedExplanationGenerator');
const alternativeJournalEngine = require('./alternativeJournalEngine');
const institutionalPolicyManager = require('./institutionalPolicyManager');
const ragSecurity = require('./ragSecurity');

// Adapters
const CrossrefAdapter = require('../adapters/crossrefAdapter');
const OpenAlexAdapter = require('../adapters/openAlexAdapter');
const ScopusAdapter = require('../adapters/scopusAdapter');
const ClarivateAdapter = require('../adapters/clarivateAdapter');
const JCRAdapter = require('../adapters/jcrAdapter');
const SJRAdapter = require('../adapters/sjrAdapter');
const PublisherAdapter = require('../adapters/publisherAdapter');
const DatabaseAdapter = require('../adapters/databaseAdapter');

class VerificationController {
  constructor() {
    this.crossref = new CrossrefAdapter();
    this.openAlex = new OpenAlexAdapter();
    this.scopus = new ScopusAdapter();
    this.clarivate = new ClarivateAdapter();
    this.jcr = new JCRAdapter();
    this.sjr = new SJRAdapter();
    this.publisher = new PublisherAdapter();
    this.database = new DatabaseAdapter();
  }

  async verify(rawInput) {
    const requestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const verifiedAt = new Date().toISOString();
    const limitations = [];

    // Step 1: Parse & Validate Input
    const parsedInput = InputParser.parseInput(rawInput);

    // Step 2: Query Source Adapters in Parallel
    const adapterPromises = [
      this.crossref.fetchJournal(parsedInput),
      this.openAlex.fetchJournal(parsedInput),
      this.scopus.fetchJournal(parsedInput),
      this.clarivate.fetchJournal(parsedInput),
      this.jcr.fetchJournal(parsedInput),
      this.sjr.fetchJournal(parsedInput),
      this.publisher.fetchJournal(parsedInput),
      this.database.fetchJournal(parsedInput)
    ];

    const adapterResults = await Promise.all(adapterPromises);

    // Track limitations from unconfigured credentials or failed APIs
    adapterResults.forEach(r => {
      if (r.status === 'UNAVAILABLE') {
        limitations.push(`${r.source} verification unavailable: ${r.errors.join('; ') || 'Authorized API credentials not configured.'}`);
      } else if (r.status === 'ERROR') {
        limitations.push(`${r.source} lookup encountered an error: ${r.errors.join('; ')}`);
      }
    });

    // Step 3 (RAG Extension): Query Cross-Run Vector Journal Cache
    let cacheCandidates = [];
    if (parsedInput.journalName || parsedInput.issn) {
      try {
        const queryText = `Journal identity lookup: ${parsedInput.journalName || ''} ${parsedInput.issn || ''}`.trim();
        const { vector: queryVector } = await embeddingEngine.embed(queryText);
        cacheCandidates = await vectorStore.queryJournalCache({ queryVector, topK: 3 });
      } catch (err) {
        console.warn('[RAG Vector Cache Lookup Warning]:', err.message);
      }
    }

    // Step 4: Journal Identity Resolution (accepts candidate suggestions from vector cache)
    const journalIdentity = IdentityResolver.resolve(parsedInput, adapterResults, cacheCandidates);

    // Step 5: Process Evidence Ledger
    const evidenceLedger = EvidenceEngine.processEvidence(adapterResults, parsedInput.cfpClaims);

    // Step 6 (RAG Extension): Index Evidence & Adapter Output Chunks into Vector Store
    let indexedChunks = [];
    try {
      indexedChunks = await retrievalIndexer.indexRunData(journalIdentity, adapterResults, evidenceLedger, parsedInput.cfpClaims);
    } catch (err) {
      console.warn('[RAG Retrieval Indexer Warning]:', err.message);
    }

    // Step 7 (RAG Extension): Predatory Pattern Reference Retrieval (DISCOVERY Strength)
    let predatoryMatches = [];
    if (rawInput.cfpText || parsedInput.cfpClaims.length > 0) {
      try {
        const textToAnalyze = `${rawInput.cfpText || ''} ${(parsedInput.cfpClaims || []).map(c => c.claim).join(' ')}`;
        predatoryMatches = await predatoryPatternRetriever.matchPatterns(textToAnalyze);
      } catch (err) {
        console.warn('[RAG Predatory Pattern Retriever Warning]:', err.message);
      }
    }

    // Step 8: Process Quartiles & Metrics (Supports Multi-Category Quartiles)
    const metricsMap = QuartileEngine.processMetrics(adapterResults);

    // Step 9: Detect Conflicts
    const conflictResult = ConflictDetector.detectConflicts(parsedInput, journalIdentity, adapterResults, metricsMap);

    // Step 10: Freshness Evaluation (Source-specific TTLs & valid_until)
    const freshness = FreshnessEngine.evaluateFreshness(metricsMap, adapterResults);

    // Step 11: Risk Assessment (Evaluates all 14 enterprise signals)
    const risk = RiskEngine.evaluateRisk(parsedInput, journalIdentity, conflictResult, adapterResults, evidenceLedger, predatoryMatches);

    // Step 12: Institutional Policy Evaluation (Distinguishes INDEXED from INSTITUTIONALLY_ACCEPTED)
    const indexing = {
      scopus: adapterResults.find(r => r.source === 'Scopus')?.indexing || { activeCoverage: false },
      webOfScience: adapterResults.find(r => r.source === 'Clarivate WoS' || r.source === 'Web of Science')?.indexing || { activeCoverage: false },
      other: adapterResults.find(r => r.source === 'OpenAlex')?.indexing || {}
    };

    const policyEvaluation = institutionalPolicyManager.evaluateCompliance(parsedInput.institutionalPolicy, indexing, metricsMap, journalIdentity);

    // Step 13 (RAG Extension): Grounded Explanation Generation
    let groundedExplanations = { hasGroundedExplanations: false, explanations: [] };
    try {
      groundedExplanations = await groundedExplanationGenerator.generateGroundedExplanations(journalIdentity, conflictResult, risk, evidenceLedger);
    } catch (err) {
      console.warn('[RAG Grounded Explanation Generator Warning]:', err.message);
    }

    // Step 14: Determine Final Verdict & Recommendation
    let status = 'NOT_VERIFIED';
    let recommendation = 'DO_NOT_RELY_ON_CURRENT_EVIDENCE';

    if (journalIdentity.identityStatus === 'AMBIGUOUS') {
      status = 'AMBIGUOUS';
      recommendation = 'FURTHER_VERIFICATION_REQUIRED';
    } else if (conflictResult.status === 'CONFLICTING_EVIDENCE') {
      status = 'CONFLICTING';
      recommendation = 'DO_NOT_RELY_ON_CURRENT_EVIDENCE';
    } else {
      const hasAuthoritativeVerified = evidenceLedger.some(e => e.authority.level <= 2 && e.status === 'VERIFIED');
      const hasMetadataVerified = evidenceLedger.some(e => e.authority.level <= 5 && e.status === 'VERIFIED');

      if (hasAuthoritativeVerified && journalIdentity.identityStatus === 'VERIFIED') {
        status = 'VERIFIED';
        recommendation = risk.riskLevel === 'LOW' ? 'ACCEPT' : 'ACCEPT_WITH_CAUTION';
      } else if (hasMetadataVerified || journalIdentity.identityStatus === 'VERIFIED' || journalIdentity.identityStatus === 'PARTIALLY_VERIFIED') {
        status = 'PARTIALLY_VERIFIED';
        recommendation = 'ACCEPT_WITH_CAUTION';
      } else {
        const unavailableCount = adapterResults.filter(r => r.status === 'UNAVAILABLE').length;
        if (unavailableCount >= 3 && !hasMetadataVerified) {
          status = 'UNAVAILABLE';
          recommendation = 'FURTHER_VERIFICATION_REQUIRED';
        } else {
          status = 'NOT_VERIFIED';
          recommendation = 'FURTHER_VERIFICATION_REQUIRED';
        }
      }
    }

    // Step 15: Alternative Journal Recommendations (triggers when problematic/unverified or requested)
    const alternatives = alternativeJournalEngine.generateAlternatives(parsedInput, metricsMap, risk, status);

    // Extract publisher acceptance rate
    const publisherAdapterRes = adapterResults.find(r => r.sourceType === 'PUBLISHER');
    const acceptanceRate = publisherAdapterRes?.journal?.acceptanceRate || 'Not publicly available';

    // Standardized Final JSON Contract (Section 30 + RAG + Alternatives Schema)
    const jsonContract = {
      agent: '18',
      requestId,
      verifiedAt,
      validUntil: freshness.validUntil,
      status,
      mode: parsedInput.mode,
      journalIdentity: {
        ...journalIdentity,
        acceptanceRate
      },
      indexing,
      metrics: {
        jcr: metricsMap.jcr || null,
        jcrCategories: metricsMap.jcrCategories,
        citescore: metricsMap.citescore || null,
        citescoreCategories: metricsMap.citescoreCategories,
        sjr: metricsMap.sjr || null,
        sjrCategories: metricsMap.sjrCategories,
        all: metricsMap.all
      },
      publisher: {
        publisherName: journalIdentity.publisher,
        officialUrl: journalIdentity.officialUrl,
        acceptanceRate,
        publisherClaimsCount: publisherAdapterRes?.evidence.length || 0
      },
      evidence: evidenceLedger,
      conflicts: conflictResult.conflicts,
      freshness,
      risk,
      policyEvaluation,
      recommendation,
      alternatives,
      limitations,
      rag: {
        active: true,
        embeddingProvider: embeddingEngine.getMode(),
        vectorStoreMode: vectorStore.getMode(),
        indexedChunksCount: indexedChunks.length,
        cacheCandidatesCount: cacheCandidates.length,
        predatoryMatchesCount: predatoryMatches.length,
        groundedExplanations
      }
    };

    // Step 16: Generate Markdown Report
    const markdownReport = ReportGenerator.generateReport(jsonContract);

    return {
      jsonContract,
      markdownReport
    };
  }
}

module.exports = VerificationController;
