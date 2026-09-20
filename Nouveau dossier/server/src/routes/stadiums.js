// server/src/routes/stadiums.js — gestion des stades
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM stadiums ORDER BY name").all();
  res.json({ count: rows.length, stadiums: rows });
});

router.get("/:id", (req, res) => {
  const stadium = db.prepare("SELECT * FROM stadiums WHERE id = ?").get(req.params.id);
  if (!stadium) return res.status(404).json({ error: "Stade introuvable." });
  res.json({ stadium });
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("name").trim().notEmpty(),
  body("city").trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, city, capacity, image } = req.body;
    try {
      const info = db
        .prepare("INSERT INTO stadiums (name, city, capacity, image) VALUES (?,?,?,?)")
        .run(name, city, capacity || null, image || null);
      res.status(201).json({ stadium: db.prepare("SELECT * FROM stadiums WHERE id = ?").get(info.lastInsertRowid) });
    } catch {
      res.status(409).json({ error: "Ce stade existe déjà." });
    }
  }
);

router.put("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const existing = db.prepare("SELECT * FROM stadiums WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Stade introuvable." });
  const merged = { ...existing, ...req.body };
  db.prepare("UPDATE stadiums SET name=?, city=?, capacity=?, image=? WHERE id=?").run(
    merged.name,
    merged.city,
    merged.capacity,
    merged.image,
    req.params.id
  );
  res.json({ stadium: db.prepare("SELECT * FROM stadiums WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM stadiums WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Stade introuvable." });
  res.status(204).send();
});

module.exports = router;
