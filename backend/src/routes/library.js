import express from 'express';
import mongoose from 'mongoose';
import LibraryItem from '../models/LibraryItem.js';
import auth from '../middleware/auth.js';
import { MEDIA_STATUSES, MEDIA_SOURCES, LIMITS } from '../constants.js';

const router = express.Router();
router.use(auth);

const allowedStatuses = MEDIA_STATUSES;
const allowedSources = MEDIA_SOURCES;

// Rejette proprement un id Mongo mal formé (sinon CastError -> 500).
function requireValidId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Identifiant invalide' });
    return false;
  }
  return true;
}

// Le tri "progress" (pourcentage d'épisodes vus) est calculé côté client.
const sortOptions = {
  recent: { createdAt: -1 },
  updated: { updatedAt: -1 },
  rating: { rating: -1, updatedAt: -1 },
  title: { title: 1 }
};

function clampNumber(value, min, max) {
  const number = Number(value);
  if (Number.isNaN(number)) return min;
  return Math.min(Math.max(number, min), max);
}

// Nettoie et borne les saisons envoyées par le client.
function sanitizeSeasons(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((season) => season && season.anilistId)
    .slice(0, 40)
    .map((season, index) => {
      const episodes = clampNumber(season.episodes || 0, 0, 100000);
      const aired = clampNumber(season.aired || 0, 0, 100000);
      const maxWatchable = Math.max(episodes, aired) || 100000;
      return {
        anilistId: String(season.anilistId),
        number: clampNumber(season.number || index + 1, 1, 100),
        title: String(season.title || '').slice(0, 300),
        episodes,
        aired,
        watched: clampNumber(season.watched || 0, 0, maxWatchable),
        duration: clampNumber(season.duration || 0, 0, 1000),
        airingStatus: String(season.airingStatus || '').slice(0, 60),
        releaseDate: String(season.releaseDate || '').slice(0, 20),
        nextAiringAt: season.nextAiringAt ? Number(season.nextAiringAt) : null,
        nextEpisode: season.nextEpisode ? Number(season.nextEpisode) : null
      };
    });
}

// Recalcule les champs dérivés (progression globale, prochaine diffusion).
function applySeasonProgress(item) {
  if (!item.seasons || item.seasons.length === 0) return;

  item.totalEpisodes = item.seasons.reduce(
    (sum, season) => sum + (season.episodes || season.aired || 0), 0
  );
  item.currentEpisode = item.seasons.reduce((sum, season) => sum + (season.watched || 0), 0);

  const nextAiring = item.seasons
    .filter((season) => season.nextAiringAt)
    .sort((a, b) => a.nextAiringAt - b.nextAiringAt)[0];
  item.nextAiringAt = nextAiring?.nextAiringAt || null;
  item.nextEpisode = nextAiring?.nextEpisode || null;
}

// Ajuste automatiquement le statut selon la progression,
// sauf si le client a explicitement demandé un statut.
function autoStatus(item, statusForced) {
  if (statusForced) return;
  const total = item.totalEpisodes || 0;
  if (total > 0 && item.currentEpisode >= total) {
    item.status = 'completed';
  } else if (item.currentEpisode > 0 && ['planning', 'completed'].includes(item.status)) {
    item.status = 'watching';
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { status, q, favorite, minRating, sort } = req.query;
    const filter = { user: req.user._id, mediaType: 'anime' };

    if (status && allowedStatuses.includes(status)) filter.status = status;
    if (favorite === 'true') filter.favorite = true;
    if (minRating && Number(minRating) > 0) filter.rating = { $gte: Number(minRating) };
    if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const sortBy = sortOptions[sort] || sortOptions.recent;
    const items = await LibraryItem.find(filter).sort(sortBy);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const items = await LibraryItem.find({ user: req.user._id, mediaType: 'anime' });
    const rated = items.filter((item) => item.rating > 0);

    // Temps passé : épisodes vus × durée d'un épisode (24 min par défaut).
    const timeWatchedMinutes = items.reduce((total, item) => {
      if (item.seasons?.length) {
        return total + item.seasons.reduce(
          (sum, season) => sum + (season.watched || 0) * (season.duration || item.episodeDuration || 24), 0
        );
      }
      return total + (item.currentEpisode || 0) * (item.episodeDuration || 24);
    }, 0);

    const stats = {
      total: items.length,
      planning: items.filter((item) => item.status === 'planning').length,
      watching: items.filter((item) => item.status === 'watching').length,
      completed: items.filter((item) => item.status === 'completed').length,
      paused: items.filter((item) => item.status === 'paused').length,
      dropped: items.filter((item) => item.status === 'dropped').length,
      favorites: items.filter((item) => item.favorite).length,
      episodesWatched: items.reduce((sum, item) => sum + (item.currentEpisode || 0), 0),
      timeWatchedMinutes,
      averageRating: rated.length
        ? Math.round((rated.reduce((sum, item) => sum + item.rating, 0) / rated.length) * 10) / 10
        : 0
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body;

    if (!allowedSources.includes(body.source)) {
      return res.status(400).json({ message: 'source invalide' });
    }
    if (!body.externalId || !body.title) {
      return res.status(400).json({ message: 'externalId et title sont obligatoires' });
    }

    const seasons = sanitizeSeasons(body.seasons);

    const metadata = {
      title: body.title,
      originalTitle: body.originalTitle || '',
      poster: body.poster || '',
      banner: body.banner || '',
      overview: body.overview || '',
      releaseDate: body.releaseDate ? String(body.releaseDate) : '',
      genres: Array.isArray(body.genres) ? body.genres.filter(Boolean).map(String) : [],
      voteAverage: clampNumber(body.voteAverage || 0, 0, 10),
      episodeDuration: clampNumber(body.episodeDuration || 24, 0, 1000)
    };

    const existing = await LibraryItem.findOne({
      user: req.user._id,
      source: body.source,
      externalId: String(body.externalId)
    });

    // Déjà présent : on rafraîchit les métadonnées et la structure des saisons
    // (nouveaux épisodes diffusés...) sans toucher à la progression.
    if (existing) {
      existing.set(metadata);
      if (seasons.length) {
        const watchedById = new Map(existing.seasons.map((s) => [s.anilistId, s.watched]));
        existing.seasons = seasons.map((season) => ({
          ...season,
          watched: Math.min(
            watchedById.get(season.anilistId) ?? 0,
            Math.max(season.episodes, season.aired) || 100000
          )
        }));
        applySeasonProgress(existing);
      }
      await existing.save();
      return res.json({ item: existing, alreadyInLibrary: true });
    }

    const item = new LibraryItem({
      ...metadata,
      user: req.user._id,
      source: body.source,
      externalId: String(body.externalId),
      mediaType: 'anime',
      seasons,
      totalEpisodes: clampNumber(body.totalEpisodes || 0, 0, 100000),
      currentEpisode: clampNumber(body.currentEpisode || 0, 0, 100000),
      status: allowedStatuses.includes(body.status) ? body.status : 'planning',
      rating: clampNumber(body.rating || 0, 0, 10),
      favorite: Boolean(body.favorite),
      notes: body.notes || ''
    });

    applySeasonProgress(item);
    autoStatus(item, allowedStatuses.includes(body.status));
    await item.save();

    res.status(201).json({ item, alreadyInLibrary: false });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!requireValidId(req, res)) return;

    // findOne scopé sur req.user._id : un utilisateur ne peut jamais
    // modifier le média d'un autre (renvoie 404 si ce n'est pas le sien).
    const item = await LibraryItem.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: 'Élément introuvable' });

    const body = req.body;
    const statusForced = Boolean(body.status);

    if (body.status && !allowedStatuses.includes(body.status)) {
      return res.status(400).json({ message: 'status invalide' });
    }

    if (body.status) item.status = body.status;
    if ('rating' in body) item.rating = clampNumber(body.rating, 0, 10);
    if ('favorite' in body) item.favorite = Boolean(body.favorite);
    if ('notes' in body) item.notes = String(body.notes || '').slice(0, 2000);
    if ('title' in body && body.title) item.title = String(body.title);
    if ('poster' in body) item.poster = String(body.poster || '');
    if ('overview' in body) item.overview = String(body.overview || '');
    if ('episodeDuration' in body) item.episodeDuration = clampNumber(body.episodeDuration, 0, 1000);

    if ('seasons' in body) {
      item.seasons = sanitizeSeasons(body.seasons);
      applySeasonProgress(item);
      autoStatus(item, statusForced);
    } else if ('currentEpisode' in body && item.seasons.length === 0) {
      // Compatibilité avec les anciennes entrées sans saisons.
      item.currentEpisode = clampNumber(body.currentEpisode, 0, 100000);
      autoStatus(item, statusForced);
    }

    await item.save();
    res.json(item);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!requireValidId(req, res)) return;

    // Suppression scopée sur l'utilisateur : impossible de supprimer chez autrui.
    const item = await LibraryItem.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!item) return res.status(404).json({ message: 'Élément introuvable' });
    res.json({ message: 'Supprimé', id: item._id });
  } catch (error) {
    next(error);
  }
});

export default router;
