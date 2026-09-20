// server/src/routes/notifications.js — fil d'actualité (buts, cartons, fins de
// match). Consommé côté client par polling (Fetch API) pour une mise à jour
// sans rechargement de page.
const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/notifications?since=2026-06-11T20:00:00.000Z&limit=20
router.get("/", (req, res) => {
  const { since, limit } = req.query;
  const max = Math.min(Number(limit) || 20, 100);
  const rows = since
    ? db
        .prepare("SELECT * FROM notifications WHERE created_at > ? ORDER BY created_at DESC LIMIT ?")
        .all(since, max)
    : db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?").all(max);
  res.json({ count: rows.length, notifications: rows, server_time: new Date().toISOString() });
});

module.exports = router;
