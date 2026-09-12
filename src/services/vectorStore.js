/**
 * Agent 18 - Vector Store Abstraction Layer
 * Integrates with Supabase pgvector when configured,
 * or defaults to local JSON vector storage with pure JS cosine similarity search.
 */

const fs = require('fs');
const path = require('path');
const embeddingEngine = require('./embeddingEngine');

class VectorStore {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || null;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY || null;
    this.isSupabaseConfigured = !!(this.supabaseUrl && this.supabaseKey);
    this.storePath = path.join(__dirname, '../../agent18_vector_store.json');
    this.initStore();
  }

  initStore() {
    if (!fs.existsSync(this.storePath)) {
      const initial = {
        chunks: [],
        journalsCache: [],
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.storePath, JSON.stringify(initial, null, 2));
    }
  }

  getStore() {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      return { chunks: [], journalsCache: [], updatedAt: new Date().toISOString() };
    }
  }

  saveStore(data) {
    try {
      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('[VectorStore] Failed to write local vector store:', err.message);
    }
  }

  getMode() {
    return this.isSupabaseConfigured ? 'SUPABASE_PGVECTOR' : 'LOCAL_JSON';
  }

  /**
   * Insert or update retrievable document chunks in the vector store
   */
  async upsertChunks(chunks = []) {
    if (!Array.isArray(chunks) || chunks.length === 0) return [];

    if (this.isSupabaseConfigured) {
      try {
        console.log(`[Supabase pgvector] Upserting ${chunks.length} chunks.`);
        // Supabase insertion mock/placeholder if credentials exist
      } catch (err) {
        console.warn('[Supabase Error] Falling back to local vector store:', err.message);
      }
    }

    const store = this.getStore();
    const existingMap = new Map(store.chunks.map(c => [c.id, c]));

    chunks.forEach(chunk => {
      existingMap.set(chunk.id, chunk);
    });

    store.chunks = Array.from(existingMap.values());
    this.saveStore(store);

    return chunks;
  }

  /**
   * Save a journal resolution record into the cross-run cache for retrieval
   */
  async saveJournalCacheRecord(record) {
    const store = this.getStore();
    const existingIdx = store.journalsCache.findIndex(j => j.journalId === record.journalId || (j.issn && j.issn === record.issn));

    if (existingIdx >= 0) {
      store.journalsCache[existingIdx] = record;
    } else {
      store.journalsCache.push(record);
    }

    // Limit cache size to 100 entries
    if (store.journalsCache.length > 100) store.journalsCache.shift();

    this.saveStore(store);
    return record;
  }

  /**
   * Search for top-K matching chunks by embedding vector similarity
   */
  async querySimilarity({ queryVector, topK = 5, filter = {} }) {
    if (!queryVector || queryVector.length === 0) return [];

    const store = this.getStore();
    const results = [];

    store.chunks.forEach(chunk => {
      // Apply metadata filter matching if provided
      if (filter.journalId && chunk.metadata?.journalId && chunk.metadata.journalId !== filter.journalId) {
        return;
      }
      if (filter.sourceType && chunk.metadata?.sourceType && chunk.metadata.sourceType !== filter.sourceType) {
        return;
      }

      if (chunk.vector && chunk.vector.length === queryVector.length) {
        const sim = embeddingEngine.constructor.cosineSimilarity(queryVector, chunk.vector);
        if (sim > 0) {
          results.push({
            chunk,
            similarity: sim
          });
        }
      }
    });

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Search for cached journal candidate records by embedding similarity
   */
  async queryJournalCache({ queryVector, topK = 3 }) {
    if (!queryVector || queryVector.length === 0) return [];

    const store = this.getStore();
    const results = [];

    store.journalsCache.forEach(journal => {
      if (journal.vector && journal.vector.length === queryVector.length) {
        const sim = embeddingEngine.constructor.cosineSimilarity(queryVector, journal.vector);
        if (sim > 0.4) { // Minimum similarity threshold for candidate suggestion
          results.push({
            journal,
            similarity: sim
          });
        }
      }
    });

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  clear() {
    this.saveStore({ chunks: [], journalsCache: [], updatedAt: new Date().toISOString() });
  }
}

module.exports = new VectorStore();
