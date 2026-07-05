import rateLimit from 'express-rate-limit';

const withMessage = (message) => ({ message });

// Limite globale de toutes les routes /api (anti-scraping / anti-DoS léger).
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: withMessage('Trop de requêtes. Patiente un instant.')
});

// Anti-bruteforce sur login / register : peu de tentatives par fenêtre.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: withMessage('Trop de tentatives. Réessaie dans quelques minutes.')
});

// Recherche AniList : évite d'épuiser le quota de l'API externe.
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: withMessage('Trop de recherches. Patiente un instant.')
});
