# FIFA26 / Control

Plateforme de championnat de football (Coupe du Monde 2026) — frontend
Next.js avec animations avancées, et backend Node.js + Express fournissant
une API REST complète (équipes, matchs, classement automatique,
statistiques, authentification).

## Structure du projet

```
.
├── app/                    # Frontend Next.js (App Router)
│   ├── page.tsx            # Page d'accueil (hero, calendrier interactif, classement, stats)
│   ├── admin/page.tsx      # Espace organisateur (résultats, événements, effectifs, stades/arbitres)
│   ├── equipes/page.tsx    # Effectifs publics : joueurs & entraîneurs par équipe
│   ├── connexion/page.tsx  # Espace supporter (better-auth + PostgreSQL)
│   └── api/auth/[...all]   # Route better-auth (comptes visiteurs)
├── components/              # Cursor, reveal/marquee/chrome, calendrier interactif, notifications
├── lib/api.ts               # Client typé pour l'API Express
├── server/                   # Backend Node.js + Express
│   ├── src/db/              # SQLite (better-sqlite3), schéma + migrations
│   ├── src/routes/          # auth, teams, players, coaches, matches, events, standings, stats, stadiums, referees, notifications
│   ├── src/utils/standings.js  # Calcul automatique du classement
│   └── src/data/seed.js     # 12 groupes / 48 équipes réelles + effectifs, stades, arbitres, calendrier
├── API.md                   # Référence de l'API REST
└── DEPLOYMENT.md            # Guide complet GitHub → Vercel/Render
```

## Démarrage rapide

```bash
# 1. Backend
cd server
cp .env.example .env
npm install
npm run seed     # crée les 12 groupes, 48 équipes, un compte admin
npm run dev       # http://localhost:4000

# 2. Frontend (dans un second terminal, à la racine du projet)
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```

Compte organisateur de démonstration (créé par `npm run seed`) :
`admin@fifa26.control` / `ChangeMoi123!` — à changer immédiatement en
production via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Deux espaces d'authentification, volontairement séparés

- **`/connexion`** — comptes **supporters** (inscription libre), gérés par
  `better-auth` + PostgreSQL (`lib/auth.ts`). Pensé pour la partie publique
  du site (favoris, notifications, etc. à construire).
- **`/admin`** — accès **organisateur** (saisie des scores, gestion des
  matchs), gérés par le backend Express avec JWT + bcrypt
  (`server/src/routes/auth.js`). Séparé du compte supporter par design : un
  organisateur n'a pas besoin d'un compte PostgreSQL côté frontend, et
  l'API Express reste utilisable indépendamment du site (scripts, apps
  mobiles, intégrations tierces).

## Fonctionnalités (cahier des charges)

**Gestion du championnat**
- Gestion des équipes (12 groupes réels, 48 équipes de la Coupe du Monde 2026)
- Gestion des joueurs et des entraîneurs, par équipe (`/equipes` côté public, `/admin` côté gestion)
- Calendrier des matchs et résultats
- **Classement calculé automatiquement** à chaque score enregistré (aucune étape manuelle, aucun classement stocké — toujours recalculé depuis les résultats)
- Buts, cartons jaunes/rouges et passes décisives liés à un match et un joueur précis (`match_events`) ; **meilleur buteur** et statistiques de discipline calculés automatiquement par agrégation, jamais stockés en doublon
- Gestion des arbitres et des stades (ville, capacité), assignables à chaque match
- Comptes utilisateurs (espace supporter, `better-auth`) et espace administrateur séparé (JWT)
- Notifications générées automatiquement (but, carton, résultat final), consultées par polling sans rechargement de page
- Recherche et filtres (équipe, groupe, statut, date via le calendrier, texte libre)

**JavaScript côté client**
- Affichage dynamique du classement (onglets par groupe, mise à jour sans rechargement)
- Calendrier interactif (navigation mensuelle, jours cliquables, filtrage des matchs par date)
- Formulaires (connexion, inscription, saisie de scores/événements/effectifs/stades/arbitres)
- Filtres combinés (équipe, groupe, statut, date, recherche texte)
- Statistiques dynamiques (meilleurs buteurs, discipline)
- Tout est consommé via **Fetch API** ; l'interface se met à jour sans rechargement de page (React + polling des notifications toutes les 15s)

Animations avancées : curseur magnétique personnalisé, texte kinétique
révélé au scroll, bandeau défilant infini, horloges live multi-fuseaux,
barre de progression de scroll, transitions de menu — inspirées de la
structure d'interaction de [haoqi.design](https://haoqi.design/). Respecte
`prefers-reduced-motion`, accessible au clavier (fermeture du menu à
l'Échap, libellés ARIA).

## Documentation

- [`API.md`](./API.md) — référence complète de l'API REST
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — guide pas à pas GitHub → Vercel (frontend) + Render (backend)
- [`server/README.md`](./server/README.md) — détails du backend

## Stack technique

**Frontend** : Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion
**Backend** : Node.js, Express, SQLite (better-sqlite3), JWT, bcrypt
