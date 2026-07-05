// Lecture d'un export TV Time (JSON) et aide au rapprochement AniList.

/* ------------------------------------------------------------------
   Format officiel de l'export TV Time :
   [
     {
       "title": "One Piece",
       "is_favorite": true,
       "status": "continuing",
       "seasons": [
         { "number": 1, "is_specials": false, "episodes": [
             { "number": 1, "is_watched": true, "special": false }, ...
         ] }, ...
       ]
     }, ...
   ]
   ------------------------------------------------------------------ */
function parseOfficialFormat(shows) {
  const result = [];
  for (const show of shows) {
    const title = typeof show?.title === 'string' ? show.title.trim() : '';
    if (!title) continue;

    let watched = 0;
    for (const season of show.seasons || []) {
      // On ignore les saisons de spéciaux : elles ne correspondent pas aux
      // numéros d'épisodes réguliers d'AniList.
      if (season?.is_specials) continue;
      for (const episode of season?.episodes || []) {
        if (episode?.is_watched && !episode?.special) watched += 1;
      }
    }

    if (watched > 0) {
      result.push({ title, watched, favorite: Boolean(show.is_favorite) });
    }
  }
  return result;
}

// Format simplifié : [{ "title": "One Piece", "watched": 1100 }]
function parseSimpleFormat(rows) {
  const result = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const title = String(row.title || row.name || row.tv_show_name || '').trim();
    const watched = Number(row.watched ?? row.watched_episodes ?? row.episodes_watched ?? row.progress);
    if (title && Number.isFinite(watched) && watched > 0) {
      result.push({ title, watched, favorite: Boolean(row.is_favorite || row.favorite) });
    }
  }
  return result;
}

/**
 * Parse un export TV Time et regroupe les épisodes vus par série.
 * Retourne [{ title, watched, favorite }] trié par nombre d'épisodes vus.
 */
export function parseTvTimeExport(text) {
  const data = JSON.parse(text);
  const rows = Array.isArray(data) ? data : (data.shows || data.series || data.data || []);

  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Format officiel si au moins une entrée a un tableau `seasons`.
  const isOfficial = rows.some((show) => show && Array.isArray(show.seasons));
  const parsed = isOfficial ? parseOfficialFormat(rows) : parseSimpleFormat(rows);

  return parsed.sort((a, b) => b.watched - a.watched);
}

function normalizeTitle(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score de similarité 0..1 entre deux titres (exact > inclusion > mots communs).
export function titleSimilarity(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.85;

  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  let common = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) common += 1;
  }
  return (2 * common) / (leftWords.size + rightWords.size);
}

// Meilleur candidat AniList pour un titre TV Time donné.
export function bestMatch(title, results) {
  let best = null;
  let bestScore = 0;
  for (const result of results || []) {
    const score = Math.max(
      titleSimilarity(title, result.title),
      titleSimilarity(title, result.originalTitle)
    );
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  }
  return bestScore >= 0.55 ? { match: best, score: bestScore } : null;
}
