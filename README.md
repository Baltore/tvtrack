# TVTrack

TVTrack est une application web de suivi d'animés : recherche, bibliothèque personnelle, progression **saison par saison et épisode par épisode**, notes, favoris, sorties à venir et import depuis TV Time. Interface sombre moderne, responsive mobile / tablette / desktop.

## Fonctionnalités

- Création de compte et connexion (JWT)
- Dashboard : temps passé devant des animés (mois/jours/heures), épisodes vus, statistiques, "Continuer à regarder", sorties des 7 prochains jours
- **Calendrier des sorties** : les prochains épisodes des animés **de ta liste**, groupés par jour (Hier, Aujourd'hui, puis les jours de la semaine jusqu'à J+6, puis « Plus tard » avec le décompte de jours)
- Recherche AniList avec debounce + catalogue sans recherche (tendances, populaires cette saison, populaires de tous les temps, mieux notés)
- **Saisons regroupées** : les saisons d'une même série (entrées AniList séparées) sont fusionnées en une seule fiche — Mushoku Tensei = 1 carte avec 5 saisons, pas 6 résultats
- Fiche détail : liste des saisons (progression, coche "saison vue", grille d'épisodes dépliable — cliquer sur l'épisode N marque tout ce qui précède comme vu)
- Suivi par animé : statut (à voir, en cours, terminé, en pause, abandonné — mis à jour automatiquement selon la progression), note sur 10, favori, commentaire personnel
- Bibliothèque avec filtres (statut, favoris, note minimum, titre) et tri (récent, activité, note, titre, progression)
- **Import TV Time** : charge le fichier JSON de ton export TV Time, l'app retrouve tes animés sur AniList et importe ta progression
- Toasts, skeleton loaders, états vides avec actions

## Stack

- Backend : Node.js, Express, MongoDB, Mongoose, JWT
- Frontend : React + Vite (sans autre dépendance)
- API externe : AniList GraphQL (pas de clé requise)

## Installation

### 1. Lancer MongoDB

```bash
cd tvtrack
docker compose up -d
```

Ou lance MongoDB localement si tu l'as déjà.

### 2. Backend

```bash
cd backend
# Windows : copy .env.example .env
# Mac/Linux : cp .env.example .env
npm install
npm run dev
```

Dans `backend/.env`, remplis au minimum `JWT_SECRET` et `MONGODB_URI` (le serveur refuse de démarrer sans).
Le backend tourne sur `http://localhost:5000` (test : `http://localhost:5000/health`).

**Variables `backend/.env`** (voir `backend/.env.example`) :

| Variable | Rôle | Local |
|----------|------|-------|
| `NODE_ENV` | environnement | `development` |
| `PORT` | port du serveur | `5000` |
| `MONGODB_URI` | connexion MongoDB | `mongodb://127.0.0.1:27017/tvtrack` |
| `JWT_SECRET` | clé de signature des sessions | une chaîne longue et aléatoire |
| `JWT_EXPIRES_IN` | durée des sessions | `7d` |
| `CORS_ORIGIN` | origine(s) frontend autorisée(s) | `http://localhost:5173` |

**Variable `frontend/.env`** (voir `frontend/.env.example`) : `VITE_API_URL` = `http://localhost:5000/api`.

> AniList ne nécessite aucune clé. Il n'y a **aucun secret côté frontend** (seul `VITE_API_URL` y est exposé).

### 3. Frontend

```bash
cd frontend
# Windows : copy .env.example .env
# Mac/Linux : cp .env.example .env
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173`.

## Import TV Time

1. Demande ton export de données dans TV Time.
2. Récupère le fichier `.json` contenant tes épisodes vus.
3. Dans TVTrack : menu **Import TV Time** → choisis le fichier → vérifie la liste → lance l'import.

Le parseur lit le format officiel de l'export TV Time (tableau de séries avec `seasons[].episodes[].is_watched`), ignore les épisodes spéciaux, et reprend le flag `is_favorite`. Le format simple `[{ "title": "One Piece", "watched": 1100 }]` fonctionne aussi.

L'import passe par la recherche AniList (limitée à ~30 requêtes/minute), donc il avance volontairement lentement (~1 série toutes les 4-5 s). Les séries non-animés (Elite, 13 Reasons Why...) sont marquées « introuvable ». Sur un export réel de ~260 séries, comptez une quinzaine de minutes ; tu peux arrêter et relancer à tout moment (les séries déjà importées sont détectées).

## Routes backend

Toutes les routes hors `/api/auth/register` et `/api/auth/login` demandent un header `Authorization: Bearer <token>`.

### Auth

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Recherche & catalogue (AniList)

```http
GET /api/search/anime?q=one piece      # recherche (saisons regroupées)
GET /api/search/anime/airing?days=7    # planning de diffusion global (dédoublonné)
GET /api/search/upcoming?days=90       # planning limité aux animés de MA bibliothèque
GET /api/search/browse                 # tendances, saison en cours, populaires, mieux notés
GET /api/search/detail/anime/:id       # fiche franchise : toutes les saisons regroupées (avec cache)
```

### Bibliothèque

```http
GET    /api/library                    # filtres : status, q, favorite, minRating, sort
GET    /api/library/stats              # totaux, épisodes vus, temps passé (minutes), note moyenne
POST   /api/library                    # ajout (si déjà présent : rafraîchit les métadonnées sans toucher à la progression)
PATCH  /api/library/:id                # statut, saisons/épisodes vus, note, favori, commentaire
DELETE /api/library/:id
```

Un élément de bibliothèque stocke un tableau `seasons` (`anilistId`, `episodes`, `aired`, `watched`, `duration`...) ; la progression globale, le statut et le temps de visionnage en découlent automatiquement.

## Structure du frontend

```txt
src/
  lib/         api.js (client API), helpers.js (dates, statuts, temps, payloads), tvtime.js (parseur d'export)
  context/     ToastContext.jsx (notifications)
  hooks/       useLibraryActions.js (modifier / supprimer)
  components/  Sidebar, MediaCard, MediaGrid, MediaDetailModal, SeasonList, FilterBar,
               StatCard, EmptyState, LoadingSkeleton, Icons
  pages/       Dashboard, Library, Calendar, Search, Import, Login, Register
```

## Sécurité

- **Helmet** (en-têtes HTTP sécurisés) + **CORS** restreint (localhost en dev, `CORS_ORIGIN` en prod).
- **Rate limiting** : anti-bruteforce sur login/register (20 / 15 min), limite sur la recherche et globale sur `/api`.
- **JWT** signé avec `JWT_SECRET` (jamais en dur), expiration configurable ; le serveur refuse de démarrer en prod avec un secret faible.
- **Mots de passe** hachés bcrypt (coût 12), `select: false` : jamais renvoyés par l'API.
- **Validation** des entrées (email, mot de passe, pseudo, statut, note, progression) + **sanitization anti-injection MongoDB**.
- Chaque requête bibliothèque est **scopée sur l'utilisateur** : impossible de lire/modifier les données d'un autre.
- Gestion d'erreurs globale : messages propres, **aucune stack ni secret renvoyé** au client.

