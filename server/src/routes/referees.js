// server/src/routes/referees.js — gestion des arbitres
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM referees ORDER BY name").all();
  res.json({ count: rows.length, referees: rows });
});

router.get("/:id", (req, res) => {
  const referee = db.prepare("SELECT * FROM referees WHERE id = ?").get(req.params.id);
  if (!referee) return res.status(404).json({ error: "Arbitre introuvable." });
  res.json({ referee });
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("name").trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, nationality } = req.body;
    const info = db.prepare("INSERT INTO referees (name, nationality) VALUES (?,?)").run(name, nationality || null);
    res.status(201).json({ referee: db.prepare("SELECT * FROM referees WHERE id = ?").get(info.lastInsertRowid) });
  }
);

router.put("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const existing = db.prepare("SELECT * FROM referees WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Arbitre introuvable." });
  const merged = { ...existing, ...req.body };
  db.prepare("UPDATE referees SET name=?, nationality=?, matches_officiated=? WHERE id=?").run(
    merged.name,
    merged.nationality,
    merged.matches_officiated,
    req.params.id
  );
  res.json({ referee: db.prepare("SELECT * FROM referees WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM referees WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Arbitre introuvable." });
  res.status(204).send();
});

module.exports = router;
