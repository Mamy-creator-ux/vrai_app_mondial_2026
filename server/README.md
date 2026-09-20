# FIFA26 / Control — API (Node.js + Express)

API REST pour la gestion d'un championnat de football : équipes, joueurs,
entraîneurs, arbitres, stades, matchs, événements (buts/cartons), classement
automatique, statistiques calculées, notifications, authentification.

## Installation

```bash
cp .env.example .env
npm install
npm run seed    # 12 groupes, 48 équipes réelles (CM 2026), stades, arbitres,
                 # effectifs (joueurs + entraîneurs), calendrier de démo, compte admin
npm run dev      # démarrage avec rechargement auto (nodemon)
# ou
npm start        # démarrage simple
```

Le serveur écoute par défaut sur `http://localhost:4000`. Voir
[`../API.md`](../API.md) pour la référence complète des routes.

## Modèle de données

| Table | Rôle |
|---|---|
| `groups`, `teams` | 12 groupes, 48 équipes (tirage réel CM 2026) |
| `players`, `coaches` | Effectif et sélectionneur de chaque équipe |
| `stadiums`, `referees` | Infrastructures et corps arbitral |
| `matches` | Calendrier, résultats, stade/arbitre assignés |
| `match_events` | Buts, cartons jaunes/rouges, passes décisives — **source de vérité unique** pour les statistiques |
| `notifications` | Fil d'actualité généré automatiquement (but, carton, résultat) |
| `users` | Comptes organisateurs (JWT) |

SQLite (fichier local, `data/championnat.sqlite`), zéro configuration. Le
schéma est créé/migré automatiquement au démarrage (`src/db/index.js`,
migrations idempotentes via `PRAGMA table_info`). Pour passer à PostgreSQL en
production, seul ce fichier a besoin d'être adapté — le reste de l'API
(routes, calcul du classement et des statistiques) est indépendant du moteur
de stockage.

## Calculs automatiques (rien n'est stocké en double)

- **Classement** (`src/utils/standings.js`) : recalculé à la volée à chaque
  appel de `GET /api/standings` à partir des matchs `TERMINE`. Règles : 3
  points victoire, 1 nul, 0 défaite ; tri par points, puis différence de
  buts, puis buts marqués.
- **Statistiques joueurs** (`src/routes/stats.js`) : meilleur(s) buteur(s) et
  discipline (cartons) recalculés par agrégation SQL de `match_events` à
  chaque appel de `/api/stats/*`. Un but enregistré via `POST /api/events`
  apparaît donc immédiatement dans `/api/stats/top-scorers`.
- **Notifications** : générées automatiquement par `POST /api/events` (but,
  carton) et par `PATCH /api/matches/:id/score` lorsqu'un match passe au
  statut `TERMINE`.

## Sécurité

- Mots de passe hashés avec `bcryptjs`
- Jetons `JWT` signés (`JWT_SECRET`, à changer en production)
- `helmet` (en-têtes HTTP sécurisés), `cors` restreint à `CORS_ORIGIN`
- Limitation de débit (`express-rate-limit`) globale + spécifique au login
- Validation des entrées (`express-validator`) sur toutes les routes d'écriture
- Écriture (POST/PUT/DELETE) protégée par JWT sur toutes les ressources ;
  suppression réservée au rôle `admin`

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Démarre avec rechargement automatique (nodemon) |
| `npm start` | Démarre en mode production |
| `npm run seed` | (Ré)initialise les données de référence (idempotent) |
