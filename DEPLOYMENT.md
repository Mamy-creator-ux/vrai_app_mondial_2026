# Guide de déploiement — FIFA26 / Control

Ce guide couvre, du premier `git init` jusqu'au site en ligne :

1. Préparer le dépôt GitHub
2. Déployer le **backend Express** (API REST + base de données)
3. Déployer le **frontend Next.js** sur **Vercel**
4. Relier les deux et vérifier
5. Dépannage courant

> **Pourquoi deux déploiements séparés ?** Vercel exécute le code sous forme de
> fonctions serverless : chaque requête démarre une fonction isolée et
> temporaire. C'est excellent pour Next.js, mais mal adapté à un serveur
> Express classique qui doit garder une connexion permanente à un fichier
> SQLite sur disque. On déploie donc le frontend sur Vercel et le backend
> Express sur un hébergeur qui fait tourner un vrai processus persistant
> (Render, gratuit, est utilisé ici — Railway ou Fly.io fonctionnent pareil).

---

## 1. Préparer le dépôt GitHub

```bash
# À la racine du projet (qui contient à la fois le frontend et /server)
git init
git add .
git commit -m "Initial commit — FIFA26 / Control"
```

Créez un dépôt vide sur GitHub (sans README ni .gitignore, pour éviter les
conflits), puis :

```bash
git branch -M main
git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
git push -u origin main
```

Vérifiez que ces fichiers **ne sont pas** commités (ils sont dans
`.gitignore`) : `node_modules/`, `.env`, `server/data/*.sqlite`.

---

## 2. Déployer le backend Express (API REST)

### Option recommandée : Render (gratuit, simple)

1. Allez sur [render.com](https://render.com) → **New +** → **Web Service**
2. Connectez votre dépôt GitHub
3. Configurez le service :
   - **Root Directory** : `server`
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm run seed && npm start`
     *(le seed ne réinsère rien si les données existent déjà — il est donc
     sûr de le relancer à chaque déploiement)*
   - **Instance Type** : Free
4. Dans l'onglet **Environment**, ajoutez les variables (copiez
   `server/.env.example`) :
   | Clé | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | une longue chaîne aléatoire (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `JWT_EXPIRES_IN` | `12h` |
   | `CORS_ORIGIN` | l'URL de votre futur site Vercel, ex. `https://fifa26-control.vercel.app` |
   | `SEED_ADMIN_EMAIL` | votre email admin |
   | `SEED_ADMIN_PASSWORD` | un mot de passe fort |
5. **Important — disque persistant** : par défaut, le système de fichiers de
   Render est éphémère (les données SQLite seraient effacées à chaque
   redéploiement). Ajoutez un disque : **Disks** → **Add Disk**, montez-le sur
   `/opt/render/project/src/data`, puis définissez la variable d'environnement
   `DB_PATH=/opt/render/project/src/data/championnat.sqlite`.
6. Cliquez **Create Web Service**. Notez l'URL générée, ex.
   `https://fifa26-control-api.onrender.com`.
7. Vérifiez : ouvrez `https://<votre-api>.onrender.com/api` — vous devez voir
   le JSON listant les routes disponibles.

### Alternative : Railway

Mêmes réglages (`Root Directory: server`, `Build: npm install`,
`Start: npm run seed && npm start`), avec un volume monté sur `server/data`
pour la persistance SQLite. Railway détecte Node.js automatiquement.

### Alternative : passer à PostgreSQL (recommandé si vous grandissez)

Le module `server/src/db/index.js` est le seul fichier à connaître la base.
Pour basculer vers PostgreSQL managé (Render Postgres, Supabase, Neon),
remplacez `better-sqlite3` par le driver `pg`, adaptez les requêtes
(`?` → `$1, $2...`), le reste de l'API (routes, calcul du classement) ne
change pas.

---

## 3. Déployer le frontend sur Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New** → **Project**
2. Importez le même dépôt GitHub
3. **Root Directory** : laissez la racine (le dossier `server/` est ignoré
   par Vercel grâce au `.vercelignore` fourni)
4. **Framework Preset** : Next.js (détecté automatiquement)
5. Dans **Environment Variables**, ajoutez (copiez `.env.example` racine) :
   | Clé | Valeur |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | l'URL Render de l'étape 2, ex. `https://fifa26-control-api.onrender.com` |
   | `NEXT_PUBLIC_SITE_URL` | votre future URL Vercel, ex. `https://fifa26-control.vercel.app` |
   | `DATABASE_URL` | chaîne de connexion PostgreSQL (voir ci-dessous) |
   | `BETTER_AUTH_URL` | même valeur que `NEXT_PUBLIC_SITE_URL` |
   | `BETTER_AUTH_SECRET` | longue chaîne aléatoire (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
6. Cliquez **Deploy**.

### Base de données PostgreSQL pour l'espace « supporter » (better-auth)

L'espace « Connexion » du site (comptes visiteurs) utilise `better-auth` +
PostgreSQL, séparément de l'API Express. Le plus simple sur Vercel :

1. Dans votre projet Vercel → onglet **Storage** → **Create Database** →
   **Neon** (ou Supabase) → suivez l'assistant.
2. Vercel ajoute automatiquement `DATABASE_URL` à vos variables
   d'environnement.
3. Les tables (`user`, `session`, `account`, `verification`) doivent exister :
   générez-les avec Drizzle Kit avant le premier déploiement :

   ```bash
   npx drizzle-kit push --config=drizzle.config.ts
   ```

   *(si `drizzle.config.ts` n'existe pas encore, créez-le à la racine :)*

   ```ts
   import { defineConfig } from "drizzle-kit"
   export default defineConfig({
     schema: "./lib/db/schema.ts",
     dialect: "postgresql",
     dbCredentials: { url: process.env.DATABASE_URL! },
   })
   ```

4. Redéployez.

---

## 4. Relier les deux et vérifier

1. Retournez sur Render → variables d'environnement de l'API → mettez à jour
   `CORS_ORIGIN` avec la vraie URL Vercel obtenue à l'étape 3, puis
   redéployez le service (**Manual Deploy**).
2. Ouvrez votre site Vercel : la bannière rouge « API indisponible » ne doit
   **pas** apparaître ; le calendrier, le classement et les statistiques se
   chargent avec les données réelles.
3. Testez l'espace organisateur : `/admin`, connectez-vous avec le compte
   admin créé par le seed. Onglet **Résultats** : changez un score, vérifiez
   que le classement se met à jour immédiatement sur la page d'accueil.
   Onglet **Événements** : enregistrez un but sur un match, vérifiez qu'il
   apparaît aussitôt dans le fil de notifications (icône cloche) et dans les
   meilleurs buteurs de la page d'accueil. Onglets **Effectifs** et
   **Stades & arbitres** : ajoutez un joueur et un stade de test.
4. Testez la page publique `/equipes` : sélectionnez une équipe, vérifiez
   que son effectif et son entraîneur s'affichent.
5. Testez l'espace supporter : `/connexion`, créez un compte — il doit
   fonctionner sans erreur si `DATABASE_URL` et `BETTER_AUTH_SECRET` sont
   corrects.

## 5. Domaines personnalisés (optionnel)

- **Vercel** : Project → Settings → Domains → ajoutez votre domaine, suivez
  les instructions DNS (enregistrement `CNAME` vers `cname.vercel-dns.com`).
- **Render** : Settings → Custom Domain, similaire.
- N'oubliez pas de remettre à jour `CORS_ORIGIN`, `NEXT_PUBLIC_SITE_URL` et
  `BETTER_AUTH_URL` avec les nouveaux domaines.

## 6. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| Bannière rouge « API indisponible » | `NEXT_PUBLIC_API_URL` absent/faux, ou CORS bloqué | Vérifiez la variable sur Vercel et `CORS_ORIGIN` sur Render |
| `/admin` : « Connexion impossible » | Seed non exécuté | Vérifiez les logs Render : `npm run seed` doit s'exécuter au démarrage |
| Classement toujours à zéro | Aucun match `TERMINE` avec score | Enregistrez un score depuis `/admin` |
| Le service Render se met en veille (plan gratuit) | Normal sur le plan gratuit après inactivité | Le premier appel après veille prend ~30s ; passez sur un plan payant pour l'éviter |
| Erreur `BETTER_AUTH_SECRET` au build | Variable manquante sur Vercel | Ajoutez-la dans Project → Settings → Environment Variables |
| Données SQLite perdues après redéploiement | Pas de disque persistant configuré | Ajoutez un Disk Render monté sur le dossier `data`, ou migrez vers PostgreSQL |

---

## Développement local (rappel)

```bash
# Terminal 1 — backend
cd server
cp .env.example .env
npm install
npm run seed
npm run dev        # http://localhost:4000

# Terminal 2 — frontend
cp .env.example .env.local
npm install
npm run dev         # http://localhost:3000
```
