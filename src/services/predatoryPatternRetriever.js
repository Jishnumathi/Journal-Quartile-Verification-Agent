/**
 * Agent 18 - Predatory Pattern Reference Retriever
 * Matches CFP text and publisher statements against curated predatory-journal indicator patterns
 * using embedding similarity. Matches are returned strictly at DISCOVERY evidence strength.
 */

const predatoryPatterns = require('../data/predatoryPatterns.json');
const embeddingEngine = require('./embeddingEngine');

class PredatoryPatternRetriever {
  constructor() {
    this.embeddedPatterns = null;
  }

  async initialize() {
    if (this.embeddedPatterns) return;

    this.embeddedPatterns = [];
    for (const pattern of predatoryPatterns) {
      const { vector } = await embeddingEngine.embed(`${pattern.category} ${pattern.pattern} ${pattern.description}`);
      this.embeddedPatterns.push({
        ...pattern,
        vector
      });
    }
  }

  /**
   * Retrieve matching predatory pattern indicators against input text (CFP text or publisher claims)
   */
  async matchPatterns(inputText) {
    if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
      return [];
    }

    await this.initialize();

    const { vector: queryVector } = await embeddingEngine.embed(inputText);
    const matches = [];

    for (const pattern of this.embeddedPatterns) {
      const sim = embeddingEngine.constructor.cosineSimilarity(queryVector, pattern.vector);
      // High threshold for vector match (>= 0.50) to prevent false positives
      if (sim >= 0.50) {
        matches.push({
          patternId: pattern.id,
          category: pattern.category,
          similarity: sim,
          code: `PRED_PATTERN_${pattern.category}`,
          severity: 'MEDIUM',
          scoreImpact: 10,
          description: `[RAG DISCOVERY] Matched known indicator pattern "${pattern.category}": ${pattern.description} (Source: ${pattern.sourceRef}).`,
          evidenceStrength: 'DISCOVERY',
          evidenceId: pattern.id
        });
      }
    }

    return matches;
  }
}

module.exports = new PredatoryPatternRetriever();
