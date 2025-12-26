import express from "express";
import Collection from "../models/Collection.js";
import Series from "../models/Series.js";
import CardType from "../models/CardType.js";
import Emitter from "../models/Emitter.js";

const router = express.Router();

router.use(express.json({ limit: "1mb" }));

function mustName(body) {
  const name = (body?.name ?? "").toString().trim();
  if (!name) {
    const err = new Error("name is required");
    err.status = 400;
    throw err;
  }
  if (name.length > 80) {
    const err = new Error("name is too long (max 80)");
    err.status = 400;
    throw err;
  }
  return name;
}

async function list(Model) {
  return Model.find({}, { name: 1, createdAt: 1 })
    .sort({ nameNorm: 1 })
    .lean();
}

async function create(Model, req) {
  mustName(req.body);
  try {
    const doc = await Model.create({ name: req.body.name });
    return { ok: true, item: { _id: doc._id, name: doc.name } };
  } catch (e) {
    if (e?.code === 11000) return { ok: false, error: "duplicate_name" };
    throw e;
  }
}

async function remove(Model, id) {
  const res = await Model.deleteOne({ _id: id });
  return { ok: true, deletedCount: res.deletedCount ?? 0 };
}

// Collections
router.get("/collections", async (_req, res) => res.json({ ok: true, items: await list(Collection) }));
router.post("/collections", async (req, res, next) => { try { res.json(await create(Collection, req)); } catch (e) { next(e); }});
router.delete("/collections/:id", async (req, res, next) => { try { res.json(await remove(Collection, req.params.id)); } catch (e) { next(e); }});

// Series
router.get("/series", async (_req, res) => res.json({ ok: true, items: await list(Series) }));
router.post("/series", async (req, res, next) => { try { res.json(await create(Series, req)); } catch (e) { next(e); }});
router.delete("/series/:id", async (req, res, next) => { try { res.json(await remove(Series, req.params.id)); } catch (e) { next(e); }});

// Card Types
router.get("/card-types", async (_req, res) => res.json({ ok: true, items: await list(CardType) }));
router.post("/card-types", async (req, res, next) => { try { res.json(await create(CardType, req)); } catch (e) { next(e); }});
router.delete("/card-types/:id", async (req, res, next) => { try { res.json(await remove(CardType, req.params.id)); } catch (e) { next(e); }});

// Emitters
router.get("/emitters", async (_req, res) => res.json({ ok: true, items: await list(Emitter) }));
router.post("/emitters", async (req, res, next) => { try { res.json(await create(Emitter, req)); } catch (e) { next(e); }});
router.delete("/emitters/:id", async (req, res, next) => { try { res.json(await remove(Emitter, req.params.id)); } catch (e) { next(e); }});

// Lists for dropdowns
router.get("/lists", async (_req, res) => {
  const [collections, series, cardTypes, emitters] = await Promise.all([
    list(Collection),
    list(Series),
    list(CardType),
    list(Emitter),
  ]);
  res.json({ ok: true, collections, series, cardTypes, emitters });
});

router.use((err, _req, res, _next) => {
  res.status(Number(err?.status || 500)).json({ ok: false, error: err?.message || "server_error" });
});

export default router;
