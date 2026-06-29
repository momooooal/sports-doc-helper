'use strict';

/* ================================================================
   全民運動科公文小助手 — 純靜態版前端搜尋邏輯
   資料來源：search-data.json（由 build_static_index.py 產生）
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

/* ---- 全域狀態 ---- */
let allData   = [];   // 全部頁面記錄
let dataReady = false;

/* ---- DOM 就緒後初始化 ---- */
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

/* ---- 載入 search-data.json ---- */
async function loadSearchData() {
  const loadingBar = document.getElementById('dataLoadingBar');
  const errorBar   = document.getElementById('dataErrorBar');
  const textEl     = document.getElementById('dataLoadingText');

  loadingBar.style.display = '';
  errorBar.style.display   = 'none';

  try {
    textEl.textContent = '正在載入手冊資料，請稍候…';
    const res = await fetch('search-data.json');
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

/* ---- 更新身分狀態提示 ---- */
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
    statusEl.textContent = `✔ 已載入 ${count} 頁資料，可進行查詢。`;
  } else {
    statusEl.className   = 'role-status';
    statusEl.textContent = '⚠ 此身分尚無資料（search-data.json 可能未包含此身分）。';
    statusEl.style.color = 'var(--warning)';
  }
}

/* ---- 解析多關鍵字 ---- */
function parseKeywords(query) {
  return query.trim().split(/\s+/).filter(k => k.length > 0);
}

/* ---- 搜尋計分（越多關鍵字命中、命中越多次，分數越高） ---- */
function scoreRecord(record, keywords) {
  const textParts = [
    record.title,
    Array.isArray(record.keywords) ? record.keywords.join(' ') : '',
    Array.isArray(record.assistant_steps) ? record.assistant_steps.join(' ') : '',
    Array.isArray(record.notes) ? record.notes.join(' ') : '',
    record.exact_text,
    record.section_title,
    record.manual_name
  ];
  const text = textParts.filter(Boolean).join(' ');
  let score  = 0;
  let allHit = true;

  for (const kw of keywords) {
    const count = (text.split(kw).length - 1);
    if (count === 0) { allHit = false; }
    score += count;
  }

  // 所有關鍵字都命中加權
  if (allHit && keywords.length > 1) score += keywords.length * 5;

  // 命中章節標題、主題名稱時再加權，讓更像操作指引的頁面排前面
  const titleText = [record.title, record.section_title].filter(Boolean).join(' ');
  for (const kw of keywords) {
    if (titleText.includes(kw)) score += 8;
  }

  return score;
}

/* ---- 小助手整理步驟：優先讀取資料欄位，沒有就從 exact_text 依原文擷取 ---- */
function buildAssistantSteps(record) {
  if (Array.isArray(record.assistant_steps) && record.assistant_steps.length > 0) {
    return record.assistant_steps
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n');
  }

  const extracted = extractStepsFromText(record.exact_text || '');

  if (extracted.length === 0) {
    return '此頁未擷取到明確步驟，請展開下方手冊原文確認。';
  }

  return extracted
    .slice(0, 8)
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
}

/* ---- 從手冊原文擷取步驟，不新增手冊沒有的操作內容 ---- */
function extractStepsFromText(text) {
  const lines = cleanManualLines(text);
  const steps = [];

  // 1. 擷取「步驟一：……」格式，並串接後面的 A/B/C 說明
  let current = null;

  for (const line of lines) {
    const stepMatch = line.match(/^(?:[（(]\d+[）)]\s*)?步驟[一二三四五六七八九十\d]+[：:]\s*(.+)$/);
    if (stepMatch) {
      if (current) steps.push(current);
      current = stepMatch[1].trim();
      continue;
    }

    const alphaMatch = line.match(/^[A-Z]\.\s*(.+)$/);
    if (current && alphaMatch) {
      const detail = alphaMatch[1].trim();
      if (detail) current += ` → ${detail}`;
      continue;
    }

    // 手冊有些 A/B/C 的下一行會換行，補接短行
    if (current && !looksLikeNewSection(line) && line.length <= 36) {
      const lastPart = current.split(' → ').pop() || '';
      if (lastPart && !lastPart.endsWith('。') && !lastPart.endsWith('】') && !lastPart.endsWith('即可')) {
        current += line;
      }
    }
  }

  if (current) steps.push(current);

  if (steps.length > 0) return uniqueSteps(steps);

  // 2. 擷取「(1) 【按鈕】：說明」格式
  for (const line of lines) {
    const actionMatch = line.match(/^[（(]\d+[）)]\s*【([^】]+)】[：:]\s*(.+)$/);
    if (actionMatch) {
      steps.push(`使用【${actionMatch[1]}】：${actionMatch[2]}`);
    }
  }

  if (steps.length > 0) return uniqueSteps(steps);

  // 3. 擷取「步驟說明：A→B→C」格式
  const flowLine = lines.find(line => line.includes('步驟說明') && line.includes('→'));
  if (flowLine) {
    const flow = flowLine
      .replace(/^.*步驟說明[：:]\s*/, '')
      .split('→')
      .map(part => part.replace(/[（(]\d+[）)]/g, '').trim())
      .filter(Boolean);

    if (flow.length > 0) {
      return flow.map(part => `依序完成：${part}`);
    }
  }

  return [];
}

function cleanManualLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.includes('版權所有'))
    .filter(line => !line.includes('Copyright'))
    .filter(line => !/^高雄市政府第三代公文整合系統/.test(line))
    .filter(line => !/^康大資訊/.test(line))
    .filter(line => !/^文件版本/.test(line));
}

function looksLikeNewSection(line) {
  return (
    /^[（(]\d+[）)]/.test(line) ||
    /^步驟[一二三四五六七八九十\d]+[：:]/.test(line) ||
    /^[一二三四五六七八九十\d]+[、.]/.test(line) ||
    /^第[一二三四五六七八九十\d]+/.test(line)
  );
}

function uniqueSteps(steps) {
  const seen = new Set();
  return steps
    .map(step => step.replace(/\s+/g, ' ').trim())
    .filter(step => {
      if (!step || seen.has(step)) return false;
      seen.add(step);
      return true;
    });
}


/* ---- 執行查詢 ---- */
function doSearch() {
  const role  = document.getElementById('roleSelect').value.trim();
  const query = document.getElementById('queryInput').value.trim();

  if (!role)      { alert('請先選擇使用者身分。'); return; }
  if (!query)     { alert('請輸入查詢關鍵字。');   return; }
  if (!dataReady) { alert('手冊資料尚未載入完成，請稍候再試。'); return; }

  clearResults();

  const keywords = parseKeywords(query);

  // 1. 篩選該身分資料
  const roleData = allData.filter(r => r.role === role);

  // 2. 計分並過濾零分（至少有一個關鍵字命中）
  const scored = roleData
    .map(r => ({ record: r, score: scoreRecord(r, keywords) }))
    .filter(s => s.score > 0);

  // 3. 依分數降冪、頁碼升冪排序
  scored.sort((a, b) => b.score - a.score || a.record.page_number - b.record.page_number);

  renderResults(scored.map(s => s.record), role, query, keywords);
}

/* ---- 渲染結果 ---- */
function renderResults(results, role, query, keywords) {
  if (!results || results.length === 0) {
    document.getElementById('noResultSection').style.display = '';
    return;
  }

  const section = document.getElementById('resultsSection');
  section.style.display = '';
  document.getElementById('resultsBadge').textContent =
    `共 ${results.length} 筆`;
  document.getElementById('resultsInfo').textContent  =
    `身分：${escHtml(role)}　關鍵字：${escHtml(query)}`;

  const list = document.getElementById('resultsList');
  list.innerHTML = '';

  results.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const assistantText = buildAssistantSteps(r);
    const assistantHtml = highlightKeywords(escHtml(assistantText), keywords);

    const snippetText = extractSnippet(r.exact_text, keywords, 300);
    const fullText    = r.exact_text;
    const snippetHtml = highlightKeywords(escHtml(snippetText), keywords);
    const fullHtml    = highlightKeywords(escHtml(fullText), keywords);
    const hasMore     = fullText.length > snippetText.length;
    const expandId    = `expand-${idx}`;
    const snippetId   = `snippet-${idx}`;
    const fullId      = `full-${idx}`;

    card.innerHTML = `
      <div class="result-meta">
        <span class="meta-tag meta-role">👤 ${escHtml(r.role)}</span>
        <span class="meta-tag meta-manual">📄 ${escHtml(r.manual_name)}</span>
        <span class="meta-tag meta-section">📌 ${escHtml(r.section_title)}</span>
        <span class="meta-tag meta-page">第 ${r.page_number} 頁</span>
      </div>

      <div class="result-content-box" style="margin-bottom:12px;">
        <div class="result-content-label">☁️ 小助手整理步驟（依手冊原文擷取）</div>
        <div class="result-content-text">${assistantHtml}</div>
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


/* ---- 展開/收合 ---- */
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

/* ---- 擷取關鍵字附近摘錄 ---- */
function extractSnippet(text, keywords, windowSize) {
  if (!keywords || keywords.length === 0 || !text) return text.slice(0, windowSize * 2);
  const kw  = keywords[0];
  const idx = text.indexOf(kw);
  if (idx === -1) return text.slice(0, windowSize * 2);
  const start   = Math.max(0, idx - windowSize);
  const end     = Math.min(text.length, idx + kw.length + windowSize);
  let snippet   = text.slice(start, end);
  if (start > 0)          snippet = '…' + snippet;
  if (end < text.length)  snippet = snippet + '…';
  return snippet;
}

/* ---- 多關鍵字高亮（僅顯示層，不改原文） ---- */
function highlightKeywords(html, keywords) {
  if (!keywords || keywords.length === 0) return html;
  let result = html;
  for (const kw of keywords) {
    if (!kw) continue;
    const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(safe, 'g'), m => `<mark>${m}</mark>`);
  }
  return result;
}

/* ---- 清除 ---- */
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

/* ---- 工具 ---- */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}
