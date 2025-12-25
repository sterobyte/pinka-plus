# Pinka Plus — Mini App MVP (Admin + Bot + TMA)

MVP: 3 сервиса (admin API, bot, mini‑app). Mini‑app сохраняет учетку пользователя в MongoDB через `POST /api/users/ensure`.

- Admin API: Node.js + Express + MongoDB (Mongoose)
- Bot: Telegraf
- TMA: Vite + React

## Локальный запуск

1) Скопируй env:
- `admin/.env.example` → `admin/.env`
- `bot/.env.example` → `bot/.env`
- `tma/.env.example` → `tma/.env`

2) Запуск:

**admin**
```bash
cd admin && npm i && npm run dev
```

**bot**
```bash
cd bot && npm i && npm run dev
```

**tma**
```bash
cd tma && npm i && npm run dev
```

## Render (Blueprint)

В корне есть `render.yaml` (Blueprint). В Render выставь env:
- admin: `MONGO_URI`, `BOT_TOKEN`
- bot: `BOT_TOKEN`, `ADMIN_API_URL`, (опц.) `TMA_URL`
- tma: `VITE_ADMIN_API_URL`
