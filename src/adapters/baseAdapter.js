/**
 * Agent 18 - Base Source Adapter
 * Standard contract for all metadata and indexing adapters.
 */

class BaseAdapter {
  constructor(sourceName, sourceType) {
    this.sourceName = sourceName;
    this.sourceType = sourceType; // AUTHORITATIVE, OFFICIAL_METRIC, METADATA, PUBLISHER, DISCOVERY
  }

  createEmptyResult(status = 'UNAVAILABLE', errors = []) {
    return {
      source: this.sourceName,
      sourceType: this.sourceType,
      status: status, // AVAILABLE, UNAVAILABLE, ERROR, MOCK, NO_MATCH, RATE_LIMITED
      journal: {
        title: '',
        issn: '',
        eissn: '',
        publisher: '',
        officialUrl: ''
      },
      metrics: [],
      indexing: {},
      evidence: [],
      retrievedAt: new Date().toISOString(),
      errors: errors
    };
  }
}

module.exports = BaseAdapter;
