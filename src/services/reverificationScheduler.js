/**
 * Agent 18 - Reverification Scheduler Engine
 * Manages background periodic reverification schedules for high-risk, conflicting,
 * and near-expiry cached journal verification records.
 */

class ReverificationScheduler {
  constructor() {
    this.schedules = new Map();
  }

  /**
   * Register a journal for periodic reverification
   */
  schedule(journalId, interval = 'WEEKLY', metadata = {}) {
    const record = {
      journalId,
      interval,
      scheduledAt: new Date().toISOString(),
      lastReverifiedAt: null,
      priority: metadata.riskLevel === 'HIGH' ? 'HIGH' : 'NORMAL',
      metadata
    };

    this.schedules.set(journalId, record);
    return record;
  }

  /**
   * Get all active reverification schedules
   */
  getSchedules() {
    return Array.from(this.schedules.values());
  }

  /**
   * Execute immediate manual re-verification of a specific journal
   */
  async reverifyNow(verificationController, queryInput) {
    if (!verificationController || !queryInput) {
      throw new Error('VerificationController instance and query input are required for re-verification.');
    }

    // Force live or partial fresh fetch
    const freshInput = typeof queryInput === 'string' ? { journalName: queryInput } : { ...queryInput };
    freshInput.forceRefresh = true;

    const result = await verificationController.verify(freshInput);

    // Update schedule record if registered
    const jId = result.jsonContract.journalIdentity.canonicalJournalId;
    if (this.schedules.has(jId)) {
      const sched = this.schedules.get(jId);
      sched.lastReverifiedAt = new Date().toISOString();
      this.schedules.set(jId, sched);
    }

    return result;
  }
}

module.exports = new ReverificationScheduler();
