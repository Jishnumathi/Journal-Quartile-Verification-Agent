/**
 * College Agent Orchestrator Service
 * Implements Section 9 & 10 specifications of the Master Prompt.
 * Manages the primary College Agent multi-agent workflow and applies configurable institutional policies.
 * Delegates journal verification subtasks to JournalVerifierSubagent (Agent 18).
 */

const JournalVerifierSubagent = require('../agents/journalVerifierSubagent');

class CollegeAgentOrchestrator {
  constructor() {
    this.agentId = 'COLLEGE_AGENT_MAIN';
    this.agentName = 'College Enterprise Academic Operations Agent';
    this.subagent = new JournalVerifierSubagent();
  }

  /**
   * Evaluates configurable institutional policy (Section 10).
   */
  evaluateInstitutionalPolicy(subagentResult, policyConfig = {}) {
    const defaultPolicy = {
      requiredIndexing: ['SCOPUS', 'WEB_OF_SCIENCE'],
      minimumQuartile: 'Q2',
      allowWebOfScience: true,
      allowUGC: true,
      requireCurrentVerification: true,
      maxCacheAgeDays: 30
    };

    const policy = { ...defaultPolicy, ...policyConfig };
    const contract = subagentResult.result?.contract || subagentResult.journal || {};
    const riskLevel = subagentResult.risk?.level || subagentResult.result?.riskLevel || 'LOW';
    const quartile = subagentResult.result?.primaryQuartile || 'UNRANKED';

    const evaluations = [];
    let compliant = true;

    const isApprovedList = subagentResult.result?.targetApproved || 
                           subagentResult.result?.verdict === 'APPROVED' || 
                           subagentResult.recommendation?.status === 'APPROVED' || 
                           contract.policyEvaluation?.isInstitutionallyAccepted === true || 
                           contract.policyEvaluation?.onApprovedList === true;

    // Rule 1: Risk Screening Check
    if ((riskLevel === 'HIGH' || riskLevel === 'CRITICAL') && !isApprovedList) {
      evaluations.push({ rule: 'Risk Screening Level', satisfied: false, detail: `Risk level ${riskLevel} exceeds safety limit.` });
      compliant = false;
    } else {
      evaluations.push({ rule: 'Risk Screening Level', satisfied: true, detail: `Risk level ${riskLevel} acceptable.` });
    }

    // Rule 2: Minimum Quartile Threshold
    const quartilesOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
    const minQuartileIdx = quartilesOrder.indexOf(policy.minimumQuartile);
    const actualQuartileIdx = quartilesOrder.indexOf(quartile);

    if (actualQuartileIdx !== -1 && minQuartileIdx !== -1 && actualQuartileIdx <= minQuartileIdx) {
      evaluations.push({ rule: `Minimum Quartile Threshold (${policy.minimumQuartile})`, satisfied: true, detail: `Journal quartile ${quartile} meets or exceeds ${policy.minimumQuartile}.` });
    } else if (subagentResult.result?.targetApproved) {
      evaluations.push({ rule: `Minimum Quartile Threshold (${policy.minimumQuartile})`, satisfied: true, detail: `Approved via institutional venue registry.` });
    } else {
      evaluations.push({ rule: `Minimum Quartile Threshold (${policy.minimumQuartile})`, satisfied: false, detail: `Quartile ${quartile} does not satisfy ${policy.minimumQuartile}.` });
      compliant = false;
    }

    // Rule 3: Cache Freshness Check
    const cacheStatus = subagentResult.cache?.cacheStatus || 'VALID';
    if (policy.requireCurrentVerification && cacheStatus === 'EXPIRED') {
      evaluations.push({ rule: 'Verification Freshness', satisfied: false, detail: 'Cached verification is EXPIRED. Reverification required.' });
      compliant = false;
    } else {
      evaluations.push({ rule: 'Verification Freshness', satisfied: true, detail: `Cache status: ${cacheStatus}` });
    }

    return {
      compliant,
      policyConfig: policy,
      evaluations,
      summary: compliant ? 'All institutional policy conditions satisfied.' : 'One or more policy constraints failed.'
    };
  }

  /**
   * Helper to delegate subtask to Agent 18 (Section 9 method 5).
   */
  async delegateToJournalVerifier(taskId, taskType, payload) {
    return await this.subagent.executeSubagentTask({
      taskId,
      taskType,
      callingAgent: this.agentName,
      payload
    });
  }

  /**
   * Synthesize decision (Section 9 method 6).
   */
  synthesizeDecision(workflowType, subagentResponse, policyConfig = {}) {
    if (subagentResponse.status !== 'SUCCESS' && subagentResponse.execution?.status !== 'COMPLETED') {
      return {
        status: 'FAILED',
        actionRequired: 'MANUAL_REVIEW_REQUIRED',
        summary: 'Subagent failed to complete journal verification task.'
      };
    }

    const policyEval = this.evaluateInstitutionalPolicy(subagentResponse, policyConfig);
    const res = subagentResponse.result || {};
    const recStatus = subagentResponse.recommendation?.status || res.verdict || 'APPROVED';

    if (workflowType === 'FACULTY_PROMOTION_DOSSIER' || workflowType === 'VERIFY_FACULTY_PUBLICATION') {
      const isApproved = recStatus === 'APPROVED' && policyEval.compliant;
      return {
        status: isApproved ? 'DOSSIER_APPROVED' : recStatus === 'NEEDS_REVIEW' ? 'PROVISIONAL_REVIEW' : 'DOSSIER_REJECTED',
        actionRequired: isApproved ? 'FORWARD_TO_DEAN' : recStatus === 'NEEDS_REVIEW' ? 'REFER_TO_PROMOTION_COMMITTEE' : 'RETURN_TO_CANDIDATE',
        incentiveAwarded: isApproved ? (res.incentivePoints || 100) : 0,
        policyEvaluation: policyEval,
        summary: isApproved ? `Publication claim approved under policy.` : `Dossier item failed policy requirements or verification.`
      };
    }

    if (workflowType === 'PRE_SUBMISSION_SCREENING' || workflowType === 'PRE_SUBMISSION_CHECK') {
      const isApproved = res.targetApproved && policyEval.compliant;
      return {
        status: isApproved ? 'TARGET_APPROVED' : 'TARGET_REJECTED',
        actionRequired: isApproved ? 'PROCEED_WITH_SUBMISSION' : 'REVIEW_ALTERNATIVE_VENUES',
        suggestedAlternatives: res.alternativeVenues || [],
        policyEvaluation: policyEval,
        summary: isApproved
          ? `Journal ${res.targetJournal || 'target'} is verified and suitable for manuscript submission.`
          : `Target journal is unsuitable. Review recommended alternatives.`
      };
    }

    if (workflowType === 'DEPARTMENT_AUDIT' || workflowType === 'AUDIT_DEPARTMENT_PUBLICATIONS') {
      return {
        status: 'AUDIT_COMPLETE',
        actionRequired: 'ARCHIVE_AUDIT_REPORT',
        grade: res.departmentQualityGrade || 'GOOD',
        q1q2Percentage: res.q1q2Percentage || 0,
        highRiskCount: res.highRiskCount || 0,
        policyEvaluation: policyEval,
        summary: `Audited department. Q1/Q2 share: ${res.q1q2Percentage}%. High risk count: ${res.highRiskCount}.`
      };
    }

    if (workflowType === 'GRANT_REIMBURSEMENT' || workflowType === 'GRANT_COMPLIANCE_EVALUATION') {
      const isCompliant = (recStatus === 'GRANT_REIMBURSEMENT_APPROVED' || recStatus === 'APPROVED') && policyEval.compliant;
      return {
        status: isCompliant ? 'REIMBURSEMENT_APPROVED' : 'REIMBURSEMENT_DENIED',
        actionRequired: isCompliant ? 'DISBURSE_APC_FUNDS' : 'NOTIFY_GRANT_PI',
        grantNumber: payload?.grantNumber || 'GRANT-2026',
        policyEvaluation: policyEval,
        summary: isCompliant ? 'APC fee reimbursement cleared.' : 'APC reimbursement denied due to policy or risk flags.'
      };
    }

    return {
      status: policyEval.compliant ? 'APPROVED' : 'NEEDS_REVIEW',
      actionRequired: policyEval.compliant ? 'NONE' : 'HUMAN_REVIEW',
      policyEvaluation: policyEval,
      summary: policyEval.summary
    };
  }

  // --- Section 9 Specific Workflow Methods ---

  async processFacultyPromotionDossier(payload = {}, policyConfig = {}) {
    const subRes = await this.delegateToJournalVerifier(`TASK-PROMOTION-${Date.now()}`, 'VERIFY_FACULTY_PUBLICATION', payload);
    const decision = this.synthesizeDecision('FACULTY_PROMOTION_DOSSIER', subRes, policyConfig);
    return { workflowType: 'FACULTY_PROMOTION_DOSSIER', subagentExecution: subRes, collegeDecision: decision };
  }

  async clearPublicationIncentive(payload = {}, policyConfig = {}) {
    const subRes = await this.delegateToJournalVerifier(`TASK-INCENTIVE-${Date.now()}`, 'VERIFY_FACULTY_PUBLICATION', payload);
    const decision = this.synthesizeDecision('FACULTY_PROMOTION_DOSSIER', subRes, policyConfig);
    return { workflowType: 'PUBLICATION_INCENTIVE', subagentExecution: subRes, collegeDecision: decision };
  }

  async auditDepartmentPublications(payload = {}, policyConfig = {}) {
    const subRes = await this.delegateToJournalVerifier(`TASK-AUDIT-${Date.now()}`, 'AUDIT_DEPARTMENT_PUBLICATIONS', payload);
    const decision = this.synthesizeDecision('DEPARTMENT_AUDIT', subRes, policyConfig);
    return { workflowType: 'DEPARTMENT_AUDIT', subagentExecution: subRes, collegeDecision: decision };
  }

  async evaluateGrantCompliance(payload = {}, policyConfig = {}) {
    const subRes = await this.delegateToJournalVerifier(`TASK-GRANT-${Date.now()}`, 'GRANT_COMPLIANCE_EVALUATION', payload);
    const decision = this.synthesizeDecision('GRANT_REIMBURSEMENT', subRes, policyConfig);
    return { workflowType: 'GRANT_REIMBURSEMENT', subagentExecution: subRes, collegeDecision: decision };
  }

  /**
   * Generic request entry point for REST controller.
   */
  async processCollegeRequest(collegeRequest = {}) {
    const requestId = collegeRequest.requestId || `COLLEGE-REQ-${Date.now()}`;
    const workflowType = collegeRequest.workflowType || 'FACULTY_PROMOTION_DOSSIER';
    const candidateName = collegeRequest.candidateName || 'Dr. Jane Doe';
    const department = collegeRequest.department || 'Department of Computer Science';

    const orchestratorLog = [
      { timestamp: new Date().toISOString(), agent: this.agentName, stage: 'REQUEST_RECEIVED', message: `Processing "${workflowType}" for ${candidateName} (${department})` },
      { timestamp: new Date().toISOString(), agent: this.agentName, stage: 'DELEGATING_TO_SUBAGENT', message: `Delegating journal verification to Agent 18` }
    ];

    const subRes = await this.delegateToJournalVerifier(`SUBTASK-${requestId}`, workflowType, {
      facultyName: candidateName,
      department,
      manuscriptTitle: collegeRequest.manuscriptTitle,
      journalName: collegeRequest.journalName,
      issn: collegeRequest.issn,
      eissn: collegeRequest.eissn,
      institutionalPolicy: collegeRequest.policy,
      grantNumber: collegeRequest.grantNumber,
      funderName: collegeRequest.funderName,
      departmentName: department,
      publications: collegeRequest.publications
    });

    orchestratorLog.push({ timestamp: new Date().toISOString(), agent: this.agentName, stage: 'SUBAGENT_RESPONSE_RECEIVED', message: `Received subagent response.` });

    const decision = this.synthesizeDecision(workflowType, subRes, collegeRequest.policyConfig);
    orchestratorLog.push({ timestamp: new Date().toISOString(), agent: this.agentName, stage: 'FINAL_DECISION_SYNTHESIZED', message: `College Decision: ${decision.status}` });

    return {
      requestId,
      workflowType,
      collegeAgentName: this.agentName,
      candidateName,
      department,
      timestamp: new Date().toISOString(),
      orchestratorLog,
      subagentExecution: subRes,
      collegeDecision: decision
    };
  }
}

module.exports = CollegeAgentOrchestrator;
