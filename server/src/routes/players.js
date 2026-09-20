// server/src/routes/players.js — gestion des joueurs (effectifs)
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SELECT = `
  SELECT players.*, teams.name AS team_name, teams.code AS team_code, teams.flag AS team_flag
  FROM players JOIN teams ON teams.id = players.team_id
`;

// GET /api/players?team_id=1
router.get("/", (req, res) => {
  const { team_id } = req.query;
  const rows = team_id
    ? db.prepare(`${SELECT} WHERE players.team_id = ? ORDER BY players.number`).all(team_id)
    : db.prepare(`${SELECT} ORDER BY teams.name, players.number`).all();
  res.json({ count: rows.length, players: rows });
});

router.get("/:id", (req, res) => {
  const player = db.prepare(`${SELECT} WHERE players.id = ?`).get(req.params.id);
  if (!player) return res.status(404).json({ error: "Joueur introuvable." });
  res.json({ player });
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("team_id").isInt(),
  body("name").trim().notEmpty(),
  body("position").isIn(["GARDIEN", "DEFENSEUR", "MILIEU", "ATTAQUANT"]),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { team_id, name, number, position, birth_date, nationality } = req.body;
    const info = db
      .prepare("INSERT INTO players (team_id, name, number, position, birth_date, nationality) VALUES (?,?,?,?,?,?)")
      .run(team_id, name, number || null, position, birth_date || null, nationality || null);
    res.status(201).json({ player: db.prepare(`${SELECT} WHERE players.id = ?`).get(info.lastInsertRowid) });
  }
);

router.put("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const existing = db.prepare("SELECT * FROM players WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Joueur introuvable." });
  const merged = { ...existing, ...req.body };
  db.prepare(
    "UPDATE players SET team_id=?, name=?, number=?, position=?, birth_date=?, nationality=? WHERE id=?"
  ).run(merged.team_id, merged.name, merged.number, merged.position, merged.birth_date, merged.nationality, req.params.id);
  res.json({ player: db.prepare(`${SELECT} WHERE players.id = ?`).get(req.params.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM players WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Joueur introuvable." });
  res.status(204).send();
});

module.exports = router;
