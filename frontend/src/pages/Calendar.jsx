import { useEffect, useMemo, useState } from 'react';
import { libraryApi, searchApi } from '../lib/api.js';
import { formatAiring, diffInDays, daySectionLabel, dayCountdown } from '../lib/helpers.js';
import { useToast } from '../context/ToastContext.jsx';
import useLibraryActions from '../hooks/useLibraryActions.js';
import EmptyState from '../components/EmptyState.jsx';
import MediaDetailModal from '../components/MediaDetailModal.jsx';
import { SkeletonGrid } from '../components/LoadingSkeleton.jsx';
import { CalendarIcon, ClockIcon } from '../components/Icons.jsx';

export default function Calendar({ onNavigate }) {
  const toast = useToast();
  const [schedule, setSchedule] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { item, mode: 'library' }

  const { updateItem, deleteItem } = useLibraryActions({ setItems, setSelected });

  useEffect(() => {
    let cancelled = false;
    // Le planning AniList + la bibliothèque complète (pour ouvrir la fiche).
    Promise.allSettled([searchApi.upcoming(90), libraryApi.list()]).then(([sch, lib]) => {
      if (cancelled) return;
      if (sch.status === 'fulfilled') setSchedule(sch.value);
      else toast.error(sch.reason.message);
      if (lib.status === 'fulfilled') setItems(lib.value);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const itemById = useMemo(
    () => new Map(items.map((item) => [String(item._id), item])),
    [items]
  );

  // Regroupe le planning : jours proches (Hier → +6 j) séparés, le reste
  // dans "Plus tard".
  const { days, later } = useMemo(() => {
    const near = new Map();
    const later = [];
    for (const entry of schedule) {
      const diff = diffInDays(entry.airingAt);
      if (diff < -1) continue;
      if (diff <= 6) {
        if (!near.has(diff)) near.set(diff, []);
        near.get(diff).push(entry);
      } else {
        later.push(entry);
      }
    }
    const sortByTime = (a, b) => a.airingAt - b.airingAt;
    for (const list of near.values()) list.sort(sortByTime);
    later.sort(sortByTime);
    const days = [...near.keys()].sort((a, b) => a - b).map((diff) => ({ diff, entries: near.get(diff) }));
    return { days, later };
  }, [schedule]);

  const isEmpty = days.length === 0 && later.length === 0;

  function openEntry(entry) {
    const item = itemById.get(entry.libraryItemId);
    if (item) setSelected({ item, mode: 'library' });
    else toast.info('Cet animé n\'est plus dans ta liste.');
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Planning</p>
          <h1>Calendrier des sorties</h1>
          <p className="page-sub">Les prochains épisodes des animés de ta liste, jour par jour.</p>
        </div>
      </header>

      {loading ? (
        <SkeletonGrid count={8} />
      ) : isEmpty ? (
        <EmptyState
          icon={<CalendarIcon size={28} />}
          title="Aucune sortie à venir"
          message="Aucun animé de ta liste n'a d'épisode programmé pour le moment. Ajoute des animés en cours de diffusion pour les voir apparaître ici."
          actionLabel="Explorer le catalogue"
          onAction={() => onNavigate('search')}
        />
      ) : (
        <div className="calendar">
          {days.map(({ diff, entries }) => (
            <section key={diff} className="calendar-section">
              <span className="calendar-label">{daySectionLabel(diff)}</span>
              <div className="airing-grid">
                {entries.map((entry) => (
                  <AiringCard key={`${entry.externalId}-${entry.episode}`} entry={entry} onOpen={openEntry} />
                ))}
              </div>
            </section>
          ))}

          {later.length > 0 && (
            <section className="calendar-section">
              <span className="calendar-label">Plus tard</span>
              <div className="airing-grid">
                {later.map((entry) => (
                  <AiringCard key={`${entry.externalId}-${entry.episode}`} entry={entry} onOpen={openEntry} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {selected && (
        <MediaDetailModal
          item={selected.item}
          mode="library"
          onClose={() => setSelected(null)}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />
      )}
    </section>
  );
}

function AiringCard({ entry, onOpen }) {
  const diff = diffInDays(entry.airingAt);
  const countdown = dayCountdown(diff);

  return (
    <button className="airing-card" onClick={() => onOpen(entry)}>
      <div className="airing-poster">
        {entry.poster
          ? <img src={entry.poster} alt="" loading="lazy" />
          : <span className="poster-placeholder">Animé</span>}
        <span className="poster-shade" />
        <span className={`airing-countdown ${diff <= 0 ? 'soon' : ''}`}>
          <strong>{countdown.value}</strong>
          {countdown.unit && <span>{countdown.unit}</span>}
        </span>
      </div>
      <div className="airing-info">
        <h3 title={entry.title}>{entry.title}</h3>
        <p><ClockIcon size={12} /> Ép. {entry.episode} · {formatAiring(entry.airingAt)}</p>
      </div>
    </button>
  );
}
