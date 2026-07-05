import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchApi } from '../lib/api.js';
import { STATUSES, STATUS_LABELS, formatDate, formatAiring, formatRating, seasonTotal } from '../lib/helpers.js';
import SeasonList from './SeasonList.jsx';
import { CloseIcon, HeartIcon, StarIcon, TrashIcon, PlusIcon, CheckIcon, ClockIcon } from './Icons.jsx';

const RATING_CHOICES = [0, 1, 2, 3, 4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/**
 * Fiche détail d'un animé (franchise complète, toutes saisons regroupées).
 * mode "library" : suivi épisode par épisode via SeasonList + statut, note,
 *                  favori, commentaire, suppression.
 * mode "search"  : consultation + ajout à la bibliothèque.
 */
export default function MediaDetailModal({ item, mode = 'library', inLibrary = false, onClose, onUpdate, onDelete, onAdd }) {
  const [details, setDetails] = useState(null);
  const [notes, setNotes] = useState(item.notes || '');
  const [addStatus, setAddStatus] = useState('planning');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const migratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    if (item.source === 'anilist') {
      searchApi.detail(item.externalId)
        .then((data) => { if (!cancelled) setDetails(data); })
        .catch(() => { /* la fiche reste utilisable avec les données locales */ });
    }
    return () => { cancelled = true; };
  }, [item.source, item.externalId]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const isLibrary = mode === 'library';

  // Saisons affichées : structure fraîche d'AniList (nouveaux épisodes,
  // nouvelles saisons...) + progression de l'utilisateur.
  const displaySeasons = useMemo(() => {
    const fresh = details?.seasons?.length ? details.seasons : null;
    const own = item.seasons || [];

    if (fresh) {
      // Ancienne entrée sans saisons : on répartit la progression globale.
      if (own.length === 0 && (item.currentEpisode || 0) > 0) {
        let remaining = item.currentEpisode;
        return fresh.map((season) => {
          const cap = seasonTotal(season) || remaining;
          const watched = Math.min(remaining, cap);
          remaining -= watched;
          return { ...season, watched };
        });
      }
      const watchedById = new Map(own.map((season) => [season.anilistId, season.watched || 0]));
      return fresh.map((season) => ({
        ...season,
        watched: Math.min(watchedById.get(season.anilistId) ?? 0, Math.max(season.episodes, season.aired) || 100000)
      }));
    }

    if (own.length) return own;

    // Secours si AniList est injoignable : une pseudo-saison unique.
    if (item.totalEpisodes || item.currentEpisode) {
      return [{
        anilistId: item.externalId,
        number: 1,
        title: item.title,
        episodes: item.totalEpisodes || 0,
        aired: item.totalEpisodes || 0,
        watched: item.currentEpisode || 0,
        duration: item.episodeDuration || 24
      }];
    }
    return [];
  }, [details, item]);

  // Migration silencieuse des anciennes entrées vers le format à saisons.
  useEffect(() => {
    if (isLibrary && details?.seasons?.length && (item.seasons || []).length === 0 && !migratedRef.current) {
      migratedRef.current = true;
      onUpdate?.(item._id, { seasons: displaySeasons }, null);
    }
  }, [details]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = {
    ...item,
    overview: item.overview || details?.overview || '',
    poster: item.poster || details?.poster || '',
    banner: item.banner || details?.banner || '',
    genres: item.genres?.length ? item.genres : (details?.genres || []),
    voteAverage: item.voteAverage || details?.voteAverage || 0,
    airingStatus: details?.airingStatus || item.airingStatus || '',
    studio: details?.studio || '',
    episodeDuration: details?.episodeDuration || item.episodeDuration || 0,
    nextAiringAt: details?.nextAiringAt || item.nextAiringAt || null,
    nextEpisode: details?.nextEpisode ?? item.nextEpisode ?? null,
    seasons: displaySeasons
  };

  const totalEpisodes = displaySeasons.reduce((sum, season) => sum + seasonTotal(season), 0);
  const watchedEpisodes = displaySeasons.reduce((sum, season) => sum + (season.watched || 0), 0);
  const releaseDate = formatDate(info.releaseDate);
  const airing = info.nextAiringAt ? formatAiring(info.nextAiringAt) : '';

  async function run(action) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const update = (updates, message) => run(() => onUpdate(item._id, updates, message));

  // Clic sur un épisode / une coche de saison : pas de toast pour ne pas
  // spammer, la grille qui se remplit suffit comme feedback.
  function setSeasonWatched(index, watched) {
    const seasons = displaySeasons.map((season, i) => (
      i === index ? { ...season, watched: Math.max(0, watched) } : season
    ));
    update({ seasons }, null);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    run(async () => {
      const removed = await onDelete(item._id);
      if (removed) onClose();
    });
  }

  // Rendu dans un portail vers <body> : sinon la modal, en position:fixed,
  // serait calée sur un ancêtre transformé (.page garde un translateY après
  // son animation) au lieu du viewport, et se retrouverait décentrée.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={item.title}>
        <div className="modal-banner">
          {info.banner
            ? <img src={info.banner} alt="" />
            : info.poster && <img src={info.poster} alt="" className="banner-fallback" />}
          <span className="banner-shade" />
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Fermer">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-header">
            {info.poster && <img className="modal-poster" src={info.poster} alt="" />}
            <div className="modal-title-block">
              <h2>{info.title}</h2>
              {info.originalTitle && info.originalTitle !== info.title && (
                <p className="modal-original">{info.originalTitle}</p>
              )}
              <div className="modal-chips">
                {isLibrary && <span className={`badge status-${item.status}`}>{STATUS_LABELS[item.status]}</span>}
                {displaySeasons.length > 0 && (
                  <span className="badge">{displaySeasons.length} saison{displaySeasons.length > 1 ? 's' : ''}</span>
                )}
                {totalEpisodes > 0 && <span className="badge">{totalEpisodes} épisodes</span>}
                {releaseDate && <span className="badge">{releaseDate}</span>}
                {info.episodeDuration > 0 && <span className="badge">{info.episodeDuration} min/ép.</span>}
                {info.airingStatus && <span className="badge">{info.airingStatus}</span>}
                {info.voteAverage > 0 && (
                  <span className="badge badge-rating"><StarIcon size={12} filled /> {formatRating(info.voteAverage)}/10</span>
                )}
                {info.studio && <span className="badge">{info.studio}</span>}
              </div>
              {info.genres.length > 0 && (
                <div className="modal-genres">
                  {info.genres.map((genre) => <span key={genre} className="genre-tag">{genre}</span>)}
                </div>
              )}
              {airing && (
                <p className="media-card-airing"><ClockIcon size={14} /> Épisode {info.nextEpisode ?? '?'} — {airing}</p>
              )}
            </div>
          </div>

          {info.overview && <p className="modal-overview">{info.overview}</p>}

          {!isLibrary && (
            <div className="tracking-panel">
              <h3>Ajouter à ma liste</h3>
              {inLibrary ? (
                <p className="already-in"><CheckIcon size={16} /> Cet animé est déjà dans ta liste.</p>
              ) : (
                <div className="add-row">
                  <select value={addStatus} onChange={(event) => setAddStatus(event.target.value)} disabled={busy}>
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => run(async () => {
                      const saved = await onAdd({ ...info, status: addStatus });
                      if (saved) onClose();
                    })}
                  >
                    <PlusIcon size={15} /> Ajouter
                  </button>
                </div>
              )}
            </div>
          )}

          {displaySeasons.length > 0 && (
            <div className="tracking-panel">
              <div className="panel-head">
                <h3>Épisodes</h3>
                {totalEpisodes > 0 && (
                  <span className="panel-count">{watchedEpisodes}/{totalEpisodes} vus</span>
                )}
              </div>
              {!details && item.source === 'anilist' && (item.seasons || []).length === 0 && (
                <p className="season-note">Chargement des saisons...</p>
              )}
              <SeasonList
                seasons={displaySeasons}
                mainTitle={info.title}
                editable={isLibrary && !busy}
                onSetWatched={setSeasonWatched}
              />
            </div>
          )}

          {isLibrary && (
            <div className="tracking-panel">
              <h3>Mon suivi</h3>

              <div className="tracking-grid">
                <label className="field">
                  <span>Statut</span>
                  <select
                    value={item.status}
                    disabled={busy}
                    onChange={(event) => update({ status: event.target.value })}
                  >
                    {STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Ma note</span>
                  <select
                    value={String(item.rating || 0)}
                    disabled={busy}
                    onChange={(event) => update({ rating: Number(event.target.value) })}
                  >
                    {RATING_CHOICES.map((value) => (
                      <option key={value} value={String(value)}>
                        {value === 0 ? 'Non noté' : `★ ${formatRating(value)}`}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="field">
                  <span>Favori</span>
                  <button
                    className={`chip chip-fav ${item.favorite ? 'active' : ''}`}
                    disabled={busy}
                    onClick={() => update({ favorite: !item.favorite })}
                  >
                    <HeartIcon size={15} filled={item.favorite} />
                    {item.favorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}
                  </button>
                </div>
              </div>

              <label className="field">
                <span>Mon commentaire</span>
                <textarea
                  rows={3}
                  value={notes}
                  maxLength={2000}
                  placeholder="Ton avis, où tu t'es arrêté, une citation..."
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              <div className="modal-actions">
                {notes !== (item.notes || '') && (
                  <button className="btn btn-primary" disabled={busy} onClick={() => update({ notes })}>
                    <CheckIcon size={15} /> Enregistrer le commentaire
                  </button>
                )}
                <button
                  className={`btn btn-danger ${confirmDelete ? 'confirming' : ''}`}
                  disabled={busy}
                  onClick={handleDelete}
                  onBlur={() => setConfirmDelete(false)}
                >
                  <TrashIcon size={15} />
                  {confirmDelete ? 'Confirmer la suppression ?' : 'Retirer de ma liste'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
