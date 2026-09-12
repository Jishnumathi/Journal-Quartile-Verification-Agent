/**
 * Agent 18 - Crossref Adapter
 * Real Crossref REST API integration for journal identity, ISSN, publisher, and DOI metadata.
 */

const BaseAdapter = require('./baseAdapter');

class CrossrefAdapter extends BaseAdapter {
  constructor() {
    super('Crossref', 'METADATA');
  }

  async fetchJournal(parsedInput) {
    const result = this.createEmptyResult();
    const mailto = process.env.CROSSREF_MAILTO || 'agent18-verifier@antigravity.local';
    const headers = {
      'User-Agent': `Agent18-JournalVerifier/1.0 (mailto:${mailto})`
    };

    try {
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
      let url = '';
      const targetIssn = parsedInput.issn || parsedInput.eissn;

      if (targetIssn) {
        url = `https://api.crossref.org/journals/${encodeURIComponent(targetIssn)}`;
      } else if (parsedInput.journalName) {
        url = `https://api.crossref.org/journals?query=${encodeURIComponent(parsedInput.journalName)}&rows=1`;
      } else {
        result.status = 'UNAVAILABLE';
        result.errors.push('No ISSN or journal title provided for Crossref lookup.');
        return result;
      }

      const response = await fetchFn(url, { headers, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });

      if (response.status === 404) {
        result.status = 'NO_MATCH';
        result.errors.push('Journal not found in Crossref registry.');
        return result;
      }

      if (!response.ok) {
        result.status = 'ERROR';
        result.errors.push(`Crossref API HTTP Error: ${response.status}`);
        return result;
      }

      const data = await response.json();
      let journalData = null;

      if (data.message && data.message.title) {
        journalData = data.message;
      } else if (data.message && data.message.items && data.message.items.length > 0) {
        journalData = data.message.items[0];
      }

      if (!journalData) {
        result.status = 'NO_MATCH';
        return result;
      }

      const title = journalData.title || '';
      const publisher = journalData.publisher || '';
      const issns = journalData['issn-map'] ? Object.keys(journalData['issn-map']) : (journalData.ISSN || []);
      const primaryIssn = issns[0] || '';
      const secondaryIssn = issns[1] || '';

      result.status = 'AVAILABLE';
      result.journal = {
        title: title,
        issn: primaryIssn,
        eissn: secondaryIssn,
        publisher: publisher,
        officialUrl: journalData.subjects ? undefined : undefined
      };

      result.indexing = {
        crossrefRegistered: true
      };

      result.evidence.push({
        evidenceId: `CROSSREF-${Date.now()}`,
        claim: `Registered in Crossref metadata registry under publisher "${publisher}"`,
        source: 'Crossref',
        sourceType: 'METADATA',
        sourceUrl: url,
        retrievedAt: new Date().toISOString(),
        publicationYear: new Date().getFullYear(),
        evidenceStrength: 'METADATA',
        status: 'VERIFIED',
        notes: 'Crossref provides metadata proof of registration, not quartile ranking.'
      });

      return result;
    } catch (err) {
      result.status = 'ERROR';
      result.errors.push(`Crossref API request failed: ${err.message}`);
      return result;
    }
  }
}

module.exports = CrossrefAdapter;
