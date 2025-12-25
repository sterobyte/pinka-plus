/**
 * Pinka Plus bot
 * /start — только текст, без кнопок
 */

const { Telegraf } = require("telegraf");
const fetch = require("node-fetch");

const { BOT_TOKEN, ADMIN_API_URL } = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!ADMIN_API_URL) throw new Error("ADMIN_API_URL is required");

const bot = new Telegraf(BOT_TOKEN);

async function ensureUserFromStart(ctx) {
  const u = ctx.from || {};

  try {
    await fetch(`${ADMIN_API_URL}/api/users/ensure-bot`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bot-token": BOT_TOKEN,
      },
      body: JSON.stringify({
        tgId: u.id,
        username: u.username || "",
        firstName: u.first_name || "",
        lastName: u.last_name || "",
        languageCode: u.language_code || "",
      }),
    });
  } catch (err) {
    console.error("ensure-bot error:", err);
  }
}

bot.start(async (ctx) => {
  await ensureUserFromStart(ctx);
  return ctx.reply(
    "Открой мини-приложение через профиль бота (кнопка Open) и нажми Sync account."
  );
});

bot.launch();
console.log("[pinka-bot] started");
