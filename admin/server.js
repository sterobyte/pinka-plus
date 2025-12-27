// Pinka Plus Admin server.js (rewritten clean)
// Minimal Express admin with pages: users, cards, emitters, collections, series

import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const mongoUrl = process.env.MONGO_URL;
const client = new MongoClient(mongoUrl);
let db;

async function init() {
  await client.connect();
  db = client.db();
  console.log("DB connected");
}
init();

function layout(title, active, content) {
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  body { font-family: Arial; background:#0f172a; color:#e2e8f0; padding:20px; }
  nav a { margin-right:15px; color:#94a3b8; text-decoration:none; }
  nav a.active { color:#fff; font-weight:bold; }
  h1 { margin-bottom:20px; }
  .block { background:#1e293b; padding:15px; border-radius:8px; margin-bottom:20px; }
  input { padding:6px; }
  button { padding:6px 12px; margin-left:5px; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  td, th { border-bottom:1px solid #334155; padding:6px; }
</style>
</head>
<body>
<nav>
  <a href="/admin/users" class="${active==="users"?"active":""}">Пользователи</a>
  <a href="/admin/cards" class="${active==="cards"?"active":""}">Карты</a>
  <a href="/admin/emitters" class="${active==="emitters"?"active":""}">Эмитенты</a>
  <a href="/admin/collections" class="${active==="collections"?"active":""}">Коллекции</a>
  <a href="/admin/series" class="${active==="series"?"active":""}">Серии</a>
</nav>
<h1>${title}</h1>
${content}
</body>
</html>`;
}

// ----- USERS -----
app.get("/admin/users", async (req, res) => {
  const users = await db.collection("users").find().toArray();
  res.send(layout("Пользователи", "users", `
    <div class="block">
      <table>
        <tr><th>ID</th><th>tgId</th><th>username</th></tr>
        ${users.map(u=>`<tr><td>${u._id}</td><td>${u.tgId||""}</td><td>${u.username||""}</td></tr>`).join("")}
      </table>
    </div>
  `));
});

// ----- CARDS -----
app.get("/admin/cards", async (req, res) => {
  const cards = await db.collection("cards").find().toArray();
  res.send(layout("Карты", "cards", `
    <div class="block">
      <table>
        <tr><th>ID</th><th>owner</th><th>collection</th><th>series</th><th>emitter</th></tr>
        ${cards.map(c=>`
          <tr>
            <td>${c._id}</td>
            <td>${c.owner||""}</td>
            <td>${c.collection||""}</td>
            <td>${c.series||""}</td>
            <td>${c.emitter||""}</td>
          </tr>`).join("")}
      </table>
    </div>
  `));
});

// ----- SIMPLE FORM FACTORY -----
function metaListPage(title, active, name, items) {
  return layout(title, active, `
    <div class="block">
      <form method="POST" action="/admin/${name}">
        <input name="name" placeholder="Название" required />
        <button type="submit">Создать</button>
      </form>
      <table>
        <tr><th>ID</th><th>Название</th></tr>
        ${items.map(i=>`<tr><td>${i._id}</td><td>${i.name}</td></tr>`).join("")}
      </table>
    </div>
  `);
}

function registerMeta(name, title) {
  app.get("/admin/" + name, async (req, res) => {
    const items = await db.collection(name).find().toArray();
    res.send(metaListPage(title, name, name, items));
  });

  app.post("/admin/" + name, async (req, res) => {
    const { name: value } = req.body;
    if (value) {
      await db.collection(name).insertOne({ name: value });
    }
    res.redirect("/admin/" + name);
  });
}

registerMeta("emitters", "Эмитенты");
registerMeta("collections", "Коллекции");
registerMeta("series", "Серии");

app.listen(3000, () => console.log("Admin running on 3000"));
