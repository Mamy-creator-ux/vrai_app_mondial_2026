// server/src/db/index.js
// -----------------------------------------------------------------------------
// Connexion à la base de données SQLite (fichier local, zéro configuration).
// En production, DB_PATH peut pointer vers un disque persistant (Render Disk,
// Railway Volume, etc.). SQLite a été choisi pour que l'API tourne "out of the
// box" sans dépendance à un service de base de données externe — mais le code
// est isolé dans ce seul fichier : basculer vers PostgreSQL/MySQL plus tard
// ne demande de changer que ce module.
// -----------------------------------------------------------------------------
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "championnat.sqlite");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editeur')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL,
      flag TEXT,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      confederation TEXT,
      fifa_rank INTEGER
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      stadium TEXT,
      city TEXT,
      stadium_id INTEGER REFERENCES stadiums(id) ON DELETE SET NULL,
      referee_id INTEGER REFERENCES referees(id) ON DELETE SET NULL,
      kickoff_at TEXT NOT NULL,
      round TEXT NOT NULL DEFAULT 'Phase de groupes',
      status TEXT NOT NULL DEFAULT 'PROGRAMME' CHECK (status IN ('PROGRAMME','EN_COURS','TERMINE','REPORTE')),
      home_score INTEGER,
      away_score INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stadiums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      capacity INTEGER,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS referees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nationality TEXT,
      matches_officiated INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS coaches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      nationality TEXT,
      role TEXT NOT NULL DEFAULT 'Sélectionneur'
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      number INTEGER,
      position TEXT CHECK (position IN ('GARDIEN','DEFENSEUR','MILIEU','ATTAQUANT')),
      birth_date TEXT,
      nationality TEXT
    );

    CREATE TABLE IF NOT EXISTS match_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('BUT','CARTON_JAUNE','CARTON_ROUGE','PASSE_DECISIVE')),
      minute INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_teams_group ON teams(group_id);
    CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_coaches_team ON coaches(team_id);
    CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);
    CREATE INDEX IF NOT EXISTS idx_events_player ON match_events(player_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
  `);

  // Ajouts idempotents de colonnes sur une base déjà existante (SQLite ne
  // supporte pas "ADD COLUMN IF NOT EXISTS" : on vérifie via PRAGMA).
  const matchCols = db.prepare("PRAGMA table_info(matches)").all().map((c) => c.name);
  if (!matchCols.includes("stadium_id")) {
    db.exec("ALTER TABLE matches ADD COLUMN stadium_id INTEGER REFERENCES stadiums(id) ON DELETE SET NULL");
  }
  if (!matchCols.includes("referee_id")) {
    db.exec("ALTER TABLE matches ADD COLUMN referee_id INTEGER REFERENCES referees(id) ON DELETE SET NULL");
  }
}

migrate();

module.exports = db;
