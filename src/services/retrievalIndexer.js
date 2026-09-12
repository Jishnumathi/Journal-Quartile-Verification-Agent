/**
 * Agent 18 - Retrieval Indexer Service
 * Converts fetched metadata, adapter outputs, publisher extracts, and evidence ledger items
 * into tagged, vector-embedded document chunks stored in the VectorStore.
 */

const embeddingEngine = require('./embeddingEngine');
const vectorStore = require('./vectorStore');

class RetrievalIndexer {
  /**
   * Index evidence items and adapter outputs from a verification run
   */
  static async indexRunData(journalIdentity, adapterResults = [], evidenceLedger = [], cfpClaims = []) {
    const chunks = [];
    const journalId = journalIdentity?.canonicalJournalId || 'UNKNOWN';

    // 1. Index Evidence Ledger items
    for (const item of evidenceLedger) {
      const textToEmbed = `Evidence Item (${item.evidenceId}) from ${item.source} (${item.sourceType}): ${item.claim}. Status: ${item.status}. Authority Level: ${item.authority?.level || 'N/A'}.`;
      const { vector, mode } = await embeddingEngine.embed(textToEmbed);

      chunks.push({
        id: `CHUNK-EVID-${item.evidenceId}`,
        evidenceId: item.evidenceId,
        text: textToEmbed,
        vector,
        metadata: {
          source: item.source,
          sourceType: item.sourceType,
          retrievedAt: item.retrievedAt || new Date().toISOString(),
          journalId,
          evidenceId: item.evidenceId,
          evidenceStrength: item.evidenceStrength || 'METADATA',
          embeddingMode: mode
        }
      });
    }

    // 2. Index raw adapter responses & extracts
    for (const res of adapterResults) {
      if (res.status === 'AVAILABLE' || res.status === 'MOCK') {
        const title = res.journal?.title || '';
        const publisher = res.journal?.publisher || '';
        const url = res.journal?.officialUrl || '';
        const metricsStr = (res.metrics || []).map(m => `${m.database} ${m.metric}: ${m.value || m.quartile || 'N/A'} (${m.year})`).join(', ');

        const text = `${res.source} Metadata Extract: Title "${title}", Publisher "${publisher}", URL "${url}". Metrics: [${metricsStr}]. Status: ${res.status}.`;
        const { vector, mode } = await embeddingEngine.embed(text);

        chunks.push({
          id: `CHUNK-ADAPTER-${res.source}-${journalId}`,
          evidenceId: `ADAPTER-${res.source}`,
          text,
          vector,
          metadata: {
            source: res.source,
            sourceType: res.sourceType,
            retrievedAt: res.retrievedAt || new Date().toISOString(),
            journalId,
            evidenceId: `ADAPTER-${res.source}`,
            evidenceStrength: res.sourceType === 'PUBLISHER' ? 'PUBLISHER_CLAIM' : 'METADATA',
            embeddingMode: mode
          }
        });
      } else if (res.errors && res.errors.length > 0) {
        const errText = `${res.source} Adapter Log: Status ${res.status}. Errors: ${res.errors.join('; ')}`;
        const { vector, mode } = await embeddingEngine.embed(errText);

        chunks.push({
          id: `CHUNK-ERR-${res.source}-${Date.now()}`,
          evidenceId: `ERR-${res.source}`,
          text: errText,
          vector,
          metadata: {
            source: res.source,
            sourceType: res.sourceType,
            retrievedAt: res.retrievedAt || new Date().toISOString(),
            journalId,
            evidenceId: `ERR-${res.source}`,
            evidenceStrength: 'DISCOVERY',
            embeddingMode: mode
          }
        });
      }
    }

    // 3. Index Call for Papers (CFP) Claims
    for (let i = 0; i < cfpClaims.length; i++) {
      const cfp = cfpClaims[i];
      const cfpText = `CFP Text Claim (${i + 1}): "${cfp.claim}". Extracted Metric: ${cfp.metric || 'N/A'}, Quartile: ${cfp.quartile || 'N/A'}, Database: ${cfp.database || 'N/A'}.`;
      const { vector, mode } = await embeddingEngine.embed(cfpText);

      chunks.push({
        id: `CHUNK-CFP-${i + 1}-${journalId}`,
        evidenceId: `CFP-CLAIM-${i + 1}`,
        text: cfpText,
        vector,
        metadata: {
          source: 'User CFP Input',
          sourceType: 'UNVERIFIED_TEXT',
          retrievedAt: new Date().toISOString(),
          journalId,
          evidenceId: `CFP-CLAIM-${i + 1}`,
          evidenceStrength: 'DISCOVERY',
          embeddingMode: mode
        }
      });
    }

    // Persist chunks to VectorStore
    await vectorStore.upsertChunks(chunks);

    // If journal was resolved with verified/partially verified status, persist to journal cache
    if (journalIdentity && journalIdentity.canonicalJournalId && journalIdentity.journalName) {
      const cacheText = `Journal Cache Record: ${journalIdentity.journalName} (ISSN: ${journalIdentity.issn || 'N/A'}, eISSN: ${journalIdentity.eissn || 'N/A'}). Publisher: ${journalIdentity.publisher || 'N/A'}.`;
      const { vector } = await embeddingEngine.embed(cacheText);

      await vectorStore.saveJournalCacheRecord({
        journalId: journalIdentity.canonicalJournalId,
        journalName: journalIdentity.journalName,
        issn: journalIdentity.issn,
        eissn: journalIdentity.eissn,
        publisher: journalIdentity.publisher,
        officialUrl: journalIdentity.officialUrl,
        identityConfidence: journalIdentity.identityConfidence,
        identityStatus: journalIdentity.identityStatus,
        vector,
        resolvedAt: new Date().toISOString()
      });
    }

    return chunks;
  }
}

module.exports = RetrievalIndexer;
