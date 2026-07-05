import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import auth from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { config } from '../config/env.js';
import { LIMITS, EMAIL_REGEX } from '../constants.js';

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// Représentation publique : jamais de mot de passe ni de champ sensible.
function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email
  };
}

// Validation d'inscription : renvoie un message d'erreur, ou null si tout est bon.
// Les vérifs `typeof ... === 'string'` bloquent aussi les injections d'objets.
function validateRegister({ username, email, password }) {
  if (typeof username !== 'string' || username.trim().length < LIMITS.USERNAME_MIN || username.trim().length > LIMITS.USERNAME_MAX) {
    return `Le pseudo doit faire entre ${LIMITS.USERNAME_MIN} et ${LIMITS.USERNAME_MAX} caractères`;
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return 'Email invalide';
  }
  if (typeof password !== 'string' || password.length < LIMITS.PASSWORD_MIN) {
    return `Le mot de passe doit faire au moins ${LIMITS.PASSWORD_MIN} caractères`;
  }
  return null;
}

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    const error = validateRegister({ username, email, password });
    if (error) return res.status(400).json({ message: error });

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });

    const user = await User.create({ username: username.trim(), email: normalizedEmail, password });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    // Le mot de passe (select: false) doit être demandé explicitement pour la comparaison.
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    // Même message que l'email existe ou non : évite l'énumération de comptes.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
