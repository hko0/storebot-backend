/**
 * ================================================================
 *  StoreBot Widget v2 — Calls Backend (API Key Hidden)
 * ================================================================
 *
 *  <script>
 *    window.StoreBotConfig = {
 *      backendUrl: 'https://your-backend.com', // رابط الباكند
 *      storeName:  'اسم متجرك',
 *      primaryColor: '#0f0f1a',
 *      accentColor:  '#f5a623',
 *      lang: 'ar',
 *    };
 *  </script>
 *  <script src="store-bot-widget.js" defer></script>
 * ================================================================
 */

(function () {
  "use strict";

  const cfg = Object.assign(
    {
      backendUrl:   "",
      storeName:    "متجرنا",
      primaryColor: "#0f0f1a",
      accentColor:  "#f5a623",
      lang:         "ar",
      greeting:     "أهلاً! أنا مساعد المتجر الذكي 🛍️\nاسألني عن أي منتج أو سعر!",
    },
    window.StoreBotConfig || {}
  );

  const isRTL = cfg.lang === "ar";

  /* ─── State ─── */
  let messages = [];
  let isOpen   = false;
  let isLoading = false;
  let totalProducts = 0;

  /* ─── Styles ─── */
  function injectStyles() {
    if (document.getElementById("sb-styles")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap";
    document.head.appendChild(link);

    const s = document.createElement("style");
    s.id = "sb-styles";
    s.textContent = `
      #sb-root*,#sb-root *::before,#sb-root *::after{box-sizing:border-box;margin:0;padding:0}
      #sb-root{
        --p:${cfg.primaryColor};--a:${cfg.accentColor};
        --bg:#fff;--sf:#f6f7fb;--br:#e8eaf0;--tx:#1a1a2e;--mu:#8891a7;
        --r:18px;--sh:0 24px 60px rgba(0,0,0,.18),0 4px 12px rgba(0,0,0,.08);
        --fn:${isRTL?"'Cairo'":"'Inter'"}, sans-serif;
        --dir:${isRTL?"rtl":"ltr"};
        font-family:var(--fn);direction:var(--dir);
      }

      /* Toggle */
      #sb-btn{
        position:fixed;bottom:24px;${isRTL?"left":"right"}:24px;
        width:62px;height:62px;border-radius:50%;
        background:var(--p);border:none;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 8px 32px rgba(0,0,0,.28);
        transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;
        z-index:999999;overflow:hidden;
      }
      #sb-btn::before{content:'';position:absolute;inset:0;
        background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.15),transparent 70%);
        border-radius:50%;}
      #sb-btn:hover{transform:scale(1.1);box-shadow:0 12px 40px rgba(0,0,0,.32);}
      #sb-btn:active{transform:scale(.95);}
      #sb-btn::after{content:'';position:absolute;inset:-4px;border-radius:50%;
        border:2px solid var(--a);opacity:0;
        animation:sbp 2.4s ease-out infinite;}
      @keyframes sbp{0%{opacity:.7;transform:scale(1)}70%{opacity:0;transform:scale(1.45)}100%{opacity:0}}

      #sb-ico,#sb-ico-x{transition:opacity .2s,transform .25s;position:absolute;}
      #sb-ico-x{opacity:0;transform:rotate(-90deg);}
      #sb-root.open #sb-ico{opacity:0;transform:rotate(90deg);}
      #sb-root.open #sb-ico-x{opacity:1;transform:rotate(0);}

      #sb-badge{
        position:absolute;top:4px;${isRTL?"left":"right"}:4px;
        width:18px;height:18px;border-radius:50%;
        background:var(--a);font-size:10px;font-weight:700;color:#fff;
        display:flex;align-items:center;justify-content:center;
        border:2px solid var(--p);
        opacity:0;transform:scale(0);
        transition:opacity .2s,transform .3s cubic-bezier(.34,1.56,.64,1);
      }
      #sb-badge.vis{opacity:1;transform:scale(1);}

      /* Window */
      #sb-win{
        position:fixed;bottom:100px;${isRTL?"left":"right"}:24px;
        width:min(390px,calc(100vw - 32px));
        height:min(590px,calc(100vh - 120px));
        background:var(--bg);border-radius:var(--r);
        box-shadow:var(--sh);display:flex;flex-direction:column;
        overflow:hidden;z-index:999998;
        border:1px solid var(--br);
        transform:scale(.88) translateY(24px);opacity:0;pointer-events:none;
        transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .25s;
      }
      #sb-root.open #sb-win{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}

      /* Header */
      #sb-hd{
        background:var(--p);padding:16px 20px;
        display:flex;align-items:center;gap:12px;flex-shrink:0;position:relative;overflow:hidden;
      }
      #sb-hd::before{content:'';position:absolute;inset:0;
        background:linear-gradient(135deg,rgba(255,255,255,.07) 0%,transparent 60%);pointer-events:none;}
      #sb-av{width:42px;height:42px;border-radius:50%;background:var(--a);
        display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;
        box-shadow:0 4px 12px rgba(0,0,0,.2);}
      #sb-hd-info{flex:1;min-width:0;}
      #sb-hd-name{font-size:15px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      #sb-hd-st{font-size:11px;color:rgba(255,255,255,.65);display:flex;align-items:center;gap:5px;margin-top:2px;}
      #sb-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:sbd 2s ease-in-out infinite;}
      @keyframes sbd{0%,100%{opacity:1}50%{opacity:.4}}
      #sb-hd-cnt{color:rgba(255,255,255,.5);font-size:10px;margin-top:1px;}
      #sb-hd-x{background:rgba(255,255,255,.12);border:none;cursor:pointer;color:rgba(255,255,255,.8);
        border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;
        transition:background .15s;flex-shrink:0;font-size:16px;}
      #sb-hd-x:hover{background:rgba(255,255,255,.22);color:#fff;}

      /* Messages */
      #sb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth;}
      #sb-msgs::-webkit-scrollbar{width:4px;}
      #sb-msgs::-webkit-scrollbar-thumb{background:var(--br);border-radius:2px;}

      .sbm{display:flex;flex-direction:column;animation:sbin .25s cubic-bezier(.34,1.56,.64,1) both;}
      @keyframes sbin{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}
      .sbm.bot{align-items:flex-start;}.sbm.usr{align-items:flex-end;}
      .sbb{max-width:82%;padding:11px 15px;border-radius:16px;font-size:14px;line-height:1.6;word-break:break-word;white-space:pre-wrap;}
      .sbm.bot .sbb{background:var(--sf);color:var(--tx);border-${isRTL?"top-right":"top-left"}-radius:4px;}
      .sbm.usr .sbb{background:var(--a);color:#fff;border-${isRTL?"top-left":"top-right"}-radius:4px;}
      .sbt{font-size:10px;color:var(--mu);margin-top:4px;padding:0 4px;}

      /* Product pill inside message */
      .sb-pill{
        display:inline-flex;align-items:center;gap:6px;
        background:rgba(255,255,255,.18);border-radius:20px;
        padding:3px 10px 3px 3px;margin-top:6px;font-size:12px;
      }
      .sb-pill img{width:24px;height:24px;border-radius:50%;object-fit:cover;}

      /* Typing */
      .sb-ty{display:flex;align-items:center;gap:5px;padding:13px 16px;}
      .sb-ty span{width:7px;height:7px;border-radius:50%;background:var(--mu);animation:sbty .9s ease-in-out infinite;}
      .sb-ty span:nth-child(2){animation-delay:.15s}.sb-ty span:nth-child(3){animation-delay:.3s}
      @keyframes sbty{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}

      /* Chips */
      #sb-chips{padding:8px 16px 0;display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;}
      .sbc{background:var(--sf);border:1px solid var(--br);border-radius:20px;padding:6px 14px;
        font-size:12px;color:var(--tx);cursor:pointer;
        transition:background .15s,border-color .15s,color .15s;white-space:nowrap;font-family:var(--fn);}
      .sbc:hover{background:var(--p);color:#fff;border-color:var(--p);}

      /* Input */
      #sb-ia{padding:12px 16px 16px;border-top:1px solid var(--br);display:flex;gap:10px;align-items:flex-end;flex-shrink:0;background:var(--bg);}
      #sb-in{flex:1;border:1.5px solid var(--br);border-radius:12px;padding:10px 14px;
        font-size:14px;font-family:var(--fn);resize:none;outline:none;background:var(--sf);
        color:var(--tx);max-height:100px;overflow-y:auto;
        transition:border-color .2s,box-shadow .2s;line-height:1.5;direction:var(--dir);}
      #sb-in:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(15,15,26,.08);background:var(--bg);}
      #sb-in::placeholder{color:var(--mu);}
      #sb-sd{width:42px;height:42px;border-radius:12px;background:var(--p);border:none;cursor:pointer;
        display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;
        transition:background .15s,transform .15s;}
      #sb-sd:hover{background:var(--a);}
      #sb-sd:active{transform:scale(.92);}
      #sb-sd:disabled{opacity:.4;cursor:not-allowed;}

      /* Empty */
      #sb-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:8px;padding:24px;text-align:center;color:var(--mu);}
      #sb-empty .ei{font-size:40px;}
      #sb-empty .et{font-size:14px;font-weight:700;color:var(--tx);}
      #sb-empty .es{font-size:12px;line-height:1.6;}

      /* Status bar */
      #sb-bar{background:#f0fdf4;border-bottom:1px solid #86efac;padding:7px 14px;
        font-size:11px;color:#14532d;display:flex;align-items:center;gap:6px;
        flex-shrink:0;transition:max-height .3s,padding .3s,opacity .3s;max-height:40px;}
      #sb-bar.hidden{max-height:0;padding:0;opacity:0;overflow:hidden;}
      #sb-bar.loading{background:#fffbea;border-color:#fde68a;color:#92400e;}
      #sb-bar.err{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d;}

      #sb-pw{text-align:center;font-size:10px;color:var(--mu);padding-bottom:4px;flex-shrink:0;}
      #sb-pw a{color:var(--mu);text-decoration:none;}

      @media(max-width:480px){
        #sb-win{${isRTL?"left":"right"}:0;bottom:0;width:100vw;height:80vh;border-radius:var(--r) var(--r) 0 0;}
        #sb-btn{${isRTL?"left":"right"}:16px;bottom:16px;}
      }
    `;
    document.head.appendChild(s);
  }

  /* ─── DOM ─── */
  function buildDOM() {
    if (document.getElementById("sb-root")) return;
    const root = document.createElement("div");
    root.id = "sb-root";
    root.innerHTML = `
      <button id="sb-btn" aria-label="${isRTL?"المساعد الذكي":"AI Assistant"}">
        <svg id="sb-ico" width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(255,255,255,.15)"/>
          <path d="M13 7h-2v6h6v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="${cfg.accentColor}"/>
          <circle cx="12" cy="12" r="3" fill="white"/>
        </svg>
        <svg id="sb-ico-x" width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
        <span id="sb-badge"></span>
      </button>

      <div id="sb-win" role="dialog">
        <div id="sb-hd">
          <div id="sb-av">🛍️</div>
          <div id="sb-hd-info">
            <div id="sb-hd-name">${cfg.storeName}</div>
            <div id="sb-hd-st"><span id="sb-dot"></span><span>${isRTL?"متصل الآن":"Online"}</span></div>
            <div id="sb-hd-cnt"></div>
          </div>
          <button id="sb-hd-x">✕</button>
        </div>

        <div id="sb-bar" class="loading">
          <span>⏳</span><span id="sb-bar-txt">${isRTL?"جارٍ تحميل المنتجات...":"Loading products..."}</span>
        </div>

        <div id="sb-msgs">
          <div id="sb-empty">
            <div class="ei">🛍️</div>
            <div class="et">${isRTL?"أهلاً بك!":"Welcome!"}</div>
            <div class="es">${cfg.greeting}</div>
          </div>
        </div>

        <div id="sb-chips"></div>

        <div id="sb-ia">
          <textarea id="sb-in" rows="1" placeholder="${isRTL?"اكتب سؤالك...":"Type your question..."}"></textarea>
          <button id="sb-sd" disabled>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="${isRTL?"M20 12H4m8-8l8 8-8 8":"M4 12h16M12 4l8 8-8 8"}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div id="sb-pw">Powered by <a href="https://anthropic.com" target="_blank">Claude AI</a></div>
      </div>
    `;
    document.body.appendChild(root);
  }

  /* ─── Check backend status ─── */
  async function checkBackend() {
    if (!cfg.backendUrl) {
      setBar("err", isRTL ? "❌ backendUrl غير محدد في الإعدادات" : "❌ backendUrl not configured");
      return;
    }
    try {
      const res = await fetch(`${cfg.backendUrl}/health`);
      const data = await res.json();
      totalProducts = data.products || 0;

      if (totalProducts > 0) {
        setBar("ok", `✅ ${isRTL ? "جاهز — " : "Ready — "}${totalProducts.toLocaleString()} ${isRTL ? "منتج" : "products"}`);
        document.getElementById("sb-hd-cnt").textContent =
          `${totalProducts.toLocaleString()} ${isRTL ? "منتج في المتجر" : "products"}`;
        setTimeout(() => document.getElementById("sb-bar")?.classList.add("hidden"), 3000);
      } else {
        setBar("err", isRTL ? "⚠️ لا توجد منتجات في الكاش" : "⚠️ No products cached");
      }
    } catch {
      setBar("err", isRTL ? "⚠️ تعذّر الاتصال بالخادم" : "⚠️ Cannot reach backend");
    }
  }

  function setBar(type, text) {
    const bar = document.getElementById("sb-bar");
    const txt = document.getElementById("sb-bar-txt");
    if (!bar || !txt) return;
    bar.className = type === "ok" ? "" : type;
    txt.textContent = text;
  }

  /* ─── Chat ─── */
  async function callBackend(msg) {
    messages.push({ role: "user", content: msg });

    const res = await fetch(`${cfg.backendUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages:  messages.slice(-12),
        storeName: cfg.storeName,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    messages.push({ role: "assistant", content: data.reply });
    return data;
  }

  /* ─── UI ─── */
  function ts() {
    return new Date().toLocaleTimeString(isRTL ? "ar" : "en", { hour: "2-digit", minute: "2-digit" });
  }

  function addMsg(role, text) {
    document.getElementById("sb-empty")?.remove();
    const c = document.getElementById("sb-msgs");
    const w = document.createElement("div");
    w.className = `sbm ${role === "user" ? "usr" : "bot"}`;
    const b = document.createElement("div");
    b.className = "sbb";
    b.textContent = text;
    const t = document.createElement("div");
    t.className = "sbt";
    t.textContent = ts();
    w.appendChild(b);
    w.appendChild(t);
    c.appendChild(w);
    c.scrollTop = c.scrollHeight;
  }

  function showTyping() {
    const c = document.getElementById("sb-msgs");
    const el = document.createElement("div");
    el.className = "sbm bot";
    el.id = "sb-ty";
    el.innerHTML = `<div class="sbb sb-ty"><span></span><span></span><span></span></div>`;
    c.appendChild(el);
    c.scrollTop = c.scrollHeight;
  }

  function renderChips() {
    const chips = isRTL
      ? ["📦 آخر المنتجات", "💰 ما هي العروض؟", "🔍 أبحث عن منتج", "❓ كيف أطلب؟"]
      : ["📦 New arrivals", "💰 Any deals?", "🔍 Find a product", "❓ How to order?"];
    const c = document.getElementById("sb-chips");
    if (!c) return;
    c.innerHTML = "";
    chips.forEach(chip => {
      const el = document.createElement("button");
      el.className = "sbc";
      el.textContent = chip;
      el.onclick = () => { c.innerHTML = ""; send(chip); };
      c.appendChild(el);
    });
  }

  async function send(text) {
    const inp = document.getElementById("sb-in");
    const btn = document.getElementById("sb-sd");
    const msg = (text || inp?.value || "").trim();
    if (!msg || isLoading) return;

    if (inp) { inp.value = ""; inp.style.height = "auto"; }
    if (btn) btn.disabled = true;

    addMsg("user", msg);
    showTyping();
    isLoading = true;

    try {
      const data = await callBackend(msg);
      document.getElementById("sb-ty")?.remove();
      addMsg("bot", data.reply);
    } catch (e) {
      document.getElementById("sb-ty")?.remove();
      addMsg("bot", isRTL ? `⚠️ خطأ: ${e.message}` : `⚠️ Error: ${e.message}`);
    } finally {
      isLoading = false;
      if (btn) btn.disabled = false;
      if (inp) inp.focus();
    }
  }

  /* ─── Events ─── */
  function bind() {
    const root  = document.getElementById("sb-root");
    const btn   = document.getElementById("sb-btn");
    const close = document.getElementById("sb-hd-x");
    const inp   = document.getElementById("sb-in");
    const sd    = document.getElementById("sb-sd");
    const badge = document.getElementById("sb-badge");

    btn?.addEventListener("click", () => {
      isOpen = !isOpen;
      root.classList.toggle("open", isOpen);
      badge.classList.remove("vis");
      if (isOpen && messages.length === 0) renderChips();
      if (isOpen) setTimeout(() => inp?.focus(), 350);
    });

    close?.addEventListener("click", () => { isOpen = false; root.classList.remove("open"); });

    inp?.addEventListener("input", function () {
      sd.disabled = !this.value.trim() || isLoading;
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 100) + "px";
    });

    inp?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    sd?.addEventListener("click", () => send());

    setTimeout(() => {
      if (!isOpen) { badge.textContent = "1"; badge.classList.add("vis"); }
    }, 3500);
  }

  /* ─── Init ─── */
  function init() {
    injectStyles();
    buildDOM();
    bind();
    checkBackend();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
