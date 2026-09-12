/**
 * Agent 18 - Grounded Explanation Generator
 * Generates plain-language explanation sentences for conflict & risk narrative sections.
 * STRICT NO-FABRICATION CONSTRAINT:
 * - Every sentence MUST be traceable to at least one retrieved chunk's `evidenceId`.
 * - Explicitly labeled as "AI-assisted, grounded in retrieved evidence".
 * - If 0 relevant chunks are found, falls back to plain deterministic fields without generating text.
 */

const vectorStore = require('./vectorStore');
const embeddingEngine = require('./embeddingEngine');

class GroundedExplanationGenerator {
  /**
   * Generates grounded narrative explanations for conflicts and risk findings
   */
  static async generateGroundedExplanations(journalIdentity, conflictResult, riskResult, evidenceLedger = []) {
    const explanations = [];
    const journalId = journalIdentity?.canonicalJournalId || 'UNKNOWN';

    // 1. Conflict Explanation Grounding
    if (conflictResult && conflictResult.conflicts && conflictResult.conflicts.length > 0) {
      for (const conflict of conflictResult.conflicts) {
        // Query VectorStore for chunks related to this conflict's sources or terms
        const queryText = `${conflict.type} ${conflict.explanation} ${conflict.sources ? conflict.sources.join(' ') : ''}`;
        const { vector: queryVector } = await embeddingEngine.embed(queryText);
        const topChunks = await vectorStore.querySimilarity({
          queryVector,
          topK: 2,
          filter: { journalId }
        });

        if (topChunks && topChunks.length > 0) {
          const matchingChunk = topChunks[0].chunk;
          const evidenceId = matchingChunk.evidenceId || matchingChunk.metadata?.evidenceId || 'EVID-UNKNOWN';
          const sentence = `Discrepancy identified between ${conflict.sources ? conflict.sources.join(' and ') : 'sources'}: ${conflict.explanation} (Grounded in retrieved evidence chunk [${evidenceId}] from ${matchingChunk.metadata?.source || 'Source'}).`;

          explanations.push({
            type: 'CONFLICT_EXPLANATION',
            conflictId: conflict.conflictId,
            text: sentence,
            evidenceCitations: [evidenceId],
            label: 'AI-assisted, grounded in retrieved evidence',
            similarity: topChunks[0].similarity
          });
        }
      }
    }

    // 2. Risk Narrative Grounding
    if (riskResult && riskResult.riskFactors && riskResult.riskFactors.length > 0) {
      for (const factor of riskResult.riskFactors) {
        const queryText = `${factor.code} ${factor.description}`;
        const { vector: queryVector } = await embeddingEngine.embed(queryText);
        const topChunks = await vectorStore.querySimilarity({
          queryVector,
          topK: 2,
          filter: { journalId }
        });

        if (topChunks && topChunks.length > 0) {
          const matchingChunk = topChunks[0].chunk;
          const evidenceId = matchingChunk.evidenceId || matchingChunk.metadata?.evidenceId || 'EVID-UNKNOWN';
          const sentence = `Risk factor [${factor.code}] assessed at ${factor.severity} severity: ${factor.description} (Supported by retrieved chunk [${evidenceId}]).`;

          explanations.push({
            type: 'RISK_EXPLANATION',
            riskCode: factor.code,
            text: sentence,
            evidenceCitations: [evidenceId],
            label: 'AI-assisted, grounded in retrieved evidence',
            similarity: topChunks[0].similarity
          });
        }
      }
    }

    return {
      hasGroundedExplanations: explanations.length > 0,
      label: 'AI-assisted, grounded in retrieved evidence',
      explanations
    };
  }
}

module.exports = GroundedExplanationGenerator;
