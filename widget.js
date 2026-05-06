/**
 * StoreBot Widget — Professional Edition
 * Loaded via embed.js — Do not include directly
 */
(function () {
  "use strict";

  const cfg = Object.assign({
    backendUrl:   "",
    storeName:    "متجرنا",
    lang:         "ar",
    primaryColor: "#111827",
    accentColor:  "#6366f1",
    logoText:     "🛍️",
    greeting:     "مرحباً! كيف أقدر أساعدك اليوم؟",
    placeholder:  "اكتب رسالتك...",
  }, window.StoreBotConfig || {});

  const RTL = cfg.lang === "ar";
  const SIDE = RTL ? "left" : "right";

  /* ── State ── */
  let messages  = [];
  let isOpen    = false;
  let isBusy    = false;
  let unread    = 0;
  let totalProducts = 0;

  /* ── Mount ── */
  if (document.getElementById("_sb_root")) return;

  /* ── Fonts ── */
  const lnk = document.createElement("link");
  lnk.rel = "stylesheet";
  lnk.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
  document.head.appendChild(lnk);

  /* ── CSS ── */
  const style = document.createElement("style");
  style.textContent = `
    #_sb_root { all: initial; }
    #_sb_root *, #_sb_root *::before, #_sb_root *::after {
      box-sizing: border-box; margin: 0; padding: 0;
      font-family: ${RTL ? "'IBM Plex Sans Arabic'" : "'IBM Plex Sans'"}, sans-serif;
    }
    #_sb_root {
      --p: ${cfg.primaryColor};
      --a: ${cfg.accentColor};
      --bg: #ffffff;
      --bg2: #f8f9fc;
      --bg3: #f1f3f9;
      --tx: #0f172a;
      --tx2: #64748b;
      --bd: #e2e8f0;
      --r: 20px;
      direction: ${RTL ? "rtl" : "ltr"};
    }

    /* ── Launcher ── */
    #_sb_btn {
      position: fixed;
      bottom: 28px;
      ${SIDE}: 28px;
      width: 58px; height: 58px;
      border-radius: 50%;
      background: var(--p);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,.22), 0 1px 4px rgba(0,0,0,.12);
      z-index: 2147483640;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1);
    }
    #_sb_btn:hover { transform: scale(1.08); }
    #_sb_btn:active { transform: scale(.94); }

    #_sb_btn_ico, #_sb_btn_x {
      position: absolute;
      transition: opacity .18s, transform .22s;
    }
    #_sb_btn_x { opacity: 0; transform: rotate(-45deg) scale(.7); }
    #_sb_root.open #_sb_btn_ico { opacity: 0; transform: rotate(45deg) scale(.7); }
    #_sb_root.open #_sb_btn_x   { opacity: 1; transform: rotate(0) scale(1); }

    #_sb_badge {
      position: absolute; top: 1px; ${SIDE}: 1px;
      min-width: 18px; height: 18px; border-radius: 9px;
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px;
      border: 2px solid #fff;
      opacity: 0; transform: scale(0);
      transition: opacity .15s, transform .25s cubic-bezier(.34,1.56,.64,1);
    }
    #_sb_badge.show { opacity: 1; transform: scale(1); }

    /* ── Window ── */
    #_sb_win {
      position: fixed;
      bottom: 100px;
      ${SIDE}: 28px;
      width: min(400px, calc(100vw - 20px));
      height: min(600px, calc(100vh - 120px));
      background: var(--bg);
      border-radius: var(--r);
      box-shadow: 0 20px 60px rgba(0,0,0,.15), 0 4px 16px rgba(0,0,0,.08);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 2147483639;
      transform: translateY(20px) scale(.96);
      opacity: 0; pointer-events: none;
      transition: transform .28s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    #_sb_root.open #_sb_win {
      transform: translateY(0) scale(1);
      opacity: 1; pointer-events: all;
    }

    /* ── Header ── */
    #_sb_hd {
      background: var(--p);
      padding: 18px 20px 16px;
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
      position: relative;
    }
    #_sb_av {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,.2);
    }
    #_sb_hd_info { flex: 1; min-width: 0; }
    #_sb_hd_name {
      font-size: 15px; font-weight: 600; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #_sb_hd_sub {
      font-size: 11px; color: rgba(255,255,255,.6);
      display: flex; align-items: center; gap: 5px; margin-top: 3px;
    }
    #_sb_online {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4ade80;
      animation: _sb_pulse 2s ease-in-out infinite;
    }
    @keyframes _sb_pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

    #_sb_hd_x {
      background: rgba(255,255,255,.1); border: none; cursor: pointer;
      color: rgba(255,255,255,.75); border-radius: 10px;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 18px; line-height: 1;
      transition: background .15s;
    }
    #_sb_hd_x:hover { background: rgba(255,255,255,.2); color: #fff; }

    /* Product count pill */
    #_sb_pill {
      position: absolute; bottom: -12px; ${RTL ? "right" : "left"}: 20px;
      background: var(--bg);
      border: 1px solid var(--bd);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px; color: var(--tx2);
      box-shadow: 0 2px 8px rgba(0,0,0,.07);
      white-space: nowrap;
    }

    /* ── Messages ── */
    #_sb_msgs {
      flex: 1; overflow-y: auto;
      padding: 24px 16px 12px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #_sb_msgs::-webkit-scrollbar { width: 3px; }
    #_sb_msgs::-webkit-scrollbar-thumb { background: var(--bd); border-radius: 2px; }

    /* Welcome state */
    #_sb_welcome {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 32px 24px; gap: 10px;
    }
    #_sb_welcome .wi { font-size: 48px; }
    #_sb_welcome .wt { font-size: 16px; font-weight: 600; color: var(--tx); }
    #_sb_welcome .ws { font-size: 13px; color: var(--tx2); line-height: 1.6; max-width: 240px; }

    /* Messages */
    .sb-m { display: flex; flex-direction: column; animation: _sb_in .2s ease both; }
    @keyframes _sb_in { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
    .sb-m.bot  { align-items: flex-start; }
    .sb-m.user { align-items: flex-end; }

    .sb-b {
      max-width: 82%; padding: 12px 16px;
      font-size: 14px; line-height: 1.7;
      word-break: break-word; white-space: pre-wrap;
      border-radius: 16px;
    }
    .sb-m.bot  .sb-b {
      background: var(--bg3);
      color: var(--tx);
      border-bottom-${RTL ? "right" : "left"}-radius: 4px;
    }
    .sb-m.user .sb-b {
      background: var(--p);
      color: #fff;
      border-bottom-${RTL ? "left" : "right"}-radius: 4px;
      padding: 12px 18px;
    }
    .sb-m.bot .sb-b a {
      color: var(--a);
      text-decoration: underline;
      word-break: break-all;
      cursor: pointer;
    }
    .sb-m.bot .sb-b a:hover { opacity: .8; }
    .sb-t { font-size: 10px; color: var(--tx2); margin-top: 4px; padding: 0 4px; }

    /* Typing dots */
    .sb-dots { display: flex; gap: 4px; padding: 12px 16px; }
    .sb-dots span {
      width: 7px; height: 7px; border-radius: 50%; background: var(--tx2);
      animation: _sb_dot 1s ease-in-out infinite;
    }
    .sb-dots span:nth-child(2) { animation-delay: .15s; }
    .sb-dots span:nth-child(3) { animation-delay: .3s; }
    @keyframes _sb_dot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

    /* ── Quick replies ── */
    #_sb_quick {
      padding: 8px 16px 4px;
      display: flex; gap: 8px; flex-wrap: wrap;
      flex-shrink: 0;
    }
    .sb-q {
      background: var(--bg); border: 1.5px solid var(--bd);
      border-radius: 20px; padding: 6px 14px;
      font-size: 12px; color: var(--tx);
      cursor: pointer; white-space: nowrap;
      transition: border-color .15s, color .15s, background .15s;
      font-family: inherit;
    }
    .sb-q:hover { border-color: var(--p); color: var(--p); background: var(--bg2); }

    /* ── Input ── */
    #_sb_form {
      padding: 12px 16px 16px;
      border-top: 1px solid var(--bd);
      display: flex; align-items: flex-end; gap: 10px;
      flex-shrink: 0;
    }
    #_sb_inp {
      flex: 1; border: 1.5px solid var(--bd); border-radius: 14px;
      padding: 10px 14px; font-size: 14px;
      resize: none; outline: none; background: var(--bg2);
      color: var(--tx); max-height: 96px; overflow-y: auto;
      transition: border-color .15s, box-shadow .15s;
      line-height: 1.5; font-family: inherit;
      direction: ${RTL ? "rtl" : "ltr"};
    }
    #_sb_inp:focus {
      border-color: var(--p);
      box-shadow: 0 0 0 3px ${cfg.primaryColor}18;
      background: #fff;
    }
    #_sb_inp::placeholder { color: var(--tx2); }

    #_sb_send {
      width: 40px; height: 40px; border-radius: 12px;
      background: var(--p); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background .15s, transform .15s, opacity .15s;
    }
    #_sb_send:hover { background: var(--a); }
    #_sb_send:active { transform: scale(.9); }
    #_sb_send:disabled { opacity: .35; cursor: not-allowed; }

    /* ── Footer ── */
    #_sb_foot {
      text-align: center; font-size: 10px; color: var(--tx2);
      padding: 0 0 10px; flex-shrink: 0;
    }

    @media (max-width: 480px) {
      #_sb_win {
        ${SIDE}: 0; bottom: 0;
        width: 100vw;
        height: min(92vh, 680px);
        border-radius: var(--r) var(--r) 0 0;
      }
      #_sb_btn { ${SIDE}: 18px; bottom: 18px; }
    }
  `;
  document.head.appendChild(style);

  /* ── DOM ── */
  const root = document.createElement("div");
  root.id = "_sb_root";
  root.innerHTML = `
    <button id="_sb_btn" aria-label="فتح المحادثة">
      <svg id="_sb_btn_ico" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
      </svg>
      <svg id="_sb_btn_x" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
      <span id="_sb_badge"></span>
    </button>

    <div id="_sb_win" role="dialog" aria-modal="true">
      <div id="_sb_hd">
        <div id="_sb_av">${cfg.logoText}</div>
        <div id="_sb_hd_info">
          <div id="_sb_hd_name">${cfg.storeName}</div>
          <div id="_sb_hd_sub">
            <span id="_sb_online"></span>
            <span>${RTL ? "مساعد الذكاء الاصطناعي" : "AI Assistant"}</span>
          </div>
        </div>
        <button id="_sb_hd_x" aria-label="إغلاق">✕</button>
        <div id="_sb_pill" style="display:none"></div>
      </div>

      <div id="_sb_msgs">
        <div id="_sb_welcome">
          <div class="wi">${cfg.logoText}</div>
          <div class="wt">${RTL ? "أهلاً بك!" : "Welcome!"}</div>
          <div class="ws">${cfg.greeting}</div>
        </div>
      </div>

      <div id="_sb_quick"></div>

      <div id="_sb_form">
        <textarea id="_sb_inp" rows="1"
          placeholder="${cfg.placeholder}"
          aria-label="رسالتك"></textarea>
        <button id="_sb_send" disabled aria-label="إرسال">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="${RTL ? "M3 12h18M12 5l7 7-7 7" : "M3 12h18M12 5l7 7-7 7"}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div id="_sb_foot">
        ${RTL ? "مدعوم بـ" : "Powered by"} <strong>StoreBot AI</strong>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  /* ── Refs ── */
  const btn    = root.querySelector("#_sb_btn");
  const win    = root.querySelector("#_sb_win");
  const badge  = root.querySelector("#_sb_badge");
  const msgs   = root.querySelector("#_sb_msgs");
  const inp    = root.querySelector("#_sb_inp");
  const send   = root.querySelector("#_sb_send");
  const hd_x   = root.querySelector("#_sb_hd_x");
  const quick  = root.querySelector("#_sb_quick");
  const pill   = root.querySelector("#_sb_pill");

  /* ── Helpers ── */
  const ts = () => new Date().toLocaleTimeString(RTL ? "ar" : "en", { hour: "2-digit", minute: "2-digit" });

  /* حفظ UTM params من الصفحة الحالية */
  function getUTMParams() {
    const p = new URLSearchParams(window.location.search);
    const utm = {};
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(k => {
      if (p.get(k)) utm[k] = p.get(k);
    });
    return utm;
  }

  /* إضافة UTM على الروابط */
  function addUTMToUrl(url) {
    try {
      const u = new URL(url);
      const utm = getUTMParams();
      // نضيف utm_source=storebot دائماً
      u.searchParams.set("utm_source", utm.utm_source || "storebot");
      u.searchParams.set("utm_medium", utm.utm_medium || "chat");
      if (utm.utm_campaign) u.searchParams.set("utm_campaign", utm.utm_campaign);
      return u.toString();
    } catch { return url; }
  }

  /* تحويل النص إلى HTML مع روابط قابلة للنقر */
  function renderText(text) {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // تحويل الروابط
    const linked = escaped.replace(
      /(https?:\/\/[^\s\)\]\*،,]+)/g,
      (url) => {
        const clean = url.replace(/&amp;/g, "&");
        const tracked = addUTMToUrl(clean);
        const display = clean.length > 40 ? clean.slice(0, 40) + "..." : clean;
        return `<a href="${tracked}" target="_blank" rel="noopener">${display}</a>`;
      }
    );

    // تحويل **bold**
    return linked.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function addMsg(role, text) {
    root.querySelector("#_sb_welcome")?.remove();
    const w = document.createElement("div");
    w.className = `sb-m ${role}`;
    const b = document.createElement("div");
    b.className = "sb-b";

    if (role === "bot") {
      b.innerHTML = renderText(text);
    } else {
      b.textContent = text;
    }

    const t = document.createElement("div");
    t.className = "sb-t";
    t.textContent = ts();
    w.appendChild(b); w.appendChild(t);
    msgs.appendChild(w);
    msgs.scrollTop = msgs.scrollHeight;

    if (role === "bot" && !isOpen) {
      unread++;
      badge.textContent = unread;
      badge.classList.add("show");
    }
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "sb-m bot"; el.id = "_sb_ty";
    el.innerHTML = `<div class="sb-b sb-dots"><span></span><span></span><span></span></div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function renderQuick() {
    const qs = RTL
      ? ["🛍️ آخر المنتجات", "💰 العروض", "🔍 ابحث عن منتج", "📦 حالة الطلب"]
      : ["🛍️ New arrivals", "💰 Deals", "🔍 Find product", "📦 Order status"];
    quick.innerHTML = "";
    qs.forEach(q => {
      const el = document.createElement("button");
      el.className = "sb-q"; el.textContent = q;
      el.onclick = () => { quick.innerHTML = ""; sendMsg(q); };
      quick.appendChild(el);
    });
  }

  /* ── API ── */
  async function callAPI(text) {
    messages.push({ role: "user", content: text });
    const res = await fetch(`${cfg.backendUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-12), storeName: cfg.storeName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    messages.push({ role: "assistant", content: data.reply });
    return data.reply;
  }

  async function sendMsg(text) {
    const msg = (text || inp.value || "").trim();
    if (!msg || isBusy) return;
    inp.value = ""; inp.style.height = "auto";
    send.disabled = true;
    addMsg("user", msg);
    showTyping(); isBusy = true;
    try {
      const reply = await callAPI(msg);
      root.querySelector("#_sb_ty")?.remove();
      addMsg("bot", reply);
    } catch (e) {
      root.querySelector("#_sb_ty")?.remove();
      addMsg("bot", RTL ? `⚠️ خطأ: ${e.message}` : `⚠️ Error: ${e.message}`);
    } finally {
      isBusy = false; send.disabled = !inp.value.trim();
      inp.focus();
    }
  }

  /* ── Health check ── */
  fetch(`${cfg.backendUrl}/health`).then(r => r.json()).then(d => {
    totalProducts = d.products || 0;
    if (totalProducts > 0 && pill) {
      pill.textContent = `${totalProducts.toLocaleString()} ${RTL ? "منتج" : "products"}`;
      pill.style.display = "";
    }
  }).catch(() => {});

  /* ── Events ── */
  btn.addEventListener("click", () => {
    isOpen = !isOpen;
    root.classList.toggle("open", isOpen);
    badge.classList.remove("show"); unread = 0;
    if (isOpen && messages.length === 0) renderQuick();
    if (isOpen) setTimeout(() => inp.focus(), 300);
  });

  hd_x.addEventListener("click", () => { isOpen = false; root.classList.remove("open"); });

  inp.addEventListener("input", function () {
    send.disabled = !this.value.trim() || isBusy;
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 96) + "px";
  });

  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  send.addEventListener("click", () => sendMsg());

  /* ── Show badge after 4s ── */
  setTimeout(() => {
    if (!isOpen) { badge.textContent = "1"; badge.classList.add("show"); }
  }, 4000);

})();
