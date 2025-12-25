/**
 * Pinka Plus — admin/server.js
 * STEP: add user source column (BOT / TMA / BOT+TMA)
 *
 * source logic:
 *  - BOT      => botStartCount > 0 && launchCount === 0
 *  - TMA      => launchCount > 0 && botStartCount === 0
 *  - BOT+TMA  => botStartCount > 0 && launchCount > 0
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

// --- CORS ---
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
    username: String,
    firstName: String,
    lastName: String,
    languageCode: String,

    createdAt: Date,
    lastSeenAt: Date,

    launchCount: { type: Number, default: 0 },
    botStartCount: { type: Number, default: 0 },
    botStartAt: Date,
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

// --- landing ---
app.get("/", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`
<!doctype html>
<html><head><meta charset="utf-8"><title>Pinka Admin</title></head>
<body style="font-family:system-ui;margin:24px">
<h1>Pinka Admin</h1>
<p><a href="/admin/users">Список пользователей</a></p>
<p><a href="/api/health">/api/health</a></p>
</body></html>
`);
});

// --- users page ---
app.get("/admin/users", (_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pinka Admin — Users</title>
<style>
body{font-family:system-ui;margin:24px}
table{border-collapse:collapse;width:100%;max-width:1300px}
th,td{border:1px solid #e0e0e0;padding:8px;font-size:14px}
th{background:#fafafa;text-align:left}
.badge{padding:2px 6px;border-radius:6px;font-size:12px}
.bot{background:#e3f2fd}
.tma{background:#e8f5e9}
.both{background:#ede7f6}
</style>
</head>
<body>
<h1>Пользователи</h1>
<p>Все, кто хоть раз запускал бота и/или открывал TMA.</p>

<table id="t">
<thead>
<tr>
<th>tgId</th>
<th>username</th>
<th>firstName</th>
<th>lastName</th>
<th>lang</th>
<th>source</th>
<th>launchCount</th>
<th>botStartCount</th>
<th>createdAt</th>
<th>lastSeenAt</th>
</tr>
</thead>
<tbody></tbody>
</table>

<script>
function source(u){
  if (u.botStartCount>0 && u.launchCount>0) return ['BOT+TMA','both'];
  if (u.botStartCount>0) return ['BOT','bot'];
  if (u.launchCount>0) return ['TMA','tma'];
  return ['—',''];
}
(async()=>{
  const r=await fetch('/api/admin/users');
  const d=await r.json();
  const tb=document.querySelector('#t tbody');
  (d.users||[]).forEach(u=>{
    const tr=document.createElement('tr');
    const td=v=>{const x=document.createElement('td');x.textContent=v??'';return x};
    tr.appendChild(td(u.tgId));
    tr.appendChild(td(u.username));
    tr.appendChild(td(u.firstName));
    tr.appendChild(td(u.lastName));
    tr.appendChild(td(u.languageCode));
    const [label,cls]=source(u);
    const s=document.createElement('td');
    const b=document.createElement('span');
    b.className='badge '+cls;
    b.textContent=label;
    s.appendChild(b);
    tr.appendChild(s);
    tr.appendChild(td(u.launchCount));
    tr.appendChild(td(u.botStartCount));
    tr.appendChild(td(u.createdAt?new Date(u.createdAt).toISOString():''));
    tr.appendChild(td(u.lastSeenAt?new Date(u.lastSeenAt).toISOString():''));
    tb.appendChild(tr);
  });
})();
</script>
</body>
</html>
`);
});

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- admin users API ---
app.get("/api/admin/users", async (_req, res) => {
  const users = await User.find({}).sort({ lastSeenAt: -1 }).limit(5000).lean();
  res.json({ ok: true, users });
});

// --- keep existing ensure endpoints ---
app.post("/api/users/ensure", async (_req, res) => {
  res.status(501).json({ ok: false, error: "use existing implementation" });
});
app.post("/api/users/ensure-bot", async (_req, res) => {
  res.status(501).json({ ok: false, error: "use existing implementation" });
});

app.listen(Number(PORT), () => {
  console.log(`[pinka-admin] listening on :${PORT}`);
});
