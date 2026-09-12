/**
 * Agent 18 - Conflict Detector
 * Deterministic detection of data contradictions vs explainable system differences.
 */

class ConflictDetector {
  static detectConflicts(parsedInput, identityResult, adapterResults = [], metricsMap = {}) {
    const conflicts = [];
    let status = 'NO_CONFLICT';

    // 1. Publisher Disagreement Check (e.g. Crossref Publisher vs Publisher Website vs User Input)
    const publishers = new Map();
    adapterResults.forEach(res => {
      if (res.journal && res.journal.publisher) {
        publishers.set(res.source, res.journal.publisher.toLowerCase().trim());
      }
    });

    if (publishers.size > 1) {
      const pubArray = Array.from(publishers.entries());
      const firstPub = pubArray[0][1];
      const mismatch = pubArray.find(([src, pub]) => pub !== firstPub);
      if (mismatch) {
        conflicts.push({
          conflictId: `CONF-PUB-${Date.now()}`,
          type: 'PUBLISHER_MISMATCH',
          severity: 'HIGH',
          sources: [pubArray[0][0], mismatch[0]],
          explanation: `Publisher disagreement detected: "${pubArray[0][0]}" lists "${pubArray[0][1]}" while "${mismatch[0]}" lists "${mismatch[1]}".`,
          status: 'CONFLICTING_EVIDENCE'
        });
        status = 'CONFLICTING_EVIDENCE';
      }
    }

    // 2. ISSN Disagreement Check
    if (parsedInput.issn) {
      adapterResults.forEach(res => {
        if (res.journal && res.journal.issn && res.journal.issn !== parsedInput.issn && res.journal.eissn !== parsedInput.issn) {
          conflicts.push({
            conflictId: `CONF-ISSN-${Date.now()}`,
            type: 'ISSN_DISAGREEMENT',
            severity: 'MEDIUM',
            sources: ['User Input', res.source],
            explanation: `User provided ISSN (${parsedInput.issn}) differs from ${res.source} record (${res.journal.issn}).`,
            status: 'CONFLICTING_EVIDENCE'
          });
          if (status !== 'CONFLICTING_EVIDENCE') status = 'CONFLICTING_EVIDENCE';
        }
      });
    }

    // 3. Metric System Difference Check (JCR vs CiteScore vs SJR)
    // E.g., JCR Q1 vs CiteScore Q2
    if (metricsMap.jcr && metricsMap.citescore) {
      if (metricsMap.jcr.quartile !== metricsMap.citescore.quartile) {
        conflicts.push({
          conflictId: `DIFF-METRIC-${Date.now()}`,
          type: 'METRIC_SYSTEM_DIFFERENCE',
          severity: 'INFO',
          sources: ['Clarivate JCR', 'Scopus CiteScore'],
          explanation: `Different ranking systems report different quartiles: JCR reports ${metricsMap.jcr.quartile} while Scopus CiteScore reports ${metricsMap.citescore.quartile}. This is expected because Clarivate JCR and Elsevier Scopus use different journal sets, citation windows, and category formulas.`,
          status: 'EXPLAINABLE_DIFFERENCE'
        });
        if (status === 'NO_CONFLICT') status = 'EXPLAINABLE_DIFFERENCE';
      }
    }

    // 4. Same Metric System Contradiction Check
    const scopusMetrics = adapterResults.filter(r => r.source === 'Scopus').flatMap(r => r.metrics || []);
    if (scopusMetrics.length > 1) {
      const q1 = scopusMetrics[0].quartile;
      const mismatch = scopusMetrics.find(m => m.quartile !== q1 && m.year === scopusMetrics[0].year);
      if (mismatch) {
        conflicts.push({
          conflictId: `CONF-SCOPUS-${Date.now()}`,
          type: 'SAME_METRIC_CONTRADICTION',
          severity: 'HIGH',
          sources: ['Scopus API'],
          explanation: `Contradictory quartile values found within Scopus records for the same year.`,
          status: 'CONFLICTING_EVIDENCE'
        });
        status = 'CONFLICTING_EVIDENCE';
      }
    }

    // 5. Unverified CFP Claims vs Database Reality
    (parsedInput.cfpClaims || []).forEach(cfpClaim => {
      if (cfpClaim.quartile) {
        const verifiedQ = metricsMap.citescore?.quartile || metricsMap.jcr?.quartile;
        if (verifiedQ && verifiedQ !== cfpClaim.quartile) {
          conflicts.push({
            conflictId: `CONF-CFP-${Date.now()}`,
            type: 'CFP_CLAIM_CONTRADICTION',
            severity: 'HIGH',
            sources: ['User CFP Text', 'Database API'],
            explanation: `CFP claims "${cfpClaim.claim}" (${cfpClaim.quartile}), but verified database metric reports ${verifiedQ}.`,
            status: 'CONFLICTING_EVIDENCE'
          });
          status = 'CONFLICTING_EVIDENCE';
        }
      }
    });

    // 6. Title vs Resolved Journal Title Mismatch Check
    if (parsedInput.journalName && identityResult && identityResult.journalName) {
      const IdentityResolver = require('./identityResolver');
      const sim = IdentityResolver.calculateTitleSimilarity(parsedInput.journalName, identityResult.journalName);
      if (sim < 0.5) {
        conflicts.push({
          conflictId: `CONF-TITLE-MISMATCH-${Date.now()}`,
          type: 'TITLE_ISSN_MISMATCH',
          severity: 'HIGH',
          sources: ['User Input Title', 'Database Record'],
          explanation: `Title mismatch: User searched for "${parsedInput.journalName}", but ISSN resolved to "${identityResult.journalName}".`,
          status: 'CONFLICTING_EVIDENCE'
        });
        status = 'CONFLICTING_EVIDENCE';
      }
    }

    // 7. Invalid Check Digit Check
    if (parsedInput.rawIssn && !parsedInput.issnValid) {
      conflicts.push({
        conflictId: `CONF-ISSN-CHECK-${Date.now()}`,
        type: 'INVALID_ISSN_CHECKSUM',
        severity: 'MEDIUM',
        sources: ['User Input'],
        explanation: `Provided ISSN (${parsedInput.rawIssn}) failed check-digit validation.`,
        status: 'CONFLICTING_EVIDENCE'
      });
      if (status === 'NO_CONFLICT' || status === 'INSUFFICIENT_EVIDENCE') status = 'CONFLICTING_EVIDENCE';
    }

    if (conflicts.length === 0) {
      const hasAvailable = adapterResults.some(r => r.status === 'AVAILABLE' || r.status === 'MOCK');
      if (status === 'NO_CONFLICT') {
        status = hasAvailable ? 'NO_CONFLICT' : 'INSUFFICIENT_EVIDENCE';
      }
    }

    return {
      status,
      conflicts
    };
  }
}

module.exports = ConflictDetector;
