# AGENT 18 — DOWNSTREAM INTEGRATION CONTRACTS

**Project**: Agent 18 — Journal Quartile Verification Agent  
**Version**: 1.0 (Production Ready)  
**Date**: September 12, 2026  

---

## 1. Executive Summary
This document specifies the exact interface contracts, payload schemas, and REST endpoints exposed by **Agent 18** to downstream autonomous agents in the research intelligence system:

- **Agent 17**: Literature Review Agent (verifies journal credibility during citation aggregation)
- **Agent 20**: Publishing Strategy Agent (uses quartile and alternative venue recommendations)
- **Agent 21**: Compliance & Grant Verification Agent (validates institutional and funder policy compliance)
- **Agent 59**: Executive Research Dashboard (ingests risk scores, evidence ledgers, and audit trail metrics)

---

## 2. API Endpoint Specification

### Endpoint: `/api/integration/agent18-result`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Consumer-Agent-ID`: `17` | `20` | `21` | `59`
  - `Idempotency-Key`: `<UUIDv4>` (Optional, highly recommended)

#### Request Payload Schema
```json
{
  "journalName": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
  "issn": "0162-8828",
  "eissn": "1939-3539",
  "url": "https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34",
  "cfp": "Call for papers text if evaluating specific special issue",
  "institutionalPolicy": "JCR Q1 or Scopus Q1 required",
  "mode": "LIVE"
}
```

#### Response Payload Schema (`Agent18IntegrationContract`)
```json
{
  "agent": "18",
  "contractVersion": "1.0",
  "journal": {
    "canonical_name": "IEEE Transactions on Pattern Analysis and Machine Intelligence",
    "issn": "0162-8828",
    "eissn": "1939-3539",
    "publisher": "IEEE",
    "url": "https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34"
  },
  "verification": {
    "status": "VERIFIED",
    "overall_risk_score": 5,
    "risk_level": "LOW",
    "verified_at": "2026-09-12T12:15:00.000Z",
    "valid_until": "2027-09-12T12:15:00.000Z"
  },
  "quartiles": {
    "primary_quartile": "Q1",
    "jcr_quartile": "Q1",
    "citescore_quartile": "Q1",
    "sjr_quartile": "Q1",
    "categories": [
      {
        "category": "Computer Science Applications",
        "source": "Scopus",
        "rank": 3,
        "totalJournals": 720,
        "quartile": "Q1",
        "percentile": 99.5
      }
    ]
  },
  "indexing": {
    "web_of_science": true,
    "wos_collection": "Science Citation Index Expanded (AHCI / SCIE)",
    "scopus": true,
    "doaj": false
  },
  "institutional_compliance": {
    "policy_name": "JCR Q1 or Scopus Q1 required",
    "status": "COMPLIANT",
    "institutionally_accepted": true,
    "on_approved_list": true,
    "matching_rule": "JCR Q1 or Scopus Q1 satisfied"
  },
  "alternatives": {
    "recommended": false,
    "reason": "Target journal satisfies quality and verification standards.",
    "alternatives": []
  },
  "evidence": [
    {
      "evidenceId": "EVID-001",
      "sourceType": "Crossref",
      "claim": "Journal identity verified",
      "confidence": 1.0,
      "sourceUrl": "https://api.crossref.org/journals/0162-8828"
    }
  ],
  "rag_provenance": {
    "rag_enabled": true,
    "retrieved_documents_count": 2,
    "highest_relevance_score": 0.92,
    "safety_cap_applied": false
  }
}
```

---

## 3. Agent-Specific Consumer Contracts

### Agent 17: Literature Review Agent
- **Usage**: Before including a paper in a systematic review, Agent 17 queries Agent 18 using `journalName` or `issn`.
- **Decision Logic**:
  - If `verification.status == "VERIFIED"` AND `quartiles.primary_quartile in ["Q1", "Q2"]`: Paper is categorized as **High Quality Credible Citation**.
  - If `verification.status == "SUSPICIOUS"` OR `verification.risk_level == "HIGH"`: Paper is flagged with a warning banner.

### Agent 20: Publishing Strategy Agent
- **Usage**: When recommending target venues for a manuscript, Agent 20 passes the intended journal to Agent 18.
- **Decision Logic**:
  - If `alternatives.recommended == true`: Agent 20 injects `alternatives.alternatives` into the researcher's venue selection dashboard.

### Agent 21: Compliance & Grant Verification Agent
- **Usage**: Checks whether publication fees (APC) can be reimbursed using grant funds.
- **Decision Logic**:
  - Checks `institutional_compliance.status == "COMPLIANT"` and `institutional_compliance.institutionally_accepted == true`.

### Agent 59: Executive Research Dashboard
- **Usage**: Aggregates enterprise analytics on institutional publishing trends.
- **Decision Logic**:
  - Ingests `verification.overall_risk_score`, `quartiles`, and `rag_provenance` for real-time risk heatmaps.

---

## 4. Error Handling & Fallbacks

| Error Code | HTTP Status | Description | Fallback Behavior |
|---|---|---|---|
| `INVALID_INPUT` | 400 | Missing journal name and ISSN | Consumer receives `status: "UNAVAILABLE"` with error reason |
| `RATE_LIMITED` | 429 | Exceeded 100 requests per 15 minutes | Consumer should retry after backoff interval |
| `SERVICE_UNAVAILABLE` | 503 | External database APIs unreachable | Agent 18 returns `LOCAL_CACHE` or `MOCK` evidence with status `UNAVAILABLE` |
