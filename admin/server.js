/**
 * Pinka Plus — admin/server.js
 * STEP: Cards -> "Добавить карту" (+ PNG upload)
 *
 * Manual fields:
 *  - cardNo (декор)
 *  - issuer (select)
 *  - type (select)
 *  - series (select)
 *  - ownerTgId (default 71846656)
 *  - image PNG
 *
 * System fields:
 *  - KID (unique)
 *  - utcDate (YYYY-MM-DD)
 *  - utcTime (HH:mm:ss)
 *
 * IMPORTANT: filename stays server.js
 */

import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";

const app = express();
app.use(express.json({ limit: "2mb" }));

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

// --- Models ---
const UserSchema = new mongoose.Schema(
  {
    tgId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    languageCode: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    launchCount: { type: Number, default: 0 }, // TMA launches
    botStartCount: { type: Number, default: 0 }, // Bot /start count
    botStartAt: { type: Date, default: null },
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

const CardSchema = new mongoose.Schema(
  {
    kid: { type: String, required: true, unique: true, index: true },

    // manual
    cardNo: { type: String, default: "" }, // декор
    issuer: { type: String, required: true },
    cardType: { type: String, required: true },
    series: { type: String, required: true },
    ownerTgId: { type: Number, required: true, index: true },

    // system
    utcDate: { type: String, required: true }, // YYYY-MM-DD
    utcTime: { type: String, required: true }, // HH:mm:ss

    // image (stored in Mongo for MVP)
    image: {
      contentType: { type: String, default: "" },
      data: { type: Buffer, default: null },
      filename: { type: String, default: "" },
    },
  },
  { collection: "cards" }
);

const Card = mongoose.models.Card || mongoose.model("Card", CardSchema);

// --- constants (готовые списки, пока минимальные) ---
const ISSUERS = ["Pinka Plus"];
const TYPES = ["Personality"];
const SERIES = ["Creme"];

// --- KID generator ---
// We keep it deterministic and collision-resistant: 32 hex chars (UUID v4 without dashes).
// Example: 9f7c1a0b3d0e4f5a9b8c7d6e5f4a3b2c
function genKID() {
  return crypto.randomUUID().replaceAll("-", "");
}

function utcDateTimeParts(d = new Date()) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  return { utcDate: `${yyyy}-${mm}-${dd}`, utcTime: `${HH}:${MM}:${SS}` };
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function userSource(u) {
  if (u.botStartCount > 0 && u.launchCount > 0) return "BOT+TMA";
  if (u.botStartCount > 0) return "BOT";
  if (u.launchCount > 0) return "TMA";
  return "—";
}

function layout(title, active, content) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0}
header{display:flex;gap:16px;align-items:center;padding:12px 20px;border-bottom:1px solid #e0e0e0}
nav a{color:#333;text-decoration:none;padding:6px 10px;border-radius:6px}
nav a.active{background:#111;color:#fff}
main{padding:24px}
table{border-collapse:collapse;width:100%;max-width:1400px}
th,td{border:1px solid #e0e0e0;padding:8px;font-size:14px}
th{background:#fafafa;text-align:left}
.small{color:#666;font-size:13px}
.btn{display:inline-block;background:#111;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;border:none;cursor:pointer}
.row{display:grid;grid-template-columns:220px 1fr;gap:10px;align-items:center;margin:10px 0;max-width:760px}
input,select{padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px}
.badge{padding:2px 6px;border-radius:6px;font-size:12px;background:#f1f1f1}
</style>
</head>
<body>
<header>
  <strong>Pinka Admin</strong>
  <nav>
    <a href="/admin/users" class="${active === "users" ? "active" : ""}">Пользователи</a>
    <a href="/admin/cards" class="${active === "cards" ? "active" : ""}">Карты</a>
  </nav>
</header>
<main>${content}</main>
</body>
</html>`;
}

// --- upload (PNG only) ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png") return cb(null, true);
    cb(new Error("Only PNG is allowed"));
  },
});

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
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// --- routes ---
app.get("/", (_req, res) => res.redirect("/admin/users"));

// --- Users page ---
app.get("/admin/users", async (_req, res) => {
  const users = await User.find({}).sort({ lastSeenAt: -1 }).limit(5000).lean();

  const rows = users
    .map(
      (u) => `<tr>
<td>${u.tgId}</td>
<td>${esc(u.username)}</td>
<td>${esc(u.firstName)}</td>
<td>${esc(u.lastName)}</td>
<td>${esc(u.languageCode)}</td>
<td><span class="badge">${userSource(u)}</span></td>
<td>${u.launchCount}</td>
<td>${u.botStartCount}</td>
<td>${u.createdAt ? new Date(u.createdAt).toISOString() : ""}</td>
<td>${u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : ""}</td>
</tr>`
    )
    .join("");

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    layout(
      "Pinka Admin — Users",
      "users",
      `<h1>Пользователи</h1>
<p class="small">Все, кто хоть раз запускал бота и/или открывал TMA.</p>
<table>
<thead>
<tr>
<th>tgId</th><th>username</th><th>firstName</th><th>lastName</th><th>lang</th>
<th>source</th><th>launchCount</th><th>botStartCount</th><th>createdAt</th><th>lastSeenAt</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>`
    )
  );
});

// --- Cards list ---
app.get("/admin/cards", async (_req, res) => {
  const cards = await Card.find({}).sort({ utcDate: -1, utcTime: -1 }).limit(5000).lean();

  const rows = cards
    .map(
      (c) => `<tr>
<td>${esc(c.kid)}</td>
<td>${esc(c.cardNo)}</td>
<td>${esc(c.issuer)}</td>
<td>${esc(c.cardType)}</td>
<td>${esc(c.series)}</td>
<td>${c.ownerTgId}</td>
<td>${esc(c.utcDate)}</td>
<td>${esc(c.utcTime)}</td>
<td>${c.image?.data ? "PNG" : "—"}</td>
</tr>`
    )
    .join("");

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    layout(
      "Pinka Admin — Cards",
      "cards",
      `<div style="display:flex;align-items:center;gap:12px">
  <h1 style="margin:0">Карты</h1>
  <a class="btn" href="/admin/cards/new">Добавить карту</a>
</div>
<p class="small">Карты без владельца не существуют.</p>

<table>
<thead>
<tr>
<th>KID</th><th>номер</th><th>эмитент</th><th>тип</th><th>серия</th><th>ownerTgId</th><th>date</th><th>time</th><th>png</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>`
    )
  );
});

// --- Cards create form ---
app.get("/admin/cards/new", (_req, res) => {
  const issuerOptions = ISSUERS.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  const typeOptions = TYPES.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  const seriesOptions = SERIES.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");

  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(
    layout(
      "Pinka Admin — Add Card",
      "cards",
      `<h1>Добавить карту</h1>

<form action="/admin/cards/new" method="post" enctype="multipart/form-data">
  <div class="row">
    <label>Номер карты (декор)</label>
    <input name="cardNo" placeholder="777" />
  </div>

  <div class="row">
    <label>Эмитент</label>
    <select name="issuer">${issuerOptions}</select>
  </div>

  <div class="row">
    <label>Тип</label>
    <select name="cardType">${typeOptions}</select>
  </div>

  <div class="row">
    <label>Серия</label>
    <select name="series">${seriesOptions}</select>
  </div>

  <div class="row">
    <label>Владелец (tgID)</label>
    <input name="ownerTgId" value="71846656" inputmode="numeric" />
  </div>

  <div class="row">
    <label>PNG</label>
    <input type="file" name="image" accept="image/png" required />
  </div>

  <div class="row">
    <span></span>
    <button class="btn" type="submit">Создать</button>
  </div>

  <p class="small">Система присвоит: KID + дату/время (UTC).</p>
</form>`
    )
  );
});

app.post("/admin/cards/new", upload.single("image"), async (req, res) => {
  try {
    const cardNo = String(req.body?.cardNo || "");
    const issuer = String(req.body?.issuer || "");
    const cardType = String(req.body?.cardType || "");
    const series = String(req.body?.series || "");
    const ownerTgId = Number(req.body?.ownerTgId);

    if (!ISSUERS.includes(issuer)) return res.status(400).send("bad issuer");
    if (!TYPES.includes(cardType)) return res.status(400).send("bad type");
    if (!SERIES.includes(series)) return res.status(400).send("bad series");
    if (!Number.isFinite(ownerTgId) || ownerTgId <= 0) return res.status(400).send("bad ownerTgId");
    if (!req.file?.buffer) return res.status(400).send("png is required");

    const now = new Date();
    const { utcDate, utcTime } = utcDateTimeParts(now);

    // guarantee unique KID (retry a few times)
    let kid = genKID();
    for (let i = 0; i < 6; i++) {
      const exists = await Card.findOne({ kid }).select("_id").lean();
      if (!exists) break;
      kid = genKID();
    }

    await Card.create({
      kid,
      cardNo,
      issuer,
      cardType,
      series,
      ownerTgId,
      utcDate,
      utcTime,
      image: {
        contentType: req.file.mimetype,
        data: req.file.buffer,
        filename: req.file.originalname || "card.png",
      },
    });

    return res.redirect("/admin/cards");
  } catch (e) {
    return res.status(500).send(String(e?.message || e));
  }
});

// image endpoint (для проверки)
app.get("/api/cards/:kid/image.png", async (req, res) => {
  const kid = String(req.params.kid || "");
  const card = await Card.findOne({ kid }).lean();
  if (!card?.image?.data) return res.status(404).end();
  res.setHeader("content-type", "image/png");
  res.end(card.image.data);
});

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- API: users ensure (TMA) ---
app.post("/api/users/ensure", async (req, res) => {
  try {
    const initData = String(req.body?.initData || "");
    if (!initData) return res.status(400).json({ ok: false, error: "initData is required" });

    const parsed = parseInitData(initData);
    if (!parsed.ok) return res.status(401).json({ ok: false, error: "bad initData" });

    const userObj = safeJsonParse(parsed.params.user || "");
    if (!userObj?.id) return res.status(400).json({ ok: false, error: "user is missing in initData" });

    const now = new Date();
    const tgId = Number(userObj.id);

    const profile = {
      username: String(userObj.username || ""),
      firstName: String(userObj.first_name || ""),
      lastName: String(userObj.last_name || ""),
      languageCode: String(userObj.language_code || ""),
    };

    const user = await User.findOneAndUpdate(
      { tgId },
      {
        $setOnInsert: {
          tgId,
          createdAt: now,
        },
        $set: {
          ...profile,
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

// --- API: users ensure (BOT /start) ---
app.post("/api/users/ensure-bot", async (req, res) => {
  try {
    const token = String(req.headers["x-bot-token"] || "");
    if (!token || token !== BOT_TOKEN) return res.status(401).json({ ok: false, error: "unauthorized" });

    const tgId = Number(req.body?.tgId);
    if (!Number.isFinite(tgId) || tgId <= 0) return res.status(400).json({ ok: false, error: "tgId is required" });

    const now = new Date();

    const profile = {
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
          createdAt: now,
          botStartCount: 0,
        },
        $set: {
          ...profile,
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

app.listen(Number(PORT), () => {
  console.log(`[pinka-admin] listening on :${PORT}`);
});
