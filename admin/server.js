/**
 * Pinka Plus — admin/server.js (STEP 1)
 * Goal: фиксировать пользователей, которые запускали бота (/start).
 *
 * Добавлено:
 *   POST /api/users/ensure-bot
 *   - вызывается ботом при /start
 *   - авторизация: заголовок x-bot-token должен совпадать с env BOT_TOKEN
 *   - upsert пользователя по tgId
 *   - инкремент botStartCount и обновление botStartAt/lastSeenAt
 *
 * ВАЖНО: имена файлов не меняем. server.js остаётся server.js.
 */

const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- ENV ---
const { MONGO_URI, BOT_TOKEN, PORT = 10000 } = process.env;

// --- Mongo ---
if (!MONGO_URI) throw new Error("MONGO_URI is required");
mongoose.connect(MONGO_URI);

// --- User model ---
// Если у тебя модель уже объявлена иначе — перенеси новые поля botStartCount/botStartAt туда.
const UserSchema = new mongoose.Schema(
  {
    tgId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    languageCode: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    // уже используемое поле (WebApp launches)
    launchCount: { type: Number, default: 0 },

    // NEW: bot starts
    botStartCount: { type: Number, default: 0 },
    botStartAt: { type: Date, default: null },
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

// --- health ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/**
 * Уже существующий эндпойнт (WebApp initData).
 * Оставь как есть в твоём проекте — ниже просто заглушка.
 * ВАЖНО: фикс Mongo conflicting update operators:
 *  - launchCount НЕ ставим в $setOnInsert
 *  - увеличиваем только через $inc: { launchCount: 1 }
 */
app.post("/api/users/ensure", async (_req, res) => {
  return res.status(501).json({
    ok: false,
    error: "This patch file is a STEP-1 template. Keep your existing /api/users/ensure implementation.",
  });
});

/**
 * NEW: bot calls this on /start to фиксировать пользователей кто запускал бота
 * Auth: header x-bot-token must equal BOT_TOKEN
 */
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
          // launchCount НЕ трогаем тут
          botStartCount: 0,
          botStartAt: now,
        },
        $set: {
          ...payload,
          lastSeenAt: now,
          botStartAt: now,
        },
        $inc: {
          botStartCount: 1,
        },
      },
      { new: true, upsert: true }
    );

    return res.json({ ok: true, user, meta: { source: "bot" } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(Number(PORT), () => {
  // eslint-disable-next-line no-console
  console.log(`[pinka-admin] listening on :${PORT}`);
});
