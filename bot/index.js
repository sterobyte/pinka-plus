/**
 * Pinka Plus — bot/index.js
 * STEP: убрать inline WebApp кнопку полностью.
 *
 * Оставляем:
 *  - фиксацию пользователя (POST /api/users/ensure-bot)
 *  - обычный текстовый ответ на /start (без клавиатур)
 */

const { Telegraf } = require("telegraf");

const { BOT_TOKEN, ADMIN_API_URL } = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!ADMIN_API_URL) throw new Error("ADMIN_API_URL is required");

const bot = new Telegraf(BOT_TOKEN);

async function ensureBotUser(ctx) {
  const u = ctx.from || {};
  const url = `${ADMIN_API_URL.replace(/\/+$/, "")}/api/users/ensure-bot`;

  try {
    const res = await fetch(url, {
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

    if (!res.ok) {
      const text = await res.text();
      // eslint-disable-next-line no-console
      console.error("[bot] ensure-bot failed:", res.status, text);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[bot] ensure-bot error:", e?.message || e);
  }
}

bot.start(async (ctx) => {
  await ensureBotUser(ctx);
  return ctx.reply("Открой мини‑приложение через кнопку «Open» в профиле бота / меню (не через чат).");
});

bot.launch();
console.log("[pinka-bot] launched");
