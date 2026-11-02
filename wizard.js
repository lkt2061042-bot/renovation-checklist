/* 祥信裝修工程 CheungShun — 一題一頁需求單精靈 */
(function () {
  "use strict";
  const DATA = window.RENO_DATA;
  if (!DATA) return;
  const QUESTIONS = DATA.questions;
  const SCOPES = DATA.scopes;
  const CONTACT = window.CONTACT || { whatsapp: "", phone: "", email: "" };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  const CAT_ICONS = {
    "報價方式": '<path d="M6 2h9l4 4v16H5z"/><path d="M9 8h7M9 12h7M9 16h4"/>',
    "基本資料": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    "工作範圍": '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
    "現場環境": '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
    "設計需求": '<rect x="2" y="2" width="15" height="6" rx="2"/><path d="M9 16v-2a2 2 0 012-2h7a2 2 0 002-2V7a2 2 0 00-2-2h-1"/><rect x="8" y="16" width="4" height="6" rx="1"/>',
    "拆改與水電": '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    "泥水與油漆": '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    "傢俬與收納": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 10h16M12 10v11M8.5 6.5h1M14.5 6.5h1"/>',
    "工程安排": '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    "聯絡安排": '<path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1121 11.5z"/>'
  };
  const ICON_DEFAULT = CAT_ICONS["工作範圍"];

  const state = { answers: {}, flow: [], idx: 0, summary: false };

  // ---- overlay DOM ----
  const overlay = document.createElement("div");
  overlay.className = "qz";
  overlay.id = "qz";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "裝修需求單");
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="qz-top">
      <button class="qz-close" id="qzClose" type="button" aria-label="關閉需求單">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="qz-bar"><span class="qz-fill" id="qzFill"></span></div>
      <div class="qz-count" id="qzCount">準備中</div>
    </div>
    <div class="qz-body" id="qzBody"></div>
    <div class="qz-foot">
      <button class="btn btn-ghost" id="qzBack" type="button">上一題</button>
      <button class="btn btn-primary" id="qzNext" type="button">下一題</button>
    </div>`;
  document.body.appendChild(overlay);

  const printRoot = document.createElement("div");
  printRoot.id = "qzPrintRoot";
  document.body.appendChild(printRoot);

  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const body = $("#qzBody");
  const fill = $("#qzFill");
  const count = $("#qzCount");
  const btnBack = $("#qzBack");
  const btnNext = $("#qzNext");

  function modeOf() {
    const v = state.answers.Q001;
    return v === "精準報價" ? "精準" : v === "簡單報價" ? "簡單" : null;
  }
  function scopesOf() {
    return state.answers.Q010 || [];
  }
  function valueOf(qid) {
    return state.answers[qid];
  }
  function setValue(qid, val) {
    if (val === "" || val === null || val === undefined || (Array.isArray(val) && !val.length)) {
      delete state.answers[qid];
    } else {
      state.answers[qid] = val;
    }
  }

  function depMet(q) {
    if (!q.dep_qids) return true;
    const qids = q.dep_qids.split("|");
    const results = qids.map(dq => {
      const raw = state.answers[dq];
      const vals = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      const targets = q.dep_values || [];
      if (q.dep_op === "包含") return vals.some(x => targets.includes(x));
      if (q.dep_op === "等於") return vals.some(x => targets.includes(x));
      if (q.dep_op === "不等於") return vals.length === 0 || vals.some(x => !targets.includes(x));
      return true;
    });
    return q.dep_logic === "AND" ? results.every(Boolean) : results.some(Boolean);
  }

  function buildFlow() {
    const mode = modeOf();
    const scopes = scopesOf();
    const flow = [];
    for (const q of QUESTIONS) {
      if (q.id === "Q001" || q.id === "Q010" || (q.stage_order || 0) < 30) {
        flow.push(q);
        continue;
      }
      if (mode && q.modes && !q.modes.split(";").includes(mode)) continue;
      if (scopes.length) {
        const hitAll = (q.scopes || []).includes("ALL");
        const hit = (q.scopes || []).some(s => scopes.includes(s));
        if (!hitAll && !hit) continue;
      }
      if (!depMet(q)) continue;
      flow.push(q);
    }
    return flow;
  }

  function answerValue(q) {
    const v = state.answers[q.id];
    if (q.type === "multi_choice") return Array.isArray(v) && v.length ? v : null;
    return v || null;
  }
  function answerText(q) {
    const v = state.answers[q.id];
    if (v == null) return "";
    if (Array.isArray(v)) return v.join("、");
    if (q.type === "number" && q.unit) return `${v} ${q.unit}`;
    return String(v);
  }
  function isSelected(q, label) {
    const v = state.answers[q.id];
    return Array.isArray(v) ? v.includes(label) : v === label;
  }
  function validate(q) {
    if (!q.required) return true;
    if (q.type === "photo") return true;
    const v = answerValue(q);
    if (v == null) return false;
    if (q.type === "number") {
      const n = Number(v);
      if (isNaN(n)) return false;
      if (q.min != null && q.min !== "" && n < Number(q.min)) return false;
      if (q.max != null && q.max !== "" && n > Number(q.max)) return false;
    }
    return true;
  }

  function optionCard(q, o) {
    const on = isSelected(q, o.label);
    const multi = q.type === "multi_choice";
    const icon = `<span class="qopt-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${CAT_ICONS[q.stage] || ICON_DEFAULT}</svg></span>`;
    return `<button class="qopt${on ? " is-on" : ""}${multi ? " multi" : ""}" type="button" data-val="${esc(o.label)}" role="${multi ? "checkbox" : "radio"}" aria-checked="${on ? "true" : "false"}">
      ${icon}
      <span class="qopt-txt"><b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ""}</span>
      <span class="qopt-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></span>
    </button>`;
  }

  function inputHTML(q) {
    const v = state.answers[q.id] || "";
    if (q.type === "single_choice" || q.type === "multi_choice") {
      const hint = q.type === "multi_choice" ? `<p class="qz-multi-hint">可選多項，選好後按「下一題」。</p>` : "";
      return `${hint}<div class="qz-opts">${q.options.map(o => optionCard(q, o)).join("")}</div>`;
    }
    if (q.type === "number") {
      return `<div class="qz-unit"><input class="qz-field" type="number" inputmode="decimal" id="qzInput" value="${esc(v)}" ${q.min != null && q.min !== "" ? `min="${esc(q.min)}"` : ""} ${q.max != null && q.max !== "" ? `max="${esc(q.max)}"` : ""} placeholder="請輸入數字">${q.unit ? `<b>${esc(q.unit)}</b>` : ""}</div>`;
    }
    if (q.type === "date") {
      return `<input class="qz-field" type="date" id="qzInput" value="${esc(v)}">`;
    }
    if (q.type === "photo") {
      return `<div class="qz-photo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg><p>此題可稍後於上門度尺時提供，現在可以按「下一題」跳過。</p></div>`;
    }
    if (q.type === "long_text" || q.type === "measurement") {
      return `<textarea class="qz-field" id="qzInput" placeholder="${esc(q.type === "measurement" ? "例如：1800 × 600 × 2400（闊 × 深 × 高，mm）" : "請輸入內容")}">${esc(v)}</textarea>`;
    }
    if (q.type === "phone") {
      return `<input class="qz-field" type="tel" inputmode="tel" id="qzInput" value="${esc(v)}" placeholder="請輸入聯絡電話">`;
    }
    return `<input class="qz-field" type="text" id="qzInput" value="${esc(v)}" placeholder="請輸入">`;
  }

  function syncFlow(keepId) {
    state.flow = buildFlow();
    if (keepId) {
      const i = state.flow.findIndex(x => x.id === keepId);
      if (i >= 0) state.idx = i;
    }
  }

  function renderCurrent() {
    const q = state.flow[state.idx];
    if (!q) { renderSummary(); return; }
    state.summary = false;
    const pct = state.flow.length ? ((state.idx + 1) / state.flow.length) * 100 : 0;
    fill.style.width = pct + "%";
    count.textContent = `第 ${state.idx + 1} / ${state.flow.length} 題`;
    body.innerHTML = `<div class="qz-card">
      <span class="qz-kicker">${esc(q.stage)}</span>
      <h2>${esc(q.text)}</h2>
      ${q.subtitle ? `<p class="qz-sub">${esc(q.subtitle)}</p>` : ""}
      ${inputHTML(q)}
      <p class="qz-error" id="qzErr"></p>
    </div>`;
    body.scrollTop = 0;

    const input = $("#qzInput", body);
    if (input) {
      input.addEventListener("input", () => {
        setValue(q.id, input.value.trim());
        hideError();
      });
      if (q.type !== "date") input.focus({ preventScroll: true });
    }

    $$(".qopt", body).forEach(btn => {
      btn.addEventListener("click", () => {
        const label = btn.dataset.val;
        if (q.type === "multi_choice") {
          const cur = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
          const on = cur.includes(label);
          setValue(q.id, on ? cur.filter(x => x !== label) : cur.concat(label));
          hideError();
          renderCurrent();
        } else {
          setValue(q.id, label);
          hideError();
          syncFlow(q.id);
          renderCurrent();
          if (state.idx < state.flow.length - 1) {
            setTimeout(() => { if (!state.summary) next(false); }, 200);
          }
        }
      });
    });

    btnNext.disabled = false;
    btnBack.textContent = state.idx === 0 ? "關閉" : "上一題";
  }

  function showError(q) {
    const el = $("#qzErr", body);
    if (el) {
      el.textContent = q.type === "number" ? "請輸入有效數字。" : "請先完成此題。";
      el.classList.add("is-on");
    }
    body.classList.add("is-shake");
    setTimeout(() => body.classList.remove("is-shake"), 350);
  }
  function hideError() {
    const el = $("#qzErr", body);
    if (el) el.classList.remove("is-on");
  }

  function next(auto = true) {
    const q = state.flow[state.idx];
    if (!validate(q)) { showError(q); return; }
    if (state.idx >= state.flow.length - 1) { renderSummary(); return; }
    state.idx++;
    syncFlow(state.flow[state.idx].id);
    renderCurrent();
  }
  function back() {
    if (state.summary) { state.summary = false; renderCurrent(); return; }
    if (state.idx <= 0) { closeQz(); return; }
    state.idx--;
    syncFlow(state.flow[state.idx].id);
    renderCurrent();
  }

  function summaryRows() {
    const rows = [];
    for (const q of QUESTIONS) {
      if (state.answers[q.id] != null) {
        rows.push([q.text, answerText(q)]);
      }
    }
    return rows;
  }
  function summaryText() {
    const rows = summaryRows();
    if (!rows.length) return "";
    const lines = ["【裝修需求摘要】", ""];
    rows.forEach(([k, v]) => lines.push(`${k}：${v}`));
    lines.push("", "（由祥信裝修工程網站需求單生成）");
    return lines.join("\n");
  }

  let pdfLibPromise = null;
  function loadPdfLib() {
    if (window.html2pdf) return Promise.resolve();
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/html2pdf.bundle.min.js?v=20261102";
      s.onload = () => resolve();
      s.onerror = () => {
        pdfLibPromise = null;
        reject(new Error("PDF library failed to load"));
      };
      document.head.appendChild(s);
    });
    return pdfLibPromise;
  }

  function fmtDate(value) {
    if (!value) return "待定";
    let d;
    if (value instanceof Date) {
      d = value;
    } else {
      d = new Date(value + "T00:00:00");
    }
    if (isNaN(d)) return String(value);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function pdfMeta() {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const ref = `QS-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const scopes = state.answers.Q010 || [];
    const months = scopes.map(name => {
      const s = (DATA.scopes || []).find(x => x.name === name);
      const m = s && Number(s.months);
      return m && !isNaN(m) ? m : null;
    }).filter(Boolean);
    const duration = months.length ? Math.max(...months) : null;
    const start = state.answers.Q011 || "";
    let completion = "";
    if (start && duration) {
      const d = new Date(start + "T00:00:00");
      if (!isNaN(d)) {
        d.setMonth(d.getMonth() + duration);
        completion = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
      }
    }
    return { ref, now, scopes, duration, start, completion };
  }

  function buildPdfDoc() {
    const meta = pdfMeta();
    const groups = new Map();
    for (const q of QUESTIONS) {
      if (state.answers[q.id] == null) continue;
      if (["Q001", "Q010", "Q011"].includes(q.id)) continue;
      if (!groups.has(q.stage)) groups.set(q.stage, []);
      groups.get(q.stage).push([q.text, answerText(q)]);
    }
    const groupHtml = [...groups.entries()].map(([stage, rows]) => {
      const rowHtml = rows.map(([k, v]) => `<div class="pdf-row"><div class="pdf-q">${esc(k)}</div><div class="pdf-a">${esc(v)}</div></div>`);
      // Keep the section heading with its first row so a heading never sits alone
      // at the bottom of a page.
      return `
      <section class="pdf-group">
        <div class="pdf-head"><h3>${esc(stage)}</h3>${rowHtml[0] || ""}</div>
        ${rowHtml.slice(1).join("")}
      </section>`;
    }).join("");

    const doc = document.createElement("div");
    doc.className = "pdf-doc";
    doc.innerHTML = `
      <div class="pdf-top">
        <img class="pdf-logo" src="assets/logo.png" alt="祥信裝修工程 CheungShun">
        <div class="pdf-top-right">
          <div class="pdf-label">QUOTATION BRIEF</div>
          <div class="pdf-ref">${esc(meta.ref)}</div>
        </div>
      </div>
      <div class="pdf-title">裝修需求報價摘要</div>
      <div class="pdf-sub">祥信裝修工程 CheungShun · 香港住宅裝修</div>
      <div class="pdf-meta">建立日期：${esc(fmtDate(meta.now))}　｜　報價方式：${esc(state.answers.Q001 || "未選擇")}　｜　資料來源：網站需求單</div>
      <div class="pdf-facts">
        <div class="pdf-fact"><span>工程範圍</span><b>${esc(meta.scopes.join("、") || "未選擇")}</b></div>
        <div class="pdf-fact"><span>開始日期</span><b>${esc(fmtDate(meta.start))}</b></div>
        <div class="pdf-fact"><span>預計工期</span><b>${meta.duration ? esc(meta.duration + " 個月") : "待定"}</b></div>
        <div class="pdf-fact"><span>預計完工</span><b>${esc(meta.completion || "待定")}</b></div>
      </div>
      ${groupHtml}
      <div class="pdf-foot">
        <div><b>備註：</b>本摘要由客人於網站填寫的資料自動生成，只供初步參考。</div>
        <div>實際工程範圍、物料、數量及金額，以現場度尺及正式報價單為準。</div>
        <div>祥信裝修工程 CheungShun · 查詢請把此 PDF 傳送給我們。</div>
      </div>`;

    return doc;
  }

  function waitImages(root) {
    return Promise.all([...root.querySelectorAll("img")].map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));
  }

  async function downloadPdf(btn, msg) {
    btn.disabled = true;
    btn.textContent = "正在生成 PDF…";
    msg.textContent = "";
    let doc = null;
    try {
      await loadPdfLib();
      doc = buildPdfDoc();
      if (!doc.querySelector(".pdf-row")) throw new Error("no answers to export");
      const stage = document.createElement("div");
      stage.className = "pdf-stage";
      stage.appendChild(doc);
      document.body.appendChild(stage);
      await waitImages(doc);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      await window.html2pdf().set({
        margin: [10, 10, 12, 10],
        filename: `祥信裝修需求摘要_${dateStr}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-row", ".pdf-fact", ".pdf-head"] },
      }).from(doc).save();
      btn.textContent = "PDF 已下載";
      msg.textContent = "PDF 已下載，可傳送給我們作初步報價。";
    } catch (e) {
      console.error(e);
      btn.disabled = false;
      btn.textContent = "完成並下載 PDF";
      msg.textContent = "PDF 生成失敗，請再試一次。";
    } finally {
      const stage = doc && doc.parentElement;
      if (stage && stage.classList.contains("pdf-stage")) stage.remove();
      else if (doc) doc.remove();
    }
  }

  let printTimer = null;
  function clearPrintView() {
    printRoot.innerHTML = "";
    document.body.classList.remove("is-printing");
    if (printTimer) { clearTimeout(printTimer); printTimer = null; }
  }

  // Browser-native print/Save-as-PDF. This keeps the text selectable and avoids
  // the canvas limits that make html2canvas return a blank page on iOS.
  function printSummary(msg) {
    clearPrintView();
    const doc = buildPdfDoc();
    if (!doc.querySelector(".pdf-row")) {
      if (msg) msg.textContent = "未有可列印的資料。";
      return;
    }
    printRoot.appendChild(doc);
    document.body.classList.add("is-printing");
    const done = () => {
      window.removeEventListener("afterprint", done);
      clearPrintView();
    };
    window.addEventListener("afterprint", done);
    printTimer = setTimeout(clearPrintView, 300000);
    if (msg) msg.textContent = "在列印視窗選擇「另存為 PDF / 儲存到檔案」。";
    try {
      window.print();
    } catch (e) {
      clearPrintView();
      if (msg) msg.textContent = "瀏覽器未能開啟列印，請用直接下載 PDF。";
    }
  }

  function renderSummary() {
    state.summary = true;
    fill.style.width = "100%";
    count.textContent = "完成";
    const rows = summaryRows();
    const wa = CONTACT.whatsapp;
    body.innerHTML = `<div class="qz-card">
      <div class="qz-summary">
        <div class="qz-sum-head">
          <span class="qz-sum-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg></span>
          <div><h3>需求摘要已整理好</h3><p>共 ${rows.length} 項，確認後可下載專業 PDF 摘要。</p></div>
        </div>
        <dl class="qz-sum-rows">${rows.map(([k, v]) => `<div class="qz-sum-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
        <div class="qz-sum-actions">
          <button class="btn btn-brand" id="qzPrint" type="button">列印 / 儲存 PDF</button>
          ${wa ? `<a class="btn btn-primary" id="qzWa" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp 傳送摘要</a>` : ""}
        </div>
        <p class="qz-sum-msg" id="qzSumMsg" role="status" aria-live="polite"></p>
        <p class="qz-sum-note">iPhone / iPad：按「列印 / 儲存 PDF」→ 分享 → 儲存到檔案。桌面：列印視窗選「另存為 PDF」。PDF 只包含你填寫的資料，實際工程範圍及金額以現場度尺及正式報價單為準。</p>
      </div>
    </div>`;
    body.scrollTop = 0;
    btnBack.textContent = "上一題";

    $("#qzPrint", body).addEventListener("click", () => {
      printSummary($("#qzSumMsg", body));
    });
    
    if (wa) {
      const a = $("#qzWa", body);
      a.addEventListener("click", () => {
        a.href = `https://wa.me/${wa}?text=${encodeURIComponent(summaryText())}`;
      });
    }
  }

  function startQz() {
    state.answers = {};
    state.idx = 0;
    state.summary = false;
    syncFlow();
    overlay.hidden = false;
    document.body.classList.add("no-scroll");
    renderCurrent();
    $("#qzClose").focus();
  }
  function closeQz() {
    overlay.hidden = true;
    document.body.classList.remove("no-scroll");
  }

  // wiring
  const launch = $("#qzStart");
  if (launch) launch.addEventListener("click", startQz);
  $("#qzClose").addEventListener("click", closeQz);
  btnNext.addEventListener("click", () => next(true));
  btnBack.addEventListener("click", back);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeQz(); });
  document.addEventListener("keydown", e => {
    if (overlay.hidden) return;
    if (e.key === "Escape") closeQz();
  });
})();
