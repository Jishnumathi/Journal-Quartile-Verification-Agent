/**
 * Agent 18 - Local Sample Database Adapter
 * Queries the connected SQLite sample database for authoritative local metadata,
 * indexing records, and multi-year metrics during verification runs.
 */

const sampleDatabase = require('../db/sampleDatabase');

class DatabaseAdapter {
  constructor() {
    this.source = 'Local SQLite Database';
    this.sourceType = 'DATABASE';
    this.authorityLevel = 2; // Level 2: Authoritative Database Registry
  }

  async fetchJournal(parsedInput) {
    const query = parsedInput.issn || parsedInput.eissn || parsedInput.journalName;
    if (!query) {
      return {
        source: this.source,
        sourceType: this.sourceType,
        status: 'SKIPPED',
        journal: null,
        metrics: [],
        evidence: [],
        errors: ['No search terms (ISSN or Journal Name) provided']
      };
    }

    try {
      const match = sampleDatabase.getJournalByIdOrIssn(query);

      if (!match) {
        return {
          source: this.source,
          sourceType: this.sourceType,
          status: 'NOT_FOUND',
          journal: null,
          metrics: [],
          evidence: [],
          errors: ['No record found in local SQLite database']
        };
      }

      const evidence = [
        {
          source: this.source,
          claim: `Journal "${match.journal_name}" found in connected SQLite sample database (Print ISSN: ${match.issn || 'N/A'}, eISSN: ${match.eissn || 'N/A'}).`,
          status: 'VERIFIED',
          authority: { level: this.authorityLevel, description: 'Authoritative SQLite Database Registry' },
          strength: 'AUTHORITATIVE_REGISTRY'
        }
      ];

      if (match.indexed_scopus) {
        evidence.push({
          source: this.source,
          claim: `Active Scopus database coverage confirmed in SQLite database registry.`,
          status: 'VERIFIED',
          authority: { level: this.authorityLevel, description: 'Authoritative SQLite Database Registry' },
          strength: 'AUTHORITATIVE_REGISTRY'
        });
      }

      if (match.indexed_wos) {
        evidence.push({
          source: this.source,
          claim: `Active Web of Science database coverage confirmed in SQLite database registry.`,
          status: 'VERIFIED',
          authority: { level: this.authorityLevel, description: 'Authoritative SQLite Database Registry' },
          strength: 'AUTHORITATIVE_REGISTRY'
        });
      }

      const metrics = (match.metrics || []).map(m => ({
        database: m.database_name,
        metric: m.metric_name,
        value: m.value,
        quartile: m.quartile,
        year: m.year,
        authority: { level: this.authorityLevel }
      }));

      return {
        source: this.source,
        sourceType: this.sourceType,
        status: 'FOUND',
        journal: {
          journalName: match.journal_name,
          issn: match.issn,
          eissn: match.eissn,
          publisher: match.publisher,
          officialUrl: match.official_url,
          subjectArea: match.subject_area
        },
        indexing: {
          scopus: { activeCoverage: !!match.indexed_scopus },
          webOfScience: { activeCoverage: !!match.indexed_wos }
        },
        metrics,
        evidence,
        errors: []
      };
    } catch (err) {
      return {
        source: this.source,
        sourceType: this.sourceType,
        status: 'ERROR',
        journal: null,
        metrics: [],
        evidence: [],
        errors: [err.message]
      };
    }
  }
}

module.exports = DatabaseAdapter;
