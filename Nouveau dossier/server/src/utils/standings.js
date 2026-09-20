// server/src/utils/standings.js
// -----------------------------------------------------------------------------
// Calcul automatique du classement à partir des matchs TERMINE.
// Règles FIFA standard : 3 pts victoire, 1 pt nul, 0 pt défaite.
// Tri : points > différence de buts > buts marqués > nom (stable, lisible).
// -----------------------------------------------------------------------------
const db = require("../db");

function computeStandingsForGroup(groupId) {
  const teams = db.prepare("SELECT id, name, code, flag FROM teams WHERE group_id = ?").all(groupId);
  const table = new Map(
    teams.map((t) => [
      t.id,
      {
        team_id: t.id,
        name: t.name,
        code: t.code,
        flag: t.flag,
        joues: 0,
        gagnes: 0,
        nuls: 0,
        perdus: 0,
        buts_pour: 0,
        buts_contre: 0,
        diff: 0,
        points: 0,
        forme: [],
      },
    ])
  );

  const matches = db
    .prepare(
      `SELECT * FROM matches WHERE group_id = ? AND status = 'TERMINE' AND home_score IS NOT NULL AND away_score IS NOT NULL ORDER BY kickoff_at ASC`
    )
    .all(groupId);

  for (const m of matches) {
    const home = table.get(m.home_team_id);
    const away = table.get(m.away_team_id);
    if (!home || !away) continue;

    home.joues++;
    away.joues++;
    home.buts_pour += m.home_score;
    home.buts_contre += m.away_score;
    away.buts_pour += m.away_score;
    away.buts_contre += m.home_score;

    if (m.home_score > m.away_score) {
      home.gagnes++;
      home.points += 3;
      away.perdus++;
      home.forme.push("V");
      away.forme.push("D");
    } else if (m.home_score < m.away_score) {
      away.gagnes++;
      away.points += 3;
      home.perdus++;
      away.forme.push("V");
      home.forme.push("D");
    } else {
      home.nuls++;
      away.nuls++;
      home.points += 1;
      away.points += 1;
      home.forme.push("N");
      away.forme.push("N");
    }
  }

  const rows = [...table.values()].map((r) => ({
    ...r,
    diff: r.buts_pour - r.buts_contre,
    forme: r.forme.slice(-5),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.buts_pour !== a.buts_pour) return b.buts_pour - a.buts_pour;
    return a.name.localeCompare(b.name);
  });

  return rows.map((r, i) => ({ position: i + 1, ...r }));
}

function computeAllStandings() {
  const groups = db.prepare("SELECT id, name FROM groups ORDER BY name").all();
  return groups.map((g) => ({
    group_id: g.id,
    group_name: g.name,
    standings: computeStandingsForGroup(g.id),
  }));
}

module.exports = { computeStandingsForGroup, computeAllStandings };
