/**
 * Pinka Plus — bot/index.js (STEP 1)
 * Goal: при /start фиксировать пользователя в админке.
 *
 * Делает POST {tgId, username, firstName, lastName, languageCode}
 * на ADMIN_API_URL + /api/users/ensure-bot
 * с заголовком x-bot-token = BOT_TOKEN
 */

const { Telegraf, Markup } = require("telegraf");

const { BOT_TOKEN, ADMIN_API_URL, TMA_URL } = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!ADMIN_API_URL) throw new Error("ADMIN_API_URL is required");
if (!TMA_URL) throw new Error("TMA_URL is required");

const bot = new Telegraf(BOT_TOKEN);

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.response = json;
    throw err;
  }
  return json;
}

bot.start(async (ctx) => {
  // 1) фиксируем пользователя в админке
  try {
    const u = ctx.from || {};
    await postJson(
      `${ADMIN_API_URL.replace(/\/+$/, "")}/api/users/ensure-bot`,
      {
        tgId: u.id,
        username: u.username || "",
        firstName: u.first_name || "",
        lastName: u.last_name || "",
        languageCode: u.language_code || "",
      },
      { "x-bot-token": BOT_TOKEN }
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[bot] ensure-bot failed:", e?.message || e, e?.response || "");
  }

  // 2) кнопка WebApp как и раньше
  return ctx.reply(
    "Открывай Pinka Plus:",
    Markup.inlineKeyboard([
      Markup.button.webApp("Open", TMA_URL),
    ])
  );
});

bot.launch();
console.log("[pinka-bot] launched");
