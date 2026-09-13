/**
 * Agent 18 - Frontend Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const verifyForm = document.getElementById('verifyForm');
  const presetSelect = document.getElementById('presetSelect');
  const healthStatusBadge = document.getElementById('healthStatusBadge');
  const runTestsBtn = document.getElementById('runTestsBtn');
  const submitBtn = document.getElementById('submitBtn');

  const resultsPlaceholder = document.getElementById('resultsPlaceholder');
  const loadingState = document.getElementById('loadingState');
  const resultsContainer = document.getElementById('resultsContainer');

  const reportModal = document.getElementById('reportModal');
  const viewReportBtn = document.getElementById('viewReportBtn');
  const closeReportModalBtn = document.getElementById('closeReportModalBtn');
  const closeReportModalFooterBtn = document.getElementById('closeReportModalFooterBtn');
  const copyReportBtn = document.getElementById('copyReportBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const markdownReportText = document.getElementById('markdownReportText');

  let currentContract = null;
  let currentReportMarkdown = '';

  const dbStatusBadge = document.getElementById('dbStatusBadge');
  const dbExplorerBtn = document.getElementById('dbExplorerBtn');
  const dbModal = document.getElementById('dbModal');
  const closeDbModalBtn = document.getElementById('closeDbModalBtn');
  const closeDbModalFooterBtn = document.getElementById('closeDbModalFooterBtn');
  const dbSearchInput = document.getElementById('dbSearchInput');
  const dbSeedBtn = document.getElementById('dbSeedBtn');
  const dbJournalsTableBody = document.getElementById('dbJournalsTableBody');
  const dbJournalDetailView = document.getElementById('dbJournalDetailView');
  const dbJournalDetailJson = document.getElementById('dbJournalDetailJson');

  // 1. Initial Health Check & Database Status
  checkHealth();
  checkDatabaseStatus();

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const ragInfo = data.rag ? ` | RAG Active (${data.rag.embeddingProvider}/${data.rag.vectorStoreMode})` : '';
        healthStatusBadge.innerHTML = `<span class="pulse-dot"></span> Agent 18 Online (Free Tier Ready${ragInfo})`;
      } else {
        healthStatusBadge.innerHTML = `<span class="pulse-dot" style="background-color:red;"></span> Offline`;
      }
    } catch (e) {
      healthStatusBadge.innerHTML = `<span class="pulse-dot" style="background-color:red;"></span> Server Disconnected`;
    }
  }

  async function checkDatabaseStatus() {
    try {
      const res = await fetch('/api/database/status');
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          const totalJournals = data.tableCounts?.journals || 0;
          dbStatusBadge.innerHTML = `<span class="pulse-dot green"></span> SQLite DB: Connected (${totalJournals} Records)`;
        } else {
          dbStatusBadge.innerHTML = `<span class="pulse-dot red"></span> SQLite DB: Disconnected`;
        }
      }
    } catch (e) {
      dbStatusBadge.innerHTML = `<span class="pulse-dot red"></span> SQLite DB: Error`;
    }
  }

  // 2. Sample Presets Auto-fill
  presetSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'nature') {
      document.getElementById('journalName').value = 'Nature';
      document.getElementById('issn').value = '0028-0836';
      document.getElementById('eissn').value = '1476-4687';
      document.getElementById('journalUrl').value = 'https://www.nature.com/nature';
      document.getElementById('cfpText').value = '';
      document.getElementById('verificationMode').value = 'PARTIAL';
    } else if (val === 'tpami') {
      document.getElementById('journalName').value = 'IEEE Transactions on Pattern Analysis and Machine Intelligence';
      document.getElementById('issn').value = '0162-8828';
      document.getElementById('eissn').value = '1939-3539';
      document.getElementById('journalUrl').value = 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34';
      document.getElementById('cfpText').value = 'Submit your manuscript to IEEE TPAMI. Ranked Scopus Q1 and JCR Q1.';
      document.getElementById('verificationMode').value = 'PARTIAL';
    } else if (val === 'cfp') {
      document.getElementById('journalName').value = 'International Journal of Advanced Computing';
      document.getElementById('issn').value = '';
      document.getElementById('eissn').value = '';
      document.getElementById('journalUrl').value = '';
      document.getElementById('cfpText').value = 'Submit your research paper to our Scopus Q1 journal with high Impact Factor JCR Q1.';
      document.getElementById('verificationMode').value = 'PARTIAL';
    } else if (val === 'wrong_issn') {
      document.getElementById('journalName').value = 'Nature';
      document.getElementById('issn').value = '1234-5678'; // Wrong ISSN for Nature
      document.getElementById('eissn').value = '';
      document.getElementById('journalUrl').value = '';
      document.getElementById('cfpText').value = '';
      document.getElementById('verificationMode').value = 'PARTIAL';
    } else if (val === 'mock_mode') {
      document.getElementById('journalName').value = 'IEEE Transactions on Pattern Analysis and Machine Intelligence';
      document.getElementById('issn').value = '0162-8828';
      document.getElementById('eissn').value = '1939-3539';
      document.getElementById('journalUrl').value = 'https://ieeexplore.ieee.org/xpl/RecentIssue.jsp?punumber=34';
      document.getElementById('verificationMode').value = 'MOCK';
    }
  });

  // 3. Form Submission
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      journalName: document.getElementById('journalName').value,
      issn: document.getElementById('issn').value,
      eissn: document.getElementById('eissn').value,
      url: document.getElementById('journalUrl').value,
      cfp: document.getElementById('cfpText').value,
      requestedYear: document.getElementById('requestedYear').value,
      requestedDatabase: document.getElementById('requestedDatabase').value,
      institutionalPolicy: document.getElementById('institutionalPolicy').value,
      mode: document.getElementById('verificationMode').value
    };

    // UI Loading State
    resultsPlaceholder.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      currentContract = data.jsonContract;
      currentReportMarkdown = data.markdownReport;

      renderResults(data.jsonContract);
    } catch (err) {
      alert(`Verification Request Failed: ${err.message}`);
      resultsPlaceholder.classList.remove('hidden');
    } finally {
      loadingState.classList.add('hidden');
      submitBtn.disabled = false;
    }
  });

  // 4. Render Results
  function renderResults(contract) {
    resultsContainer.classList.remove('hidden');

    // Verdict Badge & Banner
    const verdictBadge = document.getElementById('verdictBadge');
    verdictBadge.textContent = contract.status.replace('_', ' ');
    verdictBadge.className = `verdict-badge v-${contract.status.toLowerCase()}`;

    document.getElementById('modeBadge').textContent = `${contract.mode} MODE`;
    document.getElementById('recommendationText').textContent = contract.recommendation;
    document.getElementById('identityConfidenceText').textContent = `${contract.journalIdentity.identityConfidence}%`;
    document.getElementById('riskLevelText').textContent = `${contract.risk.riskLevel} (${contract.risk.riskScore}/100)`;

    // Identity Card
    document.getElementById('resJournalName').textContent = contract.journalIdentity.journalName || 'Not Identified';
    document.getElementById('resIssn').textContent = contract.journalIdentity.issn || 'N/A';
    document.getElementById('resEissn').textContent = contract.journalIdentity.eissn || 'N/A';
    document.getElementById('resPublisher').textContent = contract.journalIdentity.publisher || 'N/A';

    const urlElem = document.getElementById('resUrl');
    if (contract.journalIdentity.officialUrl) {
      urlElem.innerHTML = `<a href="${contract.journalIdentity.officialUrl}" target="_blank" style="color:var(--info-color)">${contract.journalIdentity.officialUrl}</a>`;
    } else {
      urlElem.textContent = 'N/A';
    }
    document.getElementById('resMethod').textContent = contract.journalIdentity.resolutionMethod;

    // Metrics & Quartiles Grid
    renderMetricBox('jcr', contract.metrics.jcr);
    renderMetricBox('citescore', contract.metrics.citescore);
    renderMetricBox('sjr', contract.metrics.sjr);

    // Evidence Table
    const tbody = document.getElementById('evidenceTableBody');
    tbody.innerHTML = '';
    contract.evidence.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${e.source}</strong></td>
        <td><span class="mode-tag">${e.authority.label.split(':')[0]}</span></td>
        <td>${e.evidenceStrength}</td>
        <td>${e.claim}</td>
        <td><span class="mode-tag">${e.status}</span></td>
      `;
      tbody.appendChild(tr);
    });

    // Conflicts
    const confContainer = document.getElementById('conflictsContainer');
    if (contract.conflicts.length > 0) {
      confContainer.innerHTML = contract.conflicts.map(c => `
        <div style="margin-bottom:0.5rem; padding:0.5rem; background:rgba(245, 158, 11, 0.1); border-left:3px solid var(--warning-color); border-radius:4px;">
          <strong style="color:var(--warning-color)">[${c.type}]</strong> ${c.explanation}
        </div>
      `).join('');
    } else {
      confContainer.innerHTML = `<p class="text-muted">No conflicts or discrepancies detected.</p>`;
    }

    // Risk Factors
    const riskContainer = document.getElementById('riskContainer');
    if (contract.risk.riskFactors.length > 0) {
      riskContainer.innerHTML = contract.risk.riskFactors.map(f => `
        <div style="margin-bottom:0.5rem; padding:0.5rem; background:rgba(239, 68, 68, 0.1); border-left:3px solid var(--danger-color); border-radius:4px;">
          <strong style="color:var(--danger-color)">[${f.code}]</strong> ${f.description}
        </div>
      `).join('');
    } else {
      riskContainer.innerHTML = `<p class="text-muted">Low risk evaluation. No elevated risk factors.</p>`;
    }

    // Policy Container
    const policyContainer = document.getElementById('policyContainer');
    if (contract.policyEvaluation.evaluations.length > 0) {
      policyContainer.innerHTML = contract.policyEvaluation.evaluations.map(p => `
        <div style="font-size:0.85rem; margin-bottom:0.4rem;">
          ${p.satisfied ? '✅' : '❌'} <strong>${p.rule}:</strong> ${p.evidence}
        </div>
      `).join('');
    } else {
      policyContainer.innerHTML = `<p class="text-muted">No custom institutional policy requirements specified.</p>`;
    }

    // RAG Grounded Explanations
    const ragContainer = document.getElementById('ragExplanationsContainer');
    const ragStatusBadge = document.getElementById('ragStatusBadge');

    if (contract.rag && contract.rag.active) {
      ragStatusBadge.textContent = `RAG (${contract.rag.embeddingProvider} / ${contract.rag.vectorStoreMode})`;
      if (contract.rag.groundedExplanations && contract.rag.groundedExplanations.hasGroundedExplanations) {
        ragContainer.innerHTML = contract.rag.groundedExplanations.explanations.map(e => `
          <div style="margin-bottom:0.5rem; padding:0.6rem; background:rgba(99, 102, 241, 0.08); border-left:3px solid #6366f1; border-radius:4px; font-size:0.85rem;">
            <strong style="color:#6366f1;">[${e.label}]</strong> ${e.text}
          </div>
        `).join('');
      } else {
        ragContainer.innerHTML = `<p class="text-muted">No AI-assisted narrative explanations generated (fell back to plain structured output).</p>`;
      }
    } else {
      ragContainer.innerHTML = `<p class="text-muted">RAG extension unconfigured.</p>`;
    }

    // Alternative Journals Rendering
    const altContainer = document.getElementById('alternativesContainer');
    const altCountBadge = document.getElementById('altCountBadge');

    if (contract.alternatives && contract.alternatives.recommended && contract.alternatives.alternatives.length > 0) {
      altCountBadge.textContent = `${contract.alternatives.alternatives.length} OPTIONS`;
      altCountBadge.className = `mini-badge badge-green`;
      altContainer.innerHTML = contract.alternatives.alternatives.map(a => `
        <div style="margin-bottom:0.6rem; padding:0.6rem; background:rgba(16, 185, 129, 0.08); border-left:3px solid #10b981; border-radius:4px; font-size:0.85rem;">
          <strong style="color:#10b981; font-size:0.95rem;">🟢 ${a.journalName}</strong> (JCR: ${a.jcrQuartile || 'N/A'}, CiteScore: ${a.citescoreQuartile || 'N/A'}, SJR: ${a.sjrQuartile || 'N/A'})
          <div style="color:var(--text-muted); margin-top:0.2rem;">• Publisher: ${a.publisher} | ISSN: ${a.issn}</div>
          <div style="color:var(--text-color); margin-top:0.2rem;">• <em>${a.selectionReason}</em></div>
          <div style="margin-top:0.2rem;"><a href="${a.officialUrl}" target="_blank" style="color:var(--info-color)">Visit Official Site →</a></div>
        </div>
      `).join('');
    } else {
      altCountBadge.textContent = `TARGET OK`;
      altContainer.innerHTML = `<p class="text-muted">Target journal satisfies quality standards. No alternative venues required.</p>`;
    }

    // Load Approved-Venue List
    loadApprovedVenues();

    // Limitations
    const limitationsContainer = document.getElementById('limitationsContainer');
    if (contract.limitations.length > 0) {
      limitationsContainer.innerHTML = contract.limitations.map(l => `<p style="font-size:0.85rem; color:var(--text-muted);">• ${l}</p>`).join('');
    } else {
      limitationsContainer.innerHTML = `<p class="text-muted">None</p>`;
    }
  }

  async function loadApprovedVenues() {
    const venueContainer = document.getElementById('approvedVenuesContainer');
    try {
      const res = await fetch('/api/institutional-list');
      if (res.ok) {
        const data = await res.json();
        if (data.venues && data.venues.length > 0) {
          venueContainer.innerHTML = data.venues.map(v => `
            <div style="font-size:0.85rem; padding:0.4rem; border-bottom:1px solid rgba(255,255,255,0.05);">
              ✅ <strong>${v.journalName}</strong> (ISSN: ${v.issn || 'N/A'}) — Approved by <em>${v.approvingInstitution}</em>
            </div>
          `).join('');
        } else {
          venueContainer.innerHTML = `<p class="text-muted">No institutional approved venues registered.</p>`;
        }
      }
    } catch (err) {
      venueContainer.innerHTML = `<p class="text-muted">Could not load approved venue registry.</p>`;
    }
  }

  function renderMetricBox(idPrefix, metricData) {
    const qBadge = document.getElementById(`${idPrefix}Quartile`);
    const valElem = document.getElementById(`${idPrefix}Value`);
    const labelElem = document.getElementById(`${idPrefix}Label`);

    if (metricData && metricData.quartile) {
      qBadge.textContent = metricData.quartile;
      qBadge.className = `quartile-badge q-${metricData.quartile.toLowerCase()}`;
      valElem.textContent = `${metricData.metric}: ${metricData.value || 'N/A'}`;
      labelElem.textContent = metricData.formattedLabel;
    } else {
      qBadge.textContent = 'N/A';
      qBadge.className = `quartile-badge q-na`;
      valElem.textContent = 'Metrics Unavailable';
      labelElem.textContent = '-';
    }
  }

  // 5. Report Modal & JSON Exporting
  viewReportBtn.addEventListener('click', () => {
    markdownReportText.textContent = currentReportMarkdown;
    reportModal.classList.remove('hidden');
  });

  closeReportModalBtn.addEventListener('click', () => reportModal.classList.add('hidden'));
  closeReportModalFooterBtn.addEventListener('click', () => reportModal.classList.add('hidden'));

  copyReportBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentReportMarkdown);
    alert('Report Markdown copied to clipboard!');
  });

  exportJsonBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentContract, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `agent18_verification_${currentContract.requestId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // 6. Run Test Suite Button
  runTestsBtn.addEventListener('click', async () => {
    runTestsBtn.disabled = true;
    runTestsBtn.textContent = 'Running Tests...';
    try {
      const res = await fetch('/api/tests/run');
      const results = await res.json();
      alert(`Automated Test Suite Execution Complete:\nPassed: ${results.passed}/${results.total}\nFailed: ${results.failed}`);
    } catch (err) {
      alert(`Test Execution Failed: ${err.message}`);
    } finally {
      runTestsBtn.disabled = false;
      runTestsBtn.textContent = '⚡ Run 15-Test Suite';
    }
  });

  // 7. Database Explorer Modal Logic
  dbExplorerBtn.addEventListener('click', () => {
    dbModal.classList.remove('hidden');
    loadDbJournals();
  });

  closeDbModalBtn.addEventListener('click', () => dbModal.classList.add('hidden'));
  closeDbModalFooterBtn.addEventListener('click', () => dbModal.classList.add('hidden'));

  let dbSearchTimeout = null;
  dbSearchInput.addEventListener('input', (e) => {
    clearTimeout(dbSearchTimeout);
    dbSearchTimeout = setTimeout(() => {
      loadDbJournals(e.target.value.trim());
    }, 300);
  });

  dbSeedBtn.addEventListener('click', async () => {
    if (!confirm('Re-seed SQLite database with default sample datasets?')) return;
    try {
      const res = await fetch('/api/database/seed', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Database re-seeded');
      checkDatabaseStatus();
      loadDbJournals();
    } catch (err) {
      alert(`Re-seed error: ${err.message}`);
    }
  });

  async function loadDbJournals(searchQuery = '') {
    try {
      dbJournalsTableBody.innerHTML = `<tr><td colspan="8" class="text-muted">Loading SQLite records...</td></tr>`;
      const url = searchQuery ? `/api/database/journals?q=${encodeURIComponent(searchQuery)}` : '/api/database/journals';
      const res = await fetch(url);
      const data = await res.json();

      if (!data.journals || data.journals.length === 0) {
        dbJournalsTableBody.innerHTML = `<tr><td colspan="8" class="text-muted">No records found matching "${searchQuery}"</td></tr>`;
        return;
      }

      dbJournalsTableBody.innerHTML = data.journals.map(j => `
        <tr>
          <td><strong>${j.journal_name}</strong></td>
          <td><code>${j.issn || '-'}</code></td>
          <td><code>${j.eissn || '-'}</code></td>
          <td>${j.publisher || '-'}</td>
          <td>${j.indexed_scopus ? '<span class="status-badge status-verified">YES</span>' : '<span class="status-badge status-conflicting">NO</span>'}</td>
          <td>${j.indexed_wos ? '<span class="status-badge status-verified">YES</span>' : '<span class="status-badge status-conflicting">NO</span>'}</td>
          <td><span class="mini-badge">${j.metrics_count || 0} Records</span></td>
          <td>
            <button class="btn btn-secondary btn-sm select-db-journal-btn" data-issn="${j.issn || ''}" data-name="${j.journal_name}">Verify</button>
            <button class="btn btn-secondary btn-sm inspect-db-journal-btn" data-id="${j.id}">Inspect</button>
          </td>
        </tr>
      `).join('');

      // Add event listeners to dynamic buttons
      document.querySelectorAll('.select-db-journal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const name = e.target.getAttribute('data-name');
          const issn = e.target.getAttribute('data-issn');
          document.getElementById('journalName').value = name;
          document.getElementById('issn').value = issn;
          document.getElementById('eissn').value = '';
          document.getElementById('cfpText').value = '';
          document.getElementById('verificationMode').value = 'PARTIAL';
          dbModal.classList.add('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      document.querySelectorAll('.inspect-db-journal-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          const detailRes = await fetch(`/api/database/journals/${id}`);
          const detailData = await detailRes.json();
          dbJournalDetailJson.textContent = JSON.stringify(detailData.journal, null, 2);
          dbJournalDetailView.classList.remove('hidden');
        });
      });

    } catch (err) {
      dbJournalsTableBody.innerHTML = `<tr><td colspan="8" class="text-danger">Failed to load SQLite records: ${err.message}</td></tr>`;
    }
  }

});
