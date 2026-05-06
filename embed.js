/**
 * StoreBot Embed Loader
 * Usage: <script src="https://your-backend.railway.app/embed.js"
 *           data-store="اسم متجرك"
 *           data-lang="ar"
 *           data-color="#111827"
 *           data-accent="#6366f1"
 *           data-logo="🛍️"
 *           async></script>
 */
(function () {
  var s = document.currentScript || document.querySelector('script[data-store]');
  var base = "https://storebot-backend-production.up.railway.app";

  window.StoreBotConfig = {
    backendUrl:   base,
    storeName:    (s && s.getAttribute("data-store"))  || "متجرنا",
    lang:         (s && s.getAttribute("data-lang"))   || "ar",
    primaryColor: (s && s.getAttribute("data-color"))  || "#111827",
    accentColor:  (s && s.getAttribute("data-accent")) || "#6366f1",
    logoText:     (s && s.getAttribute("data-logo"))   || "🛍️",
    greeting:     (s && s.getAttribute("data-greeting")) || "مرحباً! كيف أقدر أساعدك؟",
  };

  var w = document.createElement("script");
  w.src = base + "/widget.js?v=" + Date.now();
  w.async = true;
  document.head.appendChild(w);
})();
