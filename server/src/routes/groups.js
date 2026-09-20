// server/src/routes/groups.js
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/groups — liste des groupes avec leurs équipes
router.get("/", (req, res) => {
  const groups = db.prepare("SELECT id, name FROM groups ORDER BY name").all();
  const teamsStmt = db.prepare("SELECT id, name, code, flag, confederation, fifa_rank FROM teams WHERE group_id = ? ORDER BY name");
  const result = groups.map((g) => ({ ...g, teams: teamsStmt.all(g.id) }));
  res.json({ count: result.length, groups: result });
});

module.exports = router;
