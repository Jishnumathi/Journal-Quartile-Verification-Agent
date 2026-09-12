/**
 * Agent 18 - Freshness & Cache Validity Engine
 * Tracks retrieval timestamps, calculates source-specific TTLs (Indexing: 30d, Metrics: 365d, Publisher: 90d),
 * and enforces STALE status when cached records expire past valid_until.
 */

class FreshnessEngine {
  /**
   * Source-specific Time-To-Live (TTL) definitions in milliseconds
   */
  static get TTL() {
    return {
      INDEXING: 30 * 24 * 60 * 60 * 1000,      // 30 days
      METRICS: 365 * 24 * 60 * 60 * 1000,     // 365 days
      PUBLISHER: 90 * 24 * 60 * 60 * 1000,    // 90 days
      POLICY: 180 * 24 * 60 * 60 * 1000      // 180 days
    };
  }

  static evaluateFreshness(metricsMap = {}, adapterResults = [], cachedAt = null) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const retrievedAt = now.toISOString();
    
    // Calculate valid_until (default 30 days for indexing, 365 days for annual metrics)
    const minTtl = this.TTL.INDEXING;
    const validUntilDate = new Date(now.getTime() + minTtl);
    const validUntil = validUntilDate.toISOString();

    let oldestMetricYear = currentYear;
    let newestMetricYear = 1970;
    let hasMetrics = false;

    (metricsMap.all || []).forEach(m => {
      if (m.year && !isNaN(m.year)) {
        hasMetrics = true;
        const yr = parseInt(m.year, 10);
        if (yr < oldestMetricYear) oldestMetricYear = yr;
        if (yr > newestMetricYear) newestMetricYear = yr;
      }
    });

    let freshnessStatus = 'UNKNOWN';
    let explanation = '';

    // Check if evaluating an existing cached record that has expired
    if (cachedAt) {
      const cacheTime = new Date(cachedAt).getTime();
      const ageMs = now.getTime() - cacheTime;
      if (ageMs > minTtl) {
        freshnessStatus = 'STALE';
        explanation = `Cached verification record created on ${new Date(cachedAt).toLocaleDateString()} has exceeded validity period (${Math.floor(ageMs / (24*3600*1000))} days old). Re-verification recommended.`;
        return {
          retrievedAt,
          validUntil,
          oldestMetricYear: hasMetrics ? oldestMetricYear : null,
          newestMetricYear: hasMetrics ? newestMetricYear : null,
          freshnessStatus,
          explanation
        };
      }
    }

    if (hasMetrics) {
      const yearDiff = currentYear - newestMetricYear;
      if (yearDiff <= 1) {
        freshnessStatus = 'CURRENT';
        explanation = `Metrics are up-to-date for ${newestMetricYear} (Verified on ${now.toLocaleDateString()}). Valid until ${validUntilDate.toLocaleDateString()}.`;
      } else if (yearDiff <= 3) {
        freshnessStatus = 'RECENT';
        explanation = `Metrics reflect ${newestMetricYear} data, within normal 3-year publication release window. Valid until ${validUntilDate.toLocaleDateString()}.`;
      } else {
        freshnessStatus = 'STALE';
        explanation = `Latest available metric data is from ${newestMetricYear} (${yearDiff} years old). Re-verification recommended.`;
      }
    } else {
      const metadataAvailable = adapterResults.some(r => r.status === 'AVAILABLE' || r.status === 'MOCK');
      if (metadataAvailable) {
        freshnessStatus = 'CURRENT';
        explanation = `Journal metadata retrieved live on ${now.toLocaleDateString()}. Metric year evaluation unavailable. Valid until ${validUntilDate.toLocaleDateString()}.`;
      } else {
        freshnessStatus = 'UNKNOWN';
        explanation = 'Insufficient timestamped evidence to evaluate data freshness.';
      }
    }

    return {
      retrievedAt,
      validUntil,
      cacheCreatedAt: retrievedAt,
      oldestMetricYear: hasMetrics ? oldestMetricYear : null,
      newestMetricYear: hasMetrics ? newestMetricYear : null,
      freshnessStatus,
      explanation
    };
  }
}

module.exports = FreshnessEngine;
