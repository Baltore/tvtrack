import { useState } from 'react';
import { seasonTotal } from '../lib/helpers.js';
import { CheckIcon, ChevronDownIcon } from './Icons.jsx';

/**
 * Liste des saisons façon TV Time : une ligne par saison avec progression,
 * bouton pour tout cocher, et grille d'épisodes dépliable.
 * Cliquer sur l'épisode N indique "je suis à l'épisode N" (tout ce qui précède
 * est vu) ; re-cliquer sur le dernier épisode vu le décoche.
 */
export default function SeasonList({ seasons, mainTitle, editable = true, onSetWatched }) {
  const [openIndex, setOpenIndex] = useState(null);

  if (!seasons || seasons.length === 0) return null;

  return (
    <div className="season-list">
      {seasons.map((season, index) => (
        <SeasonRow
          key={season.anilistId || index}
          season={season}
          mainTitle={mainTitle}
          editable={editable}
          open={openIndex === index}
          onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          onSetWatched={(watched) => onSetWatched?.(index, watched)}
        />
      ))}
    </div>
  );
}

function SeasonRow({ season, mainTitle, editable, open, onToggle, onSetWatched }) {
  const total = seasonTotal(season);
  const watchable = season.aired || season.episodes || 0;
  const watched = season.watched || 0;
  const done = total > 0 && watched >= total;
  const percent = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  const upcoming = season.episodes > 0 ? season.episodes - watchable : 0;
  const subtitle = season.title && season.title !== mainTitle ? season.title : '';

  // Le nombre de cases à afficher : les épisodes diffusés (on ne peut pas
  // avoir vu un épisode pas encore sorti).
  const gridCount = Math.max(watchable, watched);

  return (
    <div className={`season ${done ? 'done' : ''}`}>
      <div className="season-row">
        <button className="season-toggle" onClick={onToggle} aria-expanded={open}>
          <ChevronDownIcon size={16} className={`season-chevron ${open ? 'open' : ''}`} />
          <span className="season-name">
            <strong>Saison {season.number}</strong>
            {subtitle && <span className="season-subtitle">{subtitle}</span>}
          </span>
        </button>

        <span className="season-count">{watched}/{total || '?'}</span>

        {editable && (
          <button
            className={`season-check ${done ? 'checked' : ''}`}
            onClick={() => onSetWatched(done ? 0 : (total || watchable))}
            aria-label={done ? 'Marquer la saison comme non vue' : 'Marquer toute la saison comme vue'}
          >
            <CheckIcon size={16} />
          </button>
        )}
      </div>

      <div className="season-bar"><span style={{ width: `${percent}%` }} /></div>

      {open && (
        <div className="season-episodes">
          {gridCount === 0 ? (
            <p className="season-note">Aucun épisode diffusé pour le moment.</p>
          ) : (
            <div className="episode-grid">
              {Array.from({ length: gridCount }, (_, i) => i + 1).map((episode) => (
                <button
                  key={episode}
                  className={`ep ${episode <= watched ? 'seen' : ''}`}
                  disabled={!editable}
                  title={`Épisode ${episode}`}
                  onClick={() => onSetWatched(episode === watched ? episode - 1 : episode)}
                >
                  {episode}
                </button>
              ))}
            </div>
          )}
          {upcoming > 0 && (
            <p className="season-note">{upcoming} épisode{upcoming > 1 ? 's' : ''} à venir</p>
          )}
        </div>
      )}
    </div>
  );
}
