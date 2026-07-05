import dotenv from 'dotenv';

// Charge le .env (une seule fois, avant toute lecture de process.env).
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.error(`❌ Variable d'environnement manquante : ${name}. Copie backend/.env.example vers backend/.env et remplis-la.`);
    process.exit(1);
  }
  return value.trim();
}

const jwtSecret = requireEnv('JWT_SECRET');
const mongoUri = requireEnv('MONGODB_URI');

// En production, on refuse de démarrer avec un secret faible ou par défaut :
// c'est ce qui protège réellement les sessions de tes utilisateurs.
if (isProd) {
  if (jwtSecret.length < 32 || jwtSecret === 'change_this_secret_key') {
    console.error('❌ JWT_SECRET trop faible pour la production. Genere une cle : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
}

// Origines autorisées par CORS (liste séparée par des virgules).
// CORS_ORIGIN est prioritaire ; CLIENT_URL reste accepté pour compatibilité.
const corsOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins
};
