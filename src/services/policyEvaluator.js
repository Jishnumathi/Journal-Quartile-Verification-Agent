/**
 * Agent 18 - Policy Evaluator Engine
 * Evaluates optional institutional requirements against verified evidence.
 */

class PolicyEvaluator {
  static evaluatePolicy(institutionalPolicy, indexingData = {}, metricsMap = {}) {
    if (!institutionalPolicy) {
      return {
        status: 'UNKNOWN',
        policyProvided: false,
        evaluations: [],
        summary: 'No institutional policy specified.'
      };
    }

    const evaluations = [];
    const policyStr = (typeof institutionalPolicy === 'string' ? institutionalPolicy : JSON.stringify(institutionalPolicy)).toLowerCase();

    let overallSatisfied = true;
    let verifiedCount = 0;

    // Policy Rule 1: Scopus Required
    if (policyStr.includes('scopus')) {
      const isScopus = indexingData.scopus?.activeCoverage || metricsMap.citescore;
      evaluations.push({
        rule: 'Scopus Indexing Required',
        satisfied: !!isScopus,
        evidence: isScopus ? 'Scopus indexing confirmed' : 'Scopus indexing not confirmed'
      });
      if (!isScopus) overallSatisfied = false;
      else verifiedCount++;
    }

    // Policy Rule 2: Web of Science / WoS Required
    if (policyStr.includes('wos') || policyStr.includes('web of science')) {
      const isWos = indexingData.webOfScience?.activeCoverage || metricsMap.jcr;
      evaluations.push({
        rule: 'Web of Science Indexing Required',
        satisfied: !!isWos,
        evidence: isWos ? 'Web of Science indexing confirmed' : 'Web of Science indexing not confirmed'
      });
      if (!isWos) overallSatisfied = false;
      else verifiedCount++;
    }

    // Policy Rule 3: JCR Required
    if (policyStr.includes('jcr') || policyStr.includes('impact factor')) {
      const hasJcr = !!metricsMap.jcr;
      evaluations.push({
        rule: 'JCR Metric Required',
        satisfied: hasJcr,
        evidence: hasJcr ? `JCR Impact Factor: ${metricsMap.jcr.value}` : 'JCR metric unavailable'
      });
      if (!hasJcr) overallSatisfied = false;
      else verifiedCount++;
    }

    // Policy Rule 4: Q1 Required
    if (policyStr.includes('q1')) {
      const isQ1 = (metricsMap.jcr?.quartile === 'Q1') || (metricsMap.citescore?.quartile === 'Q1') || (metricsMap.sjr?.quartile === 'Q1');
      evaluations.push({
        rule: 'Q1 Quartile Required',
        satisfied: isQ1,
        evidence: isQ1 ? 'Q1 quartile verified' : 'No Q1 quartile confirmed across database metrics'
      });
      if (!isQ1) overallSatisfied = false;
      else verifiedCount++;
    }

    // Policy Rule 5: Q2 or above
    if (policyStr.includes('q2 or above') || policyStr.includes('q2+')) {
      const isQ1Q2 = ['Q1', 'Q2'].includes(metricsMap.jcr?.quartile) || ['Q1', 'Q2'].includes(metricsMap.citescore?.quartile);
      evaluations.push({
        rule: 'Q2 or Higher Quartile Required',
        satisfied: isQ1Q2,
        evidence: isQ1Q2 ? 'Q1/Q2 quartile verified' : 'Quartile lower than Q2 or unavailable'
      });
      if (!isQ1Q2) overallSatisfied = false;
      else verifiedCount++;
    }

    let status = 'SATISFIED';
    if (evaluations.length === 0) {
      status = 'UNKNOWN';
    } else if (!overallSatisfied) {
      status = 'NOT_SATISFIED';
    }

    return {
      status,
      policyProvided: true,
      rawPolicy: institutionalPolicy,
      evaluations,
      summary: status === 'SATISFIED' ? 'All institutional policy requirements satisfied.' : 'One or more institutional requirements were not satisfied.'
    };
  }
}

module.exports = PolicyEvaluator;
