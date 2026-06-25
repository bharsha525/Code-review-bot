/* ───────────────────────────────────────────────────
   CodeReview AI  —  app.js
─────────────────────────────────────────────────── */

// ── State ──────────────────────────────────────────
const state = { history: [] };

// ── DOM refs ───────────────────────────────────────
const codeInput    = document.getElementById('codeInput');
const reviewBtn    = document.getElementById('reviewBtn');
const resultsEmpty = document.getElementById('resultsEmpty');
const resultsContent = document.getElementById('resultsContent');
const lineCountEl  = document.getElementById('lineCount');
const charCountEl  = document.getElementById('charCount');
const historyList  = document.getElementById('historyList');
const themeToggle  = document.getElementById('themeToggle');
const toast        = document.getElementById('toast');

// ─Themes─────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('cr-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
})();

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  themeToggle.innerHTML = t === 'dark'
    ? '<i class="ti ti-sun"></i>'
    : '<i class="ti ti-moon"></i>';
  localStorage.setItem('cr-theme', t);
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Navigation ─────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'history') renderHistory();
  });
});

// ── Focus chips ────────────────────────────────────
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => chip.classList.toggle('active'));
});

// ── Editor counters ────────────────────────────────
codeInput.addEventListener('input', updateCounters);
function updateCounters() {
  const text = codeInput.value;
  const lines = text ? text.split('\n').length : 0;
  lineCountEl.textContent = lines + ' line' + (lines !== 1 ? 's' : '');
  charCountEl.textContent = text.length + ' chars';
}
updateCounters();

// ── Clear & Copy ───────────────────────────────────
document.getElementById('clearBtn').addEventListener('click', () => {
  codeInput.value = '';
  updateCounters();
  resultsEmpty.style.display = 'flex';
  resultsContent.style.display = 'none';
  showToast('Code cleared');
});

document.getElementById('copyBtn').addEventListener('click', () => {
  if (!codeInput.value.trim()) return;
  navigator.clipboard.writeText(codeInput.value).then(() => showToast('Code copied!'));
});

// ── Helpers ────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function timeAgo(ts) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60)  return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  return Math.floor(d / 3600) + 'h ago';
}

// ── Build AI prompt ────────────────────────────────
function buildPrompt(code, lang, focuses) {
  const langStr  = lang === 'auto' ? '' : ` The language is ${lang}.`;
  const focusStr = focuses.length ? focuses.join(', ') : 'general code quality';
  return `You are a world-class code reviewer and algorithm expert. Review the following code focusing on: ${focusStr}.${langStr}

Your response must be ONLY a valid JSON object — no markdown, no backticks, no extra text.

JSON structure:
{
  "language": "<detected or specified language>",
  "score": <integer 0-100, overall quality>,
  "summary": "<2-3 sentence honest overall assessment>",
  "original_complexity": {
    "time": "<e.g. O(n²)>",
    "space": "<e.g. O(n)>",
    "time_explanation": "<1 sentence why>",
    "space_explanation": "<1 sentence why>"
  },
  "issues": [
    {
      "severity": "<critical|warning|info|positive>",
      "title": "<short title, max 8 words>",
      "description": "<clear explanation, 2-3 sentences>",
      "fix": "<specific improved code snippet, or empty string for positive items>"
    }
  ],
  "best_solution": {
    "title": "<name of the optimal approach, e.g. 'Hash Set approach'>",
    "explanation": "<2-3 sentence explanation of why this is better>",
    "code": "<full optimized code implementation>",
    "complexity": {
      "time": "<e.g. O(n)>",
      "space": "<e.g. O(n)>",
      "time_explanation": "<1 sentence why>",
      "space_explanation": "<1 sentence why>"
    },
    "improvement": "<1 sentence comparing to original, e.g. 'Reduces time from O(n²) to O(n)'>"
  }
}

Rules:
- Include 3-6 issues. Always include at least one "positive" if code has merits.
- The best_solution must be a COMPLETE, RUNNABLE implementation in the same language.
- If the code is already optimal, still show the best solution with minor improvements.
- Be specific and technical. Mention exact line numbers or patterns where relevant.

Code to review:
\`\`\`
${code}
\`\`\``;
}

// ── Get active focuses ─────────────────────────────
function getActiveFocuses() {
  return [
    { id: 'f-bugs',     label: 'bugs and logic errors' },
    { id: 'f-security', label: 'security vulnerabilities' },
    { id: 'f-perf',     label: 'performance and algorithmic efficiency' },
    { id: 'f-style',    label: 'code style and readability' },
    { id: 'f-best',     label: 'best optimal solution with complexity analysis' },
  ]
  .filter(f => document.getElementById(f.id).parentElement.classList.contains('active'))
  .map(f => f.label);
}


async function callAPI(prompt) {
  const API_KEY = 'AQ.Ab8RN6JuDh4yii7-3F4T0JBA1r7qWks_PprfNGrQpiwP98zI1Q'; // paste your key
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    }
  );

  if (!response.ok) throw new Error('API error ' + response.status);
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Render results ─────────────────────────────────
function renderResults(review) {
  const score = review.score || 0;
  const scoreClass = score >= 75 ? 's-high' : score >= 50 ? 's-mid' : 's-low';
  const barColor   = score >= 75 ? '#0D7A55' : score >= 50 ? '#9B590A' : '#C0392B';

  const sevMap = {
    critical: { icon: 'ti-alert-triangle', ic: 'ic-critical', sb: 'sb-critical', label: 'Critical' },
    warning:  { icon: 'ti-alert-circle',   ic: 'ic-warning',  sb: 'sb-warning',  label: 'Warning' },
    info:     { icon: 'ti-info-circle',    ic: 'ic-info',     sb: 'sb-info',     label: 'Suggestion' },
    positive: { icon: 'ti-circle-check',   ic: 'ic-positive', sb: 'sb-positive', label: 'Good' },
  };

  // ── Score section
  const scoreHtml = `
    <div class="score-section">
      <div class="score-row">
        <span class="score-label">Quality score</span>
        <span class="score-number ${scoreClass}">${score}<span style="font-size:16px;font-weight:400;color:var(--text-3)">/100</span></span>
      </div>
      <div class="score-bar-bg">
        <div class="score-bar-fill" style="width:${score}%;background:${barColor}"></div>
      </div>
      <p class="score-summary">${escHtml(review.summary || '')}</p>
    </div>
  `;

  // ── Complexity comparison table
  const oc = review.original_complexity || {};
  const bc = review.best_solution?.complexity || {};
  const complexityHtml = (oc.time || bc.time) ? `
    <div style="padding:0 12px 4px;">
      <table class="complexity-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Your code</th>
            <th>Best solution</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Time complexity</td>
            <td><span class="complexity-val">${escHtml(oc.time || '—')}</span></td>
            <td><span class="complexity-val complexity-best">${escHtml(bc.time || '—')}</span></td>
          </tr>
          <tr>
            <td>Space complexity</td>
            <td><span class="complexity-val">${escHtml(oc.space || '—')}</span></td>
            <td><span class="complexity-val complexity-best">${escHtml(bc.space || '—')}</span></td>
          </tr>
          ${oc.time_explanation ? `<tr><td colspan="3" style="font-size:12px;color:var(--text-3);padding:6px 12px;">Your code: ${escHtml(oc.time_explanation)}</td></tr>` : ''}
          ${bc.time_explanation ? `<tr><td colspan="3" style="font-size:12px;color:var(--c-positive);padding:6px 12px;"><i class="ti ti-sparkles" style="font-size:12px"></i> Best: ${escHtml(bc.time_explanation)}</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  ` : '';

  // ── Issues
  const issuesHtml = (review.issues || []).map((issue, i) => {
    const sev = sevMap[issue.severity] || sevMap['info'];
    const fixHtml = issue.fix ? `
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-block-label">Suggested fix</span>
          <button class="copy-btn" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
        </div>
        <pre>${escHtml(issue.fix)}</pre>
      </div>
    ` : '';
    return `
      <div class="issue-card" id="issue-${i}">
        <div class="issue-head" onclick="toggleIssue(${i})">
          <div class="sev-icon ${sev.ic}"><i class="ti ${sev.icon}"></i></div>
          <div class="issue-head-text">
            <div class="issue-title">${escHtml(issue.title)}</div>
          </div>
          <span class="sev-badge ${sev.sb}">${sev.label}</span>
          <i class="ti ti-chevron-right issue-chevron"></i>
        </div>
        <div class="issue-body-wrap">
          <p class="issue-desc">${escHtml(issue.description)}</p>
          ${fixHtml}
        </div>
      </div>
    `;
  }).join('');

  // ── Best solution section
  const bs = review.best_solution;
  const bestHtml = bs ? `
    <div class="best-section">
      <div class="best-header">
        <i class="ti ti-stars"></i>
        <h3>${escHtml(bs.title || 'Best solution')}</h3>
        <span class="best-badge">Optimal</span>
      </div>
      <div class="best-body">
        <p class="best-desc">${escHtml(bs.explanation || '')}</p>
        ${bs.improvement ? `<p style="font-size:12px;font-weight:600;color:var(--c-positive);margin-bottom:12px;"><i class="ti ti-trending-up" style="font-size:13px;vertical-align:-2px;"></i> ${escHtml(bs.improvement)}</p>` : ''}
        ${bs.code ? `
          <div class="code-block">
            <div class="code-block-header">
              <span class="code-block-label">Optimized implementation</span>
              <button class="copy-btn" onclick="copyCode(this)"><i class="ti ti-copy"></i> Copy</button>
            </div>
            <pre>${escHtml(bs.code)}</pre>
          </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  resultsContent.innerHTML = `
    ${scoreHtml}
    ${complexityHtml}
    <div class="issues-list">${issuesHtml}</div>
    ${bestHtml}
  `;

  resultsEmpty.style.display = 'none';
  resultsContent.style.display = 'block';
}

// ── Toggle issue accordion ─────────────────────────
window.toggleIssue = function(i) {
  document.getElementById('issue-' + i).classList.toggle('open');
};

// ── Copy code snippet ──────────────────────────────
window.copyCode = function(btn) {
  const pre = btn.closest('.code-block').querySelector('pre');
  navigator.clipboard.writeText(pre.textContent).then(() => {
    btn.innerHTML = '<i class="ti ti-check"></i> Copied!';
    setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 1800);
  });
};

// ── Main review action ─────────────────────────────
reviewBtn.addEventListener('click', async () => {
  const code = codeInput.value.trim();
  if (!code) { showToast('Paste some code first'); return; }

  const lang    = document.getElementById('lang').value;
  const focuses = getActiveFocuses();
  const prompt  = buildPrompt(code, lang, focuses);

  reviewBtn.disabled = true;
  reviewBtn.innerHTML = '<div class="spinner"></div><span>Analyzing…</span>';
  resultsEmpty.style.display = 'flex';
  resultsContent.style.display = 'none';

  try {
    const review = await callAPI(prompt);
    renderResults(review);

    // Save to history
    state.history.unshift({
      ts: Date.now(),
      lang: review.language || lang,
      score: review.score,
      snippet: code.split('\n')[0].substring(0, 80),
      review,
      code
    });

    showToast('Review complete ✓');
  } catch (err) {
    resultsContent.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--c-critical);">
        <i class="ti ti-alert-circle" style="font-size:32px;display:block;margin-bottom:10px;"></i>
        <p style="font-weight:500;margin-bottom:6px;">Analysis failed</p>
        <p style="font-size:13px;color:var(--text-2);">${escHtml(err.message)}</p>
      </div>
    `;
    resultsEmpty.style.display = 'none';
    resultsContent.style.display = 'block';
  }

  reviewBtn.disabled = false;
  reviewBtn.innerHTML = '<i class="ti ti-player-play"></i><span>Analyze code</span>';
});

// ── Render history page ────────────────────────────
function renderHistory() {
  if (!state.history.length) {
    historyList.innerHTML = `
      <div class="empty-history">
        <i class="ti ti-history"></i>
        <p>No reviews yet</p>
        <span>Analyze some code to see your history here.</span>
      </div>
    `;
    return;
  }

  historyList.innerHTML = state.history.map((item, i) => {
    const score = item.score || 0;
    const col   = score >= 75 ? 'var(--c-positive)' : score >= 50 ? 'var(--c-warning)' : 'var(--c-critical)';
    const bg    = score >= 75 ? 'var(--c-positive-bg)' : score >= 50 ? 'var(--c-warning-bg)' : 'var(--c-critical-bg)';
    return `
      <div class="history-item" onclick="restoreReview(${i})">
        <div class="history-score-badge" style="background:${bg};color:${col}">${score}</div>
        <div class="history-info">
          <div class="history-lang">${escHtml(item.lang || 'unknown')}</div>
          <div class="history-snippet">${escHtml(item.snippet || '')}</div>
        </div>
        <div class="history-time">${timeAgo(item.ts)}</div>
        <i class="ti ti-chevron-right" style="color:var(--text-3);font-size:16px;"></i>
      </div>
    `;
  }).join('');
}

// ── Restore a past review ──────────────────────────
window.restoreReview = function(i) {
  const item = state.history[i];
  if (!item) return;
  codeInput.value = item.code;
  updateCounters();
  renderResults(item.review);
  // Switch to review tab
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-page="review"]').classList.add('active');
  document.getElementById('page-review').classList.add('active');
};
