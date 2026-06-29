'use strict';

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
let activeSuggestionIndex = -1;
let currentQuickCategory = '常用待辦';
let quickGuideCollapsed = false;

const ROLE_CATEGORY_ORDER = {
  '承辦人': ['常用待辦', '案例流程', '表單申請', '個人設定', '常見問題', '其他查詢'],
  '登記桌人員': ['常用待辦', '代理模式', '案例流程', '查詢報表', '個人設定', '常見問題'],
  '基層主管': ['常用待辦', '核閱決行', '案例流程', '表單申請', '查詢報表', '個人設定', '常見問題'],
  '核判長官': ['常用待辦', '核判決行', '受會會辦', '案例流程', '查詢報表', '個人設定', '常見問題'],
};

document.addEventListener('DOMContentLoaded', () => {
  loadSearchData();

  document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    doSearch();
  });

  document.getElementById('roleSelect').addEventListener('change', () => {
    updateRoleStatus();
    clearResults();
    updateQuickGuidePanel();
    hideSuggestions();
  });

  const queryInput = document.getElementById('queryInput');
  queryInput.addEventListener('input', updateSuggestions);
  queryInput.addEventListener('focus', updateSuggestions);
  queryInput.addEventListener('keydown', handleSuggestionKeydown);

  const quickToggle = document.getElementById('quickGuideToggle');
  if (quickToggle) {
    quickToggle.addEventListener('click', () => {
      quickGuideCollapsed = !quickGuideCollapsed;
      updateQuickGuidePanel();
    });
  }

  document.addEventListener('click', event => {
    const wrap = document.querySelector('.search-suggest-wrap');
    if (wrap && !wrap.contains(event.target)) hideSuggestions();
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
    updateQuickGuidePanel();
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


function getCuratedRecordsForRole(role) {
  return allData.filter(r => r.role === role && isCuratedRecord(r) && Array.isArray(r.assistant_steps) && r.assistant_steps.length > 0);
}

function getCategoryOrder(role) {
  return ROLE_CATEGORY_ORDER[role] || ['常用操作'];
}

function getRecordCategory(record) {
  if (record.role === '登記桌人員') return getDeskCategory(record);
  if (record.role === '基層主管') return getSupervisorCategory(record);
  if (record.role === '核判長官') return getJudgeCategory(record);
  return getChengbanCategory(record);
}

function getChengbanCategory(record) {
  const title = record.title || '';
  const words = `${title} ${joinArray(record.keywords)}`;

  if (/(電子來文|紙本來文|創簽稿|函覆|多稿|密件|紙本創簽稿|轉紙本)/.test(words)) return '案例流程';
  if (/(展期|專案|速別|性質|銷號|延後歸檔|檔案目錄|調閱|調案|特殊性案件|申請)/.test(words)) return '表單申請';
  if (/(儀表板|自訂流程|個人資料|代理|被代理|憑證)/.test(words)) return '個人設定';
  if (/(筆硯|BIN|附件|大型附件|紙本如何處理|沒有資料|總發文|常見問題|確定送發)/.test(words)) return '常見問題';
  if (/(查詢|報表|列印|群組|抽樣分析|檔案歸還|會辦公文)/.test(words)) return '其他查詢';
  return '常用待辦';
}



function getSupervisorCategory(record) {
  const title = record.title || '';
  const words = `${title} ${joinArray(record.keywords)} ${record.section_title || ''}`;

  if (/^(待簽收|承辦中|受會案件|待結案|待歸檔|待複閱|待補簽章)/.test(title)) return '常用待辦';
  if (/^(陳核案件|表單核閱)/.test(title)) return '核閱決行';
  if (/^案例流程/.test(title)) return '案例流程';
  if (/^(表單申請|公文展期|公文專案|公文速別|公文銷號|公文延後歸檔|檔案目錄|調案查詢|特殊性案件)/.test(title)) return '表單申請';
  if (/^(已處理公文|承辦作業|查詢|報表列印|應用作業)/.test(title)) return '查詢報表';
  if (/^(共通性作業|個人化儀表板|自訂流程|個人資料|設定代理|被代理|個人憑證)/.test(title)) return '個人設定';
  if (/^(常見問題)/.test(title)) return '常見問題';

  if (/(補簽|待簽收|承辦中|受會|待結案|待歸檔|複閱)/.test(words)) return '常用待辦';
  if (/(陳核|決行|核閱|審核|退件|流程變更)/.test(words)) return '核閱決行';
  if (/(案例流程|線上公文|紙本公文|核判變更流程)/.test(words)) return '案例流程';
  if (/(展期|專案|速別|性質|銷號|延後歸檔|調閱|調案|特殊性案件|表單申請)/.test(words)) return '表單申請';
  if (/(查詢|報表|列印|清單|登記簿|應用|抽樣分析|發文群組|會辦案件)/.test(words)) return '查詢報表';
  if (/(儀表板|自訂流程|個人資料|代理|憑證)/.test(words)) return '個人設定';
  return '常用待辦';
}

function getJudgeCategory(record) {
  const title = record.title || '';
  const words = `${title} ${joinArray(record.keywords)} ${record.section_title || ''}`;

  if (/^(待簽收|待複閱|表單核閱|待補簽章)/.test(title)) return '常用待辦';
  if (/^(待核判)/.test(title)) return '核判決行';
  if (/^(受會待核判)/.test(title)) return '受會會辦';
  if (/^案例流程/.test(title)) return '案例流程';
  if (/^(已處理公文|查詢|報表列印|核判長官作業)/.test(title)) return '查詢報表';
  if (/^(共通性作業|個人化儀表板|個人資料|設定代理|被代理|個人憑證)/.test(title)) return '個人設定';
  if (/^(常見問題|補簽作業)/.test(title)) return '常見問題';

  if (/(受會|會畢|會辦)/.test(words)) return '受會會辦';
  if (/(核判|決行|送陳|退回|退文|流程變更)/.test(words)) return '核判決行';
  if (/(案例流程|電子來文|紙本來文|複閱|變更流程)/.test(words)) return '案例流程';
  if (/(查詢|清單|收文簿|列印|未結案|已結案|會畢公文)/.test(words)) return '查詢報表';
  if (/(儀表板|個人資料|代理|憑證)/.test(words)) return '個人設定';
  return '常用待辦';
}

function getDeskCategory(record) {
  const title = record.title || '';
  const words = `${title} ${joinArray(record.keywords)} ${record.section_title || ''}`;

  // 先看標題前綴，避免「簽收」因為含有查詢、紙本來文等關鍵字被分到其他類。
  if (/^(待簽收|待分文|來文分文|已處理公文：對方未簽收)/.test(title)) return '常用待辦';
  if (/^代理模式/.test(title)) return '代理模式';
  if (/^案例流程/.test(title)) return '案例流程';
  if (/^(登記桌處理|報表列印|已處理公文)/.test(title)) return '查詢報表';
  if (/^共通性作業/.test(title)) return '個人設定';
  if (/^常見問題/.test(title)) return '常見問題';

  if (/(常見問題|為甚麼|為什麼|如何設定單位|設定登記桌|系統管理|組織及單位代碼管理)/.test(words)) return '常見問題';
  if (/(個人化儀表板|個人資料|設定代理作業|被代理查詢|共通性作業)/.test(words)) return '個人設定';
  if (/(案例流程|電子來文|紙本來文|函覆發文|轉紙本|來文分文完整流程)/.test(words)) return '案例流程';
  if (/(登記簿|清單|報表|查詢|列印|催辦|逾期|彙總|送文|會辦|未結案|已結案|Excel|PDF)/.test(words)) return '查詢報表';
  if (/(代理模式|承辦中|待結案|受會案件|待歸檔|轉線上|單位決行|送陳|存查|送發|續辦|送檔|歸檔|註銷|變更承辦人|移交|彙辦|併辦|會畢)/.test(words)) return '代理模式';
  return '常用待辦';
}

function updateQuickGuidePanel() {
  const panel = document.getElementById('quickGuidePanel');
  const body = document.getElementById('quickGuideBody');
  const toggle = document.getElementById('quickGuideToggle');
  const role = document.getElementById('roleSelect').value;

  if (!panel || !body || !toggle) return;

  if (!dataReady || !role || getCuratedRecordsForRole(role).length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  body.style.display = quickGuideCollapsed ? 'none' : '';
  toggle.textContent = quickGuideCollapsed ? '展開選單' : '收合選單';

  if (!quickGuideCollapsed) renderQuickGuide();
}

function renderQuickGuide() {
  const categoryEl = document.getElementById('quickGuideCategories');
  const optionEl = document.getElementById('quickGuideOptions');
  if (!categoryEl || !optionEl) return;

  const role = document.getElementById('roleSelect').value;
  const order = getCategoryOrder(role);
  const records = getCuratedRecordsForRole(role);
  const grouped = {};
  for (const category of order) grouped[category] = [];
  for (const record of records) {
    const category = getRecordCategory(record);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(record);
  }

  if (!grouped[currentQuickCategory] || grouped[currentQuickCategory].length === 0) {
    currentQuickCategory = order.find(c => grouped[c] && grouped[c].length > 0) || order[0] || '常用操作';
  }

  categoryEl.innerHTML = order
    .filter(category => grouped[category] && grouped[category].length > 0)
    .map(category => `
      <button type="button" class="quick-category-btn ${category === currentQuickCategory ? 'active' : ''}" onclick="selectQuickCategory('${escAttr(category)}')">
        ${category}<span>${grouped[category].length}</span>
      </button>
    `).join('');

  optionEl.innerHTML = (grouped[currentQuickCategory] || [])
    .map(record => renderQuickOption(record))
    .join('');
}

function renderQuickOption(record) {
  const keywords = Array.isArray(record.keywords) ? record.keywords.slice(0, 4) : [];
  const firstStep = normalizeSteps(record.assistant_steps)[0] || '點選後直接查看小助手整理步驟。';
  return `
    <button type="button" class="quick-option-card" onclick="searchFromChoice('${escAttr(record.role || '')}', '${escAttr(record.title || '')}')">
      <span class="quick-option-title">${escHtml(record.title || '')}</span>
      <span class="quick-option-desc">${escHtml(firstStep)}</span>
      <span class="quick-option-tags">
        ${keywords.map(k => `<i>${escHtml(k)}</i>`).join('')}
      </span>
    </button>
  `;
}

function selectQuickCategory(category) {
  currentQuickCategory = category;
  renderQuickGuide();
}

function searchFromChoice(role, query) {
  const roleSelect = document.getElementById('roleSelect');
  const queryInput = document.getElementById('queryInput');
  if (role) roleSelect.value = role;
  queryInput.value = query;
  hideSuggestions();
  updateRoleStatus();
  updateQuickGuidePanel();
  doSearch();
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function suggestionScore(record, query, keywords) {
  const title = record.title || '';
  const keywordText = joinArray(record.keywords);
  const stepsText = joinArray(record.assistant_steps);
  const searchText = `${title} ${keywordText} ${stepsText}`;
  let score = 0;

  if (!query) return 0;
  if (title === query) score += 1000;
  if (title.includes(query)) score += 700;
  if (keywordText.includes(query)) score += 520;
  if (stepsText.includes(query)) score += 180;

  let hit = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    if (title.includes(kw)) score += 120;
    if (keywordText.includes(kw)) score += 100;
    if (stepsText.includes(kw)) score += 35;
    if (searchText.includes(kw)) hit += 1;
  }
  if (hit === keywords.length && keywords.length > 1) score += 160;
  return score;
}

function getSuggestions(query) {
  const role = document.getElementById('roleSelect').value;
  if (!dataReady || !role || !query.trim()) return [];

  const keywords = parseKeywords(query);
  const fullQuery = keywords.join('');
  return getCuratedRecordsForRole(role)
    .map(record => ({ record, score: suggestionScore(record, fullQuery, keywords) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.record.title || '').localeCompare(String(b.record.title || ''), 'zh-Hant'))
    .slice(0, 8)
    .map(item => item.record);
}

function updateSuggestions() {
  const box = document.getElementById('suggestionBox');
  const input = document.getElementById('queryInput');
  const role = document.getElementById('roleSelect').value;
  if (!box || !input) return;

  if (!dataReady || !role) {
    hideSuggestions();
    return;
  }

  const query = input.value.trim();
  const suggestions = getSuggestions(query);
  activeSuggestionIndex = -1;

  if (!query || suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  box.innerHTML = `
    <div class="suggestion-title">你可能想查：</div>
    ${suggestions.map((record, index) => renderSuggestionItem(record, index)).join('')}
  `;
  box.style.display = '';
}

function renderSuggestionItem(record, index) {
  const keywords = Array.isArray(record.keywords) ? record.keywords.slice(0, 3) : [];
  return `
    <button type="button" class="suggestion-item" data-index="${index}" onclick="searchFromChoice('${escAttr(record.role || '')}', '${escAttr(record.title || '')}')">
      <span class="suggestion-main">${escHtml(record.title || '')}</span>
      <span class="suggestion-sub">${keywords.map(k => escHtml(k)).join('・')}</span>
    </button>
  `;
}

function handleSuggestionKeydown(event) {
  const box = document.getElementById('suggestionBox');
  if (!box || box.style.display === 'none') return;
  const items = [...box.querySelectorAll('.suggestion-item')];
  if (!items.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
    updateSuggestionActive(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
    updateSuggestionActive(items);
  } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
    event.preventDefault();
    items[activeSuggestionIndex].click();
  } else if (event.key === 'Escape') {
    hideSuggestions();
  }
}

function updateSuggestionActive(items) {
  items.forEach((item, idx) => item.classList.toggle('active', idx === activeSuggestionIndex));
}

function hideSuggestions() {
  const box = document.getElementById('suggestionBox');
  if (box) box.style.display = 'none';
  activeSuggestionIndex = -1;
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

function isCuratedRecord(record) {
  const typeText = `${record.data_type || ''} ${record.record_type || ''}`;
  return typeText.includes('curated') || typeText.includes('小助手') || typeText.includes('精選');
}

function querySpecificity(fullQuery, keywords) {
  const q = (fullQuery || '').trim();
  if (!q) return 'none';
  // 很廣的詞容易命中很多操作，最多顯示 2 筆；其他情況只顯示最符合的 1 筆。
  const broadTerms = ['發文', '查詢', '申請', '存查', '歸檔', '簽收', '分文', '代理', '代理模式', '送出', '列印', '設定', '公文', '附件', '報表', '核判', '批核', '決行', '複閱', '表單', '會辦', '送陳會', '送陳/會', '退文', '抽回'];
  if (broadTerms.includes(q)) return 'broad';
  if (q.length <= 1) return 'broad';
  return 'specific';
}

function curatedMatchLevel(record, keywords, fullQuery) {
  const title = record.title || '';
  const keywordText = joinArray(record.keywords);
  const stepsText = joinArray(record.assistant_steps);
  const section = record.section_title || '';
  const q = fullQuery || '';

  if (!q) return 0;
  if (title === q) return 1000;
  if (title.includes(q) || q.includes(title)) return 900;
  if ((record.keywords || []).some(k => k === q)) return 850;
  if (keywordText.includes(q)) return 750;
  if (section.includes(q)) return 650;

  let hitCount = 0;
  for (const kw of keywords) {
    if (title.includes(kw) || keywordText.includes(kw) || stepsText.includes(kw) || section.includes(kw)) {
      hitCount += 1;
    }
  }
  if (hitCount === keywords.length && keywords.length > 1) return 500;
  if (hitCount > 0) return 250;
  return 0;
}

function pickBestResults(scored, role, fullQuery, keywords = []) {
  const curatedScored = scored
    .filter(s => isCuratedRecord(s.record))
    .map(s => ({
      ...s,
      matchLevel: curatedMatchLevel(s.record, keywords, fullQuery)
    }))
    .filter(s => s.matchLevel > 0)
    .sort((a, b) => {
      if (b.matchLevel !== a.matchLevel) return b.matchLevel - a.matchLevel;
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.record.page_number || 0) - Number(b.record.page_number || 0);
    });

  const pageScored = scored.filter(s => !isCuratedRecord(s.record));

  // 有小助手整理資料時，只顯示最精準的整理結果，不再讓 PDF 原文頁面洗版。
  if (curatedScored.length > 0) {
    const specificity = querySpecificity(fullQuery, keywords);
    const limit = specificity === 'broad' ? 2 : 1;

    return {
      results: curatedScored.slice(0, limit).map(s => s.record),
      mode: 'curated',
      total: curatedScored.length,
      hidden: Math.max(curatedScored.length - limit, 0)
    };
  }

  // 找不到小助手整理時，才顯示最相關的 1 筆原文頁面作為備援。
  return {
    results: pageScored.slice(0, 1).map(s => s.record),
    mode: 'fallback',
    total: pageScored.length,
    hidden: Math.max(pageScored.length - 1, 0)
  };
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
    .filter(s => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.record.page_number || 0) - Number(b.record.page_number || 0);
    });

  const picked = pickBestResults(scored, role, fullQuery, keywords);
  renderResults(picked.results, role, query, keywords, picked.mode, picked.total, picked.hidden);
}

function renderResults(results, role, query, keywords, mode = 'curated', total = 0, hidden = 0) {
  if (!results || results.length === 0) {
    document.getElementById('noResultSection').style.display = '';
    return;
  }

  const section = document.getElementById('resultsSection');
  section.style.display = '';
  document.getElementById('resultsBadge').textContent = `顯示 ${results.length} 筆`;
  document.getElementById('resultsInfo').textContent  = mode === 'curated'
    ? `身分：${escHtml(role)}　關鍵字：${escHtml(query)}　｜已只顯示最符合的小助手指引${hidden > 0 ? `，另有 ${hidden} 筆相關結果已隱藏，請用更完整關鍵字縮小範圍。` : '。'}`
    : `身分：${escHtml(role)}　關鍵字：${escHtml(query)}　｜未找到小助手整理，僅顯示最相關的原文頁面參考。`;

  const list = document.getElementById('resultsList');
  list.innerHTML = '';

  results.forEach((r, idx) => {
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

      <details class="evidence-details">
        <summary>📖 查看手冊原文依據</summary>
        <div class="result-content-box">
          <div class="result-content-label">手冊原文依據（關鍵字附近段落）</div>
          <div class="result-content-text" id="${snippetId}">${snippetHtml}${hasMore ? '<span class="ellipsis-hint">…</span>' : ''}</div>
          <div class="result-content-text full-text" id="${fullId}" style="display:none">${fullHtml}</div>
          ${hasMore ? `<button class="btn-expand" id="${expandId}" onclick="toggleFull('${snippetId}','${fullId}','${expandId}')">▼ 展開完整原文</button>` : ''}
        </div>
      </details>
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
    return `<p class="assistant-empty">此筆尚無小助手整理步驟，請展開手冊原文依據確認。</p>`;
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
  hideSuggestions();
  updateQuickGuidePanel();
  clearResults();
}

function clearResults() {
  document.getElementById('resultsSection').style.display  = 'none';
  document.getElementById('noResultSection').style.display = 'none';
  document.getElementById('resultsList').innerHTML         = '';
}

function escAttr(str) {
  return escHtml(str).replace(/`/g, '&#096;');
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
