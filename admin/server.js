import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEV_ALLOW_MOCK = String(process.env.DEV_ALLOW_MOCK || "").toLowerCase() === "true";

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in env");
  process.exit(1);
}
if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN in env");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("✅ Mongo connected");

const userSchema = new mongoose.Schema(
  {
    tgId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    languageCode: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    launchCount: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const User = mongoose.model("User", userSchema);

/**
 * Telegram WebApp initData verification
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Missing hash" };
  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calcHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calcHash !== hash) return { ok: false, error: "Invalid hash" };

  const userRaw = params.get("user");
  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      return { ok: false, error: "Bad user JSON" };
    }
  }

  return { ok: true, user };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "pinka-admin", ts: new Date().toISOString() });
});

app.post("/api/users/ensure", async (req, res) => {
  const { initData, mockTgId, meta } = req.body || {};
  let tgUser = null;

  if (initData && typeof initData === "string" && initData.length > 0) {
    const parsed = parseInitData(initData);
    if (!parsed.ok) return res.status(401).json({ ok: false, error: parsed.error });
    tgUser = parsed.user;
    if (!tgUser?.id) return res.status(400).json({ ok: false, error: "Missing user in initData" });
  } else if (DEV_ALLOW_MOCK && Number.isFinite(Number(mockTgId))) {
    tgUser = { id: Number(mockTgId), username: "mock", first_name: "Mock", last_name: "User", language_code: "en" };
  } else {
    return res.status(400).json({ ok: false, error: "initData required (or enable DEV_ALLOW_MOCK + mockTgId)" });
  }

  const tgId = Number(tgUser.id);
  const update = {
    username: String(tgUser.username || ""),
    firstName: String(tgUser.first_name || ""),
    lastName: String(tgUser.last_name || ""),
    languageCode: String(tgUser.language_code || ""),
    lastSeenAt: new Date(),
  };

  // FIX: don't set launchCount and $inc launchCount in the same update (Mongo conflict).
  const doc = await User.findOneAndUpdate(
    { tgId },
    {
      $setOnInsert: { tgId, createdAt: new Date() },
      $set: update,
      $inc: { launchCount: 1 },
    },
    { new: true, upsert: true }
  ).lean();

  res.json({
    ok: true,
    user: {
      tgId: doc.tgId,
      username: doc.username,
      firstName: doc.firstName,
      lastName: doc.lastName,
      languageCode: doc.languageCode,
      createdAt: doc.createdAt,
      lastSeenAt: doc.lastSeenAt,
      launchCount: doc.launchCount,
    },
    meta: meta || null,
  });
});

app.get("/api/users/count", async (req, res) => {
  const count = await User.countDocuments({});
  res.json({ ok: true, count });
});

app.listen(PORT, () => console.log(`✅ Admin API listening on :${PORT}`));
