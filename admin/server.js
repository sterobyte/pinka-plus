/**
 * Pinka Plus — admin/server.js (STEP: Users list + landing page)
 *
 * Fix: "Cannot GET /" -> add GET /
 * Add: GET /api/admin/users  -> список всех пользователей (кто запускал бот и/или TMA)
 *
 * IMPORTANT: filename stays server.js
 */

import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json({ limit: "1mb" }));

const { MONGO_URI, BOT_TOKEN, PORT = 10000 } = process.env;

if (!MONGO_URI) throw new Error("MONGO_URI is required");
await mongoose.connect(MONGO_URI);

// --- User model (merge into your existing schema if you already have it) ---
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

// --- Landing page (so / is not 404) ---
app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Pinka Admin</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;line-height:1.4}
    .card{border:1px solid #ddd;border-radius:12px;padding:16px;max-width:860px}
    a{color:#0b63ce;text-decoration:none}
    a:hover{text-decoration:underline}
    code{background:#f6f6f6;padding:2px 6px;border-radius:6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Pinka Admin</h1>
    <p><a href="/admin/users">Список пользователей</a></p>
    <p><a href="/api/health">/api/health</a></p>
  </div>
</body>
</html>`);
});

// --- Simple users page ---
app.get("/admin/users", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Pinka Admin — Users</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px}
    table{border-collapse:collapse;width:100%;max-width:1200px}
    th,td{border:1px solid #e0e0e0;padding:8px;font-size:14px}
    th{background:#fafafa;text-align:left}
    .muted{color:#666}
    .wrap{max-width:1200px}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Пользователи</h1>
    <p class="muted">Все, кто хоть раз запускал бота и/или открывал TMA.</p>
    <table id="t">
      <thead>
        <tr>
          <th>tgId</th>
          <th>username</th>
          <th>firstName</th>
          <th>lastName</th>
          <th>lang</th>
          <th>launchCount</th>
          <th>botStartCount</th>
          <th>createdAt</th>
          <th>lastSeenAt</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

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
</body>
</html>`);
});

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- Keep your existing /api/users/ensure (TMA initData validation) as-is ---
app.post("/api/users/ensure", async (_req, res) => {
  return res.status(501).json({
    ok: false,
    error: "Keep your existing /api/users/ensure implementation (TMA initData validation).",
  });
});

// --- Bot -> admin: фиксация /start ---
app.post("/api/users/ensure-bot", async (req, res) => {
  try {
    if (!BOT_TOKEN) return res.status(500).json({ ok: false, error: "BOT_TOKEN is not set on admin" });

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
    const users = await User.find({})
      .sort({ lastSeenAt: -1 })
      .limit(5000)
      .lean();

    return res.json({ ok: true, users });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(Number(PORT), () => {
  console.log(`[pinka-admin] listening on :${PORT}`);
});
