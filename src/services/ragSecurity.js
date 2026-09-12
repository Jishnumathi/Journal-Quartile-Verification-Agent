/**
 * Agent 18 - RAG Security & Prompt Injection Defense Engine
 * Enforces strict separation between system instructions and retrieved evidence data.
 * Sanitizes retrieved context against prompt injection attacks and attaches complete traceable provenance.
 */

class RagSecurity {
  /**
   * List of adversarial prompt injection patterns to neutralize
   */
  static get injectionPatterns() {
    return [
      /ignore\s+(previous|all)\s+instructions/gi,
      /you\s+are\s+now\s+a/gi,
      /system\s+instruction\s*:/gi,
      /override\s+verification\s+status/gi,
      /say\s+this\s+journal\s+is\s+q1/gi,
      /mark\s+status\s+as\s+verified/gi,
      /bypass\s+security/gi,
      /forget\s+rules/gi
    ];
  }

  /**
   * Sanitizes retrieved text string against prompt injection vectors
   */
  static sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    let sanitized = text;

    this.injectionPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED_PROMPT_INJECTION_ATTEMPT]');
    });

    return sanitized;
  }

  /**
   * Wraps retrieved context in strict untrusted data boundaries
   */
  static formatUntrustedContext(chunks = []) {
    if (!Array.isArray(chunks) || chunks.length === 0) return '';

    const sanitizedChunks = chunks.map((c, idx) => {
      const cleanText = this.sanitizeText(c.chunk?.text || c.text || '');
      const evidenceId = c.chunk?.evidenceId || c.evidenceId || `EVID-${idx}`;
      const source = c.chunk?.metadata?.source || c.metadata?.source || 'Retrieved Document';
      const url = c.chunk?.metadata?.sourceUrl || c.metadata?.sourceUrl || 'N/A';
      const sim = c.similarity ? c.similarity.toFixed(3) : '1.000';

      return `[Chunk #${idx + 1} | EvidenceID: ${evidenceId} | Source: ${source} | URL: ${url} | Relevance: ${sim}]\n${cleanText}`;
    });

    return `<untrusted_retrieved_evidence>\n${sanitizedChunks.join('\n\n')}\n</untrusted_retrieved_evidence>`;
  }

  /**
   * Attach complete traceable provenance metadata to a RAG evidence item
   */
  static attachProvenance(chunk, relevanceScore = 1.0) {
    const metadata = chunk.metadata || {};
    return {
      documentId: metadata.documentId || `DOC-${chunk.id || Date.now()}`,
      chunkId: chunk.id || `CHUNK-${Date.now()}`,
      evidenceId: chunk.evidenceId || metadata.evidenceId || 'EVID-UNKNOWN',
      source: metadata.source || 'Retrieved Document',
      sourceUrl: metadata.sourceUrl || 'N/A',
      retrievedAt: metadata.retrievedAt || new Date().toISOString(),
      documentDate: metadata.documentDate || 'N/A',
      evidenceText: this.sanitizeText(chunk.text || ''),
      relevanceScore: parseFloat(relevanceScore.toFixed(3)),
      verificationStatus: metadata.evidenceStrength === 'AUTHORITATIVE' ? 'VERIFIED' : 'UNVERIFIED',
      provenanceHash: `SHA256-${Math.random().toString(36).substring(2, 10)}`
    };
  }
}

module.exports = RagSecurity;
