/**
 * Pinka Plus — admin/server.js (FIX: restore /api/users/ensure + CORS)
 *
 * Fixes TMA "Load failed":
 *  - полноценный /api/users/ensure (Telegram WebApp initData validation)
 *  - CORS для запросов из TMA
 *  - сохраняем /api/users/ensure-bot и /api/admin/users
 *
 * IMPORTANT: filename stays server.js
 */

import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json({ limit: "1mb" }));

const { MONGO_URI, BOT_TOKEN, PORT = 10000 } = process.env;

if (!MONGO_URI) throw new Error("MONGO_URI is required");
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");

await mongoose.connect(MONGO_URI);

// ---- CORS (для TMA) ----
app.use((req, res, next) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-bot-token");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// --- User model ---
const UserSchema = new mongoose.Schema(
  {
    tgId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    languageCode: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    launchCount: { type: Number, default: 0 },      // TMA launches
    botStartCount: { type: Number, default: 0 },    // Bot /start count
    botStartAt: { type: Date, default: null },
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

// --- landing ---
app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html><head><meta charset="utf-8"/><title>Pinka Admin</title></head>
<body style="font-family:system-ui;margin:24px">
  <h1>Pinka Admin</h1>
  <p><a href="/admin/users">Список пользователей</a></p>
  <p><a href="/api/health">/api/health</a></p>
</body></html>`);
});

app.get("/admin/users", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pinka Admin — Users</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px}
table{border-collapse:collapse;width:100%;max-width:1200px}
th,td{border:1px solid #e0e0e0;padding:8px;font-size:14px}
th{background:#fafafa;text-align:left}
.muted{color:#666}
</style>
</head><body>
<h1>Пользователи</h1>
<p class="muted">Все, кто хоть раз запускал бота и/или открывал TMA.</p>
<table id="t"><thead><tr>
<th>tgId</th><th>username</th><th>firstName</th><th>lastName</th><th>lang</th>
<th>launchCount</th><th>botStartCount</th><th>createdAt</th><th>lastSeenAt</th>
</tr></thead><tbody></tbody></table>
<script>
(async () => {
  const res = await fetch('/api/admin/users');
  const data = await res.json();
  const tbody = document.querySelector('#t tbody');
  tbody.innerHTML = '';
  (data.users || []).forEach(u => {
    const tr = document.createElement('tr');
    const td = (v) => { const x=document.createElement('td'); x.textContent = v ?? ''; return x; };
    tr.appendChild(td(u.tgId));
    tr.appendChild(td(u.username));
    tr.appendChild(td(u.firstName));
    tr.appendChild(td(u.lastName));
    tr.appendChild(td(u.languageCode));
    tr.appendChild(td(u.launchCount));
    tr.appendChild(td(u.botStartCount));
    tr.appendChild(td(u.createdAt ? new Date(u.createdAt).toISOString() : ''));
    tr.appendChild(td(u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : ''));
    tbody.appendChild(tr);
  });
})();
</script>
</body></html>`);
});

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---- Telegram WebApp initData validation ----
function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return { ok: computedHash === hash, params: Object.fromEntries(params.entries()) };
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

/**
 * POST /api/users/ensure
 * Body: { initData: string }
 * - валидируем initData
 * - upsert user (tgId)
 * - FIX Mongo operators: launchCount НЕ в $setOnInsert, только $inc
 */
app.post("/api/users/ensure", async (req, res) => {
  try {
    const initData = String(req.body?.initData || "");
    if (!initData) return res.status(400).json({ ok: false, error: "initData is required" });

    const parsed = parseInitData(initData);
    if (!parsed.ok) return res.status(401).json({ ok: false, error: "bad initData" });

    const userObj = safeJsonParse(parsed.params.user || "");
    if (!userObj?.id) return res.status(400).json({ ok: false, error: "user is missing in initData" });

    const now = new Date();

    const payload = {
      tgId: Number(userObj.id),
      username: String(userObj.username || ""),
      firstName: String(userObj.first_name || ""),
      lastName: String(userObj.last_name || ""),
      languageCode: String(userObj.language_code || ""),
    };

    const user = await User.findOneAndUpdate(
      { tgId: payload.tgId },
      {
        $setOnInsert: {
          ...payload,
          createdAt: now,
          // launchCount НЕ ставим тут!
        },
        $set: {
          ...payload,
          lastSeenAt: now,
        },
        $inc: { launchCount: 1 },
      },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, user, meta: { source: "tma" } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

/**
 * POST /api/users/ensure-bot
 * Auth: header x-bot-token must equal BOT_TOKEN
 */
app.post("/api/users/ensure-bot", async (req, res) => {
  try {
    const token = String(req.headers["x-bot-token"] || "");
    if (!token || token !== BOT_TOKEN) return res.status(401).json({ ok: false, error: "unauthorized" });

    const tgId = Number(req.body?.tgId);
    if (!Number.isFinite(tgId) || tgId <= 0) return res.status(400).json({ ok: false, error: "tgId is required" });

    const now = new Date();

    const payload = {
      username: String(req.body?.username || ""),
      firstName: String(req.body?.firstName || ""),
      lastName: String(req.body?.lastName || ""),
      languageCode: String(req.body?.languageCode || ""),
    };

    const user = await User.findOneAndUpdate(
      { tgId },
      {
        $setOnInsert: {
          tgId,
          ...payload,
          createdAt: now,
          botStartCount: 0,
          botStartAt: now,
        },
        $set: {
          ...payload,
          lastSeenAt: now,
          botStartAt: now,
        },
        $inc: { botStartCount: 1 },
      },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, user, meta: { source: "bot" } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// --- Admin API: users list ---
app.get("/api/admin/users", async (_req, res) => {
  try {
    const users = await User.find({}).sort({ lastSeenAt: -1 }).limit(5000).lean();
    return res.json({ ok: true, users });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(Number(PORT), () => {
  console.log(`[pinka-admin] listening on :${PORT}`);
});
