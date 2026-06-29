use strict';

/* ================================================================
   全民運動科公文小助手 — 純靜態版前端搜尋邏輯
   資料來源：search-data.json
   顯示方式：小助手整理步驟 + 手冊原文依據
   ================================================================ */

const ROLE_PDF_MAP = {
  "承辦人":           "高雄第三代公文系統_承辦人操作手冊.pdf",
  "基層主管":          "高雄第三代公文系統_基層主管操作手冊.pdf",
  "核判長官":          "高雄第三代公文系統_核判長官操作手冊.pdf",
  "登記桌人員":        "高雄第三代公文系統_登記桌操作手冊.pdf",
  "機關收文人員":      "高雄第三代公文系統_機關收文操作手冊.pdf",
  "機關發文人員":      "高雄第三代公文系統_機關發文操作手冊.pdf",
  "研考人員":          "高雄第三代公文系統_研考人員操作手冊.pdf",
  "機關系統管理者":    "高雄第三代公文系統_機關系統管理者操作手冊.pdf",
  "電子交換人員":      "高雄第三代公文系統_新電子交換操作手冊.pdf",
  "影像掃描人員":      "高雄第三代公文系統_影像掃描操作手冊.pdf",
  "檔案管理人員（學校）": "高雄第三代公文系統_檔案管理操作手冊(學校).pdf",
  "檔案管理人員（機關）": "高雄第三代公文系統_檔案管理操作手冊(機關).pdf",
};

let allData   = [];
let dataReady = false;

document.addEventListener('DOMContentLoaded', () => {
  loadSearchData();

  document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    doSearch();
  });

  document.getElementById('roleSelect').addEventListener('change', () => {
    updateRoleStatus();
    clearResults();
  });
});

async function loadSearchData() {
  const loadingBar = document.getElementById('dataLoadingBar');
  const errorBar   = document.getElementById('dataErrorBar');
  const textEl     = document.getElementById('dataLoadingText');

  loadingBar.style.display = '';
  errorBar.style.display   = 'none';

  try {
    textEl.textContent = '正在載入手冊資料，請稍候…';
    const res = await fetch('search-data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allData   = await res.json();
    dataReady = true;
    loadingBar.style.display = 'none';
    updateRoleStatus();
  } catch (err) {
    loadingBar.style.display = 'none';
    errorBar.style.display   = '';
    console.error('載入 search-data.json 失敗：', err);
  }
}

function updateRoleStatus() {
  const role     = document.getElementById('roleSelect').value;
  const statusEl = document.getElementById('roleStatus');

  if (!role) { statusEl.textContent = ''; return; }

  if (!dataReady) {
    statusEl.className   = 'role-status loading';
    statusEl.textContent = '⏳ 手冊資料載入中…';
    return;
  }

  const count = allData.filter(r => r.role === role).length;
  if (count > 0) {
    statusEl.className   = 'role-status loaded';
    statusEl.textContent = `✔ 已載入 ${count} 筆資料，可進行查詢。`;
  } else {
    statusEl.className   = 'role-status';
    statusEl.textContent = '⚠ 此身分尚無資料（search-data.json 可能未包含此身分）。';
    statusEl.style.color = 'var(--warning)';
  }
}

function parseKeywords(query) {
  return query.trim().split(/\s+/).filter(k => k.length > 0);
}

function joinArray(value) {
  return Array.isArray(value) ? value.join(' ') : (value || '');
}

function recordSearchText(record) {
  return [
    record.title,
    joinArray(record.keywords),
    joinArray(record.assistant_steps),
    joinArray(record.notes),
    record.section_title,
    record.manual_name,
    record.exact_text
  ].filter(Boolean).join(' ');
}

function scoreRecord(record, keywords, fullQuery) {
  const text      = recordSearchText(record);
  const title     = record.title || '';
  const section   = record.section_title || '';
  const stepsText = joinArray(record.assistant_steps);
  const keywordText = joinArray(record.keywords);
  let score = 0;
  let allHit = true;

  for (const kw of keywords) {
    const inText = text.includes(kw);
    if (!inText) allHit = false;

    if (title.includes(kw))       score += 35;
    if (keywordText.includes(kw)) score += 28;
    if (section.includes(kw))     score += 20;
    if (stepsText.includes(kw))   score += 14;

    const count = text.split(kw).length - 1;
    score += Math.min(count, 8);
  }

  if (fullQuery) {
    if (title.includes(fullQuery))       score += 45;
    if (keywordText.includes(fullQuery)) score += 35;
    if (section.includes(fullQuery))     score += 25;
    if ((record.exact_text || '').includes(fullQuery)) score += 10;
  }

  if (allHit && keywords.length > 1) score += keywords.length * 8;

  // 先讓人工整理與小助手精選資料排前面，再顯示一般 PDF 頁面原文。
  const typeText = `${record.data_type || ''} ${record.record_type || ''}`;
  if (typeText.includes('小助手') || typeText.includes('curated')) score += 80;
  if (Array.isArray(record.assistant_steps) && record.assistant_steps.length > 0) score += 12;

  // 目錄、封面類頁面通常不是使用者要找的操作步驟，稍微往後排。
  if ((record.exact_text || '').includes('目 錄')) score -= 30;
  if ((record.page_number || 0) <= 4) score -= 10;

  return score;
}

function doSearch() {
  const role  = document.getElementById('roleSelect').value.trim();
  const query = document.getElementById('queryInput').value.trim();

  if (!role)      { alert('請先選擇使用者身分。'); return; }
  if (!query)     { alert('請輸入查詢關鍵字。');   return; }
  if (!dataReady) { alert('手冊資料尚未載入完成，請稍候再試。'); return; }

  clearResults();

  const keywords  = parseKeywords(query);
  const fullQuery = keywords.join('');
  const roleData  = allData.filter(r => r.role === role);

  const scored = roleData
    .map(r => ({ record: r, score: scoreRecord(r, keywords, fullQuery) }))
    .filter(s => s.score > 0);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Number(a.record.page_number || 0) - Number(b.record.page_number || 0);
  });

  renderResults(scored.map(s => s.record), role, query, keywords);
}

function renderResults(results, role, query, keywords) {
  if (!results || results.length === 0) {
    document.getElementById('noResultSection').style.display = '';
    return;
  }

  const section = document.getElementById('resultsSection');
  section.style.display = '';
  document.getElementById('resultsBadge').textContent = `共 ${results.length} 筆`;
  document.getElementById('resultsInfo').textContent  = `身分：${escHtml(role)}　關鍵字：${escHtml(query)}`;

  const list = document.getElementById('resultsList');
  list.innerHTML = '';

  results.slice(0, 50).forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const exactText   = r.exact_text || '';
    const snippetText = extractSnippet(exactText, keywords, 300);
    const snippetHtml = highlightKeywords(escHtml(snippetText), keywords);
    const fullHtml    = highlightKeywords(escHtml(exactText), keywords);
    const hasMore     = exactText.length > snippetText.length;
    const expandId    = `expand-${idx}`;
    const snippetId   = `snippet-${idx}`;
    const fullId      = `full-${idx}`;

    const steps = normalizeSteps(r.assistant_steps);
    const notes = normalizeSteps(r.notes);
    const pageDisplay = Array.isArray(r.source_pages) && r.source_pages.length
      ? `第 ${escHtml(r.source_pages.join('、'))} 頁`
      : `第 ${escHtml(r.page_number)} 頁`;

    card.innerHTML = `
      <div class="result-meta">
        <span class="meta-tag meta-role">👤 ${escHtml(r.role)}</span>
        <span class="meta-tag meta-manual">📄 ${escHtml(r.manual_name)}</span>
        <span class="meta-tag meta-section">📌 ${escHtml(r.title || r.section_title || '未標示章節')}</span>
        <span class="meta-tag meta-page">${pageDisplay}</span>
      </div>

      <div class="assistant-steps-box">
        <div class="assistant-steps-label">☁️ 小助手整理步驟</div>
        <div class="assistant-steps-alert">以下為小助手整理版，實際操作仍請以下方手冊原文依據為準。</div>
        ${renderSteps(steps, keywords)}
        ${renderNotes(notes)}
      </div>

      <div class="result-content-box">
        <div class="result-content-label">📖 手冊原文依據（關鍵字附近段落）</div>
        <div class="result-content-text" id="${snippetId}">${snippetHtml}${hasMore ? '<span class="ellipsis-hint">…</span>' : ''}</div>
        <div class="result-content-text full-text" id="${fullId}" style="display:none">${fullHtml}</div>
        ${hasMore ? `<button class="btn-expand" id="${expandId}" onclick="toggleFull('${snippetId}','${fullId}','${expandId}')">▼ 展開完整原文</button>` : ''}
      </div>
    `;
    list.appendChild(card);
  });
}

function normalizeSteps(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function renderSteps(steps, keywords) {
  if (!steps.length) {
    return `<p class="assistant-empty">此筆資料沒有額外整理步驟，請以下方手冊原文依據為準。</p>`;
  }
  return `
    <ol class="assistant-step-list">
      ${steps.map(step => `<li>${highlightKeywords(escHtml(step), keywords)}</li>`).join('')}
    </ol>
  `;
}

function renderNotes(notes) {
  if (!notes.length) return '';
  return `
    <div class="assistant-notes">
      <div class="assistant-notes-title">提醒</div>
      <ul>
        ${notes.map(note => `<li>${escHtml(note)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function toggleFull(snippetId, fullId, btnId) {
  const snippetEl  = document.getElementById(snippetId);
  const fullEl     = document.getElementById(fullId);
  const btn        = document.getElementById(btnId);
  const isExpanded = fullEl.style.display !== 'none';
  if (isExpanded) {
    fullEl.style.display    = 'none';
    snippetEl.style.display = '';
    btn.textContent = '▼ 展開完整原文';
  } else {
    snippetEl.style.display = 'none';
    fullEl.style.display    = '';
    btn.textContent = '▲ 收合';
  }
}

function extractSnippet(text, keywords, windowSize) {
  if (!keywords || keywords.length === 0 || !text) return text.slice(0, windowSize * 2);
  let idx = -1;
  for (const kw of keywords) {
    idx = text.indexOf(kw);
    if (idx !== -1) break;
  }
  if (idx === -1) return text.slice(0, windowSize * 2);
  const start = Math.max(0, idx - windowSize);
  const end   = Math.min(text.length, idx + keywords[0].length + windowSize);
  let snippet = text.slice(start, end);
  if (start > 0)         snippet = '…' + snippet;
  if (end < text.length) snippet = snippet + '…';
  return snippet;
}

function highlightKeywords(html, keywords) {
  if (!keywords || keywords.length === 0) return html;
  let result = html;
  const unique = [...new Set(keywords)].sort((a, b) => b.length - a.length);
  for (const kw of unique) {
    if (!kw) continue;
    const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(safe, 'g'), m => `<mark>${m}</mark>`);
  }
  return result;
}

function clearAll() {
  document.getElementById('roleSelect').value = '';
  document.getElementById('queryInput').value = '';
  const statusEl = document.getElementById('roleStatus');
  statusEl.textContent = '';
  statusEl.className   = 'role-status';
  statusEl.style.color = '';
  clearResults();
}

function clearResults() {
  document.getElementById('resultsSection').style.display  = 'none';
  document.getElementById('noResultSection').style.display = 'none';
  document.getElementById('resultsList').innerHTML         = '';
}

function escHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
