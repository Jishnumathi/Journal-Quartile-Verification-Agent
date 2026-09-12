/**
 * Agent 18 - Journal Identity Resolver
 * Normalizes title, matches candidate records, calculates confidence scores,
 * and sets canonical identity status (VERIFIED, PARTIALLY_VERIFIED, AMBIGUOUS, NOT_FOUND, CONFLICTING).
 */

class IdentityResolver {
  /**
   * Normalize string for fuzzy/exact string comparison
   */
  static normalizeTitle(title) {
    if (!title || typeof title !== 'string') return '';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/^(the|an|a|journal of|international journal of)\s+/i, '')
      .replace(/[^a-z0-9\s]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Compare two titles and return similarity score (0.0 to 1.0)
   */
  static calculateTitleSimilarity(title1, title2) {
    const t1 = this.normalizeTitle(title1);
    const t2 = this.normalizeTitle(title2);
    if (!t1 || !t2) return 0;
    if (t1 === t2) return 1.0;

    // Levenshtein distance based score
    const len1 = t1.length;
    const len2 = t2.length;
    const maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0;

    let matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const indicator = t1[i - 1] === t2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    const distance = matrix[len2][len1];
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Resolves journal identity from collected adapter outputs & optional RAG cache candidates
   */
  static resolve(parsedInput, adapterResults = [], cacheCandidates = []) {
    let canonicalJournalId = '';
    let journalName = parsedInput.journalName || '';
    let issn = parsedInput.issn || '';
    let eissn = parsedInput.eissn || '';
    let publisher = parsedInput.publisher || '';
    let officialUrl = parsedInput.journalUrl || '';
    let identityConfidence = 0;
    let identityStatus = 'NOT_FOUND';
    const notes = [];

    // Collect all unique journal candidates from external adapters
    const candidates = [];
    adapterResults.forEach(res => {
      if (res.status === 'AVAILABLE' || res.status === 'MOCK') {
        if (res.journal && (res.journal.title || res.journal.issn)) {
          candidates.push({
            source: res.source,
            title: res.journal.title,
            issn: res.journal.issn,
            eissn: res.journal.eissn,
            publisher: res.journal.publisher,
            url: res.journal.officialUrl
          });
        }
      }
    });

    // Check Priority 1: Exact ISSN match
    let matchedCandidate = null;
    let matchMethod = '';

    if (issn) {
      matchedCandidate = candidates.find(c => c.issn === issn || c.eissn === issn);
      if (matchedCandidate) matchMethod = 'Exact ISSN Match';
    }

    // Priority 2: Exact eISSN match
    if (!matchedCandidate && eissn) {
      matchedCandidate = candidates.find(c => c.issn === eissn || c.eissn === eissn);
      if (matchedCandidate) matchMethod = 'Exact eISSN Match';
    }

    // Priority 3: Exact URL match
    if (!matchedCandidate && officialUrl) {
      matchedCandidate = candidates.find(c => c.url && c.url.toLowerCase() === officialUrl.toLowerCase());
      if (matchedCandidate) matchMethod = 'Official URL Match';
    }

    // Priority 4: Exact normalized title match
    if (!matchedCandidate && journalName) {
      const normInput = this.normalizeTitle(journalName);
      matchedCandidate = candidates.find(c => this.normalizeTitle(c.title) === normInput);
      if (matchedCandidate) matchMethod = 'Exact Normalized Title Match';
    }

    // Priority 5: Fuzzy title similarity
    if (!matchedCandidate && journalName) {
      let highestScore = 0;
      let bestMatch = null;
      candidates.forEach(c => {
        const sim = this.calculateTitleSimilarity(journalName, c.title);
        if (sim > highestScore) {
          highestScore = sim;
          bestMatch = c;
        }
      });
      if (highestScore >= 0.75) {
        matchedCandidate = bestMatch;
        matchMethod = `Fuzzy Title Match (${(highestScore * 100).toFixed(0)}% similarity)`;
      } else if (highestScore >= 0.5) {
        notes.push(`Ambiguous title match found: "${bestMatch.title}" with score ${highestScore.toFixed(2)}`);
      }
    }

    // Priority 6 (RAG Extension): Embedding Similarity Cache Candidate Suggestion
    if (!matchedCandidate && Array.isArray(cacheCandidates) && cacheCandidates.length > 0) {
      const topCacheMatch = cacheCandidates[0];
      if (topCacheMatch && topCacheMatch.journal) {
        const cacheJournal = topCacheMatch.journal;
        notes.push(`Vector cache candidate suggested: "${cacheJournal.journalName}" (${(topCacheMatch.similarity * 100).toFixed(0)}% embedding similarity). Non-authoritative.`);
        // Cache suggestion can surface candidate details, but status is capped at PARTIALLY_VERIFIED/AMBIGUOUS
        matchedCandidate = {
          source: 'Vector Cache Suggestion',
          title: cacheJournal.journalName,
          issn: cacheJournal.issn,
          eissn: cacheJournal.eissn,
          publisher: cacheJournal.publisher,
          url: cacheJournal.officialUrl,
          isCacheSuggestion: true
        };
        matchMethod = `Embedding Similarity Cache Candidate (${(topCacheMatch.similarity * 100).toFixed(0)}%)`;
      }
    }

    // Populate resolved identity fields
    if (matchedCandidate) {
      journalName = matchedCandidate.title || journalName;
      issn = matchedCandidate.issn || issn;
      eissn = matchedCandidate.eissn || eissn;
      publisher = matchedCandidate.publisher || publisher;
      officialUrl = matchedCandidate.url || officialUrl;
      canonicalJournalId = `JOURNAL-${(issn || eissn || journalName).replace(/[^a-z0-9]/gi, '').toUpperCase()}`;

      if (matchedCandidate.isCacheSuggestion) {
        identityConfidence = 60;
        identityStatus = 'PARTIALLY_VERIFIED';
      } else if (matchMethod.includes('ISSN') || matchMethod.includes('eISSN')) {
        identityConfidence = 95;
        identityStatus = 'VERIFIED';
      } else if (matchMethod.includes('Exact Normalized Title')) {
        identityConfidence = 85;
        identityStatus = (issn || eissn) ? 'VERIFIED' : 'PARTIALLY_VERIFIED';
      } else {
        identityConfidence = 70;
        identityStatus = 'PARTIALLY_VERIFIED';
      }
      notes.push(`Resolved via ${matchMethod} from source ${matchedCandidate.source}`);
    } else if (journalName || issn || eissn) {
      if (journalName && (issn || eissn)) {
        // User provided both title and ISSN, but no database API verified them together
        canonicalJournalId = `JOURNAL-${(issn || eissn).replace(/[^a-z0-9]/gi, '')}`;
        identityConfidence = 45;
        identityStatus = 'AMBIGUOUS';
        notes.push(`Title "${journalName}" and ISSN "${issn || eissn}" could not be confirmed together in academic registries.`);
      } else if (parsedInput.issnValid || parsedInput.eissnValid) {
        canonicalJournalId = `JOURNAL-${(issn || eissn).replace(/[^a-z0-9]/gi, '')}`;
        identityConfidence = 60;
        identityStatus = 'PARTIALLY_VERIFIED';
        notes.push('Identity based on user valid ISSN/eISSN without API confirmation.');
      } else if (candidates.length > 1) {
        identityConfidence = 40;
        identityStatus = 'AMBIGUOUS';
        notes.push('Multiple candidate records found with low matching confidence.');
      } else {
        identityConfidence = 20;
        identityStatus = 'NOT_FOUND';
        notes.push('No authoritative identity records matched external databases.');
      }
    }

    // Detect ISSN mismatch conflicts
    if (parsedInput.issn && matchedCandidate && matchedCandidate.issn && parsedInput.issn !== matchedCandidate.issn) {
      notes.push(`User ISSN (${parsedInput.issn}) differs from record ISSN (${matchedCandidate.issn})`);
    }

    return {
      canonicalJournalId,
      journalName,
      issn,
      eissn,
      publisher,
      officialUrl,
      identityConfidence,
      identityStatus,
      resolutionMethod: matchMethod || 'Input Metadata',
      notes
    };
  }
}

module.exports = IdentityResolver;
