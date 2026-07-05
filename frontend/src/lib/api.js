// URL du backend : vient toujours de l'environnement (jamais codée en dur en prod).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/*
 * Stockage de session : le token JWT est gardé dans localStorage.
 * Choix assumé pour ce projet car le frontend (Vercel) et le backend (Render)
 * sont sur des domaines différents : un cookie httpOnly nécessiterait
 * SameSite=None (cookie tiers), de plus en plus bloqué par les navigateurs.
 * Limite connue : en cas de faille XSS, le token pourrait être lu. Mitigations
 * en place : aucune dépendance tierce non maîtrisée, en-têtes Helmet côté API,
 * expiration du token (JWT_EXPIRES_IN), et le backend ne reçoit que du JSON.
 */
export function getToken() {
  return localStorage.getItem('tvtrack_token');
}

export function setSession({ token, user }) {
  localStorage.setItem('tvtrack_token', token);
  localStorage.setItem('tvtrack_user', JSON.stringify(user));
}

export function getStoredUser() {
  const raw = localStorage.getItem('tvtrack_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem('tvtrack_token');
  localStorage.removeItem('tvtrack_user');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (_error) {
    throw new Error('Impossible de joindre le serveur. Vérifie que le backend tourne.');
  }

  // Token expiré ou invalide : on nettoie la session et on revient au login.
  if (response.status === 401 && token && !path.startsWith('/auth/')) {
    clearSession();
    window.location.reload();
    return null;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(body?.message || 'Erreur API');
  }

  return body;
}

export const authApi = {
  login: (credentials) => api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) => api('/auth/register', { method: 'POST', body: JSON.stringify(data) })
};

export const libraryApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== '' && value !== null && value !== undefined && value !== false) {
        query.set(key, String(value));
      }
    }
    const qs = query.toString();
    return api(`/library${qs ? `?${qs}` : ''}`);
  },
  stats: () => api('/library/stats'),
  add: (item) => api('/library', { method: 'POST', body: JSON.stringify(item) }),
  update: (id, updates) => api(`/library/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  remove: (id) => api(`/library/${id}`, { method: 'DELETE' })
};

export const searchApi = {
  anime: (q) => api(`/search/anime?q=${encodeURIComponent(q)}`),
  airing: (days = 7) => api(`/search/anime/airing?days=${days}`),
  upcoming: (days = 90) => api(`/search/upcoming?days=${days}`),
  browse: () => api('/search/browse'),
  // Fiche franchise complète (toutes les saisons regroupées).
  detail: (itemOrId) => {
    const id = typeof itemOrId === 'object' ? itemOrId.externalId : itemOrId;
    return api(`/search/detail/anime/${id}`);
  }
};
