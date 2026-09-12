/**
 * Agent 18 - Embedding Engine Service
 * Generates vector embeddings using OpenAI API when configured,
 * or falls back to a deterministic local TF-IDF vectorizer (pure JS).
 */

class EmbeddingEngine {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || null;
    this.mode = this.apiKey ? 'OPENAI' : 'LOCAL_TFIDF';
  }

  getMode() {
    return this.mode;
  }

  /**
   * Generates embedding vector for a given string text.
   * Returns: { vector: number[], mode: string }
   */
  async embed(text) {
    if (!text || typeof text !== 'string') {
      text = '';
    }

    if (this.mode === 'OPENAI') {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            input: text,
            model: 'text-embedding-3-small'
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data[0] && data.data[0].embedding) {
            return {
              vector: data.data[0].embedding,
              mode: 'OPENAI'
            };
          }
        }
      } catch (err) {
        console.warn('[EmbeddingEngine] OpenAI embedding request failed, falling back to LOCAL_TFIDF:', err.message);
      }
    }

    // Local TF-IDF / Bag of Words Fallback (L2-normalized)
    const vector = this.createLocalTfidfVector(text);
    return {
      vector,
      mode: 'LOCAL_TFIDF'
    };
  }

  /**
   * Deterministic local TF-IDF / n-gram term frequency vector representation
   */
  createLocalTfidfVector(text) {
    const tokens = this.tokenize(text);
    const termFreqs = {};

    tokens.forEach(term => {
      termFreqs[term] = (termFreqs[term] || 0) + 1;
    });

    // Hash terms into fixed dimension space (128 dimensions for efficiency)
    const DIMENSIONS = 128;
    const vector = new Array(DIMENSIONS).fill(0);

    Object.keys(termFreqs).forEach(term => {
      const hash = this.simpleHash(term);
      const index = Math.abs(hash) % DIMENSIONS;
      const tf = Math.log(1 + termFreqs[term]); // Sublinear TF scaling
      vector[index] += tf;
    });

    // L2 Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }

    return vector;
  }

  tokenize(text) {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const unigrams = normalized.split(/\s+/).filter(w => w.length > 2);
    
    // Add bigrams for context phrase capture
    const bigrams = [];
    for (let i = 0; i < unigrams.length - 1; i++) {
      bigrams.push(`${unigrams[i]}_${unigrams[i + 1]}`);
    }

    return [...unigrams, ...bigrams];
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash;
  }

  /**
   * Cosine Similarity calculation between two numerical vectors
   */
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dotProduct / denom;
  }
}

module.exports = new EmbeddingEngine();
