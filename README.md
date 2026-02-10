# AppRevenue — Unified Revenue & Deployment Dashboard

Dashboard unifié pour tracker les revenus AdMob, déploiements App Store/Google Play et abonnements Stripe.

## Architecture

```
APIs (AdMob, App Store Connect, Google Play, Stripe)
        │
        ▼
   Collectors (src/collectors/)
        │
        ▼ (Cron quotidien 6h)
   SQLite Database (apprevenue.db)
        │
        ▼
   Express API (src/routes/api.js)
        │
        ▼
   Dashboard EJS + Chart.js (localhost:3000/dashboard)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API credentials

# 3. Seed database (creates admin user + sample data)
npm run db:seed

# 4. Start the server
npm start
# → http://localhost:3000

# 5. Login with admin credentials from .env
# Default: admin@example.com / changeme123
```

## API Configuration

### AdMob
1. Crée un projet Google Cloud → Active l'API AdMob
2. Crée des OAuth2 credentials (type Desktop)
3. Obtiens un refresh token via OAuth playground
4. Renseigne `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `ADMOB_PUBLISHER_ID`

### App Store Connect
1. Va sur https://appstoreconnect.apple.com/access/api
2. Crée une API Key (Admin role)
3. Télécharge le fichier `.p8` → `keys/AuthKey_XXXXXX.p8`
4. Renseigne `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID`, `APPSTORE_KEY_PATH`

### Google Play
1. Crée un Service Account dans Google Cloud Console
2. Active l'API Google Play Android Developer
3. Donne accès au SA dans Play Console → Settings → API access
4. Télécharge le JSON → `keys/google-play-service-account.json`
5. Renseigne `GOOGLE_PLAY_SERVICE_ACCOUNT_PATH`, `GOOGLE_PLAY_PACKAGE_NAMES`

### Stripe
1. Récupère ta Secret Key depuis https://dashboard.stripe.com/apikeys
2. Renseigne `STRIPE_SECRET_KEY`

## API Endpoints

Tous les endpoints nécessitent un Bearer token (obtenu via `POST /api/login`).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Authentification, retourne un JWT |
| GET | `/api/admob` | Données AdMob (query: from, to, limit) |
| GET | `/api/admob/summary` | Revenus AdMob agrégés par jour |
| GET | `/api/appstore` | Données App Store Connect |
| GET | `/api/googleplay` | Données Google Play |
| GET | `/api/stripe` | Données Stripe |
| GET | `/api/summary?days=7` | Résumé unifié |
| GET | `/api/logs` | Logs de collection |
| POST | `/api/collect` | Déclencher une collecte manuelle |
| GET | `/api/export/:source?format=csv` | Export CSV/JSON (source: admob, appstore, googleplay, stripe) |

## Scripts

```bash
npm start          # Démarre le serveur + cron
npm run dev        # Démarre avec nodemon (hot reload)
npm test           # Lance les tests Jest
npm run cron:run   # Exécute une collecte unique (sans serveur)
npm run db:seed    # Seed la base avec des données de test
```

## Structure du projet

```
src/
├── app.js              # Point d'entrée Express
├── config.js           # Configuration centralisée
├── cron.js             # Scheduler node-cron
├── collectors/         # Modules de collecte par service
│   ├── index.js        # Orchestrateur (collectAll)
│   ├── admob.js
│   ├── appstore.js
│   ├── googleplay.js
│   └── stripe.js
├── middleware/
│   └── auth.js         # JWT auth middleware
├── models/             # Sequelize models (SQLite)
│   ├── index.js
│   ├── User.js
│   ├── AdmobRevenue.js
│   ├── AppStoreData.js
│   ├── GooglePlayData.js
│   ├── StripeData.js
│   └── CollectionLog.js
├── routes/
│   ├── api.js          # REST API
│   ├── auth.js         # Login/logout
│   └── dashboard.js    # Dashboard page
├── views/              # EJS templates
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── error.ejs
│   └── partials/
├── scripts/
│   └── seed.js         # DB seeder
└── utils/
    └── logger.js       # Winston logger
tests/
├── auth.test.js
├── api.test.js
└── collectors.test.js
```

## Améliorations futures

- **Metabase / Grafana** : Connecter la DB SQLite/PostgreSQL pour des dashboards avancés
- **Supabase** : Remplacer SQLite par PostgreSQL hébergé + auth intégrée
- **Alertes email** : Ajouter Nodemailer pour notifier quand une collecte échoue ou quand le revenu chute
- **Webhooks Stripe** : Écouter les events en temps réel au lieu de polling quotidien
- **PostgreSQL** : Migrer de SQLite pour la production multi-utilisateurs
- **Docker** : Ajouter un Dockerfile pour déploiement facile
- **App Store Sales Reports** : Intégrer l'API Sales & Trends pour les downloads/revenus réels
- **Google Play Financial Reports** : Utiliser les Cloud Storage reports pour les revenus détaillés
