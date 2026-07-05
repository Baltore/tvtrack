import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config/env.js';

// Protège les routes privées : exige un JWT valide et charge l'utilisateur.
// Le mot de passe n'est jamais chargé (select: false sur le modèle).
export default async function auth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise' });
  }

  try {
    const token = header.slice(7).trim();
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: 'Session invalide, reconnecte-toi' });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Session expirée, reconnecte-toi' });
  }
}
