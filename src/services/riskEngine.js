/**
 * Agent 18 - Risk Assessment Engine (Expanded 14 Enterprise Signals)
 * Transparent, rule-based risk scoring system.
 * CRITICAL RULE: Never label a journal predatory solely because an API connection is unavailable.
 */

class RiskEngine {
  static evaluateRisk(parsedInput, identityResult, conflictResult, adapterResults = [], evidenceLedger = [], predatoryPatternMatches = []) {
    const riskFactors = [];
    let ruleScore = 0;
    let discoveryScore = 0;

    // Signal 1: Missing ISSN
    if (!parsedInput.issn && !parsedInput.eissn) {
      ruleScore += 25;
      riskFactors.push({
        code: 'MISSING_ISSN',
        severity: 'HIGH',
        description: 'No valid ISSN or eISSN provided or identified. Journal identity standard is unanchored.'
      });
    }

    // Signal 2: Ambiguous Identity
    if (identityResult.identityStatus === 'AMBIGUOUS' || identityResult.identityConfidence < 50) {
      ruleScore += 30;
      riskFactors.push({
        code: 'AMBIGUOUS_IDENTITY',
        severity: 'HIGH',
        description: 'Journal identity could not be confidently established across academic registries.'
      });
    }

    // Signal 3: Conflicting Data Sources
    if (conflictResult.status === 'CONFLICTING_EVIDENCE') {
      ruleScore += 35;
      riskFactors.push({
        code: 'CONFLICTING_SOURCES',
        severity: 'HIGH',
        description: 'Direct contradictions detected across metadata or metric sources (e.g. publisher mismatch or CFP mismatch).'
      });
    }

    // Signal 4: Publisher-Only Claims (No Independent Database API Verification)
    const authoritativeCount = evidenceLedger.filter(e => e.authority.level <= 2 && e.status === 'VERIFIED').length;
    const publisherOnlyCount = evidenceLedger.filter(e => e.sourceType === 'PUBLISHER').length;
    if (publisherOnlyCount > 0 && authoritativeCount === 0) {
      ruleScore += 20;
      riskFactors.push({
        code: 'ONLY_PUBLISHER_EVIDENCE',
        severity: 'MEDIUM',
        description: 'Indexing or quartile claims rely solely on publisher website statements without independent API confirmation.'
      });
    }

    // Signal 5: Unverified CFP Claims
    if (parsedInput.cfpClaims.length > 0 && authoritativeCount === 0) {
      ruleScore += 15;
      riskFactors.push({
        code: 'UNVERIFIED_CFP_CLAIMS',
        severity: 'MEDIUM',
        description: 'CFP text claims indexing or quartiles that could not be independently confirmed by database APIs.'
      });
    }

    // Signal 6: Invalid ISSN Check Digit
    if (parsedInput.rawIssn && !parsedInput.issnValid) {
      ruleScore += 15;
      riskFactors.push({
        code: 'INVALID_ISSN_CHECKSUM',
        severity: 'MEDIUM',
        description: `Provided ISSN (${parsedInput.rawIssn}) failed ISO 3297 check-digit validation.`
      });
    }

    // Signal 7: Recent Delisting / Discontinued Status
    const discontinuedEvidence = evidenceLedger.find(e => /discontinued|delisted|cancelled/i.test(e.claim));
    if (discontinuedEvidence) {
      ruleScore += 40;
      riskFactors.push({
        code: 'RECENT_DELISTING',
        severity: 'HIGH',
        description: `Journal has been delisted or discontinued from authoritative coverage (${discontinuedEvidence.source}).`
      });
    }

    // Signal 8: Suspicious Indexing Claims
    const fakeClaim = evidenceLedger.find(e => /fake|unsupported|false/i.test(e.claim || ''));
    if (fakeClaim) {
      ruleScore += 30;
      riskFactors.push({
        code: 'SUSPICIOUS_INDEXING_CLAIMS',
        severity: 'HIGH',
        description: `Publisher or CFP claims indexing in major databases without empirical registry listing.`
      });
    }

    // Signal 9: Publisher Identity Inconsistency
    const pubConflict = conflictResult.conflicts.find(c => c.type === 'PUBLISHER_MISMATCH');
    if (pubConflict) {
      ruleScore += 25;
      riskFactors.push({
        code: 'PUBLISHER_IDENTITY_INCONSISTENCY',
        severity: 'HIGH',
        description: pubConflict.explanation
      });
    }

    // Signal 10: Journal Title Imitation
    if (parsedInput.journalName && /international journal of|global journal of|american journal of/i.test(parsedInput.journalName) && identityResult.identityStatus === 'AMBIGUOUS') {
      ruleScore += 15;
      riskFactors.push({
        code: 'JOURNAL_TITLE_IMITATION',
        severity: 'MEDIUM',
        description: 'Journal title uses generic or imitative phrasing closely resembling high-impact titles.'
      });
    }

    // Signal 11: Unverifiable Editorial Board
    const edBoardClaim = evidenceLedger.find(e => /editorial board|unverified/i.test(e.notes || ''));
    if (edBoardClaim && authoritativeCount === 0) {
      ruleScore += 15;
      riskFactors.push({
        code: 'UNVERIFIABLE_EDITORIAL_BOARD',
        severity: 'MEDIUM',
        description: 'Editorial board members or institutional affiliations could not be verified in open registries.'
      });
    }

    // Signal 12 & 13: RAG Predatory Pattern Matches (DISCOVERY Strength)
    if (Array.isArray(predatoryPatternMatches) && predatoryPatternMatches.length > 0) {
      predatoryPatternMatches.forEach(match => {
        discoveryScore += match.scoreImpact || 10;
        riskFactors.push({
          code: match.code,
          severity: match.severity || 'MEDIUM',
          description: match.description,
          evidenceStrength: 'DISCOVERY',
          evidenceId: match.evidenceId
        });
      });
    }

    const totalScore = Math.min(100, ruleScore + discoveryScore);

    // Determine Risk Level (RAG Safety Constraint: DISCOVERY factors alone cannot set risk to HIGH)
    let riskLevel = 'LOW';
    if (totalScore >= 60) {
      if (ruleScore < 40 && discoveryScore > 0) {
        riskLevel = 'MEDIUM';
      } else {
        riskLevel = 'HIGH';
      }
    } else if (totalScore >= 25) {
      riskLevel = 'MEDIUM';
    } else if (identityResult.identityStatus === 'NOT_FOUND' && authoritativeCount === 0) {
      riskLevel = 'UNKNOWN';
    }

    return {
      riskLevel,
      riskScore: totalScore,
      riskFactors
    };
  }
}

module.exports = RiskEngine;
