const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

// ===== CORS =====
app.use(
  cors({
    origin: [
      "https://pinka-tma.onrender.com",
      "https://web.telegram.org",
      "https://t.me",
    ],
    credentials: true,
  })
);

// ===== MIDDLEWARE =====
app.use(bodyParser.json());

// ===== ENV CHECK =====
if (!process.env.MONGO_URI) {
  console.error("Missing MONGO_URI in env");
  process.exit(1);
}
if (!process.env.BOT_TOKEN) {
  console.error("Missing BOT_TOKEN in env");
  process.exit(1);
}

// ===== MONGO =====
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB error", err);
    process.exit(1);
  });

// ===== MODELS =====
const UserSchema = new mongoose.Schema(
  {
    tgId: { type: String, index: true, unique: true },
    username: String,
    firstName: String,
    lastName: String,
    photoUrl: String,
    createdAt: { type: Date, default: Date.now },
  },
  { minimize: false }
);

const User = mongoose.model("User", UserSchema);

// ===== ROUTES =====
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/users/ensure", async (req, res) => {
  try {
    const { initData } = req.body || {};

    if (!initData) {
      return res
        .status(400)
        .json({ ok: false, error: "initData required (or enable DEV_ALLOW_MOCK + mockTgId)" });
    }

    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) {
      return res.status(400).json({ ok: false, error: "user missing in initData" });
    }

    const user = JSON.parse(userRaw);

    let doc = await User.findOne({ tgId: String(user.id) });
    if (!doc) {
      doc = await User.create({
        tgId: String(user.id),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        photoUrl: user.photo_url,
      });
    }

    res.json({ ok: true, user: doc });
  } catch (e) {
    console.error("ensure error", e);
    res.status(500).json({ ok: false, error: "Load failed" });
  }
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Admin API listening on", PORT);
});
