// server/src/routes/standings.js
const express = require("express");
const db = require("../db");
const { computeStandingsForGroup, computeAllStandings } = require("../utils/standings");

const router = express.Router();

// GET /api/standings — classement calculé automatiquement pour tous les groupes
router.get("/", (req, res) => {
  res.json({ standings: computeAllStandings() });
});

// GET /api/standings/:group — classement d'un seul groupe (ex: /api/standings/A)
router.get("/:group", (req, res) => {
  const label = req.params.group.length === 1 ? `Groupe ${req.params.group.toUpperCase()}` : req.params.group;
  const group = db.prepare("SELECT id, name FROM groups WHERE name = ?").get(label);
  if (!group) return res.status(404).json({ error: "Groupe introuvable." });
  res.json({ group_name: group.name, standings: computeStandingsForGroup(group.id) });
});

module.exports = router;
