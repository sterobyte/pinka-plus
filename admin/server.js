/**
 * Pinka Plus — admin/server.js
 * STEP: top menu (Users / Cards)
 *
 * Adds:
 *  - top navigation menu
 *  - placeholder page for "Cards"
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

// --- helpers ---
function layout(title, active, content) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0}
header{display:flex;gap:16px;align-items:center;padding:12px 20px;border-bottom:1px solid #e0e0e0}
nav a{color:#333;text-decoration:none;padding:6px 10px;border-radius:6px}
nav a.active{background:#111;color:#fff}
main{padding:24px}
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
<header>
  <strong>Pinka Admin</strong>
  <nav>
    <a href="/admin/users" class="${active==='users'?'active':''}">Пользователи</a>
    <a href="/admin/cards" class="${active==='cards'?'active':''}">Карты</a>
  </nav>
</header>
<main>
${content}
</main>
</body>
</html>`;
}

function userSource(u){
  if (u.botStartCount>0 && u.launchCount>0) return ['BOT+TMA','both'];
  if (u.botStartCount>0) return ['BOT','bot'];
  if (u.launchCount>0) return ['TMA','tma'];
  return ['—',''];
}

// --- routes ---
app.get("/", (_req, res) => res.redirect("/admin/users"));

app.get("/admin/users", async (_req, res) => {
  const users = await User.find({}).sort({ lastSeenAt:-1 }).limit(5000).lean();
  const rows = users.map(u=>{
    const [label,cls]=userSource(u);
    return `<tr>
<td>${u.tgId}</td>
<td>${u.username||''}</td>
<td>${u.firstName||''}</td>
<td>${u.lastName||''}</td>
<td>${u.languageCode||''}</td>
<td><span class="badge ${cls}">${label}</span></td>
<td>${u.launchCount}</td>
<td>${u.botStartCount}</td>
<td>${u.createdAt?new Date(u.createdAt).toISOString():''}</td>
<td>${u.lastSeenAt?new Date(u.lastSeenAt).toISOString():''}</td>
</tr>`;
  }).join("");

  res.setHeader("content-type","text/html; charset=utf-8");
  res.end(layout(
    "Pinka Admin — Users",
    "users",
    `<h1>Пользователи</h1>
<p>Все, кто хоть раз запускал бота и/или открывал TMA.</p>
<table>
<thead>
<tr>
<th>tgId</th><th>username</th><th>firstName</th><th>lastName</th><th>lang</th>
<th>source</th><th>launchCount</th><th>botStartCount</th>
<th>createdAt</th><th>lastSeenAt</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>`
  ));
});

app.get("/admin/cards", (_req, res) => {
  res.setHeader("content-type","text/html; charset=utf-8");
  res.end(layout(
    "Pinka Admin — Cards",
    "cards",
    `<h1>Карты</h1>
<p>Раздел «Карты». Скоро здесь будет список и управление картами.</p>`
  ));
});

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok:true }));

// NOTE: ensure endpoints already implemented earlier and remain unchanged

app.listen(Number(PORT), ()=>{
  console.log(`[pinka-admin] listening on :${PORT}`);
});
