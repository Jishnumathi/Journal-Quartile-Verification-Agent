# AGENT 18 — JOURNAL QUARTILE VERIFICATION AGENT
## Architecture & Technical Specification Document
**Version**: 1.0.0  
**Environment**: Antigravity Free-Tier Execution  

---

### 1. Architectural Overview

Agent 18 is an **Evidence-First Journal Verification System** engineered to provide deterministic, authoritative verification of academic journal identities, indexing status, quartiles (JCR, CiteScore, SJR), publisher legitimacy, and institutional compliance.

```
                  +-----------------------------------+
                  |   Agent 18 Web UI / Dashboard     |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |  Agent 18 Verification Controller |
                  +-----------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
  +------------------+    +-------------------+   +--------------------+
  | Input Parser &   |    | Journal Identity  |   | CFP Extraction     |
  | Validation Engine|    | Resolver          |   | Engine             |
  +------------------+    +-------------------+   +--------------------+
            |                       |                       |
            +-----------------------+-----------------------+
                                    |
                                    v
       +---------------------------------------------------------+
       |                  Source Adapters Layer                  |
       |  +-------------------+  +----------------------------+  |
       |  | CrossrefAdapter   |  | OpenAlexAdapter            |  |
       |  +-------------------+  +----------------------------+  |
       |  | ScopusAdapter     |  | Clarivate/WoS Adapter      |  |
       |  +-------------------+  +----------------------------+  |
       |  | JCRAdapter        |  | PublisherAdapter           |  |
       |  +-------------------+  +----------------------------+  |
       +---------------------------------------------------------+
                                    |
                                    v
       +---------------------------------------------------------+
       |                 Evidence & Analysis Engines             |
       |  +-------------------+  +----------------------------+  |
       |  | Evidence Ledger   |  | Quartile & Metric Engine   |  |
       |  +-------------------+  +----------------------------+  |
       |  | Conflict Detector |  | Freshness Engine           |  |
       |  +-------------------+  +----------------------------+  |
       |  | Risk Engine       |  | Institutional Policy Eval  |  |
       |  +-------------------+  +----------------------------+  |
       +---------------------------------------------------------+
                                    |
                                    v
       +---------------------------------------------------------+
       |              Final Verification & Reporting             |
       |  +---------------------------------------------------+  |
       |  | Deterministic Verification Engine                 |  |
       |  +---------------------------------------------------+  |
       |  | Markdown Report & Standardized JSON Contract      |  |
       |  +---------------------------------------------------+  |
       |  | Persistence Layer (Supabase / Local Audit Store)  |  |
       |  +---------------------------------------------------+  |
       +---------------------------------------------------------+
```

---

### 2. Source Authority & Evidence Hierarchy

External metadata and metric sources are strictly classified into seven authority levels:

| Level | Classification | Description & Examples |
|---|---|---|
| **LEVEL 1** | Authoritative Database | Official API endpoints (Clarivate WoS API, Scopus API) |
| **LEVEL 2** | Official Metric Source | Clarivate JCR, Elsevier CiteScore, SCImago SJR |
| **LEVEL 3** | Government / Institutional | UGC-CARE, DOAJ, Sherpa Romeo |
| **LEVEL 4** | Official Publisher | Direct publisher website metadata |
| **LEVEL 5** | Metadata Provider | Crossref, OpenAlex |
| **LEVEL 6** | Search / Discovery | Google Scholar, Semantic Scholar |
| **LEVEL 7** | LLM Inference | AI textual extraction & claim parsing |

> **CRITICAL RULE**: LLM Inference (Level 7) can NEVER independently verify indexing or quartile status. All claims must be backed by Level 1–5 evidence.

---

### 3. Source Adapters

All source adapters implement a standard contract returning normalized results:

```typescript
interface NormalizedAdapterResult {
  source: string;
  sourceType: 'AUTHORITATIVE' | 'OFFICIAL_METRIC' | 'METADATA' | 'PUBLISHER' | 'DISCOVERY';
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR' | 'MOCK' | 'NO_MATCH' | 'RATE_LIMITED';
  journal: {
    title?: string;
    issn?: string;
    eissn?: string;
    publisher?: string;
    officialUrl?: string;
  };
  metrics: Array<{
    database: string;
    metric: string;
    year: number | string;
    category: string;
    value?: number | string;
    quartile?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'N/A';
  }>;
  indexing: Record<string, boolean | string>;
  evidence: EvidenceItem[];
  retrievedAt: string;
  errors: string[];
}
```

---

### 4. Verification Verdicts & Recommendations

**Final Verdicts**:
- `VERIFIED`: Authoritative evidence directly confirms identity, indexing, and requested quartiles.
- `PARTIALLY_VERIFIED`: Identity/metadata confirmed via open sources (Crossref/OpenAlex), but premium indexing/quartile APIs are unconfigured or unavailable.
- `CONFLICTING`: Reliable sources contradict each other regarding the same database/year/category.
- `NOT_VERIFIED`: Adequate evidence could not be found across queried sources.
- `UNAVAILABLE`: Key required APIs are missing authentication credentials.
- `STALE`: Evidence is outside acceptable freshness windows.
- `AMBIGUOUS`: Identity match confidence is too low or matches multiple distinct journals.

**Recommendations**:
- `ACCEPT`: Strong evidence satisfies all requirements with low risk.
- `ACCEPT_WITH_CAUTION`: Partial verification or minor non-critical risk factors detected.
- `FURTHER_VERIFICATION_REQUIRED`: Identity ambiguous, conflicting data, or key credentials missing.
- `DO_NOT_RELY_ON_CURRENT_EVIDENCE`: High risk factors, unverified claims, or severe conflicts found.

---

### 5. Final JSON Output Contract

Matches the exact schema defined in Section 30 of the Master Build Specification.

---

### 6. Retrieval-Augmented Generation (RAG) Extension Layer

```
Source Adapters (existing)
    ↓
Evidence Normalizer (existing)
    ↓
[NEW] Retrieval Indexer  → writes chunks + embeddings to Vector Store (Supabase pgvector / Local JSON)
    ↓
Conflict / Freshness / Risk Engines (existing, unchanged decision logic)
    ↓
[NEW] Retrieval Layer → fetches top-k relevant chunks for:
        - journal cache lookup (candidate suggestion to Identity Resolver)
        - explanation grounding (cited narrative text generation)
        - predatory-pattern matching (DISCOVERY-strength factors for Risk Engine)
    ↓
Report Generator (existing, now includes grounded explanation block)
```

**Key RAG Constraints & Guarantees**:
1. **Zero-Fabrication Policy**: Every AI-generated explanation sentence must cite at least one retrieved chunk's `evidenceId` (`[EVID-XXX]`). If 0 relevant chunks are retrieved, the pipeline falls back to standard structured-field rendering without generating unanchored text.
2. **Deterministic Supremacy**: RAG does NOT override or substitute quartile values, indexing coverage, or identity resolution confidence. It acts strictly as an additive layer for candidate discovery, indicator retrieval, and text grounding.
3. **No Paid API Dependency**: Vector storage uses `pgvector` when Supabase is configured or `agent18_vector_store.json` in plain JS. Embedding generation uses `OPENAI_API_KEY` when configured or a deterministic local TF-IDF vectorizer fallback (`LOCAL_TFIDF`).
4. **Predatory-Pattern Retrieval**: Curated pattern matching feeds into `RiskEngine` strictly at `DISCOVERY` evidence strength. Pattern matches alone CANNOT push overall journal risk to `HIGH`.

