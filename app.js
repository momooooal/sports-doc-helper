const roles = [
  "承辦人",
  "基層主管",
  "核判長官",
  "登記桌人員",
  "機關收文人員",
  "機關發文人員",
  "研考人員",
  "機關系統管理者",
  "電子交換人員",
  "影像掃描人員",
  "檔案管理人員（學校）",
  "檔案管理人員（機關）"
];

let manualData = [];

const roleSelect = document.getElementById("roleSelect");
const queryInput = document.getElementById("queryInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");
const resultCount = document.getElementById("resultCount");
const dataStatus = document.getElementById("dataStatus");

function initRoles() {
  roles.forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    roleSelect.appendChild(option);
  });
}

async function loadData() {
  try {
    const response = await fetch("search-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("無法讀取 search-data.json");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("search-data.json 格式錯誤，最外層必須是陣列");
    manualData = data;
    dataStatus.textContent = `目前已載入 ${manualData.length.toLocaleString()} 筆「小助手整理步驟＋手冊原文依據」。`;
  } catch (error) {
    console.error(error);
    dataStatus.textContent = "資料載入失敗，請確認 search-data.json 是否存在且格式正確。";
    dataStatus.classList.add("error-text");
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

function splitKeywords(query) {
  return normalizeText(query)
    .split(/\s+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function getSearchBlob(item) {
  return normalizeText([
    item.title,
    item.keywords?.join(" "),
    item.assistant_steps?.join(" "),
    item.notes?.join(" "),
    item.manual_name,
    item.section_title,
    item.exact_text
  ].join(" "));
}

function scoreItem(item, keywords, rawQuery) {
  const fullQuery = normalizeText(rawQuery).replace(/\s+/g, "");
  const title = normalizeText(item.title);
  const sectionTitle = normalizeText(item.section_title);
  const keywordsText = normalizeText((item.keywords || []).join(" "));
  const stepsText = normalizeText((item.assistant_steps || []).join(" "));
  const exactText = normalizeText(item.exact_text);
  const blob = getSearchBlob(item);
  let score = 0;

  keywords.forEach((keyword) => {
    if (title.includes(keyword)) score += 14;
    if (keywordsText.includes(keyword)) score += 10;
    if (sectionTitle.includes(keyword)) score += 8;
    if (stepsText.includes(keyword)) score += 5;
    if (exactText.includes(keyword)) score += 3;
    if (blob.includes(keyword)) score += 1;
  });

  if (fullQuery) {
    if (title.includes(fullQuery)) score += 18;
    if (keywordsText.includes(fullQuery)) score += 12;
    if (sectionTitle.includes(fullQuery)) score += 10;
    if (stepsText.includes(fullQuery)) score += 5;
    if (exactText.includes(fullQuery)) score += 4;
  }
  return score;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, keywords) {
  let safeText = escapeHTML(text);
  const uniqueKeywords = [...new Set(keywords)]
    .filter((keyword) => keyword.length > 0)
    .sort((a, b) => b.length - a.length);
  uniqueKeywords.forEach((keyword) => {
    const safeKeyword = escapeHTML(keyword);
    const pattern = new RegExp(escapeRegExp(safeKeyword), "gi");
    safeText = safeText.replace(pattern, (match) => `<mark>${match}</mark>`);
  });
  return safeText;
}

function showEmpty(message) {
  results.innerHTML = `<div class="empty-state">☁️ ${escapeHTML(message)}</div>`;
  resultCount.textContent = "";
}

function renderSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return `<p class="muted-text">本筆資料尚未建立小助手整理步驟，請直接查看下方手冊原文依據。</p>`;
  }
  return `<ol class="steps-list">${steps.map((step) => `<li>${escapeHTML(step)}</li>`).join("")}</ol>`;
}

function renderNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  return `
    <div class="note-box">
      <div class="section-label">注意事項</div>
      <ul>${notes.map((note) => `<li>${escapeHTML(note)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderResults(items, keywords) {
  if (items.length === 0) {
    showEmpty("查無對應指引，請改用其他關鍵字查詢。");
    return;
  }

  const limitedItems = items.slice(0, 30);
  resultCount.textContent = `顯示 ${limitedItems.length} 筆，共找到 ${items.length} 筆`;

  results.innerHTML = limitedItems.map((item, index) => {
    const highlightedText = highlightText(item.exact_text, keywords);
    const sourcePages = Array.isArray(item.source_pages) ? item.source_pages.join("、") : item.page_number;
    return `
      <article class="result-card">
        <div class="result-title-row">
          <div>
            <div class="mini-label">第 ${index + 1} 筆</div>
            <h3>${escapeHTML(item.title || item.section_title || "未命名指引")}</h3>
          </div>
          <span class="role-chip">${escapeHTML(item.role)}</span>
        </div>

        <div class="assistant-box">
          <div class="assistant-head">🌟 小助手整理步驟</div>
          <div class="source-warning">以下為小助手整理版，實際操作仍請以下方手冊原文為準。</div>
          ${renderSteps(item.assistant_steps)}
        </div>

        ${renderNotes(item.notes)}

        <details class="source-details">
          <summary>📖 展開手冊原文依據</summary>
          <div class="source-meta">
            <span>來源手冊：${escapeHTML(item.manual_name)}</span>
            <span>章節：${escapeHTML(item.section_title || "未標示章節")}</span>
            <span>PDF頁碼：${escapeHTML(sourcePages)}</span>
          </div>
          <div class="exact-text">${highlightedText}</div>
        </details>
      </article>
    `;
  }).join("");
}

function searchManuals() {
  const selectedRole = roleSelect.value;
  const query = queryInput.value.trim();
  if (!selectedRole) return showEmpty("請先選擇身分。");
  if (!query) return showEmpty("請輸入查詢關鍵字。");
  if (manualData.length === 0) return showEmpty("目前尚未載入資料，請確認 search-data.json。");

  const keywords = splitKeywords(query);
  const roleData = manualData.filter((item) => item.role === selectedRole);
  const searched = roleData
    .map((item) => ({ ...item, _score: scoreItem(item, keywords, query) }))
    .filter((item) => item._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return Number(a.page_number || 0) - Number(b.page_number || 0);
    });
  renderResults(searched, keywords);
}

function clearSearch() {
  queryInput.value = "";
  results.innerHTML = "";
  resultCount.textContent = "";
  roleSelect.focus();
}

searchBtn.addEventListener("click", searchManuals);
clearBtn.addEventListener("click", clearSearch);
queryInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchManuals();
});

initRoles();
loadData();
