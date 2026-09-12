/**
 * Agent 18 - Evidence Ledger Engine
 * Manages evidence normalization, classification, and authority level mapping.
 */

class EvidenceEngine {
  /**
   * Authority Levels Map
   * Level 1: Authoritative Database / Official API
   * Level 2: Official Metric Source
   * Level 3: Government / Institutional
   * Level 4: Official Publisher
   * Level 5: Metadata Provider
   * Level 6: Search / Discovery
   * Level 7: LLM Inference
   */
  static getAuthorityLevel(sourceType, source) {
    const src = (source || '').toLowerCase();
    const type = (sourceType || '').toUpperCase();

    if (type === 'AUTHORITATIVE' || src.includes('scopus') || src.includes('clarivate') || src.includes('web of science')) {
      return { level: 1, label: 'LEVEL 1: Authoritative Database' };
    }
    if (type === 'OFFICIAL_METRIC' || src.includes('jcr') || src.includes('citescore') || src.includes('sjr')) {
      return { level: 2, label: 'LEVEL 2: Official Metric Source' };
    }
    if (type === 'GOVERNMENT_INSTITUTIONAL' || src.includes('ugc') || src.includes('doaj')) {
      return { level: 3, label: 'LEVEL 3: Government / Institutional' };
    }
    if (type === 'PUBLISHER' || src.includes('publisher')) {
      return { level: 4, label: 'LEVEL 4: Official Publisher' };
    }
    if (type === 'METADATA' || src.includes('crossref') || src.includes('openalex')) {
      return { level: 5, label: 'LEVEL 5: Metadata Provider' };
    }
    if (type === 'DISCOVERY' || src.includes('scholar')) {
      return { level: 6, label: 'LEVEL 6: Search / Discovery' };
    }
    return { level: 7, label: 'LEVEL 7: LLM Inference' };
  }

  /**
   * Normalizes evidence items collected across adapters
   */
  static processEvidence(adapterResults = [], cfpClaims = []) {
    const ledger = [];

    // Process CFP Claims
    cfpClaims.forEach((claim, idx) => {
      ledger.push({
        evidenceId: `CFP-CLAIM-${idx + 1}`,
        claim: `CFP Claimed: "${claim.claim}"`,
        source: 'User CFP Text',
        sourceType: 'LLM_INFERENCE',
        authority: this.getAuthorityLevel('LLM_INFERENCE', 'User CFP Text'),
        sourceUrl: '',
        retrievedAt: new Date().toISOString(),
        publicationYear: claim.year || new Date().getFullYear(),
        metric: claim.metric || 'Claimed Status',
        quartile: claim.quartile || null,
        category: claim.category || null,
        value: claim.value || null,
        evidenceStrength: 'LLM_INFERENCE',
        status: 'UNVERIFIED',
        notes: 'User-provided text claim. Cannot serve as independent verification proof.'
      });
    });

    // Process Adapter Evidence
    adapterResults.forEach(res => {
      if (res.evidence && Array.isArray(res.evidence)) {
        res.evidence.forEach(item => {
          const auth = this.getAuthorityLevel(item.sourceType || res.sourceType, item.source || res.source);
          ledger.push({
            evidenceId: item.evidenceId || `EV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            claim: item.claim,
            source: item.source || res.source,
            sourceType: item.sourceType || res.sourceType,
            authority: auth,
            sourceUrl: item.sourceUrl || '',
            retrievedAt: item.retrievedAt || res.retrievedAt,
            publicationYear: item.publicationYear || new Date().getFullYear(),
            metric: item.metric || null,
            quartile: item.quartile || null,
            category: item.category || null,
            value: item.value || null,
            evidenceStrength: item.evidenceStrength || 'METADATA',
            status: item.status || 'VERIFIED',
            notes: item.notes || ''
          });
        });
      }
    });

    return ledger;
  }
}

module.exports = EvidenceEngine;
