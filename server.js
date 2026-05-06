/**
 * StoreBot Backend v3.1 — Multi-tenant + Redis + Supabase
 * Fixes: SIGTERM, store default, credits counter
 */
require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const cron        = require("node-cron");
const fetch       = (...args) => import("node-fetch").then(({default: f}) => f(...args));
const xml2js      = require("xml2js");
const compression = require("compression");
const { createClient } = require("@supabase/supabase-js");
const { Redis }   = require("@upstash/redis");
const path        = require("path");

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─── Supabase ── */
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || "",
  { auth: { persistSession: false } }
);

/* ─── Redis ── */
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL   || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

/* ─── CORS ── */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
  : [];

app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  const allowed = allowedOrigins.length === 0 || allowedOrigins.some(o => origin.includes(o.replace(/https?:\/\//, "")));
  if (allowed || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-store-key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ─── XML Parser ── */
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
  const channel = result?.rss?.channel?.[0];
  if (channel?.item) items = channel.item;
  else if (result?.feed?.entry) items = result.feed.entry;
  else {
    const root = Object.values(result)[0];
    const nested = Object.values(root)[0];
    if (Array.isArray(nested)) items = nested;
  }

  return items.map(item => {
    const g = "g:";
    const name = extractText(item[`${g}title`]) || extractText(item["title"]) || "";
    if (!name) return null;
    const price       = extractText(item[`${g}price`])      || extractText(item["price"])      || "";
    const salePrice   = extractText(item[`${g}sale_price`]) || "";
    const image       = extractText(item[`${g}image_link`]) || extractText(item["image_link"]) || "";
    const link        = extractText(item["link"])            || extractText(item[`${g}link`])   || "";
    const brand       = extractText(item[`${g}brand`])      || extractText(item["brand"])       || "";
    const category    = extractText(item[`${g}product_type`]) || extractText(item["product_type"]) || "";
    const availability = extractText(item[`${g}availability`]) || "in stock";
    const description  = (extractText(item[`${g}description`]) || extractText(item["description"]) || "").slice(0, 300);
    const searchText   = [name, brand, category, description.slice(0, 200)].join(" ").toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, " ");
    return { name, price, salePrice, image, link, brand, category, availability, description, searchText };
  }).filter(Boolean);
}

/* ─── Load Feed (Redis cache) ── */
async function loadFeed(feedUrl, storeId, store = {}) {
  if (!feedUrl) {
    console.warn(`[Feed] No feed URL for store ${storeId}`);
    return [];
  }
  const cacheKey = `feed:${storeId}`;

  // Try Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn(`[Feed] Redis read error for ${storeId}:`, e.message);
  }

  // Fetch from network
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "StoreBotCrawler/1.0" },
      timeout: 15000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const products = await parseFeed(xml);

    // Save to Redis
    try {
      const ttl = (store?.cache_ttl_minutes || 60) * 60;
      await redis.set(cacheKey, JSON.stringify(products), { ex: ttl });
    } catch (e) {
      console.warn(`[Feed] Redis write error:`, e.message);
    }

    console.log(`[Feed] Loaded ${products.length} products for store ${storeId}`);
    return products;
  } catch (err) {
    console.error(`[Feed] Error loading feed for ${storeId}:`, err.message);
    return [];
  }
}

/* ─── Default store (fallback) ── */
const defaultStore = {
  id: "default",
  name: process.env.STORE_NAME || "متجرنا",
  feed_url: process.env.FEED_URL,
  credits_total: 999999,
  credits_used: 0,
  plan: "default",
  max_products_search: 15,
  cache_ttl_minutes: 60,
};

/* ─── Store cache (in-memory for Supabase lookups) ── */
const storeCache = new Map(); // apiKey -> { store, fetchedAt }
const STORE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/* ─── Validate Store ── */
async function validateStore(req, res, next) {
  const apiKey = req.headers["x-store-key"];

  // Debug log — remove after confirming storeKey arrives
  console.log(`[Auth] x-store-key: ${apiKey ? apiKey.slice(0, 12) + "..." : "MISSING"}`);

  if (!apiKey) {
    req.store = defaultStore;
    return next();
  }

  // Check in-memory cache first
  const cached = storeCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < STORE_CACHE_TTL) {
    req.store = cached.store;
    return next();
  }

  try {
    const { data: store, error } = await supabase
      .from("stores")
      .select("*")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .single();

    if (error || !store) {
      console.warn(`[Auth] Invalid key: ${apiKey?.slice(0, 12)}`);
      return res.status(401).json({ error: "مفتاح غير صالح" });
    }

    if (store.credits_used >= store.credits_total) {
      return res.status(402).json({
        error: "انتهت محادثاتك الشهرية",
        credits_used: store.credits_used,
        credits_total: store.credits_total,
      });
    }

    // Cache the store lookup
    storeCache.set(apiKey, { store, fetchedAt: Date.now() });
    req.store = store;
    next();
  } catch (err) {
    console.error("[Auth] Supabase error:", err.message);
    // Fallback to default instead of crashing
    req.store = defaultStore;
    next();
  }
}

/* ─── Increment Credits ── */
async function incrementCredits(storeId, apiKey) {
  if (storeId === "default") return;
  try {
    const { error } = await supabase.rpc("increment_credits_v2", { p_store_id: storeId });
    if (error) {
      // Fallback: manual increment
      const { data } = await supabase.from("stores").select("credits_used").eq("id", storeId).single();
      if (data) {
        await supabase.from("stores").update({ credits_used: data.credits_used + 1 }).eq("id", storeId);
      }
    }
    // Invalidate in-memory store cache
    if (apiKey) storeCache.delete(apiKey);
    console.log(`[Credits] Incremented for store ${storeId}`);
  } catch (err) {
    console.error("[Credits] Error:", err.message);
  }
}

/* ─── Smart Search ── */
function searchProducts(products, query, topN = 15) {
  if (!products.length) return [];
  const tokens = query.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, " ").split(/\s+/).filter(t => t.length > 1);
  if (!tokens.length) return products.filter(p => p.availability !== "out of stock").slice(0, topN);

  return products
    .map(p => {
      let score = 0;
      for (const t of tokens) {
        if (p.name.toLowerCase().includes(t))     score += 10;
        if (p.brand.toLowerCase().includes(t))    score += 6;
        if (p.category.toLowerCase().includes(t)) score += 5;
        if (p.searchText.includes(t))             score += 2;
      }
      if (["in stock","متوفر","available"].includes(p.availability?.toLowerCase())) score += 1;
      if (p.salePrice && p.salePrice !== p.price) score += 0.5;
      return { p, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(s => s.p);
}

/* ─── Build Context ── */
function buildContext(products) {
  if (!products.length) return "لا توجد منتجات مطابقة حالياً.";
  return products.map((p, i) => {
    const price = p.salePrice ? `${p.salePrice} (كان ${p.price})` : p.price || "السعر غير محدد";
    const avail = ["in stock","متوفر","available"].includes(p.availability?.toLowerCase()) ? "✅ متوفر" : "❌ غير متوفر";
    return [
      `[${i+1}] ${p.name}`,
      p.brand    ? `   الماركة: ${p.brand}`             : "",
      `   السعر: ${price}`,
      `   الحالة: ${avail}`,
      p.category ? `   الفئة: ${p.category}`            : "",
      p.description ? `   الوصف: ${p.description.slice(0,150)}` : "",
      p.link ? `   الرابط: ${p.link}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

/* ─── System Prompt ── */
function buildSystemPrompt(ctx, store, total) {
  const storeName = store.name || "متجرنا";
  const lang      = store.lang || "ar";
  const currency  = store.currency || "ريال";

  const extras = [
    store.instructions  ? `## تعليمات خاصة بالمتجر:\n${store.instructions}`   : "",
    store.working_hours ? `## ساعات العمل:\n${store.working_hours}`             : "",
    store.shipping_info ? `## معلومات الشحن:\n${store.shipping_info}`           : "",
    store.return_policy ? `## سياسة الإرجاع:\n${store.return_policy}`          : "",
    store.whatsapp      ? `## واتساب الدعم: ${store.whatsapp}`                 : "",
    store.support_email ? `## البريد الإلكتروني: ${store.support_email}`       : "",
  ].filter(Boolean).join("\n\n");

  return `أنت مساعد تسوق ذكي لمتجر "${storeName}". المتجر يحتوي على ${total.toLocaleString()} منتج. العملة: ${currency}.

## تعليماتك الأساسية:
- أجب بنفس لغة العميل (${lang === "ar" ? "العربية افتراضياً" : "English by default"}).
- كن ودوداً ومختصراً. اذكر الاسم والسعر والرابط.
- لا تخترع منتجات أو أسعار غير موجودة في القائمة.
- إذا أراد الشراء، وجّهه للرابط المباشر.
- إذا سأل عن الشحن أو الإرجاع أو الدعم، استخدم المعلومات أدناه.
- لا تستخدم ### أو ** في ردودك — اكتب نصاً عادياً فقط.

${extras}

## المنتجات المتاحة (${ctx.split("\n").filter(l=>l.startsWith("[")).length} منتج ذو صلة من أصل ${total.toLocaleString()}):
${ctx}`;
}

/* ════════════════════════════════
   ROUTES
════════════════════════════════ */

app.get("/health", async (req, res) => {
  let redisOk = false;
  try { await redis.ping(); redisOk = true; } catch (e) { console.warn("[Redis]", e.message); }
  res.json({ status: "ok", redis: redisOk, supabase: !!process.env.SUPABASE_URL });
});

app.post("/api/refresh-feed", async (req, res) => {
  if (req.headers["x-refresh-secret"] !== process.env.REFRESH_SECRET)
    return res.status(401).json({ error: "Unauthorized" });
  const storeId = req.body.storeId || "default";
  try { await redis.del(`feed:${storeId}`); } catch {}
  res.json({ ok: true });
});

app.post("/api/chat", validateStore, async (req, res) => {
  const { messages } = req.body;
  const store = req.store;
  const apiKey = req.headers["x-store-key"];

  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: "messages required" });

  const userMsg = messages[messages.length - 1]?.content || "";
  if (userMsg.length > 500) return res.status(400).json({ error: "Message too long" });

  console.log(`[Chat] Store: ${store.id} | Msg: ${userMsg.slice(0, 60)}`);

  const feedUrl  = store.feed_url || process.env.FEED_URL;
  const products = await loadFeed(feedUrl, store.id, store);

  const query    = messages.slice(-3).map(m => m.content).join(" ").slice(0, 300);
  const relevant = searchProducts(products, query, store.max_products_search || 15);
  const ctx      = buildContext(relevant);
  const sysPrompt = buildSystemPrompt(ctx, store, products.length);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: sysPrompt,
        messages: messages.slice(-12),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Claude] Error:", response.status, JSON.stringify(err));
      return res.status(502).json({ error: err?.error?.message || "Claude error" });
    }

    const data  = await response.json();
    const reply = data.content?.[0]?.text || "";

    // Fire and forget — don't await to keep response fast
    incrementCredits(store.id, apiKey).catch(() => {});

    res.json({ reply, productsFound: relevant.length, totalProducts: products.length });
  } catch (err) {
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/api/stats", async (req, res) => {
  const feedUrl  = process.env.FEED_URL;
  const products = await loadFeed(feedUrl, "default");
  const cats     = [...new Set(products.map(p => p.category).filter(Boolean))].slice(0, 20);
  const brands   = [...new Set(products.map(p => p.brand).filter(Boolean))].slice(0, 20);
  res.json({ totalProducts: products.length, categories: cats, brands });
});

/* ─── Serve Widget Files ── */
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

/* ─── Cron: clear default feed cache every hour ── */
cron.schedule("0 * * * *", async () => {
  try { await redis.del("feed:default"); } catch {}
  console.log("[Cron] Default feed cache cleared");
});

/* ─── Graceful shutdown ── */
process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

/* ─── Start ── */
app.listen(PORT, async () => {
  console.log(`\n🚀 StoreBot v3.1 running on port ${PORT}`);
  try { await redis.ping(); console.log("✅ Redis connected"); } catch (e) { console.warn("⚠️ Redis:", e.message); }
  console.log("✅ Ready!\n");

  // Pre-warm default feed cache
  if (process.env.FEED_URL) {
    loadFeed(process.env.FEED_URL, "default").catch(() => {});
  }
});
