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

    if (!response.ok) {
      throw new Error("無法讀取 search-data.json");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("search-data.json 格式錯誤，最外層必須是陣列");
    }

    manualData = data;
    dataStatus.textContent = `目前已載入 ${manualData.length.toLocaleString()} 筆手冊原文資料。`;
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

function scoreItem(item, keywords) {
  const exactText = normalizeText(item.exact_text);
  const sectionTitle = normalizeText(item.section_title);
  const manualName = normalizeText(item.manual_name);

  let score = 0;

  keywords.forEach((keyword) => {
    if (exactText.includes(keyword)) score += 5;
    if (sectionTitle.includes(keyword)) score += 4;
    if (manualName.includes(keyword)) score += 1;
  });

  const fullQuery = keywords.join("");
  if (fullQuery && exactText.includes(fullQuery)) score += 8;
  if (fullQuery && sectionTitle.includes(fullQuery)) score += 6;

  return score;
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function showEmpty(message) {
  results.innerHTML = `
    <div class="empty-state">
      ☁️ ${escapeHTML(message)}
    </div>
  `;
  resultCount.textContent = "";
}

function renderResults(items, keywords) {
  if (items.length === 0) {
    showEmpty("查無對應原文指引，請改用其他關鍵字查詢。");
    return;
  }

  const limitedItems = items.slice(0, 30);
  resultCount.textContent = `顯示 ${limitedItems.length} 筆，共找到 ${items.length} 筆`;

  results.innerHTML = limitedItems
    .map((item) => {
      const highlightedText = highlightText(item.exact_text, keywords);

      return `
        <article class="result-card">
          <div class="result-meta">
            <span class="meta-pill">身分：${escapeHTML(item.role)}</span>
            <span class="meta-pill">來源手冊：${escapeHTML(item.manual_name)}</span>
            <span class="meta-pill">章節：${escapeHTML(item.section_title || "未標示章節")}</span>
            <span class="meta-pill">頁碼：第 ${escapeHTML(item.page_number)} 頁</span>
          </div>
          <div class="exact-text">${highlightedText}</div>
        </article>
      `;
    })
    .join("");
}

function searchManuals() {
  const selectedRole = roleSelect.value;
  const query = queryInput.value.trim();

  if (!selectedRole) {
    showEmpty("請先選擇身分。");
    return;
  }

  if (!query) {
    showEmpty("請輸入查詢關鍵字。");
    return;
  }

  if (manualData.length === 0) {
    showEmpty("目前尚未載入手冊資料，請確認 search-data.json。");
    return;
  }

  const keywords = splitKeywords(query);
  const roleData = manualData.filter((item) => item.role === selectedRole);

  const searched = roleData
    .map((item) => ({
      ...item,
      _score: scoreItem(item, keywords)
    }))
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
  if (event.key === "Enter") {
    searchManuals();
  }
});

initRoles();
loadData();
