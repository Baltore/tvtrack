import express from 'express';
import axios from 'axios';
import auth from '../middleware/auth.js';
import LibraryItem from '../models/LibraryItem.js';

const router = express.Router();
router.use(auth);

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

const ANILIST_STATUS_FR = {
  RELEASING: 'En diffusion',
  FINISHED: 'Terminé',
  NOT_YET_RELEASED: 'À venir',
  CANCELLED: 'Annulé',
  HIATUS: 'En pause'
};

// Formats considérés comme des "saisons" d'une même franchise.
const SEASON_FORMATS = ['TV', 'TV_SHORT', 'ONA'];

const BASE_FIELDS = `
  id
  isAdult
  title { romaji english native }
  description(asHtml: false)
  episodes
  duration
  format
  status
  genres
  averageScore
  startDate { year month day }
  coverImage { large extraLarge }
  bannerImage
  nextAiringEpisode { airingAt episode }
`;

const RELATIONS_FIELD = `
  relations { edges { relationType node { id type format title { romaji english } } } }
`;

function stripHtml(html = '') {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function anilistDate(startDate) {
  if (!startDate?.year) return '';
  const month = String(startDate.month || 1).padStart(2, '0');
  const day = String(startDate.day || 1).padStart(2, '0');
  return `${startDate.year}-${month}-${day}`;
}

function bestTitle(media) {
  return media.title?.english || media.title?.romaji || media.title?.native || 'Sans titre';
}

// Nombre d'épisodes déjà diffusés (utile pour les animés en cours).
function airedCount(media) {
  if (media.nextAiringEpisode?.episode) return Math.max(0, media.nextAiringEpisode.episode - 1);
  if (media.status === 'NOT_YET_RELEASED') return 0;
  return media.episodes || 0;
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

function titleSimilarity(a, b) {
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

// Les relations AniList sont parfois surprenantes (ex : "MONSTERS" marqué
// prequel de One Piece). On n'accepte un lien saison que si les titres
// se ressemblent suffisamment.
function sameFranchise(mediaTitle, nodeTitle) {
  const leftTitles = [mediaTitle?.romaji, mediaTitle?.english].filter(Boolean);
  const rightTitles = [nodeTitle?.romaji, nodeTitle?.english].filter(Boolean);
  let best = 0;
  for (const left of leftTitles) {
    for (const right of rightTitles) {
      best = Math.max(best, titleSimilarity(left, right));
    }
  }
  return best >= 0.5;
}

function isSeasonEdge(media, edge, relationType) {
  return edge.relationType === relationType
    && edge.node?.type === 'ANIME'
    && SEASON_FORMATS.includes(edge.node.format)
    && sameFranchise(media.title, edge.node.title);
}

// Une entrée est une "suite" si elle a un prequel de la même franchise :
// on la masque des listes pour ne montrer que la première saison.
function isSequel(media) {
  return (media.relations?.edges || []).some((edge) => isSeasonEdge(media, edge, 'PREQUEL'));
}

function mapAnime(media) {
  if (!media) return null;
  return {
    source: 'anilist',
    externalId: String(media.id),
    mediaType: 'anime',
    title: bestTitle(media),
    originalTitle: media.title?.romaji || media.title?.native || '',
    poster: media.coverImage?.extraLarge || media.coverImage?.large || '',
    banner: media.bannerImage || '',
    overview: stripHtml(media.description || ''),
    releaseDate: anilistDate(media.startDate),
    genres: Array.isArray(media.genres) ? media.genres : [],
    voteAverage: media.averageScore ? Math.round(media.averageScore) / 10 : 0,
    episodeDuration: media.duration || 24,
    totalEpisodes: media.episodes || 0,
    airedEpisodes: airedCount(media),
    airingStatus: ANILIST_STATUS_FR[media.status] || '',
    nextAiringAt: media.nextAiringEpisode?.airingAt || null,
    nextEpisode: media.nextAiringEpisode?.episode || null
  };
}

async function queryAnilist(query, variables = {}) {
  const response = await axios.post(ANILIST_ENDPOINT, { query, variables }, { timeout: 12000 });
  return response.data.data;
}

function groupedList(mediaList) {
  return (mediaList || [])
    .filter((media) => media && !media.isAdult && !isSequel(media))
    .map(mapAnime);
}

router.get('/anime', async (req, res, next) => {
  try {
    const search = String(req.query.q || '').trim();
    if (!search) return res.status(400).json({ message: 'Paramètre q obligatoire' });

    const data = await queryAnilist(
      `query ($search: String) {
        Page(page: 1, perPage: 24) {
          media(search: $search, type: ANIME, sort: POPULARITY_DESC) { ${BASE_FIELDS} ${RELATIONS_FIELD} }
        }
      }`,
      { search }
    );

    res.json(groupedList(data?.Page?.media));
  } catch (error) {
    next(error);
  }
});

router.get('/anime/airing', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days || 7), 30);
    const now = Math.floor(Date.now() / 1000);
    const to = now + days * 24 * 60 * 60;

    const data = await queryAnilist(
      `query ($from: Int, $to: Int) {
        Page(page: 1, perPage: 40) {
          airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
            episode
            airingAt
            media { ${BASE_FIELDS} }
          }
        }
      }`,
      { from: now, to }
    );

    // Un même animé peut diffuser plusieurs épisodes sur la période :
    // on ne garde que sa prochaine diffusion.
    const seen = new Set();
    const results = [];
    for (const airing of data?.Page?.airingSchedules || []) {
      if (!airing?.media || airing.media.isAdult || seen.has(airing.media.id)) continue;
      seen.add(airing.media.id);
      results.push({
        ...mapAnime(airing.media),
        nextAiringAt: airing.airingAt,
        nextEpisode: airing.episode
      });
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Calendrier des sorties, limité aux animés présents dans MA bibliothèque.
router.get('/upcoming', async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days || 90), 120);
    const items = await LibraryItem.find({ user: req.user._id, mediaType: 'anime' });

    // Chaque saison est un média AniList distinct : on relie tous les ids
    // (franchise + saisons) à leur entrée de bibliothèque pour l'affichage.
    const idToItem = new Map();
    for (const item of items) {
      const rootId = Number(item.externalId);
      if (rootId) idToItem.set(rootId, item);
      for (const season of item.seasons || []) {
        const id = Number(season.anilistId);
        if (id) idToItem.set(id, item);
      }
    }

    const ids = [...idToItem.keys()].filter((id) => Number.isInteger(id) && id > 0).slice(0, 400);
    if (ids.length === 0) return res.json([]);

    const now = Math.floor(Date.now() / 1000);
    const from = now - 36 * 60 * 60;           // inclut la journée d'hier
    const to = now + days * 24 * 60 * 60;

    // Plusieurs pages possibles si beaucoup d'épisodes sont programmés.
    const schedules = [];
    for (let page = 1; page <= 4; page += 1) {
      const data = await queryAnilist(
        `query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              episode
              airingAt
              mediaId
            }
          }
        }`,
        { ids, from, to, page }
      );
      const pageData = data?.Page;
      if (!pageData) break;
      schedules.push(...(pageData.airingSchedules || []));
      if (!pageData.pageInfo?.hasNextPage) break;
    }

    const results = schedules
      .map((schedule) => {
        const item = idToItem.get(schedule.mediaId);
        if (!item) return null;
        return {
          libraryItemId: String(item._id),
          externalId: String(item.externalId),
          title: item.title,
          poster: item.poster,
          status: item.status,
          episode: schedule.episode,
          airingAt: schedule.airingAt
        };
      })
      .filter(Boolean);

    // Filet de sécurité : garantit qu'un animé de la liste avec une prochaine
    // diffusion connue apparaisse, même si AniList ne renvoie pas son planning
    // détaillé (données éparses, saison pas reliée à la franchise...).
    const covered = new Set(results.map((entry) => `${entry.externalId}:${entry.airingAt}`));
    for (const item of items) {
      if (!item.nextAiringAt || item.nextAiringAt <= from || item.nextAiringAt > to) continue;
      const key = `${item.externalId}:${item.nextAiringAt}`;
      if (covered.has(key)) continue;
      covered.add(key);
      results.push({
        libraryItemId: String(item._id),
        externalId: String(item.externalId),
        title: item.title,
        poster: item.poster,
        status: item.status,
        episode: item.nextEpisode,
        airingAt: item.nextAiringAt
      });
    }

    results.sort((a, b) => a.airingAt - b.airingAt);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Catalogue sans recherche : plusieurs sections en une seule requête AniList.
router.get('/browse', async (req, res, next) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const season = month <= 3 ? 'WINTER' : month <= 6 ? 'SPRING' : month <= 9 ? 'SUMMER' : 'FALL';

    const pageBlock = (args) => `Page(page: 1, perPage: 20) {
      media(type: ANIME, isAdult: false, ${args}) { ${BASE_FIELDS} ${RELATIONS_FIELD} }
    }`;

    const data = await queryAnilist(
      `query ($season: MediaSeason, $seasonYear: Int) {
        trending: ${pageBlock('sort: TRENDING_DESC')}
        currentSeason: ${pageBlock('season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC')}
        popular: ${pageBlock('sort: POPULARITY_DESC')}
        topRated: ${pageBlock('sort: SCORE_DESC')}
      }`,
      { season, seasonYear: now.getFullYear() }
    );

    res.json({
      trending: groupedList(data?.trending?.media),
      currentSeason: groupedList(data?.currentSeason?.media),
      popular: groupedList(data?.popular?.media),
      topRated: groupedList(data?.topRated?.media)
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------
   Fiche franchise : regroupe toutes les saisons (chaîne prequel/sequel
   AniList) d'un animé en une seule fiche, avec cache en mémoire.
   ------------------------------------------------------------------ */

const franchiseCache = new Map(); // anilistId -> { at, data }
const FRANCHISE_TTL = 1000 * 60 * 60 * 6;

async function fetchMedia(id) {
  const data = await queryAnilist(
    `query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${BASE_FIELDS}
        ${RELATIONS_FIELD}
        studios(isMain: true) { nodes { name } }
      }
    }`,
    { id }
  );
  return data?.Media || null;
}

function relatedSeasonId(media, relationType) {
  const edge = (media.relations?.edges || []).find((e) => isSeasonEdge(media, e, relationType));
  return edge?.node?.id || null;
}

async function buildFranchise(startId) {
  const cached = franchiseCache.get(startId);
  if (cached && Date.now() - cached.at < FRANCHISE_TTL) return cached.data;

  const fetched = new Map(); // id -> media, évite de re-télécharger
  async function getMedia(id) {
    if (!fetched.has(id)) fetched.set(id, await fetchMedia(id));
    return fetched.get(id);
  }

  let current = await getMedia(startId);
  if (!current) return null;

  // 1. Remonter jusqu'à la première saison.
  const visited = new Set([current.id]);
  for (let i = 0; i < 20; i += 1) {
    const prequelId = relatedSeasonId(current, 'PREQUEL');
    if (!prequelId || visited.has(prequelId)) break;
    const prequel = await getMedia(prequelId);
    if (!prequel) break;
    visited.add(prequel.id);
    current = prequel;
  }

  // 2. Descendre la chaîne des suites depuis la racine.
  const root = current;
  const chain = [root];
  const chainIds = new Set([root.id]);
  let cursor = root;
  for (let i = 0; i < 20; i += 1) {
    const sequelId = relatedSeasonId(cursor, 'SEQUEL');
    if (!sequelId || chainIds.has(sequelId)) break;
    const sequel = await getMedia(sequelId);
    if (!sequel) break;
    chainIds.add(sequel.id);
    chain.push(sequel);
    cursor = sequel;
  }

  const seasons = chain.map((media, index) => ({
    anilistId: String(media.id),
    number: index + 1,
    title: bestTitle(media),
    episodes: media.episodes || 0,
    aired: airedCount(media),
    duration: media.duration || root.duration || 24,
    airingStatus: ANILIST_STATUS_FR[media.status] || '',
    releaseDate: anilistDate(media.startDate),
    nextAiringAt: media.nextAiringEpisode?.airingAt || null,
    nextEpisode: media.nextAiringEpisode?.episode || null
  }));

  const nextAiring = seasons
    .filter((season) => season.nextAiringAt)
    .sort((a, b) => a.nextAiringAt - b.nextAiringAt)[0];

  const franchise = {
    ...mapAnime(root),
    airingStatus: chain.some((media) => media.status === 'RELEASING')
      ? 'En diffusion'
      : chain.some((media) => media.status === 'NOT_YET_RELEASED')
        ? 'Suite à venir'
        : (ANILIST_STATUS_FR[chain[chain.length - 1].status] || ''),
    studio: root.studios?.nodes?.[0]?.name || '',
    totalEpisodes: seasons.reduce((sum, season) => sum + (season.episodes || season.aired || 0), 0),
    seasons,
    nextAiringAt: nextAiring?.nextAiringAt || null,
    nextEpisode: nextAiring?.nextEpisode || null
  };

  // Toutes les saisons de la chaîne pointent vers la même franchise.
  for (const id of chainIds) {
    franchiseCache.set(id, { at: Date.now(), data: franchise });
  }

  return franchise;
}

router.get('/detail/anime/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'id invalide' });
    }

    const franchise = await buildFranchise(id);
    if (!franchise) return res.status(404).json({ message: 'Animé introuvable' });

    res.json(franchise);
  } catch (error) {
    next(error);
  }
});

export default router;
