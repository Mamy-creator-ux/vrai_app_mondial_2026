// server/src/routes/events.js — événements de match : buts, cartons jaunes/rouges,
// passes décisives. Chaque événement enregistré génère automatiquement une
// notification (voir insertNotification) — c'est la brique qui alimente en
// temps réel les statistiques joueurs et le fil d'actualité du site.
const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SELECT = `
  SELECT match_events.*, players.name AS player_name, teams.name AS team_name, teams.code AS team_code, teams.flag AS team_flag
  FROM match_events
  JOIN teams ON teams.id = match_events.team_id
  LEFT JOIN players ON players.id = match_events.player_id
`;

const LABELS = {
  BUT: "⚽ But",
  CARTON_JAUNE: "🟨 Carton jaune",
  CARTON_ROUGE: "🟥 Carton rouge",
  PASSE_DECISIVE: "🅰️ Passe décisive",
};

function insertNotification({ match_id, type, title, message }) {
  db.prepare("INSERT INTO notifications (type, title, message, match_id) VALUES (?,?,?,?)").run(
    type,
    title,
    message,
    match_id
  );
}

// GET /api/events?match_id=1
router.get("/", (req, res) => {
  const { match_id, player_id } = req.query;
  let rows;
  if (match_id) rows = db.prepare(`${SELECT} WHERE match_events.match_id = ? ORDER BY minute`).all(match_id);
  else if (player_id) rows = db.prepare(`${SELECT} WHERE match_events.player_id = ?`).all(player_id);
  else rows = db.prepare(`${SELECT} ORDER BY match_events.created_at DESC LIMIT 50`).all();
  res.json({ count: rows.length, events: rows });
});

// POST /api/events — enregistre un but / carton, crée la notification associée
router.post(
  "/",
  requireAuth,
  requireRole("admin", "editeur"),
  body("match_id").isInt(),
  body("team_id").isInt(),
  body("type").isIn(["BUT", "CARTON_JAUNE", "CARTON_ROUGE", "PASSE_DECISIVE"]),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { match_id, team_id, player_id, type, minute } = req.body;
    const match = db.prepare("SELECT * FROM matches WHERE id = ?").get(match_id);
    if (!match) return res.status(404).json({ error: "Match introuvable." });

    const info = db
      .prepare("INSERT INTO match_events (match_id, team_id, player_id, type, minute) VALUES (?,?,?,?,?)")
      .run(match_id, team_id, player_id || null, type, minute || null);

    const player = player_id ? db.prepare("SELECT name FROM players WHERE id = ?").get(player_id) : null;
    const team = db.prepare("SELECT name, flag FROM teams WHERE id = ?").get(team_id);
    const who = player ? `${player.name} (${team.name})` : team.name;

    insertNotification({
      match_id,
      type,
      title: LABELS[type] || type,
      message: `${team.flag ?? ""} ${who} — ${minute ? `${minute}'` : "minute inconnue"}`.trim(),
    });

    res.status(201).json({ event: db.prepare(`${SELECT} WHERE match_events.id = ?`).get(info.lastInsertRowid) });
  }
);

router.delete("/:id", requireAuth, requireRole("admin", "editeur"), (req, res) => {
  const info = db.prepare("DELETE FROM match_events WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Événement introuvable." });
  res.status(204).send();
});

module.exports = router;
