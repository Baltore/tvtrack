// Charge et valide la configuration AVANT tout le reste.
import { config } from './src/config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/auth.js';
import libraryRoutes from './src/routes/library.js';
import searchRoutes from './src/routes/search.js';
import { apiLimiter, searchLimiter } from './src/middleware/rateLimiters.js';

const app = express();

// Derrière un proxy (Render, Railway, Nginx...) : indispensable pour que le
// rate-limit et la détection d'IP se basent sur la vraie IP du client.
app.set('trust proxy', 1);

await connectDB();

/* ---------------------------------------------------------------
   Sécurité
   --------------------------------------------------------------- */

// En-têtes HTTP sécurisés. crossOriginResourcePolicy assoupli car l'API JSON
// est consommée par un frontend hébergé sur un autre domaine.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS : en dev on autorise localhost ; en prod uniquement les origines du .env.
const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = config.isProd
  ? config.corsOrigins
  : [...devOrigins, ...config.corsOrigins];

app.use(cors({
  origin(origin, callback) {
    // Autorise les requêtes sans Origin (curl, health checks, apps natives).
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS_NOT_ALLOWED'));
  },
  credentials: true
}));

app.use(express.json({ limit: '200kb' }));

// Neutralise les opérateurs MongoDB ($, .) injectés dans body/query/params.
app.use(mongoSanitize());

// Limite globale sur toutes les routes API.
app.use('/api', apiLimiter);

/* ---------------------------------------------------------------
   Health check (pour le monitoring de l'hébergeur)
   --------------------------------------------------------------- */
function health(_req, res) {
  res.json({
    ok: true,
    name: 'TVTrack API',
    env: config.isProd ? 'production' : 'development',
    uptime: Math.round(process.uptime())
  });
}
app.get('/health', health);
app.get('/api/health', health);

/* ---------------------------------------------------------------
   Routes (limiteurs spécifiques appliqués au plus près)
   --------------------------------------------------------------- */
app.use('/api/auth', authRoutes);            // login/register limités dans le routeur
app.use('/api/search', searchLimiter, searchRoutes);
app.use('/api/library', libraryRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
});

/* ---------------------------------------------------------------
   Gestionnaire d'erreurs global : messages propres, aucune fuite.
   --------------------------------------------------------------- */
app.use((err, req, res, _next) => {
  if (err.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ message: 'Origine non autorisée' });
  }

  // Erreurs de l'API AniList (axios).
  if (err.isAxiosError) {
    console.error(`AniList error (${req.method} ${req.originalUrl}) :`, err.response?.status || err.code);
    if (err.response?.status === 429) {
      return res.status(429).json({ message: 'AniList limite les requêtes. Patiente une minute et réessaie.' });
    }
    return res.status(502).json({ message: 'AniList est momentanément indisponible. Réessaie dans un instant.' });
  }

  // Erreurs Mongoose fréquentes -> codes clairs.
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first?.message || 'Données invalides' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Identifiant invalide' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Cette entrée existe déjà' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(`[500] ${req.method} ${req.originalUrl} —`, err.message);
  else console.error(`[${status}] ${req.method} ${req.originalUrl} — ${err.message}`);

  // On ne renvoie jamais la stack ni le détail interne d'une 500 au client.
  res.status(status).json({
    message: status >= 500 ? 'Erreur serveur' : (err.message || 'Erreur')
  });
});

app.listen(config.port, () => {
  console.log(`✅ TVTrack API sur le port ${config.port} (${config.isProd ? 'production' : 'development'})`);
});
