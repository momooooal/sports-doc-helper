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

const quickWords = ["紙本來文存查", "電子來文函覆發文", "補簽", "設定代理", "待核判", "來文分文", "紙本收文登錄", "點收作業", "編目", "掃描"];
let manualData = [];

const roleSelect = document.getElementById("roleSelect");
const queryInput = document.getElementById("queryInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");
const resultCount = document.getElementById("resultCount");
const dataStatus = document.getElementById("dataStatus");
const quickSearches = document.getElementById("quickSearches");

function initRoles(){
  roles.forEach(role=>{
    const option=document.createElement("option");
    option.value=role;
    option.textContent=role;
    roleSelect.appendChild(option);
  });
}

function initQuickWords(){
  quickSearches.innerHTML = quickWords.map(word => `<button class="quick-chip" type="button" data-word="${escapeHTML(word)}">${escapeHTML(word)}</button>`).join("");
  quickSearches.addEventListener("click", (event)=>{
    const btn = event.target.closest(".quick-chip");
    if(!btn) return;
    queryInput.value = btn.dataset.word;
    queryInput.focus();
  });
}

async function loadData(){
  try{
    const response = await fetch("search-data.json", {cache:"no-store"});
    if(!response.ok) throw new Error("無法讀取 search-data.json");
    const data = await response.json();
    if(!Array.isArray(data)) throw new Error("search-data.json 最外層必須是陣列");
    manualData = data;
    const curated = manualData.filter(item => item.data_type === "小助手精選").length;
    const pages = manualData.filter(item => item.data_type === "PDF全頁原文").length;
    dataStatus.textContent = `已載入 ${manualData.length.toLocaleString()} 筆資料：${curated.toLocaleString()} 筆精選操作指引 + ${pages.toLocaleString()} 頁 PDF 原文。`;
  }catch(error){
    console.error(error);
    dataStatus.innerHTML = `<span class="error-state">資料載入失敗：請確認 search-data.json 是否已上傳且格式正確。</span>`;
  }
}

function escapeHTML(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeRegExp(value){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value){
  return String(value ?? "").toLowerCase().trim();
}

function splitKeywords(query){
  const raw = normalize(query);
  const bySpace = raw.split(/\s+/).filter(Boolean);
  if(bySpace.length > 1) return bySpace;
  return raw ? [raw] : [];
}

function itemSearchText(item){
  return [
    item.title,
    Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords,
    Array.isArray(item.assistant_steps) ? item.assistant_steps.join(" ") : item.assistant_steps,
    Array.isArray(item.notes) ? item.notes.join(" ") : item.notes,
    item.manual_name,
    item.section_title,
    item.exact_text
  ].map(normalize).join(" ");
}

function scoreItem(item, keywords, fullQuery){
  const title = normalize(item.title);
  const section = normalize(item.section_title);
  const exact = normalize(item.exact_text);
  const steps = normalize(Array.isArray(item.assistant_steps) ? item.assistant_steps.join(" ") : "");
  const kw = normalize(Array.isArray(item.keywords) ? item.keywords.join(" ") : "");
  const all = `${title} ${section} ${exact} ${steps} ${kw}`;
  let score = item.data_type === "小助手精選" ? 80 : 0;
  keywords.forEach(k=>{
    if(title.includes(k)) score += 50;
    if(section.includes(k)) score += 34;
    if(kw.includes(k)) score += 32;
    if(steps.includes(k)) score += 22;
    if(exact.includes(k)) score += 12;
    if(all.includes(k)) score += 5;
  });
  if(fullQuery){
    if(title.includes(fullQuery)) score += 60;
    if(section.includes(fullQuery)) score += 40;
    if(kw.includes(fullQuery)) score += 35;
    if(exact.includes(fullQuery)) score += 18;
  }
  return score;
}

function highlightText(text, keywords){
  let safe = escapeHTML(text);
  const unique = [...new Set(keywords)].filter(Boolean).sort((a,b)=>b.length-a.length);
  unique.forEach(keyword=>{
    const pattern = new RegExp(escapeRegExp(escapeHTML(keyword)), "gi");
    safe = safe.replace(pattern, match=>`<mark>${match}</mark>`);
  });
  return safe;
}

function showEmpty(message){
  resultCount.textContent = "";
  results.innerHTML = `<div class="empty-state">☁️ ${escapeHTML(message)}</div>`;
}

function renderResults(items, keywords){
  if(items.length === 0){
    showEmpty("查無對應原文指引，請改用其他關鍵字查詢。");
    return;
  }
  const limited = items.slice(0, 40);
  resultCount.textContent = `顯示 ${limited.length} 筆／共 ${items.length} 筆`;
  results.innerHTML = limited.map((item, index)=>{
    const steps = Array.isArray(item.assistant_steps) ? item.assistant_steps : [];
    const notes = Array.isArray(item.notes) ? item.notes : [];
    const exact = highlightText(item.exact_text || "", keywords);
    const title = item.title || item.section_title || "未標示主題";
    const typeLabel = item.data_type || "資料";
    const sourcePages = Array.isArray(item.source_pages) && item.source_pages.length > 1 ? item.source_pages.join("、") : item.page_number;
    return `
      <article class="result-card">
        <div class="result-inner">
          <div class="result-top">
            <span class="chip">身分：${escapeHTML(item.role)}</span>
            <span class="chip data-type">${escapeHTML(typeLabel)}</span>
            <span class="chip">頁碼：${escapeHTML(sourcePages)}</span>
          </div>

          <div class="title-row">
            <h3 class="result-title">${escapeHTML(title)}</h3>
            <span class="score-badge">No. ${index + 1}</span>
          </div>

          <section class="assistant-box">
            <h4>☁️ 小助手整理步驟</h4>
            <div class="source-reminder">以下為小助手整理版，實際操作仍請以下方手冊原文為準。</div>
            <ol class="steps">
              ${steps.map(step=>`<li>${highlightText(step, keywords)}</li>`).join("")}
            </ol>
          </section>

          ${notes.length ? `<section class="note-box"><h4>✦ 注意事項</h4><ul>${notes.map(note=>`<li>${escapeHTML(note)}</li>`).join("")}</ul></section>` : ""}

          <details class="source-details">
            <summary>📖 展開手冊原文依據</summary>
            <div class="source-meta">
              <div>來源手冊：${escapeHTML(item.manual_name)}</div>
              <div>章節：${escapeHTML(item.section_title || "未標示章節")}</div>
              <div>PDF 頁碼：${escapeHTML(sourcePages)}</div>
              <div>資料類型：${escapeHTML(typeLabel)}</div>
            </div>
            <div class="exact-text">${exact}</div>
          </details>
        </div>
      </article>
    `;
  }).join("");
}

function searchManuals(){
  const selectedRole = roleSelect.value;
  const query = queryInput.value.trim();
  if(!selectedRole){ showEmpty("請先選擇身分。"); return; }
  if(!query){ showEmpty("請輸入查詢關鍵字。"); return; }
  if(!manualData.length){ showEmpty("目前尚未載入手冊資料。"); return; }

  const keywords = splitKeywords(query);
  const fullQuery = normalize(query).replace(/\s+/g, "");
  const roleData = manualData.filter(item => item.role === selectedRole);
  const searched = roleData
    .map(item => ({...item, _score: scoreItem(item, keywords, fullQuery)}))
    .filter(item => item._score > 0)
    .sort((a,b)=>{
      if(b._score !== a._score) return b._score - a._score;
      if((a.data_type === "小助手精選") !== (b.data_type === "小助手精選")) return a.data_type === "小助手精選" ? -1 : 1;
      return Number(a.page_number || 0) - Number(b.page_number || 0);
    });
  renderResults(searched, keywords);
}

function clearSearch(){
  queryInput.value = "";
  results.innerHTML = "";
  resultCount.textContent = "";
  queryInput.focus();
}

searchBtn.addEventListener("click", searchManuals);
clearBtn.addEventListener("click", clearSearch);
queryInput.addEventListener("keydown", event => { if(event.key === "Enter") searchManuals(); });

initRoles();
initQuickWords();
loadData();
