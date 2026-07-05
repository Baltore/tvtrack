import { STATUS_LABELS, getYear, formatAiring, formatRating, progressPercent } from '../lib/helpers.js';
import { HeartIcon, PlusIcon, CheckIcon, StarIcon, ClockIcon } from './Icons.jsx';

/**
 * Carte animé au format affiche.
 * mode "library" : badge de statut, favori, note perso, progression globale.
 * mode "search"  : score externe et bouton d'ajout.
 * Le clic sur l'affiche ouvre la fiche détail (saisons, épisodes...).
 */
export default function MediaCard({ item, mode = 'library', inLibrary = false, onOpen, onAdd }) {
  const percent = progressPercent(item);
  const year = getYear(item.releaseDate);
  const airing = item.nextAiringAt ? formatAiring(item.nextAiringAt) : '';
  const isLibrary = mode === 'library';
  const seasonCount = item.seasons?.length || 0;

  const metaParts = [];
  if (year) metaParts.push(year);
  if (seasonCount > 1) metaParts.push(`${seasonCount} saisons`);
  if (isLibrary && item.totalEpisodes > 0) {
    metaParts.push(`${item.currentEpisode || 0}/${item.totalEpisodes} ép.`);
  } else if (!isLibrary && item.totalEpisodes > 0) {
    metaParts.push(`${item.totalEpisodes} ép.`);
  }

  return (
    <article className="media-card">
      <button className="media-poster" onClick={() => onOpen?.(item)} aria-label={`Détails de ${item.title}`}>
        {item.poster
          ? <img src={item.poster} alt="" loading="lazy" />
          : <span className="poster-placeholder">Animé</span>}

        <span className="poster-shade" />

        <span className="poster-badges">
          {isLibrary && (
            <span className={`badge status-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</span>
          )}
          {isLibrary && item.favorite && (
            <span className="badge badge-fav"><HeartIcon size={11} filled /></span>
          )}
        </span>

        <span className="poster-badges bottom">
          {isLibrary && item.rating > 0 && (
            <span className="badge badge-rating"><StarIcon size={11} filled /> {formatRating(item.rating)}</span>
          )}
          {!isLibrary && item.voteAverage > 0 && (
            <span className="badge badge-rating"><StarIcon size={11} filled /> {formatRating(item.voteAverage)}</span>
          )}
        </span>

        {isLibrary && item.totalEpisodes > 0 && (
          <span className="poster-progress"><span style={{ width: `${percent}%` }} /></span>
        )}
      </button>

      <div className="media-card-body">
        <h3 title={item.title}>{item.title}</h3>
        {metaParts.length > 0 && <p className="media-card-meta">{metaParts.join(' · ')}</p>}
        {airing && (
          <p className="media-card-airing">
            <ClockIcon size={13} /> Ép. {item.nextEpisode ?? '?'} — {airing}
          </p>
        )}
      </div>

      {mode === 'search' && onAdd && (
        <button
          className={`btn btn-small ${inLibrary ? 'btn-added' : 'btn-primary'}`}
          disabled={inLibrary}
          onClick={() => onAdd(item)}
        >
          {inLibrary ? <><CheckIcon size={15} /> Dans ma liste</> : <><PlusIcon size={15} /> Ajouter</>}
        </button>
      )}
    </article>
  );
}
