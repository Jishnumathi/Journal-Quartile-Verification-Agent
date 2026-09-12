/**
 * Agent 18 - OpenAlex Adapter
 * Real OpenAlex REST API integration for open academic source metadata cross-checking.
 */

const BaseAdapter = require('./baseAdapter');

class OpenAlexAdapter extends BaseAdapter {
  constructor() {
    super('OpenAlex', 'METADATA');
  }

  async fetchJournal(parsedInput) {
    const result = this.createEmptyResult();
    const email = process.env.OPENALEX_EMAIL || 'agent18-verifier@antigravity.local';

    try {
      const fetchFn = typeof fetch === 'function' ? fetch : (await import('node-fetch')).default;
      let url = '';
      const targetIssn = parsedInput.issn || parsedInput.eissn;

      if (targetIssn) {
        url = `https://api.openalex.org/sources?filter=issn:${encodeURIComponent(targetIssn)}&mailto=${encodeURIComponent(email)}`;
      } else if (parsedInput.journalName) {
        url = `https://api.openalex.org/sources?search=${encodeURIComponent(parsedInput.journalName)}&mailto=${encodeURIComponent(email)}`;
      } else {
        result.status = 'UNAVAILABLE';
        result.errors.push('No ISSN or journal title provided for OpenAlex lookup.');
        return result;
      }

      const response = await fetchFn(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });

      if (!response.ok) {
        result.status = 'ERROR';
        result.errors.push(`OpenAlex API HTTP Error: ${response.status}`);
        return result;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        result.status = 'NO_MATCH';
        result.errors.push('Journal source not found in OpenAlex.');
        return result;
      }

      const sourceObj = data.results[0];
      const title = sourceObj.display_name || '';
      const publisher = sourceObj.host_organization_name || '';
      const issns = sourceObj.issn || [];
      const primaryIssn = sourceObj.issn_l || issns[0] || '';
      const secondaryIssn = issns.find(i => i !== primaryIssn) || '';
      const homepageUrl = sourceObj.homepage_url || '';

      result.status = 'AVAILABLE';
      result.journal = {
        title,
        issn: primaryIssn,
        eissn: secondaryIssn,
        publisher,
        officialUrl: homepageUrl
      };

      result.indexing = {
        openAlexIndexed: true,
        isOa: sourceObj.is_oa || false,
        isInDoaj: sourceObj.is_in_doaj || false
      };

      result.evidence.push({
        evidenceId: `OPENALEX-${sourceObj.id || Date.now()}`,
        claim: `Indexed in OpenAlex academic source catalog (${sourceObj.works_count || 0} indexed publications)`,
        source: 'OpenAlex',
        sourceType: 'METADATA',
        sourceUrl: sourceObj.id || url,
        retrievedAt: new Date().toISOString(),
        publicationYear: new Date().getFullYear(),
        evidenceStrength: 'METADATA',
        status: 'VERIFIED',
        notes: 'OpenAlex metadata confirms publication history. Does not independently prove Clarivate/Scopus quartiles.'
      });

      return result;
    } catch (err) {
      result.status = 'ERROR';
      result.errors.push(`OpenAlex API request failed: ${err.message}`);
      return result;
    }
  }
}

module.exports = OpenAlexAdapter;
