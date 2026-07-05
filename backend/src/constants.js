// Constantes partagées par les routes et les modèles (source unique de vérité).

export const MEDIA_STATUSES = ['planning', 'watching', 'completed', 'paused', 'dropped'];
export const MEDIA_SOURCES = ['anilist', 'manual'];
export const MEDIA_TYPES = ['anime'];

export const LIMITS = {
  RATING_MIN: 0,
  RATING_MAX: 10,
  EPISODES_MAX: 100000,
  NOTES_MAX: 2000,
  SEASONS_MAX: 40,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  PASSWORD_MIN: 6
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
