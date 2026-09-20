// server/src/routes/teams.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/teams?group=A
router.get("/", (req, res) => {
  const { group } = req.query;
  let rows;
  if (group) {
    rows = db
      .prepare(
        `SELECT teams.*, groups.name AS group_name FROM teams
         JOIN groups ON groups.id = teams.group_id
         WHERE groups.name = ? OR groups.name = ?
         ORDER BY teams.name`
      )
      .all(`Groupe ${group}`, group);
  } else {
    rows = db
      .prepare(
        `SELECT teams.*, groups.name AS group_name FROM teams
         LEFT JOIN groups ON groups.id = teams.group_id
         ORDER BY groups.name, teams.name`
      )
      .all();
  }
  res.json({ count: rows.length, teams: rows });
});

// GET /api/teams/:id
router.get("/:id", (req, res) => {
  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!team) return res.status(404).json({ error: "Équipe introuvable." });
  res.json({ team });
});

// POST /api/teams — protégé (admin/editeur)
router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("name").trim().notEmpty(),
  body("code").trim().isLength({ min: 2, max: 4 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, code, flag, group_id, confederation, fifa_rank } = req.body;
    try {
      const info = db
        .prepare(
          "INSERT INTO teams (name, code, flag, group_id, confederation, fifa_rank) VALUES (?,?,?,?,?,?)"
        )
        .run(name, code.toUpperCase(), flag || null, group_id || null, confederation || null, fifa_rank || null);
      const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(info.lastInsertRowid);
      res.status(201).json({ team });
    } catch (e) {
      res.status(409).json({ error: "Cette équipe existe déjà." });
    }
  }
);

// PUT /api/teams/:id — protégé
router.put("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const existing = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Équipe introuvable." });

  const merged = { ...existing, ...req.body };
  db.prepare(
    "UPDATE teams SET name=?, code=?, flag=?, group_id=?, confederation=?, fifa_rank=? WHERE id=?"
  ).run(merged.name, merged.code, merged.flag, merged.group_id, merged.confederation, merged.fifa_rank, req.params.id);

  res.json({ team: db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id) });
});

// DELETE /api/teams/:id — protégé (admin uniquement)
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const info = db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Équipe introuvable." });
  res.status(204).send();
});

module.exports = router;
