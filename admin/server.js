/**
 * Pinka Plus — admin/server.js (ESM fix)
 * package.json has "type":"module" => use import, not require.
 *
 * Includes:
 *  - GET /api/health
 *  - POST /api/users/ensure-bot (фикс пользователей, которые запускали бота)
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

// If you already have a User model/schema in your project,
// merge the NEW fields (botStartCount, botStartAt) into it.
const UserSchema = new mongoose.Schema(
  {
    tgId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    languageCode: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    // WebApp launches
    launchCount: { type: Number, default: 0 },

    // Bot starts
    botStartCount: { type: Number, default: 0 },
    botStartAt: { type: Date, default: null },
  },
  { collection: "users" }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/**
 * Keep your existing /api/users/ensure (TMA initData validation) as-is.
 * This file does not replace it, to avoid breaking your working MVP chain.
 */
app.post("/api/users/ensure", async (_req, res) => {
  return res.status(501).json({
    ok: false,
    error: "Keep your existing /api/users/ensure implementation (TMA initData validation).",
  });
});

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

app.listen(Number(PORT), () => {
  console.log(`[pinka-admin] listening on :${PORT}`);
});
