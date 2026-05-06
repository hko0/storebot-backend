/**
 * ================================================================
 *  StoreBot — Backend Server
 *  - يخفي مفتاح Claude API
 *  - يكاش فيد المنتجات ويحدثه كل ساعة
 *  - يبحث بذكاء في 10,000 منتج ويرسل الأقرب فقط لـ Claude
 * ================================================================
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const cron       = require("node-cron");
const fetch      = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const xml2js     = require("xml2js");
const compression = require("compression");
const { createClient } = require("@supabase/supabase-js");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── Supabase ───────────────────────────────────────────────── */
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || "",
  { auth: { persistSession: false } }
);

/* ─── Store Validator ────────────────────────────────────────── */
async function validateStore(req, res, next) {
  const apiKey = req.headers["x-store-key"];
  if (!apiKey) {
    req.store = {
      id: "default",
      name: process.env.STORE_NAME || "متجرنا",
      feed_url: process.env.FEED_URL,
      credits_total: 999999,
      credits_used: 0,
    };
    return next();
  }
  const { data: store, error } = await supabase
    .from("stores")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (error || !store) return res.status(401).json({ error: "مفتاح غير صالح" });
  if (store.credits_used >= store.credits_total) {
    return res.status(402).json({ error: "انتهت محادثاتك", credits_used: store.credits_used, credits_total: store.credits_total });
  }
  req.store = store;
  next();
}

async function incrementCredits(storeId) {
  if (storeId === "default") return;
  await supabase.from("stores").update({ credits_used: supabase.rpc("credits_used + 1") }).eq("id", storeId);
}

/* ─── Middleware ─────────────────────────────────────────────── */
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : "*",  // في الإنتاج: حدد نطاق متجرك فقط
}));

/* ─── Product Cache ──────────────────────────────────────────── */
const cache = {
  products:    [],       // كل المنتجات المحللة
  lastUpdated: null,
  isLoading:   false,
  error:       null,
};

/* ─── XML Parser ─────────────────────────────────────────────── */
function extractText(val) {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val)) return extractText(val[0]);
  if (typeof val === "object" && val._) return val._.trim();
  return String(val).trim();
}

async function parseFeed(xmlText) {
  const parser = new xml2js.Parser({ explicitArray: true, mergeAttrs: true });
  const result = await parser.parseStringPromise(xmlText);

  let items = [];

  // Google Merchant RSS format
  const channel = result?.rss?.channel?.[0];
  if (channel?.item) items = channel.item;

  // Atom / generic feed
  else if (result?.feed?.entry) items = result.feed.entry;

  // Root level items
  else {
    const root = Object.values(result)[0];
    const nested = Object.values(root)[0];
    if (Array.isArray(nested)) items = nested;
  }

  const products = [];

  for (const item of items) {
    const g = "g:"; // Google namespace prefix

    const name =
      extractText(item[`${g}title`]) ||
      extractText(item["title"]) || "";

    if (!name) continue; // بدون اسم ما نضيفه

    const price =
      extractText(item[`${g}price`]) ||
      extractText(item["price"]) || "";

    const salePrice =
      extractText(item[`${g}sale_price`]) ||
      extractText(item["sale_price"]) || "";

    const image =
      extractText(item[`${g}image_link`]) ||
      extractText(item["image_link"]) || "";

    const link =
      extractText(item["link"]) ||
      extractText(item[`${g}link`]) || "";

    const brand =
      extractText(item[`${g}brand`]) ||
      extractText(item["brand"]) || "";

    const category =
      extractText(item[`${g}product_type`]) ||
      extractText(item[`${g}google_product_category`]) ||
      extractText(item["product_type"]) || "";

    const availability =
      extractText(item[`${g}availability`]) ||
      extractText(item["availability"]) || "in stock";

    const description =
      extractText(item[`${g}description`]) ||
      extractText(item["description"]) || "";

    const id =
      extractText(item[`${g}id`]) ||
      extractText(item["id"]) || "";

    const condition =
      extractText(item[`${g}condition`]) ||
      extractText(item["condition"]) || "new";

    // بناء نص للبحث (كل الحقول في string واحد)
    const searchText = [name, brand, category, description.slice(0, 200)]
      .join(" ")
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, " "); // يدعم العربي والإنجليزي

    products.push({
      id, name, price, salePrice, image, link,
      brand, category, availability, condition,
      description: description.slice(0, 300),
      searchText,
    });
  }

  return products;
}

/* ─── Feed Loader ────────────────────────────────────────────── */
async function loadFeed(force = false) {
  if (cache.isLoading) return;
  if (!force && cache.products.length > 0 && cache.lastUpdated) {
    const age = (Date.now() - cache.lastUpdated) / 1000 / 60;
    if (age < 60) return; // Fresh enough
  }

  const feedUrl = process.env.FEED_URL;
  if (!feedUrl) {
    cache.error = "FEED_URL not set in .env";
    console.error("[Cache] FEED_URL missing");
    return;
  }

  cache.isLoading = true;
  console.log("[Cache] Loading feed...");

  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "StoreBotCrawler/1.0" },
      timeout: 30000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const products = await parseFeed(xml);

    cache.products    = products;
    cache.lastUpdated = Date.now();
    cache.error       = null;
    console.log(`[Cache] ✅ Loaded ${products.length} products`);
  } catch (err) {
    cache.error = err.message;
    console.error("[Cache] ❌ Error:", err.message);
  } finally {
    cache.isLoading = false;
  }
}

// تحديث كل ساعة
cron.schedule("0 * * * *", () => loadFeed(true));

/* ─── Smart Product Search ───────────────────────────────────── */
/**
 * يبحث في 10k منتج ويرجع الـ N الأكثر صلة بالسؤال
 * الخوارزمية: TF-IDF مبسطة + Exact match bonus
 */
function searchProducts(query, topN = 15) {
  if (cache.products.length === 0) return [];

  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (queryTokens.length === 0) {
    // إذا السؤال عام، نرجع أول 15 متوفر
    return cache.products
      .filter(p => p.availability !== "out of stock")
      .slice(0, topN);
  }

  const scored = cache.products.map(p => {
    let score = 0;

    for (const token of queryTokens) {
      // Exact match في الاسم → وزن عالي
      if (p.name.toLowerCase().includes(token)) score += 10;
      // Brand match
      if (p.brand.toLowerCase().includes(token)) score += 6;
      // Category match
      if (p.category.toLowerCase().includes(token)) score += 5;
      // Description / searchText
      if (p.searchText.includes(token)) score += 2;
    }

    // بونص للمنتجات المتوفرة
    if (p.availability === "in stock" || p.availability === "متوفر") score += 1;

    // بونص للسعر المخفض
    if (p.salePrice && p.salePrice !== p.price) score += 0.5;

    return { product: p, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.product);
}

/* ─── Build Context for Claude ───────────────────────────────── */
function buildProductContext(products) {
  if (products.length === 0) {
    return "لا توجد منتجات مطابقة في المخزون حالياً.";
  }

  return products.map((p, i) => {
    const price = p.salePrice
      ? `${p.salePrice} (كان ${p.price})`
      : p.price || "السعر غير محدد";

    const avail = ["in stock","متوفر","available"].includes(p.availability?.toLowerCase())
      ? "✅ متوفر"
      : "❌ غير متوفر";

    return [
      `[${i + 1}] ${p.name}`,
      p.brand     ? `   الماركة: ${p.brand}` : "",
      `   السعر: ${price}`,
      `   الحالة: ${avail}`,
      p.category  ? `   الفئة: ${p.category}` : "",
      p.description ? `   الوصف: ${p.description.slice(0, 150)}` : "",
      p.link      ? `   الرابط: ${p.link}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

/* ─── System Prompt ──────────────────────────────────────────── */
function buildSystemPrompt(productContext, storeName, totalProducts) {
  return `أنت مساعد تسوق ذكي لمتجر "${storeName}".
المتجر يحتوي على ${totalProducts.toLocaleString()} منتج. تم تزويدك بالمنتجات الأكثر صلة بسؤال العميل.

## تعليماتك:
- أجب دائماً بنفس لغة العميل (عربي أو إنجليزي).
- كن ودوداً ومختصراً ومفيداً.
- إذا ذكرت منتجاً، اذكر اسمه وسعره ورابطه إن وجد.
- إذا سأل عن منتج غير موجود في القائمة، اعتذر بأدب واقترح بديلاً أو اطلب منه تفاصيل أكثر.
- لا تخترع أسعاراً أو منتجات غير موجودة في القائمة أدناه.
- إذا أراد العميل الشراء، وجّهه للرابط المباشر.

## المنتجات المتاحة (${productContext.split('\n').filter(l=>l.startsWith('[')).length} منتج ذو صلة من أصل ${totalProducts.toLocaleString()}):
${productContext}`;
}

/* ─── Routes ─────────────────────────────────────────────────── */

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    products: cache.products.length,
    lastUpdated: cache.lastUpdated
      ? new Date(cache.lastUpdated).toISOString()
      : null,
    error: cache.error,
  });
});

// Force refresh feed
app.post("/api/refresh-feed", async (req, res) => {
  const secret = req.headers["x-refresh-secret"];
  if (secret !== process.env.REFRESH_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await loadFeed(true);
  res.json({ products: cache.products.length, error: cache.error });
});

// Main chat endpoint
app.post("/api/chat", async (req, res) => {
  const { messages, storeName = "متجرنا" } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  // Rate limiting بسيط (ممكن نعمله أقوى لاحقاً)
  const userMsg = messages[messages.length - 1]?.content || "";
  if (userMsg.length > 500) {
    return res.status(400).json({ error: "Message too long" });
  }

  // بناء query للبحث من آخر رسالة + سابق لها
  const searchQuery = messages
    .slice(-3)
    .map(m => m.content)
    .join(" ")
    .slice(0, 300);

  // بحث ذكي في المنتجات
  const relevant = searchProducts(searchQuery, 15);
  const productCtx = buildProductContext(relevant);
  const systemPrompt = buildSystemPrompt(productCtx, storeName, cache.products.length);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   messages.slice(-12), // آخر 12 رسالة فقط
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Claude] Error:", err);
      return res.status(502).json({ error: err?.error?.message || "Claude API error" });
    }

    const data = await response.json();
    res.json({
      reply:          data.content?.[0]?.text || "",
      productsFound:  relevant.length,
      totalProducts:  cache.products.length,
    });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cache stats
app.get("/api/stats", (req, res) => {
  res.json({
    totalProducts: cache.products.length,
    lastUpdated:   cache.lastUpdated,
    categories:    [...new Set(cache.products.map(p => p.category).filter(Boolean))].slice(0, 20),
    brands:        [...new Set(cache.products.map(p => p.brand).filter(Boolean))].slice(0, 20),
  });
});


/* ─── Static Widget Files ────────────────────────────────────── */
const path = require("path");

app.get("/widget.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.sendFile(path.join(__dirname, "widget.js"));
});

app.get("/embed.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.sendFile(path.join(__dirname, "embed.js"));
});

/* ─── Start ──────────────────────────────────────────────────── */
app.listen(PORT, async () => {
  console.log(`\n🚀 StoreBot Backend running on port ${PORT}`);
  console.log(`📦 Loading product feed...`);
  await loadFeed(true);
  console.log(`✅ Ready! Products in cache: ${cache.products.length}\n`);
});
