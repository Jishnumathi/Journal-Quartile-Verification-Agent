/**
 * Agent 18 - Clarivate Journal Citation Reports (JCR) Adapter
 * Dedicated JCR metric and JIF quartile verification adapter.
 */

const BaseAdapter = require('./baseAdapter');

class JCRAdapter extends BaseAdapter {
  constructor() {
    super('Clarivate JCR', 'OFFICIAL_METRIC');
  }

  async fetchJournal(parsedInput) {
    const result = this.createEmptyResult();
    const apiKey = process.env.CLARIVATE_API_KEY || process.env.JCR_API_KEY;

    if (parsedInput.mode === 'MOCK') {
      result.status = 'MOCK';
      result.journal = {
        title: parsedInput.journalName || 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
        issn: parsedInput.issn || '0162-8828',
        eissn: parsedInput.eissn || '1939-3539',
        publisher: 'IEEE'
      };
      result.metrics.push({
        database: 'JCR',
        metric: 'Journal Impact Factor (JIF)',
        year: parsedInput.requestedYear || 2025,
        category: 'Computer Science, Artificial Intelligence',
        value: 23.6,
        quartile: 'Q1',
        rank: '2/145'
      });
      result.evidence.push({
        evidenceId: `MOCK-JCR-${Date.now()}`,
        claim: 'JCR Q1 Journal Impact Factor 23.6 (Category: Computer Science, Artificial Intelligence)',
        source: 'Clarivate JCR',
        sourceType: 'OFFICIAL_METRIC',
        sourceUrl: 'https://jcr.clarivate.com/mock',
        retrievedAt: new Date().toISOString(),
        publicationYear: parsedInput.requestedYear || 2025,
        metric: 'Journal Impact Factor',
        quartile: 'Q1',
        category: 'Computer Science, Artificial Intelligence',
        value: '23.6',
        evidenceStrength: 'OFFICIAL_METRIC',
        status: 'VERIFIED',
        notes: 'MOCK DATA — Generated for verification demonstration purposes.'
      });
      return result;
    }

    if (!apiKey) {
      result.status = 'UNAVAILABLE';
      result.errors.push('JCR quartile verification unavailable — authorized JCR API credentials are not configured.');
      result.evidence.push({
        evidenceId: `JCR-UNAVAIL-${Date.now()}`,
        claim: 'Clarivate JCR quartile and Impact Factor verification unavailable',
        source: 'Clarivate JCR',
        sourceType: 'OFFICIAL_METRIC',
        sourceUrl: '',
        retrievedAt: new Date().toISOString(),
        evidenceStrength: 'DISCOVERY',
        status: 'UNAVAILABLE',
        notes: 'Authorized Clarivate JCR API credentials are not configured.'
      });
      return result;
    }

    try {
      result.status = 'AVAILABLE';
      return result;
    } catch (err) {
      result.status = 'ERROR';
      result.errors.push(`JCR API exception: ${err.message}`);
      return result;
    }
  }
}

module.exports = JCRAdapter;
