/**
 * Agent 18 - Institutional Policy & Approved-Venue Manager
 * Manages institutional approved-journal lists and evaluates policy compliance.
 * STRICT DISTINCTION: Distinguishes INDEXED (database coverage) from INSTITUTIONALLY_ACCEPTED.
 */

const fs = require('fs');
const path = require('path');

class InstitutionalPolicyManager {
  constructor() {
    this.listPath = path.join(__dirname, '../data/approvedVenues.json');
    this.initStore();
  }

  initStore() {
    if (!fs.existsSync(this.listPath)) {
      const initial = [
        {
          id: "APP-001",
          journalName: "Nature",
          issn: "0028-0836",
          eissn: "1476-4687",
          approvingInstitution: "Global Institutional Research Board",
          approvalReason: "Premier multidisciplinary journal.",
          effectiveDate: "2024-01-01",
          status: "APPROVED"
        }
      ];
      fs.writeFileSync(this.listPath, JSON.stringify(initial, null, 2));
    }
  }

  getApprovedVenues() {
    try {
      const raw = fs.readFileSync(this.listPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      return [];
    }
  }

  saveApprovedVenues(venues) {
    try {
      fs.writeFileSync(this.listPath, JSON.stringify(venues, null, 2));
    } catch (err) {
      console.error('[InstitutionalPolicyManager] Failed to save approved venues:', err.message);
    }
  }

  addApprovedVenue(venueData) {
    const venues = this.getApprovedVenues();
    const newEntry = {
      id: `APP-${Date.now()}`,
      journalName: venueData.journalName || 'Unknown Journal',
      issn: venueData.issn || '',
      eissn: venueData.eissn || '',
      approvingInstitution: venueData.approvingInstitution || 'University Academic Council',
      approvalReason: venueData.approvalReason || 'Institutional Approval',
      effectiveDate: venueData.effectiveDate || new Date().toISOString().split('T')[0],
      status: 'APPROVED',
      addedAt: new Date().toISOString()
    };

    venues.push(newEntry);
    this.saveApprovedVenues(venues);
    return newEntry;
  }

  removeApprovedVenue(idOrIssn) {
    let venues = this.getApprovedVenues();
    const initialLen = venues.length;
    venues = venues.filter(v => v.id !== idOrIssn && v.issn !== idOrIssn && v.eissn !== idOrIssn);
    this.saveApprovedVenues(venues);
    return venues.length < initialLen;
  }

  /**
   * Evaluates institutional compliance and explicitly distinguishes INDEXED from INSTITUTIONALLY_ACCEPTED
   */
  evaluateCompliance(policyText, indexing, metricsMap, journalIdentity) {
    const approvedVenues = this.getApprovedVenues();
    const issn = journalIdentity?.issn;
    const eissn = journalIdentity?.eissn;
    const journalName = (journalIdentity?.journalName || '').toLowerCase();

    // Check if on institutional approved venue list
    const approvedMatch = approvedVenues.find(v => 
      (issn && (v.issn === issn || v.eissn === issn)) ||
      (eissn && (v.issn === eissn || v.eissn === eissn)) ||
      (journalName && v.journalName.toLowerCase() === journalName)
    );

    const isIndexedScopus = indexing?.scopus?.activeCoverage || false;
    const isIndexedWoS = indexing?.webOfScience?.activeCoverage || false;
    const isGloballyIndexed = isIndexedScopus || isIndexedWoS;
    const isInstitutionallyAccepted = !!approvedMatch;

    const evaluations = [];

    // Rule 1: Scopus/WoS Database Indexing Status
    evaluations.push({
      rule: 'Database Indexing Status (Scopus / Web of Science)',
      status: isGloballyIndexed ? 'INDEXED' : 'NOT_INDEXED',
      satisfied: isGloballyIndexed,
      evidence: isGloballyIndexed ? 'Confirmed active coverage in database APIs.' : 'Coverage not confirmed in database APIs.'
    });

    // Rule 2: Institutional Approved-Venue List Inclusion
    evaluations.push({
      rule: 'Institutional Approved-Venue Registry',
      status: isInstitutionallyAccepted ? 'INSTITUTIONALLY_ACCEPTED' : 'NOT_LISTED',
      satisfied: isInstitutionallyAccepted,
      evidence: isInstitutionallyAccepted ? `Approved by ${approvedMatch.approvingInstitution}: ${approvedMatch.approvalReason}` : 'Journal is not currently listed on the institutional approved-venue registry.'
    });

    // Rule 3: Custom User Policy Compliance (if specified)
    if (policyText && policyText.trim().length > 0) {
      const lowerPol = policyText.toLowerCase();
      let policyPass = true;
      let policyEvidence = 'Custom institutional policy requirements satisfied.';

      if (lowerPol.includes('scopus') && !isIndexedScopus) {
        policyPass = false;
        policyEvidence = 'Policy requires active Scopus coverage, but Scopus coverage is unconfirmed.';
      }
      if (lowerPol.includes('jcr q1') || lowerPol.includes('q1')) {
        const jcrQ = metricsMap?.jcr?.quartile;
        const citeQ = metricsMap?.citescore?.quartile;
        if (jcrQ !== 'Q1' && citeQ !== 'Q1') {
          policyPass = false;
          policyEvidence = 'Policy requires Q1 quartile, but verified metrics report Q2/N/A.';
        }
      }

      evaluations.push({
        rule: `Custom Requirement: "${policyText}"`,
        status: policyPass ? 'SATISFIED' : 'NOT_SATISFIED',
        satisfied: policyPass,
        evidence: policyEvidence
      });
    }

    const overallStatus = (isGloballyIndexed && (isInstitutionallyAccepted || !policyText)) ? 'SATISFIED' : (isGloballyIndexed ? 'INDEXED_ONLY' : 'NOT_SATISFIED');

    return {
      status: overallStatus,
      isGloballyIndexed,
      isInstitutionallyAccepted,
      summary: isInstitutionallyAccepted ? 'INSTITUTIONALLY_ACCEPTED' : (isGloballyIndexed ? 'INDEXED (Pending Institutional Acceptance)' : 'NOT_SATISFIED'),
      evaluations
    };
  }
}

module.exports = new InstitutionalPolicyManager();
