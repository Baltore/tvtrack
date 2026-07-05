// Helpers de formatage partagés par toute l'application.

export const STATUSES = [
  { value: 'planning', label: 'À voir' },
  { value: 'watching', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'paused', label: 'En pause' },
  { value: 'dropped', label: 'Abandonné' }
];

export const STATUS_LABELS = Object.fromEntries(
  STATUSES.map((status) => [status.value, status.label])
);

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Ajouté récemment' },
  { value: 'updated', label: 'Activité récente' },
  { value: 'rating', label: 'Meilleure note' },
  { value: 'title', label: 'Titre A → Z' },
  { value: 'progress', label: 'Progression' }
];

function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  // Timestamp : AniList renvoie des secondes, JS attend des millisecondes.
  if (typeof value === 'number') {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const text = String(value ?? '').trim();
  // Une année seule ("2023") se suffit à elle-même.
  if (/^\d{4}$/.test(text)) return text;
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getYear(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}$/.test(text)) return text;
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return String(date.getFullYear());
}

// "Aujourd'hui à 18:30", "Demain à 09:00" ou "ven. 10 juil. à 18:30".
export function formatAiring(unixSeconds) {
  const date = toDate(unixSeconds);
  if (!date) return '';

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0) return `Aujourd'hui à ${time}`;
  if (diffDays === 1) return `Demain à ${time}`;
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} à ${time}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function startOfDay(ms) {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Nombre de jours calendaires entre aujourd'hui et une date de diffusion.
// -1 = hier, 0 = aujourd'hui, 1 = demain, etc.
export function diffInDays(airingAt) {
  const ms = airingAt > 1e12 ? airingAt : airingAt * 1000;
  return Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86400000);
}

// Titre de section pour le calendrier : Hier / Aujourd'hui / nom du jour.
export function daySectionLabel(diff) {
  if (diff === -1) return 'Hier';
  if (diff === 0) return "Aujourd'hui";
  const day = WEEKDAYS[new Date(startOfDay(Date.now()) + diff * 86400000).getDay()];
  return day.charAt(0).toUpperCase() + day.slice(1);
}

// Décompte affiché sur la carte : { value, unit }.
export function dayCountdown(diff) {
  if (diff <= -1) return { value: 'Hier', unit: '' };
  if (diff === 0) return { value: "Auj.", unit: '' };
  return { value: String(diff), unit: diff > 1 ? 'jours' : 'jour' };
}

export function progressPercent(item) {
  if (!item || !item.totalEpisodes || item.totalEpisodes <= 0) return 0;
  return Math.min(100, Math.round(((item.currentEpisode || 0) / item.totalEpisodes) * 100));
}

export function formatRating(rating) {
  const value = Number(rating);
  if (!value || Number.isNaN(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Total d'épisodes regardables d'une saison (annoncés ou déjà diffusés).
export function seasonTotal(season) {
  return season?.episodes || season?.aired || 0;
}

// Minutes → { months, days, hours } pour la carte "Temps passé".
export function formatWatchTime(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  return {
    months: Math.floor(total / 43200),
    days: Math.floor((total % 43200) / 1440),
    hours: Math.floor((total % 1440) / 60)
  };
}

// Toutes les clés AniList couvertes par la bibliothèque (franchise + saisons),
// pour marquer "Dans ma liste" sur n'importe quelle saison trouvée en recherche.
export function libraryKeySet(items) {
  const keys = new Set();
  for (const item of items || []) {
    if (item.externalId) keys.add(String(item.externalId));
    for (const season of item.seasons || []) {
      if (season.anilistId) keys.add(String(season.anilistId));
    }
  }
  return keys;
}

/**
 * Construit le corps du POST /library à partir d'une fiche franchise.
 * watchedTotal (optionnel) : nombre d'épisodes vus à répartir sur les
 * saisons dans l'ordre (utilisé par l'import TV Time).
 */
export function buildLibraryPayload(franchise, status = 'planning', watchedTotal = 0) {
  let remaining = Math.max(0, Number(watchedTotal) || 0);

  const seasons = (franchise.seasons || []).map((season) => {
    const cap = seasonTotal(season);
    const watched = cap > 0 ? Math.min(remaining, cap) : remaining;
    remaining -= watched;
    return { ...season, watched };
  });

  const total = seasons.reduce((sum, season) => sum + seasonTotal(season), 0);
  const watched = seasons.reduce((sum, season) => sum + season.watched, 0);

  let finalStatus = status;
  if (watchedTotal > 0) {
    finalStatus = total > 0 && watched >= total ? 'completed' : 'watching';
  }

  return {
    source: 'anilist',
    externalId: franchise.externalId,
    mediaType: 'anime',
    title: franchise.title,
    originalTitle: franchise.originalTitle || '',
    poster: franchise.poster || '',
    banner: franchise.banner || '',
    overview: franchise.overview || '',
    releaseDate: franchise.releaseDate || '',
    genres: franchise.genres || [],
    voteAverage: franchise.voteAverage || 0,
    episodeDuration: franchise.episodeDuration || 24,
    seasons,
    status: finalStatus
  };
}
