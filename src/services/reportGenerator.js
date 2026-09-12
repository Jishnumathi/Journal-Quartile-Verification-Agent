/**
 * Agent 18 - Report Generator Service (Master Enterprise Production Implementation)
 * Renders standard Markdown verification report covering identity, indexing, multi-category metrics,
 * publisher information, evidence ledger, risk signals, policy compliance, alternatives, and RAG grounding.
 */

class ReportGenerator {
  static generateReport(data) {
    const {
      agent,
      requestId,
      verifiedAt,
      validUntil,
      status,
      mode,
      journalIdentity,
      indexing,
      metrics,
      publisher,
      evidence,
      conflicts,
      freshness,
      risk,
      policyEvaluation,
      recommendation,
      alternatives,
      limitations,
      rag
    } = data;

    const mockNotice = mode === 'MOCK' ? `\n> **[MOCK DATA NOTICE]**: This report contains simulated demonstration data.\n` : '';
    const ragNotice = rag && rag.active ? `> **[RAG EXTENSION ACTIVE]**: Retrieval-Augmented Generation enabled using \`${rag.embeddingProvider}\` embeddings & \`${rag.vectorStoreMode}\` vector store.\n` : '';

    const altSection = alternatives && alternatives.recommended && alternatives.alternatives.length > 0 ? `
---

## 16. Recommended Alternative Venues (Peer-Reviewed Alternatives)
> **Reason**: ${alternatives.reason}

${alternatives.alternatives.map(a => `### 🟢 ${a.journalName} (JCR: ${a.jcrQuartile || 'N/A'}, CiteScore: ${a.citescoreQuartile || 'N/A'}, SJR: ${a.sjrQuartile || 'N/A'})
- **Publisher**: ${a.publisher} | **ISSN**: ${a.issn} | **eISSN**: ${a.eissn}
- **Category**: ${a.category}
- **Indexing**: ${a.indexingStatus}
- **Selection Reason**: ${a.selectionReason}
- **Official Site**: [${a.officialUrl}](${a.officialUrl})
`).join('\n')}
` : '';

    return `# AGENT 18 — JOURNAL VERIFICATION REPORT
**Request ID**: \`${requestId}\`  
**Verified At**: ${new Date(verifiedAt).toUTCString()}  
**Valid Until**: ${validUntil ? new Date(validUntil).toUTCString() : 'N/A'}  
**Verification Mode**: \`${mode}\`  
${mockNotice}${ragNotice}
---

## 1. Executive Summary
- **Final Verdict**: **${status}**
- **Recommendation**: **${recommendation}**
- **Identity Confidence**: ${journalIdentity.identityConfidence}% (${journalIdentity.identityStatus})
- **Risk Level**: ${risk.riskLevel} (Score: ${risk.riskScore}/100)
- **Policy Compliance**: ${policyEvaluation.summary}

---

## 2. Journal Identity
- **Journal Name**: ${journalIdentity.journalName || 'N/A'}
- **ISSN (Print)**: ${journalIdentity.issn || 'N/A'}
- **eISSN (Online)**: ${journalIdentity.eissn || 'N/A'}
- **Canonical Publisher**: ${journalIdentity.publisher || 'N/A'}
- **Official URL**: ${journalIdentity.officialUrl ? `[Visit Site](${journalIdentity.officialUrl})` : 'N/A'}
- **Acceptance Rate**: ${journalIdentity.acceptanceRate || 'Not publicly available'}
- **Resolution Status**: ${journalIdentity.resolutionMethod}

---

## 3. Indexing Verification
- **Scopus**: ${indexing.scopus.activeCoverage ? 'CONFIRMED COVERAGE' : 'UNAVAILABLE / NOT CONFIRMED'}
- **Web of Science**: ${indexing.webOfScience.activeCoverage ? 'CONFIRMED COVERAGE' : 'UNAVAILABLE / NOT CONFIRMED'}
- **OpenAlex Catalog**: ${indexing.other.openAlexIndexed ? 'INDEXED' : 'NOT INDEXED'}

---

## 4. JCR Metrics (Clarivate Journal Citation Reports)
${metrics.jcr ? `- **Impact Factor**: ${metrics.jcr.value}\n- **Quartile**: **${metrics.jcr.quartile}**\n- **Year**: ${metrics.jcr.year}\n- **Category**: ${metrics.jcr.category}\n- **Label**: ${metrics.jcr.formattedLabel}` : '_JCR metrics unavailable or unconfigured._'}
${metrics.jcrCategories && metrics.jcrCategories.length > 1 ? `\n*Multi-Category JCR Breakdowns*:\n${metrics.jcrCategories.map(c => `  - **[${c.category}]**: Quartile **${c.quartile}**`).join('\n')}` : ''}

---

## 5. CiteScore Metrics (Elsevier Scopus)
${metrics.citescore ? `- **CiteScore**: ${metrics.citescore.value}\n- **Quartile**: **${metrics.citescore.quartile}**\n- **Year**: ${metrics.citescore.year}\n- **Category**: ${metrics.citescore.category}\n- **Label**: ${metrics.citescore.formattedLabel}` : '_Scopus CiteScore metrics unavailable or unconfigured._'}
${metrics.citescoreCategories && metrics.citescoreCategories.length > 1 ? `\n*Multi-Category CiteScore Breakdowns*:\n${metrics.citescoreCategories.map(c => `  - **[${c.category}]**: Quartile **${c.quartile}**`).join('\n')}` : ''}

---

## 6. SJR Metrics (SCImago Journal Rank)
${metrics.sjr ? `- **SJR Value**: ${metrics.sjr.value}\n- **Quartile**: **${metrics.sjr.quartile}**\n- **Year**: ${metrics.sjr.year}\n- **Category**: ${metrics.sjr.category}\n- **Label**: ${metrics.sjr.formattedLabel}` : '_SJR metrics unavailable or unconfigured._'}

---

## 7. Publisher Information & Acceptance Rate
- **Publisher**: ${publisher.publisherName || 'Unconfirmed'}
- **Official Website**: ${publisher.officialUrl || 'N/A'}
- **Acceptance Rate**: ${publisher.acceptanceRate || 'Not publicly available'}
- **Publisher Reported Claims**: ${publisher.publisherClaimsCount} claim(s) extracted (labeled as PUBLISHER-REPORTED).

---

## 8. Evidence Ledger
| ID | Source | Level | Strength | Claim | Status |
|---|---|---|---|---|---|
${evidence.map(e => `| \`${e.evidenceId}\` | ${e.source} | ${e.authority.label.split(':')[0]} | ${e.evidenceStrength} | ${e.claim.substring(0, 50)}... | ${e.status} |`).join('\n')}

---

## 9. Conflicts
${conflicts.length > 0 ? conflicts.map(c => `- **[${c.severity}] ${c.type}**: ${c.explanation}`).join('\n') : '_No data contradictions or conflicts detected._'}

---

## 10. Freshness & Validity Window
- **Freshness Status**: **${freshness.freshnessStatus}**
- **Valid Until**: ${validUntil ? new Date(validUntil).toUTCString() : 'N/A'}
- **Explanation**: ${freshness.explanation}

---

## 11. Risk Assessment (14 Enterprise Signals Evaluated)
- **Risk Level**: **${risk.riskLevel}** (Score: ${risk.riskScore}/100)
${risk.riskFactors.length > 0 ? risk.riskFactors.map(f => `- **[${f.severity}] ${f.code}**: ${f.description}`).join('\n') : '_No elevated risk factors detected._'}

---

## 12. Institutional Policy Evaluation
- **Policy Status**: **${policyEvaluation.status}** (${policyEvaluation.summary})
${policyEvaluation.evaluations.length > 0 ? policyEvaluation.evaluations.map(e => `- ${e.satisfied ? '[PASSED]' : '[FAILED]'} **${e.rule}**: ${e.evidence}`).join('\n') : '_No custom institutional policy rules applied._'}

---

## 13. Final Verdict
### Verdict: **${status}**
### Recommendation: **${recommendation}**

---

## 14. Limitations
${limitations.length > 0 ? limitations.map(l => `- ${l}`).join('\n') : '_No major system limitations reported._'}

---

## 15. Grounded Narrative Explanations (RAG Grounded Generation)
- **RAG Status**: Active (\`${rag?.embeddingProvider || 'LOCAL_TFIDF'}\` / \`${rag?.vectorStoreMode || 'LOCAL_JSON'}\`)
- **Indexed Chunks**: ${rag?.indexedChunksCount || 0} chunks persisted
${rag?.groundedExplanations?.hasGroundedExplanations ? rag.groundedExplanations.explanations.map(e => `- **[AI-ASSISTED GROUNDED]**: ${e.text}`).join('\n') : '_No AI-assisted narrative explanations generated for this run (fell back to plain structured output)._'}
${altSection}
`;
  }
}

module.exports = ReportGenerator;
