/**
 * Agent 18 - Publisher Adapter
 * Extracts publisher-reported metadata, claims, and acceptance rates from official URLs.
 * CRITICAL RULE: All claims from this adapter must be labeled PUBLISHER-REPORTED
 * and NEVER converted into independent database verification.
 */

const BaseAdapter = require('./baseAdapter');

class PublisherAdapter extends BaseAdapter {
  constructor() {
    super('Official Publisher Site', 'PUBLISHER');
  }

  async fetchJournal(parsedInput) {
    const result = this.createEmptyResult();
    const targetUrl = parsedInput.journalUrl;

    if (parsedInput.mode === 'MOCK' && targetUrl) {
      result.status = 'MOCK';
      result.journal = {
        title: parsedInput.journalName || 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        issn: parsedInput.issn || '0162-8828',
        eissn: parsedInput.eissn || '1939-3539',
        publisher: parsedInput.publisher || 'IEEE',
        officialUrl: targetUrl,
        acceptanceRate: '15%'
      };
      result.evidence.push({
        evidenceId: `MOCK-PUB-${Date.now()}`,
        claim: 'Scopus & Web of Science indexing claimed on publisher website. Acceptance rate: 15%.',
        source: 'Official Publisher Site',
        sourceType: 'PUBLISHER',
        sourceUrl: targetUrl,
        retrievedAt: new Date().toISOString(),
        evidenceStrength: 'PUBLISHER',
        status: 'VERIFIED',
        notes: 'PUBLISHER-REPORTED claim — Requires independent database API verification.'
      });
      return result;
    }

    if (!targetUrl || !parsedInput.urlValid) {
      result.status = 'UNAVAILABLE';
      result.errors.push('No valid official journal URL provided for publisher extraction.');
      result.journal = {
        acceptanceRate: 'Not publicly available'
      };
      return result;
    }

    try {
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
      const response = await fetchFn(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Agent18/1.0 AcademicVerifier'
        },
        signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined
      });

      if (!response.ok) {
        result.status = 'ERROR';
        result.errors.push(`Publisher URL HTTP Error: ${response.status}`);
        result.journal = { acceptanceRate: 'Not publicly available' };
        return result;
      }

      const html = await response.text();

      // Extract metadata claims & acceptance rate from HTML content
      const claimsFound = [];
      let extractedAcceptanceRate = 'Not publicly available';

      // Look for regex matches like "Acceptance rate: 18%" or "Acceptance Rate 20%"
      const accMatch = html.match(/acceptance\s+rate\s*:?\s*(\d{1,2}\s*%)/i);
      if (accMatch) {
        extractedAcceptanceRate = accMatch[1];
        claimsFound.push(`Publisher reported acceptance rate: ${extractedAcceptanceRate}`);
      }

      if (/scopus/i.test(html)) {
        claimsFound.push('Scopus indexing claimed by publisher website');
      }
      if (/web of science|science citation index/i.test(html)) {
        claimsFound.push('Web of Science indexing claimed by publisher website');
      }
      if (/impact factor/i.test(html)) {
        claimsFound.push('Impact Factor reported on publisher website');
      }

      result.status = 'AVAILABLE';
      result.journal = {
        title: parsedInput.journalName,
        issn: parsedInput.issn,
        eissn: parsedInput.eissn,
        publisher: parsedInput.publisher,
        officialUrl: targetUrl,
        acceptanceRate: extractedAcceptanceRate
      };

      claimsFound.forEach((claimText, idx) => {
        result.evidence.push({
          evidenceId: `PUB-CLAIM-${Date.now()}-${idx}`,
          claim: claimText,
          source: 'Official Publisher Site',
          sourceType: 'PUBLISHER',
          sourceUrl: targetUrl,
          retrievedAt: new Date().toISOString(),
          evidenceStrength: 'PUBLISHER',
          status: 'UNVERIFIED',
          notes: 'PUBLISHER-REPORTED: Independent verification requires direct database credentials.'
        });
      });

      if (claimsFound.length === 0) {
        result.evidence.push({
          evidenceId: `PUB-METADATA-${Date.now()}`,
          claim: `Official publisher website accessible at ${targetUrl}. Acceptance rate: Not publicly available.`,
          source: 'Official Publisher Site',
          sourceType: 'PUBLISHER',
          sourceUrl: targetUrl,
          retrievedAt: new Date().toISOString(),
          evidenceStrength: 'PUBLISHER',
          status: 'VERIFIED',
          notes: 'Publisher URL validated.'
        });
      }

      return result;
    } catch (err) {
      result.status = 'ERROR';
      result.errors.push(`Publisher URL fetch failed: ${err.message}`);
      result.journal = { acceptanceRate: 'Not publicly available' };
      return result;
    }
  }
}

module.exports = PublisherAdapter;
