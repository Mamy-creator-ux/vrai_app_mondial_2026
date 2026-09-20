// server/src/routes/coaches.js — gestion des entraîneurs
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SELECT = `
  SELECT coaches.*, teams.name AS team_name, teams.code AS team_code, teams.flag AS team_flag
  FROM coaches JOIN teams ON teams.id = coaches.team_id
`;

router.get("/", (req, res) => {
  const { team_id } = req.query;
  const rows = team_id
    ? db.prepare(`${SELECT} WHERE coaches.team_id = ?`).all(team_id)
    : db.prepare(`${SELECT} ORDER BY teams.name`).all();
  res.json({ count: rows.length, coaches: rows });
});

router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("team_id").isInt(),
  body("name").trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { team_id, name, nationality, role } = req.body;
    const info = db
      .prepare("INSERT INTO coaches (team_id, name, nationality, role) VALUES (?,?,?,?)")
      .run(team_id, name, nationality || null, role || "Sélectionneur");
    res.status(201).json({ coach: db.prepare(`${SELECT} WHERE coaches.id = ?`).get(info.lastInsertRowid) });
  }
);

router.put("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const existing = db.prepare("SELECT * FROM coaches WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Entraîneur introuvable." });
  const merged = { ...existing, ...req.body };
  db.prepare("UPDATE coaches SET team_id=?, name=?, nationality=?, role=? WHERE id=?").run(
    merged.team_id,
    merged.name,
    merged.nationality,
    merged.role,
    req.params.id
  );
  res.json({ coach: db.prepare(`${SELECT} WHERE coaches.id = ?`).get(req.params.id) });
});

router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM coaches WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Entraîneur introuvable." });
  res.status(204).send();
});

module.exports = router;
