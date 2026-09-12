/**
 * Agent 18 - Quartile & Metric Engine
 * Normalizes, formats, and isolates JCR, CiteScore, and SJR metrics without cross-contaminating systems.
 * Supports multi-category category-specific quartiles (e.g. Q1 in AI, Q2 in Theory).
 */

class QuartileEngine {
  /**
   * Format quartile display string according to Section 18 spec:
   * e.g., "JCR Q1 — 2025 — [Computer Science, Information Systems]"
   */
  static formatQuartileLabel(metricItem) {
    if (!metricItem || !metricItem.quartile) return 'N/A';
    const db = metricItem.database || 'Database';
    const q = metricItem.quartile;
    const yr = metricItem.year || new Date().getFullYear();
    const cat = metricItem.category || 'General';
    const m = metricItem.metric ? ` (${metricItem.metric})` : '';

    return `${db}${m} ${q} — ${yr} — [${cat}]`;
  }

  /**
   * Process all metrics collected across adapters and structure them by database system
   */
  static processMetrics(adapterResults = []) {
    const metricsMap = {
      jcr: null,
      jcrCategories: [],
      citescore: null,
      citescoreCategories: [],
      sjr: null,
      sjrCategories: [],
      all: []
    };

    adapterResults.forEach(res => {
      if (res.metrics && Array.isArray(res.metrics)) {
        res.metrics.forEach(m => {
          const formattedLabel = this.formatQuartileLabel(m);
          const normalized = {
            database: m.database,
            metric: m.metric,
            year: m.year,
            category: m.category,
            value: m.value,
            quartile: m.quartile,
            percentile: m.percentile,
            rank: m.rank,
            formattedLabel: formattedLabel,
            source: res.source,
            verificationDate: new Date().toISOString()
          };

          metricsMap.all.push(normalized);

          const dbLower = (m.database || '').toLowerCase();
          if (dbLower.includes('jcr') || (m.metric || '').toLowerCase().includes('jif')) {
            if (!metricsMap.jcr) metricsMap.jcr = normalized;
            metricsMap.jcrCategories.push(normalized);
          } else if (dbLower.includes('scopus') || (m.metric || '').toLowerCase().includes('citescore')) {
            if (!metricsMap.citescore) metricsMap.citescore = normalized;
            metricsMap.citescoreCategories.push(normalized);
          } else if (dbLower.includes('sjr') || dbLower.includes('scimago')) {
            if (!metricsMap.sjr) metricsMap.sjr = normalized;
            metricsMap.sjrCategories.push(normalized);
          }
        });
      }
    });

    return metricsMap;
  }
}

module.exports = QuartileEngine;
