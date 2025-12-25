import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";
import fetch from "node-fetch";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_API_URL = process.env.ADMIN_API_URL || "http://localhost:3000";
const TMA_URL = process.env.TMA_URL || "";

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Fallback: /start can record user with mockTgId (trusted sync happens from TMA initData)
async function ensureUserFromStart(ctx) {
  const u = ctx.from;
  if (!u?.id) return null;
  try {
    const r = await fetch(`${ADMIN_API_URL}/api/users/ensure`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mockTgId: u.id, meta: { source: "bot_start_fallback" } })
    });
    const j = await r.json();
    return j.ok ? j.user : null;
  } catch {
    return null;
  }
}

bot.start(async (ctx) => {
  await ensureUserFromStart(ctx);
  const url = TMA_URL || "https://example.com";
  const button = Markup.button.webApp("Open Pinka Plus", url);
  await ctx.reply("Открой мини‑приложение и нажми Sync account.", Markup.inlineKeyboard([[button]]));
});

bot.command("ping", async (ctx) => ctx.reply("pong"));

bot.launch().then(() => console.log("✅ Bot launched"));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
