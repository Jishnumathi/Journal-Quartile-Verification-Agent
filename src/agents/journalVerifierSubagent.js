/**
 * Agent 18 — Journal Verifier Subagent Wrapper
 * Implements Section 4, 6, and 7 specifications of the Master Prompt.
 * Exposes Agent 18 capabilities as an autonomous subagent for the College Agent.
 * Handles subagent tool schemas, multi-agent message contracts, task execution,
 * evidence compilation, and structured subagent execution traces.
 */

const VerificationController = require('../services/verificationController');
const alternativeJournalEngine = require('../services/alternativeJournalEngine');
const EvidenceLedgerService = require('../services/evidenceLedgerService');

class JournalVerifierSubagent {
  constructor() {
    this.agentId = 'AGENT_18';
    this.subagentName = 'Journal Quartile Verification Agent';
    this.version = '1.0.0';
    this.authority = 'VERIFICATION_SPECIALIST';
    this.verifier = new VerificationController();
  }

  /**
   * Returns metadata and capability matrix of this subagent (Section 4).
   */
  getMetadata() {
    return this.getCapabilities();
  }

  getCapabilities() {
    return {
      agentId: this.agentId,
      subagentName: this.subagentName,
      version: this.version,
      authority: this.authority,
      parentAgentType: 'College Agent',
      description: 'Verifies indexing status, quartiles, metrics, risk factors, and policy compliance for academic publication venues.',
      supportedTasks: [
        'VERIFY_FACULTY_PUBLICATION',
        'AUDIT_DEPARTMENT_PUBLICATIONS',
        'PRE_SUBMISSION_CHECK',
        'GRANT_COMPLIANCE_EVALUATION'
      ],
      supportedOutputs: [
        'STRUCTURED_JSON_CONTRACT',
        'EVIDENCE_LEDGER',
        'MARKDOWN_VERIFICATION_REPORT',
        'EXECUTION_TRACE'
      ],
      capabilities: [
        'JOURNAL_IDENTITY_VERIFICATION',
        'QUARTILE_LOOKUP_JCR_SCOPUS_SJR',
        'PREDATORY_RISK_DETECTION',
        'INSTITUTIONAL_POLICY_EVALUATION',
        'ALTERNATIVE_VENUE_RECOMMENDATION',
        'FACULTY_DOSSIER_CHECK',
        'DEPARTMENT_PUBLICATIONS_AUDIT',
        'GRANT_COMPLIANCE_CLEARANCE'
      ]
    };
  }

  /**
   * Exposes 9 standard OpenAI/Gemini/Antigravity function calling schemas (Section 6).
   */
  getToolSchemas() {
    return [
      {
        name: 'verify_journal_identity',
        description: 'Verify canonical identity, print/electronic ISSNs, publisher, and official URL.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string', description: 'Title of the journal' },
            issn: { type: 'string', description: 'Print ISSN (e.g. 0028-0836)' },
            eissn: { type: 'string', description: 'Electronic ISSN' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'evaluate_college_policy',
        description: 'Evaluate institutional college requirements against journal metrics.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' },
            policy: { type: 'object', description: 'Configurable institutional policy object' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'find_q1_q2_alternatives',
        description: 'Suggest verified Q1/Q2 alternative journals for a specific subject area.',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Subject domain (e.g., Computer Science)' }
          },
          required: ['category']
        }
      },
      {
        name: 'audit_faculty_publication',
        description: 'Evaluate a faculty publication claim for promotion, tenure, or college research incentives.',
        parameters: {
          type: 'object',
          properties: {
            facultyName: { type: 'string' },
            department: { type: 'string' },
            publicationTitle: { type: 'string' },
            journalName: { type: 'string' },
            issn: { type: 'string' }
          },
          required: ['facultyName', 'journalName']
        }
      },
      {
        name: 'verify_indexing_status',
        description: 'Check live indexing status in Web of Science and Scopus.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' },
            issn: { type: 'string' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'verify_quartile',
        description: 'Retrieve quartiles from JCR and Scopus CiteScore structured by database, year, and subject category.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' },
            category: { type: 'string' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'retrieve_journal_metrics',
        description: 'Collect Impact Factor, CiteScore, SJR, and acceptance rate with provenance labeling.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'screen_journal_risk',
        description: 'Screen journal against 14 predatory and questionable publisher signals.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' },
            issn: { type: 'string' }
          },
          required: ['journalName']
        }
      },
      {
        name: 'retrieve_evidence',
        description: 'Compile evidence ledger entries with checkedAt timestamps and confidence scores.',
        parameters: {
          type: 'object',
          properties: {
            journalName: { type: 'string' }
          },
          required: ['journalName']
        }
      }
    ];
  }

  /**
   * Helper to extract primary quartile from contract metrics.
   */
  _extractQuartile(contract) {
    if (!contract || !contract.metrics) return null;
    if (contract.metrics.jcr?.quartile) return contract.metrics.jcr.quartile;
    if (contract.metrics.citescore?.quartile) return contract.metrics.citescore.quartile;
    if (contract.metrics.sjr?.quartile) return contract.metrics.sjr.quartile;
    if (Array.isArray(contract.metrics.all) && contract.metrics.all.length > 0) {
      const q = contract.metrics.all.find(m => m.quartile);
      if (q) return q.quartile;
    }
    return null;
  }

  /**
   * Helper to evaluate if a journal is institutionally approved.
   */
  _isApprovedVenue(contract, primaryQuartile, riskLevel) {
    if (!contract) return false;

    // Completely unverified or missing records are rejected
    if (contract.status === 'NOT_VERIFIED' || 
        contract.status === 'UNAVAILABLE' || 
        contract.journalIdentity?.identityStatus === 'NOT_FOUND') {
      return false;
    }

    // Explicit institutional approved venue registry override (Nature, IEEE TPAMI)
    if (contract.policyEvaluation?.onApprovedList === true || contract.policyEvaluation?.isInstitutionallyAccepted === true) {
      return true;
    }

    // Conflicting metadata, ambiguous identity, or high risk without approved list inclusion
    if (contract.status === 'CONFLICTING' || 
        contract.status === 'AMBIGUOUS' || 
        riskLevel === 'HIGH' || 
        riskLevel === 'CRITICAL') {
      return false;
    }

    // Verified Q1 or Q2 tier journal
    if ((contract.status === 'VERIFIED' || contract.status === 'PARTIALLY_VERIFIED') && (primaryQuartile === 'Q1' || primaryQuartile === 'Q2')) {
      return true;
    }

    // Verified journal satisfying institutional policy
    if ((contract.status === 'VERIFIED' || contract.status === 'PARTIALLY_VERIFIED') && contract.policyEvaluation?.status === 'SATISFIED') {
      return true;
    }

    return false;
  }

  /**
   * Builds the Section 7 Standardized Subagent Response Contract object.
   */
  _buildSection7Contract(taskId, taskType, startedAt, rawVerification, customResult = {}) {
    const c = rawVerification.jsonContract;
    const completedAt = new Date().toISOString();
    const primaryQuartile = this._extractQuartile(c);
    const riskLevel = c.risk?.riskLevel || 'UNKNOWN';

    // Format Evidence Ledger (Section 8)
    const normalizedEvidence = EvidenceLedgerService.normalizeLedger(c.evidence || []);

    return {
      agent: {
        id: this.agentId,
        name: this.subagentName,
        version: this.version,
        authority: this.authority
      },
      execution: {
        taskId,
        taskType,
        status: 'COMPLETED',
        startedAt,
        completedAt
      },
      journal: {
        name: c.journalIdentity?.journalName || 'Unknown Journal',
        canonicalName: c.journalIdentity?.canonicalName || c.journalIdentity?.journalName || 'Unknown Journal',
        issn: c.journalIdentity?.issn || null,
        eissn: c.journalIdentity?.eissn || null,
        publisher: c.journalIdentity?.publisher || 'Unknown Publisher',
        identityConfidence: (c.journalIdentity?.confidence || 90) / 100
      },
      indexing: {
        scopus: c.indexing?.scopus || { activeCoverage: false, source: 'Scopus' },
        webOfScience: c.indexing?.webOfScience || { activeCoverage: false, source: 'Web of Science' }
      },
      quartiles: {
        jcr: c.metrics?.jcrCategories || (c.metrics?.jcr ? [c.metrics.jcr] : []),
        citescore: c.metrics?.citescoreCategories || (c.metrics?.citescore ? [c.metrics.citescore] : [])
      },
      metrics: {
        impactFactor: c.metrics?.jcr?.value || null,
        citeScore: c.metrics?.citescore?.value || null,
        sjr: c.metrics?.sjr?.value || null,
        acceptanceRate: c.journalIdentity?.acceptanceRate || null
      },
      risk: {
        level: riskLevel,
        flags: (c.risk?.riskFactors || []).map(r => ({ code: r.code, severity: r.severity, description: r.description }))
      },
      recommendation: {
        status: customResult.verdict || (c.status === 'VERIFIED' ? 'SUITABLE' : 'NEEDS_HUMAN_REVIEW'),
        reason: customResult.recommendationReason || c.recommendation || 'Verification complete.'
      },
      evidenceLedger: normalizedEvidence,
      cache: {
        verifiedAt: c.verifiedAt || startedAt,
        validUntil: c.validUntil || new Date(Date.now() + 30 * 86400000).toISOString(),
        cacheStatus: c.freshness?.freshnessStatus === 'STALE' ? 'EXPIRED' : 'VALID'
      },
      // Backwards-compatible result payload for College Agent
      result: {
        verdict: customResult.verdict || 'APPROVED',
        incentivePoints: customResult.incentivePoints ?? 100,
        recommendationReason: customResult.recommendationReason || 'Verified',
        primaryQuartile: primaryQuartile || 'UNRANKED',
        riskLevel,
        targetApproved: customResult.targetApproved ?? true,
        alternativeVenues: customResult.alternativeVenues || [],
        contract: c
      }
    };
  }

  /**
   * Main task execution interface invoked by the College Agent.
   */
  async executeSubagentTask(taskPayload = {}) {
    const startedAt = new Date().toISOString();
    const taskId = taskPayload.taskId || `TASK-SUB18-${Date.now()}`;
    const taskType = taskPayload.taskType || taskPayload.type || 'VERIFY_FACULTY_PUBLICATION';
    const callingAgent = taskPayload.callingAgent || 'College Agent Main Orchestrator';
    const payload = taskPayload.payload || taskPayload.context || taskPayload;

    const trace = [];
    const addTraceStep = (action, details) => {
      trace.push({
        stepIndex: trace.length + 1,
        timestamp: new Date().toISOString(),
        subagent: this.subagentName,
        action,
        details
      });
    };

    addTraceStep('SUBAGENT_INITIALIZATION', `Task "${taskType}" received from "${callingAgent}". Task ID: ${taskId}`);

    try {
      let subagentContract = null;

      switch (taskType) {
        case 'FACULTY_PROMOTION_DOSSIER':
        case 'FACULTY_PROMOTION_VERIFICATION':
        case 'VERIFY_FACULTY_PUBLICATION':
          subagentContract = await this._handleFacultyPublicationTask(payload, taskId, taskType, startedAt, addTraceStep);
          break;

        case 'PRE_SUBMISSION_CHECK':
          subagentContract = await this._handlePreSubmissionCheckTask(payload, taskId, taskType, startedAt, addTraceStep);
          break;

        case 'DEPARTMENT_AUDIT_BATCH':
        case 'AUDIT_DEPARTMENT_PUBLICATIONS':
          subagentContract = await this._handleDepartmentAuditTask(payload, taskId, taskType, startedAt, addTraceStep);
          break;

        case 'GRANT_COMPLIANCE_EVALUATION':
        case 'GRANT_COMPLIANCE_CHECK':
          subagentContract = await this._handleGrantComplianceTask(payload, taskId, taskType, startedAt, addTraceStep);
          break;

        default:
          addTraceStep('FALLBACK_VERIFICATION', 'Invoking standard Agent 18 verification controller');
          const rawVerification = await this.verifier.verify(payload);
          subagentContract = this._buildSection7Contract(taskId, taskType, startedAt, rawVerification);
      }

      addTraceStep('SUBAGENT_COMPLETED', `Task successfully executed with verdict: ${subagentContract.recommendation.status}`);

      subagentContract.subagentId = this.agentId;
      subagentContract.subagentName = this.subagentName;
      subagentContract.taskId = taskId;
      subagentContract.taskType = taskType;
      subagentContract.status = 'SUCCESS';
      subagentContract.executedAt = new Date().toISOString();
      subagentContract.executionTrace = trace;

      return subagentContract;

    } catch (error) {
      addTraceStep('SUBAGENT_ERROR', `Execution failed: ${error.message}`);
      return {
        agent: { id: this.agentId, name: this.subagentName, version: this.version, authority: this.authority },
        execution: { taskId, taskType, status: 'FAILED', startedAt, completedAt: new Date().toISOString() },
        subagentId: this.agentId,
        subagentName: this.subagentName,
        taskId,
        taskType,
        status: 'ERROR',
        executedAt: new Date().toISOString(),
        executionTrace: trace,
        error: error.message
      };
    }
  }

  // --- Subagent Task Handlers ---

  async _handleFacultyPublicationTask(payload, taskId, taskType, startedAt, addTraceStep) {
    const facultyName = payload.facultyName || 'Faculty Candidate';
    const department = payload.department || 'Academic Department';
    const manuscriptTitle = payload.manuscriptTitle || payload.publicationTitle || 'Submitted Research Manuscript';
    const claimType = payload.claimType || 'PROMOTION';

    addTraceStep('PARSING_FACULTY_DOSSIER', `Parsing publication claim for ${facultyName} (${department}) - ${claimType}`);

    const rawResult = await this.verifier.verify({
      journalName: payload.journalName,
      issn: payload.issn,
      eissn: payload.eissn,
      institutionalPolicy: payload.institutionalPolicy || 'JCR Q1 or Scopus Q1 required'
    });

    const contract = rawResult.jsonContract;
    const primaryQuartile = this._extractQuartile(contract);
    const riskLevel = contract.risk?.riskLevel || 'LOW';

    addTraceStep('IDENTITY_RESOLVED', `Journal resolved: "${contract.journalIdentity.journalName}" (ISSN: ${contract.journalIdentity.issn || 'N/A'})`);
    addTraceStep('QUARTILE_EVALUATED', `Primary Quartile: ${primaryQuartile || 'N/A'}, JCR: ${contract.metrics.jcr?.quartile || 'N/A'}, Scopus: ${contract.metrics.citescore?.quartile || 'N/A'}`);
    addTraceStep('RISK_ASSESSED', `Overall Risk Score: ${contract.risk.overallRiskScore || 0}/100 (${riskLevel})`);

    const isApproved = this._isApprovedVenue(contract, primaryQuartile, riskLevel);
    addTraceStep('POLICY_CHECKED', `Approval Verdict: ${isApproved ? 'APPROVED' : 'REJECTED'} - Approved Venue: ${contract.policyEvaluation?.isInstitutionallyAccepted || false}`);

    let collegeRecommendation = 'APPROVED';
    let incentivePoints = 100;
    let recommendationReason = '';

    if (isApproved) {
      collegeRecommendation = 'APPROVED';
      incentivePoints = primaryQuartile === 'Q1' ? 150 : 100;
      recommendationReason = `Journal is verified (${primaryQuartile || 'Approved Venue'}) and satisfies college institutional policy requirements.`;
    } else if (primaryQuartile === 'Q3' || primaryQuartile === 'Q4') {
      collegeRecommendation = 'NEEDS_REVIEW';
      incentivePoints = 50;
      recommendationReason = `Journal is indexed as ${primaryQuartile}, but does not strictly satisfy institutional policy requirement (Q1/Q2 required).`;
    } else {
      collegeRecommendation = 'REJECTED';
      incentivePoints = 0;
      recommendationReason = `Publication venue is unindexed, conflicting, unverified, or unranked (${riskLevel} risk level). Fails institutional promotion integrity standard.`;
    }

    return this._buildSection7Contract(taskId, taskType, startedAt, rawResult, {
      verdict: collegeRecommendation,
      incentivePoints,
      recommendationReason,
      facultyName,
      department,
      manuscriptTitle
    });
  }

  async _handlePreSubmissionCheckTask(payload, taskId, taskType, startedAt, addTraceStep) {
    addTraceStep('PRE_SUBMISSION_ANALYSIS', `Checking target journal "${payload.journalName}" prior to paper submission`);

    const rawResult = await this.verifier.verify({
      journalName: payload.journalName,
      issn: payload.issn,
      institutionalPolicy: payload.institutionalPolicy || 'JCR Q1 or Scopus Q1 required'
    });

    const contract = rawResult.jsonContract;
    const primaryQuartile = this._extractQuartile(contract);
    const riskLevel = contract.risk?.riskLevel || 'LOW';

    const targetApproved = this._isApprovedVenue(contract, primaryQuartile, riskLevel);
    addTraceStep('TARGET_VERIFIED', `Status: ${contract.status}, Quartile: ${primaryQuartile || 'N/A'}, Risk: ${riskLevel}, Approved: ${targetApproved}`);

    let alternatives = [];
    if (!targetApproved) {
      addTraceStep('GENERATING_ALTERNATIVES', `Target journal did not meet Q1/Q2 approval threshold. Fetching alternative venues.`);
      const altResult = alternativeJournalEngine.generateAlternatives(contract, contract.metrics, contract.risk, contract.status);
      alternatives = altResult.alternatives || [];
    }

    return this._buildSection7Contract(taskId, taskType, startedAt, rawResult, {
      targetApproved,
      verdict: targetApproved ? 'SUITABLE_FOR_SUBMISSION' : 'ALTERNATIVE_VENUES_RECOMMENDED',
      recommendationReason: targetApproved ? `Target journal ${contract.journalIdentity.journalName} is approved.` : `Target journal is problematic (${riskLevel} risk or unverified). Consider recommended alternatives.`,
      alternativeVenues: alternatives
    });
  }

  async _handleDepartmentAuditTask(payload, taskId, taskType, startedAt, addTraceStep) {
    const departmentName = payload.departmentName || payload.department || 'Department of Computer Science & Engineering';
    const publications = payload.publications || [
      { journalName: 'IEEE Transactions on Pattern Analysis and Machine Intelligence', issn: '0162-8828' },
      { journalName: 'Nature', issn: '0028-0836' },
      { journalName: 'International Journal of Advanced Research', issn: '2320-5407' }
    ];

    addTraceStep('DEPARTMENT_AUDIT_STARTED', `Auditing ${publications.length} publication records for ${departmentName}`);

    const auditResults = [];
    let q1Count = 0, q2Count = 0, q3Count = 0, q4Count = 0, unverifiedCount = 0, highRiskCount = 0;
    let lastRawRes = null;

    for (let i = 0; i < publications.length; i++) {
      const item = publications[i];
      addTraceStep('AUDITING_ITEM', `[${i + 1}/${publications.length}] Auditing "${item.journalName}"`);
      const rawRes = await this.verifier.verify({ journalName: item.journalName, issn: item.issn });
      lastRawRes = rawRes;
      const c = rawRes.jsonContract;

      const q = this._extractQuartile(c);
      const riskLevel = c.risk?.riskLevel || 'LOW';
      const isApproved = this._isApprovedVenue(c, q, riskLevel);

      if (!isApproved) {
        highRiskCount++;
        unverifiedCount++;
      } else if (q === 'Q1') {
        q1Count++;
      } else if (q === 'Q2') {
        q2Count++;
      } else if (q === 'Q3') {
        q3Count++;
      } else if (q === 'Q4') {
        q4Count++;
      } else {
        q1Count++;
      }

      auditResults.push({
        title: item.title || item.publicationTitle || `Paper #${i + 1}`,
        journalName: c.journalIdentity.journalName,
        issn: c.journalIdentity.issn,
        status: c.status,
        quartile: q || (isApproved ? 'Q1' : 'UNRANKED'),
        riskLevel,
        riskScore: c.risk?.overallRiskScore || 0
      });
    }

    const total = publications.length;
    const q1Percentage = Math.round((q1Count / total) * 100);
    const q1q2Percentage = Math.round(((q1Count + q2Count) / total) * 100);

    addTraceStep('AUDIT_METRICS_COMPILED', `Audit complete. Q1/Q2 share: ${q1q2Percentage}%, High Risk: ${highRiskCount}`);

    const sec7 = this._buildSection7Contract(taskId, taskType, startedAt, lastRawRes || await this.verifier.verify({ journalName: 'Nature' }), {
      verdict: 'AUDIT_COMPLETE',
      recommendationReason: `Audited ${total} publications for ${departmentName}. Q1/Q2 share: ${q1q2Percentage}%.`
    });

    sec7.result.departmentName = departmentName;
    sec7.result.totalPublicationsAudited = total;
    sec7.result.summaryQuartileBreakdown = { Q1: q1Count, Q2: q2Count, Q3: q3Count, Q4: q4Count, UnverifiedOrHighRisk: unverifiedCount };
    sec7.result.q1Percentage = q1Percentage;
    sec7.result.q1q2Percentage = q1q2Percentage;
    sec7.result.highRiskCount = highRiskCount;
    sec7.result.departmentQualityGrade = q1q2Percentage >= 70 ? 'EXCELLENT' : q1q2Percentage >= 50 ? 'GOOD' : 'NEEDS_IMPROVEMENT';
    sec7.result.auditedPublications = auditResults;

    return sec7;
  }

  async _handleGrantComplianceTask(payload, taskId, taskType, startedAt, addTraceStep) {
    const grantNumber = payload.grantNumber || 'GRANT-2026-NSF-8821';
    const funderName = payload.funderName || 'National Science Foundation / College Research Fund';
    
    addTraceStep('GRANT_EVALUATION', `Evaluating publication compliance for Grant ${grantNumber} (${funderName})`);

    const rawResult = await this.verifier.verify({
      journalName: payload.journalName,
      issn: payload.issn,
      institutionalPolicy: payload.institutionalPolicy || 'JCR Q1 or Scopus Q1 required'
    });

    const contract = rawResult.jsonContract;
    const primaryQuartile = this._extractQuartile(contract);
    const riskLevel = contract.risk?.riskLevel || 'LOW';

    const isCompliant = this._isApprovedVenue(contract, primaryQuartile, riskLevel);

    addTraceStep('GRANT_COMPLIANCE_VERDICT', `Compliance Status: ${isCompliant ? 'APPROVED_FOR_REIMBURSEMENT' : 'REIMBURSEMENT_DENIED'}`);

    return this._buildSection7Contract(taskId, taskType, startedAt, rawResult, {
      verdict: isCompliant ? 'GRANT_REIMBURSEMENT_APPROVED' : 'GRANT_REIMBURSEMENT_DENIED',
      recommendationReason: isCompliant
        ? `Journal ${contract.journalIdentity.journalName} is compliant with Grant ${grantNumber}.`
        : `Journal ${contract.journalIdentity.journalName} failed grant compliance checks (${riskLevel} risk).`
    });
  }
}

module.exports = JournalVerifierSubagent;
