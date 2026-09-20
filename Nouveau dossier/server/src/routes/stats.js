// server/src/routes/stats.js — statistiques des joueurs, calculées
// automatiquement par agrégation des événements de match (match_events).
// Aucune statistique n'est stockée séparément : impossible qu'elle se
// désynchronise des buts/cartons réellement enregistrés.
const express = require("express");
const db = require("../db");

const router = express.Router();

const BASE = `
  SELECT
    players.id AS player_id,
    players.name AS player_name,
    players.position,
    teams.id AS team_id,
    teams.name AS team_name,
    teams.code AS team_code,
    teams.flag AS team_flag,
    SUM(CASE WHEN match_events.type = 'BUT' THEN 1 ELSE 0 END) AS goals,
    SUM(CASE WHEN match_events.type = 'PASSE_DECISIVE' THEN 1 ELSE 0 END) AS assists,
    SUM(CASE WHEN match_events.type = 'CARTON_JAUNE' THEN 1 ELSE 0 END) AS yellow_cards,
    SUM(CASE WHEN match_events.type = 'CARTON_ROUGE' THEN 1 ELSE 0 END) AS red_cards
  FROM match_events
  JOIN players ON players.id = match_events.player_id
  JOIN teams ON teams.id = players.team_id
  GROUP BY players.id
`;

// GET /api/stats — statistiques agrégées de tous les joueurs ayant au moins un événement
router.get("/", (req, res) => {
  const rows = db.prepare(`${BASE} ORDER BY goals DESC, assists DESC`).all();
  res.json({ count: rows.length, stats: rows });
});

// GET /api/stats/top-scorers?limit=10 — meilleur(s) buteur(s)
router.get("/top-scorers", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const rows = db.prepare(`${BASE} HAVING goals > 0 ORDER BY goals DESC, assists DESC LIMIT ?`).all(limit);
  res.json({ count: rows.length, top_scorers: rows });
});

// GET /api/stats/discipline?limit=10 — joueurs les plus sanctionnés (cartons)
router.get("/discipline", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const rows = db
    .prepare(`${BASE} HAVING (yellow_cards + red_cards) > 0 ORDER BY red_cards DESC, yellow_cards DESC LIMIT ?`)
    .all(limit);
  res.json({ count: rows.length, discipline: rows });
});

// GET /api/stats/player/:id — fiche complète d'un joueur (infos + stats + événements)
router.get("/player/:id", (req, res) => {
  const player = db
    .prepare(
      `SELECT players.*, teams.name AS team_name, teams.code AS team_code, teams.flag AS team_flag
       FROM players JOIN teams ON teams.id = players.team_id WHERE players.id = ?`
    )
    .get(req.params.id);
  if (!player) return res.status(404).json({ error: "Joueur introuvable." });

  const stats = db.prepare(`${BASE} HAVING players.id = ?`).get(req.params.id) || {
    goals: 0,
    assists: 0,
    yellow_cards: 0,
    red_cards: 0,
  };
  const events = db
    .prepare(
      `SELECT match_events.*, matches.kickoff_at FROM match_events
       JOIN matches ON matches.id = match_events.match_id
       WHERE match_events.player_id = ? ORDER BY matches.kickoff_at DESC`
    )
    .all(req.params.id);

  res.json({ player, stats, events });
});

module.exports = router;
