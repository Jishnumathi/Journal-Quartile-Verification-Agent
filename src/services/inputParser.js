/**
 * Agent 18 - Input Parser & Validation Engine
 * Handles input sanitization, ISSN validation, SSRF protection, and CFP claim extraction.
 */

const URL = require('url').URL;

class InputParser {
  /**
   * Validate ISSN string using standard ISO 3297 check-digit algorithm
   * Format: XXXX-XXXX or XXXXXXXX
   */
  static validateISSN(issnStr) {
    if (!issnStr || typeof issnStr !== 'string') return { valid: false, clean: '' };
    const cleaned = issnStr.replace(/[^0-9X]/gi, '').toUpperCase();
    if (cleaned.length !== 8) return { valid: false, clean: '' };

    let sum = 0;
    for (let i = 0; i < 7; i++) {
      sum += parseInt(cleaned[i], 10) * (8 - i);
    }
    const checkChar = cleaned[7];
    const remainder = sum % 11;
    const computedCheck = remainder === 0 ? '0' : remainder === 1 ? 'X' : (11 - remainder).toString();

    const formatted = `${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}`;
    const isValid = checkChar === computedCheck;
    return { valid: isValid, clean: formatted, raw: cleaned };
  }

  /**
   * SSRF Protection for User-Provided URLs
   */
  static validateAndSanitizeUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return { valid: false, url: '' };
    try {
      const parsed = new URL(urlStr.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, url: '', reason: 'Only HTTP/HTTPS protocols allowed' };
      }
      const hostname = parsed.hostname.toLowerCase();
      // Block private / internal IPs and localhost
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal')
      ) {
        return { valid: false, url: '', reason: 'SSRF Protection: Access to private network resources is restricted.' };
      }
      return { valid: true, url: parsed.toString() };
    } catch (e) {
      return { valid: false, url: '', reason: 'Invalid URL structure' };
    }
  }

  /**
   * Extract key claims from CFP / Call for Papers text
   */
  static extractCFPClaims(cfpText) {
    if (!cfpText || typeof cfpText !== 'string') return [];
    const text = cfpText;
    const claims = [];

    const patterns = [
      { regex: /scopus\s+q([1-4])/i, database: 'Scopus', metric: 'CiteScore', quartileGroup: 1 },
      { regex: /scopus\s+indexed|indexed\s+in\s+scopus/i, database: 'Scopus', metric: 'Indexing' },
      { regex: /web\s+of\s+science|wos\s+indexed/i, database: 'Web of Science', metric: 'Indexing' },
      { regex: /\b(sci|scie|esci)\b/i, database: 'Web of Science', metric: 'Collection' },
      { regex: /journal\s+impact\s+factor|jif|impact\s+factor\s*:?\s*([\d\.]+)/i, database: 'JCR', metric: 'Impact Factor' },
      { regex: /jcr\s+q([1-4])/i, database: 'JCR', metric: 'JIF Quartile', quartileGroup: 1 },
      { regex: /citescore\s+q([1-4])/i, database: 'Scopus', metric: 'CiteScore Quartile', quartileGroup: 1 },
      { regex: /sjr\s+q([1-4])/i, database: 'SJR', metric: 'SJR Quartile', quartileGroup: 1 },
      { regex: /ugc[\s\-]*care/i, database: 'UGC-CARE', metric: 'Indexing' }
    ];

    patterns.forEach(({ regex, database, metric, quartileGroup }) => {
      const match = text.match(regex);
      if (match) {
        let extractedVal = match[0];
        let quartile = quartileGroup && match[quartileGroup] ? `Q${match[quartileGroup]}` : null;
        claims.push({
          claim: extractedVal,
          database,
          metric,
          quartile,
          source: 'CFP',
          verificationStatus: 'UNVERIFIED',
          note: 'Extracted from user-submitted CFP text. Requires independent verification.'
        });
      }
    });

    return claims;
  }

  /**
   * Parse user input into standardized verification request structure
   */
  static parseInput(rawInput) {
    const journalName = (rawInput.journalName || rawInput.name || rawInput.title || '').trim();
    
    // Parse ISSN & eISSN
    let issnObj = this.validateISSN(rawInput.issn);
    let eissnObj = this.validateISSN(rawInput.eissn);

    // If ISSN input contains comma or slash, try parsing both
    if (!issnObj.valid && rawInput.issn && (rawInput.issn.includes(',') || rawInput.issn.includes('/'))) {
      const parts = rawInput.issn.split(/[,/]/);
      issnObj = this.validateISSN(parts[0]);
      if (!eissnObj.valid && parts[1]) {
        eissnObj = this.validateISSN(parts[1]);
      }
    }

    const urlCheck = this.validateAndSanitizeUrl(rawInput.url || rawInput.journalUrl);
    const cfpClaims = this.extractCFPClaims(rawInput.cfp || rawInput.description || '');

    const currentYear = new Date().getFullYear();
    let requestedYear = parseInt(rawInput.requestedYear || rawInput.year, 10);
    if (isNaN(requestedYear) || requestedYear < 1990 || requestedYear > currentYear + 1) {
      requestedYear = currentYear;
    }

    return {
      journalName,
      issn: issnObj.clean,
      issnValid: issnObj.valid,
      rawIssn: rawInput.issn || '',
      eissn: eissnObj.clean,
      eissnValid: eissnObj.valid,
      rawEissn: rawInput.eissn || '',
      journalUrl: urlCheck.valid ? urlCheck.url : '',
      urlValid: urlCheck.valid,
      urlError: urlCheck.reason || null,
      doi: (rawInput.doi || '').trim(),
      publisher: (rawInput.publisher || '').trim(),
      cfpText: rawInput.cfp || rawInput.description || '',
      cfpClaims,
      requestedYear,
      requestedDatabase: rawInput.requestedDatabase || 'Any',
      requestedCategory: rawInput.requestedCategory || '',
      institutionalPolicy: rawInput.institutionalPolicy || rawInput.policy || null,
      mode: rawInput.mode || 'PARTIAL' // MOCK, PARTIAL, LIVE
    };
  }
}

module.exports = InputParser;
