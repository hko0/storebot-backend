/**
 * StoreBot Widget — Professional Edition
 * Loaded via embed.js — Do not include directly
 */
(function () {
  "use strict";

  const BACKEND = "https://storebot-backend-production.up.railway.app";

  /* ── المفتاح مخبّز من السيرفر مباشرة ── */
  const _BAKED_KEY = "%%STORE_KEY%%";

  const cfg = Object.assign({
    backendUrl:   BACKEND,
    storeName:    "متجرنا",
    lang:         "ar",
    primaryColor: "#111827",
    accentColor:  "#6366f1",
    logoText:     "🛍️",
    greeting:     "مرحباً! كيف أقدر أساعدك اليوم؟",
    placeholder:  "اكتب رسالتك...",
  }, window.StoreBotConfig || {});

  /* الأولوية: مخبّز > StoreBotConfig > فارغ */
  if (_BAKED_KEY && !_BAKED_KEY.includes("%%")) cfg.storeKey = _BAKED_KEY;

  const RTL = cfg.lang === "ar";
  const SIDE = "right"; // دائماً على اليمين

  /* ── State ── */
  let messages  = [];
  let isOpen    = false;
  let isBusy    = false;
  let unread    = 0;
  let totalProducts = 0;
  let phoneNumber = localStorage.getItem(`_sb_phone_${cfg.storeKey}`) || "";

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
      font-family: ${RTL ? "'IBM Plex Sans Arabic'" : "'IBM Plex Sans'"}, -apple-system, sans-serif;
    }
    #_sb_root {
      --wa-green:   #25D366;
      --wa-green2:  #128C7E;
      --wa-green3:  #075E54;
      --wa-light:   #dcf8c6;
      --wa-bg:      #efeae2;
      --wa-white:   #ffffff;
      --wa-gray:    #f0f0f0;
      --wa-tx:      #111b21;
      --wa-tx2:     #667781;
      --wa-bd:      #d1d7db;
      --wa-bubble-in:  #ffffff;
      --wa-bubble-out: #d9fdd3;
      direction: ${RTL ? "rtl" : "ltr"};
    }

    /* ── Launcher Button (WhatsApp style) ── */
    #_sb_btn {
      position: fixed;
      bottom: 24px;
      ${SIDE}: 24px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: var(--wa-green);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(37,211,102,.45), 0 2px 8px rgba(0,0,0,.2);
      z-index: 2147483640;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
    }
    #_sb_btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(37,211,102,.55), 0 2px 10px rgba(0,0,0,.2);
    }
    #_sb_btn:active { transform: scale(.94); }

    #_sb_btn_ico, #_sb_btn_x {
      position: absolute;
      transition: opacity .18s, transform .22s;
    }
    #_sb_btn_x { opacity: 0; transform: rotate(-45deg) scale(.7); }
    #_sb_root.open #_sb_btn_ico { opacity: 0; transform: rotate(45deg) scale(.7); }
    #_sb_root.open #_sb_btn_x   { opacity: 1; transform: rotate(0) scale(1); }

    #_sb_badge {
      position: absolute; top: 0; ${SIDE}: 0;
      min-width: 20px; height: 20px; border-radius: 10px;
      background: #ef4444; color: #fff;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      padding: 0 5px;
      border: 2.5px solid #fff;
      opacity: 0; transform: scale(0);
      transition: opacity .15s, transform .25s cubic-bezier(.34,1.56,.64,1);
    }
    #_sb_badge.show { opacity: 1; transform: scale(1); }

    /* ── Chat Window ── */
    #_sb_win {
      position: fixed;
      bottom: 96px;
      ${SIDE}: 24px;
      width: min(400px, calc(100vw - 20px));
      height: min(620px, calc(100vh - 120px));
      background: var(--wa-white);
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0,0,0,.18), 0 2px 12px rgba(0,0,0,.1);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 2147483639;
      transform: translateY(24px) scale(.95);
      opacity: 0; pointer-events: none;
      transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .22s;
    }
    #_sb_root.open #_sb_win {
      transform: translateY(0) scale(1);
      opacity: 1; pointer-events: all;
    }

    /* ── Header (WhatsApp style) ── */
    #_sb_hd {
      background: var(--wa-green2);
      padding: 10px 16px;
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    #_sb_av {
      width: 42px; height: 42px; border-radius: 50%;
      background: rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,.3);
      overflow: hidden;
    }
    #_sb_hd_info { flex: 1; min-width: 0; }
    #_sb_hd_name {
      font-size: 16px; font-weight: 600; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #_sb_hd_sub {
      font-size: 12px; color: rgba(255,255,255,.8);
      display: flex; align-items: center; gap: 5px; margin-top: 2px;
    }
    #_sb_online {
      width: 7px; height: 7px; border-radius: 50%;
      background: #a7f3d0;
      animation: _sb_pulse 2s ease-in-out infinite;
    }
    @keyframes _sb_pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    #_sb_hd_x {
      background: rgba(255,255,255,.1); border: none; cursor: pointer;
      color: rgba(255,255,255,.9); border-radius: 50%;
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 20px; line-height: 1;
      transition: background .15s;
    }
    #_sb_hd_x:hover { background: rgba(255,255,255,.2); }

    /* ── Messages Area (WhatsApp wallpaper) ── */
    #_sb_msgs {
      flex: 1; overflow-y: auto;
      padding: 12px 12px 8px;
      display: flex; flex-direction: column; gap: 4px;
      scroll-behavior: smooth;
      background-color: var(--wa-bg);
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cdc5' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    #_sb_msgs::-webkit-scrollbar { width: 4px; }
    #_sb_msgs::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 2px; }

    /* Date separator */
    .sb-date {
      text-align: center; margin: 8px 0;
    }
    .sb-date span {
      display: inline-block;
      background: rgba(255,255,255,.85);
      border-radius: 8px; padding: 4px 14px;
      font-size: 11px; color: var(--wa-tx2);
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
      white-space: nowrap;
    }

    /* Welcome */
    #_sb_welcome {
      background: rgba(255,255,255,.9);
      border-radius: 12px; padding: 20px;
      text-align: center; margin: 8px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,.1);
    }
    #_sb_welcome .wi { font-size: 40px; margin-bottom: 8px; }
    #_sb_welcome .wt { font-size: 15px; font-weight: 600; color: var(--wa-tx); margin-bottom: 6px; }
    #_sb_welcome .ws { font-size: 13px; color: var(--wa-tx2); line-height: 1.6; }

    /* Message bubbles */
    .sb-m { display: flex; flex-direction: column; animation: _sb_in .18s ease both; margin: 1px 0; }
    @keyframes _sb_in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .sb-m.bot  { align-items: flex-start; }
    .sb-m.user { align-items: flex-end; }

    .sb-b {
      max-width: 78%;
      width: fit-content;
      padding: 8px 14px;
      font-size: 14px; line-height: 1.65;
      word-break: break-word; white-space: pre-wrap;
      min-width: 80px;
    }
    .sb-m.bot .sb-b {
      background: var(--wa-bubble-in);
      color: var(--wa-tx);
      border-radius: 0 12px 12px 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,.1);
    }
    .sb-m.user .sb-b {
      background: var(--wa-bubble-out);
      color: var(--wa-tx);
      border-radius: 12px 0 12px 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,.1);
    }
    .sb-t {
      font-size: 10px; color: var(--wa-tx2);
      display: flex; align-items: center; gap: 3px;
      margin-top: 2px; padding: 0 4px;
      justify-content: flex-end;
    }
    .sb-m.bot .sb-t { justify-content: flex-start; }
    .sb-m.user .sb-t .sb-tick { color: #53bdeb; }
    .sb-m.bot .sb-b a {
      color: var(--wa-green3); text-decoration: underline;
      word-break: break-all; cursor: pointer;
    }
    .sb-m.bot .sb-b a:hover { opacity: .8; }

    /* Tick + time outside bubble */

    /* Typing */
    .sb-dots { display: flex; gap: 4px; padding: 8px 14px 18px; }
    .sb-dots span {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--wa-tx2);
      animation: _sb_dot 1.2s ease-in-out infinite;
    }
    .sb-dots span:nth-child(2){animation-delay:.2s}
    .sb-dots span:nth-child(3){animation-delay:.4s}
    @keyframes _sb_dot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}

    /* ── Input Bar (WhatsApp style) ── */
    #_sb_form {
      padding: 8px 10px;
      background: #f0f2f5;
      display: flex; align-items: flex-end; gap: 8px;
      flex-shrink: 0;
      border-top: 1px solid var(--wa-bd);
    }
    #_sb_inp {
      flex: 1; border: none; border-radius: 22px;
      padding: 10px 16px; font-size: 15px; min-height: 42px;
      resize: none; outline: none;
      background: var(--wa-white);
      color: var(--wa-tx); max-height: 100px; overflow-y: auto;
      line-height: 1.5; font-family: inherit;
      direction: ${RTL ? "rtl" : "ltr"};
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    #_sb_inp::placeholder { color: var(--wa-tx2); }

    #_sb_send {
      width: 46px; height: 46px; border-radius: 50%;
      background: var(--wa-green);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background .15s, transform .15s;
      box-shadow: 0 2px 6px rgba(37,211,102,.4);
    }
    #_sb_send:hover { background: var(--wa-green2); }
    #_sb_send:active { transform: scale(.9); }
    #_sb_send:disabled { background: var(--wa-bd); box-shadow: none; cursor: not-allowed; }

    /* Footer */
    #_sb_foot {
      text-align: center; font-size: 11px; color: var(--wa-tx2);
      padding: 4px 0 6px; background: #f0f2f5; flex-shrink: 0;
    }

    /* Phone Screen */
    #_sb_phone_screen {
      position: absolute; inset: 0;
      background: var(--wa-white);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 32px 24px; text-align: center;
      z-index: 10;
      border-radius: 16px;
    }
    #_sb_phone_screen .ps-icon { font-size: 48px; margin-bottom: 16px; }
    #_sb_phone_screen .ps-title { font-size: 18px; font-weight: 700; color: #111b21; margin-bottom: 8px; }
    #_sb_phone_screen .ps-sub { font-size: 13px; color: #667781; margin-bottom: 24px; line-height: 1.6; }
    #_sb_phone_inp {
      width: 100%; padding: 12px 16px;
      border: 1.5px solid #d1d7db; border-radius: 12px;
      font-size: 16px; outline: none; text-align: center;
      font-family: inherit; color: #111b21;
      direction: ltr; letter-spacing: 2px;
      transition: border-color .2s;
    }
    #_sb_phone_inp:focus { border-color: var(--wa-green); }
    #_sb_phone_inp::placeholder { letter-spacing: 0; color: #aaa; }
    #_sb_phone_btn {
      width: 100%; margin-top: 12px; padding: 13px;
      background: var(--wa-green); color: #fff;
      border: none; border-radius: 12px;
      font-size: 15px; font-weight: 600;
      font-family: inherit; cursor: pointer;
      transition: opacity .15s;
    }
    #_sb_phone_btn:hover { opacity: .88; }
    #_sb_phone_err { font-size: 12px; color: #ef4444; margin-top: 8px; min-height: 16px; }

    /* Phone bottom sheet fix */
    @media (max-width: 480px) {
      #_sb_phone_screen { border-radius: 16px 16px 0 0; }
      #_sb_win {
        ${SIDE}: 0; bottom: 0;
        width: 100vw;
        height: 55vh;
        border-radius: 16px 16px 0 0;
        max-height: 55vh;
      }
      #_sb_btn { ${SIDE}: 16px; bottom: 16px; }
      #_sb_msgs { padding: 10px 10px 6px; }
      #_sb_inp { font-size: 16px; }
    }

    @supports (height: 100dvh) {
      @media (max-width: 480px) {
        #_sb_win { height: 55dvh; max-height: 55dvh; }
      }
    }
  `;
  document.head.appendChild(style);

  /* ── DOM ── */
  const root = document.createElement("div");
  root.id = "_sb_root";
  root.innerHTML = `
    <button id="_sb_btn" aria-label="فتح المحادثة">
      <svg id="_sb_btn_ico" width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.857L.054 23.394a.75.75 0 0 0 .918.918l5.538-1.478A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.53 16.617c-.247.694-1.234 1.328-1.805 1.413-.512.077-1.16.11-1.87-.118-.432-.136-.985-.319-1.694-.625-2.98-1.287-4.927-4.289-5.077-4.487-.148-.199-1.213-1.612-1.213-3.074 0-1.463.768-2.182 1.04-2.479.272-.298.594-.372.792-.372.199 0 .397.002.57.01.182.01.427-.069.669.51.247.595.841 2.058.916 2.207.075.149.124.322.025.52-.099.199-.148.323-.297.497-.148.173-.312.387-.446.52-.148.148-.303.31-.13.607.173.298.77 1.271 1.653 2.059 1.135 1.012 2.093 1.325 2.39 1.475.297.148.471.124.644-.075.173-.198.743-.867.94-1.164.199-.298.397-.249.67-.15.272.1 1.733.818 2.03.967.297.149.495.223.57.347.074.124.074.719-.174 1.413z"/>
      </svg>
      <svg id="_sb_btn_x" width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <span id="_sb_badge"></span>
    </button>

    <div id="_sb_win" role="dialog" aria-modal="true">

      <!-- Phone Screen -->
      <div id="_sb_phone_screen">
        <div class="ps-icon">📱</div>
        <div class="ps-title">${RTL ? 'أهلاً بك!' : 'Welcome!'}</div>
        <div class="ps-sub">${RTL ? 'أدخل رقم جوالك لنبدأ المحادثة ونحفظ طلباتك' : 'Enter your phone number to start chatting'}</div>
        <input id="_sb_phone_inp" type="tel" placeholder="${RTL ? '05XXXXXXXX' : '+1234567890'}" inputmode="tel" />
        <div id="_sb_phone_err"></div>
        <button id="_sb_phone_btn">${RTL ? 'ابدأ المحادثة' : 'Start Chat'}</button>
      </div>
      <div id="_sb_hd">
        <div id="_sb_av">${cfg.logoText}</div>
        <div id="_sb_hd_info">
          <div id="_sb_hd_name">${cfg.storeName}</div>
          <div id="_sb_hd_sub">
            <span id="_sb_online"></span>
            <span>${RTL ? "متصل الآن" : "Online now"}</span>
          </div>
        </div>
        <button id="_sb_hd_x" aria-label="إغلاق">✕</button>
      </div>

      <div id="_sb_msgs">
        <div class="sb-date"><span>${RTL ? "اليوم" : "Today"}</span></div>
        <div id="_sb_welcome">
          <div class="wi">${cfg.logoText}</div>
          <div class="wt">${RTL ? "أهلاً! أنا موظف الذكاء الاصطناعي" : "Hi! I'm your AI Assistant"}</div>
          <div class="ws">${cfg.greeting}</div>
        </div>
      </div>

      <div id="_sb_form">
        <textarea id="_sb_inp" rows="1"
          placeholder="${cfg.placeholder || (RTL ? 'اكتب رسالة...' : 'Type a message...')}"
          aria-label="رسالتك"></textarea>
        <button id="_sb_send" disabled aria-label="إرسال">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div id="_sb_foot">
        ${RTL ? "مدعوم بـ" : "Powered by"} <strong>Dafor.ai</strong>
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
    const tick = role === "user" ? `<span class="sb-tick">✓✓</span>` : "";
    t.innerHTML = `${ts()} ${tick}`;

    w.appendChild(b);
    w.appendChild(t);
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

  /* ── Phone Screen ── */
  const phoneScreen = root.querySelector("#_sb_phone_screen");
  const phoneInp    = root.querySelector("#_sb_phone_inp");
  const phoneBtn    = root.querySelector("#_sb_phone_btn");
  const phoneErr    = root.querySelector("#_sb_phone_err");

  function showPhoneScreen() {
    phoneScreen.style.display = 'flex';
    setTimeout(() => phoneInp.focus(), 300);
  }

  function hidePhoneScreen() {
    phoneScreen.style.display = 'none';
  }

  function validatePhone(p) {
    return p.replace(/\D/g,'').length >= 9;
  }

  function submitPhone() {
    const val = phoneInp.value.trim();
    if (!validatePhone(val)) {
      phoneErr.textContent = RTL ? 'أدخل رقماً صحيحاً (9 أرقام على الأقل)' : 'Enter a valid phone number';
      return;
    }
    phoneNumber = val.replace(/\s/g,'');
    localStorage.setItem(`_sb_phone_${cfg.storeKey}`, phoneNumber);
    hidePhoneScreen();
    addMsg("bot", cfg.greeting);
  }

  phoneBtn.addEventListener("click", submitPhone);
  phoneInp.addEventListener("keydown", e => { if (e.key === "Enter") submitPhone(); });

  // إذا عنده رقم محفوظ → تجاوز الشاشة مباشرة
  if (phoneNumber) {
    hidePhoneScreen();
  } else {
    // إخفاء شاشة الجوال في البداية حتى يفتح الويدجت
    phoneScreen.style.display = 'none';
  }
  async function callAPI(text) {
    messages.push({ role: "user", content: text });
    const headers = { "Content-Type": "application/json" };
    // قراءة المفتاح وقت الإرسال لضمان تحميله
    const storeKey = cfg.storeKey || window.StoreBotConfig?.storeKey || "";
    if (storeKey) headers["x-store-key"] = storeKey;
    if (phoneNumber) headers["x-session-id"] = phoneNumber;
    const res = await fetch(`${cfg.backendUrl}/api/chat`, {
      method: "POST",
      headers,
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
    setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
    showTyping(); isBusy = true;
    try {
      const reply = await callAPI(msg);
      root.querySelector("#_sb_ty")?.remove();
      addMsg("bot", reply);
      setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
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
  }).catch(() => {});

  /* ── Events ── */
  btn.addEventListener("click", () => {
    isOpen = !isOpen;
    root.classList.toggle("open", isOpen);
    badge.classList.remove("show"); unread = 0;
    if (isOpen) {
      if (!phoneNumber) {
        showPhoneScreen();
      } else {
        if (messages.length === 0) addMsg("bot", cfg.greeting);
        setTimeout(() => inp.focus(), 300);
      }
    }
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
