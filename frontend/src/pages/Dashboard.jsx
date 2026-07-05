import { useCallback, useEffect, useState } from 'react';
import { libraryApi, searchApi } from '../lib/api.js';
import { libraryKeySet, buildLibraryPayload, formatWatchTime } from '../lib/helpers.js';
import { useToast } from '../context/ToastContext.jsx';
import useLibraryActions from '../hooks/useLibraryActions.js';
import MediaCard from '../components/MediaCard.jsx';
import MediaGrid from '../components/MediaGrid.jsx';
import StatCard from '../components/StatCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MediaDetailModal from '../components/MediaDetailModal.jsx';
import { SkeletonStats, SkeletonRow } from '../components/LoadingSkeleton.jsx';
import {
  LibraryIcon, PlayIcon, CheckIcon, EyeIcon, StarIcon,
  CalendarIcon, SearchIcon, HeartIcon, TvIcon, ClockIcon
} from '../components/Icons.jsx';

export default function Dashboard({ user, onNavigate }) {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [library, setLibrary] = useState([]);
  const [airing, setAiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { item, mode }

  const refreshStats = useCallback(() => {
    libraryApi.stats().then(setStats).catch(() => {});
  }, []);

  const { updateItem, deleteItem } = useLibraryActions({
    setItems: setLibrary,
    setSelected,
    onChanged: refreshStats
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [statsResult, libraryResult, airingResult] = await Promise.allSettled([
        libraryApi.stats(),
        libraryApi.list({ sort: 'updated' }),
        searchApi.airing(7)
      ]);
      if (cancelled) return;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (libraryResult.status === 'fulfilled') setLibrary(libraryResult.value);
      if (airingResult.status === 'fulfilled') setAiring(airingResult.value);
      if (statsResult.status === 'rejected') toast.error(statsResult.reason.message);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addItem(item) {
    try {
      // La carte de recherche ne connaît qu'une saison : on récupère
      // la franchise complète avant l'ajout.
      const franchise = item.seasons?.length ? item : await searchApi.detail(item.externalId);
      const { item: saved, alreadyInLibrary } = await libraryApi.add(
        buildLibraryPayload(franchise, item.status || 'planning')
      );
      setLibrary((current) => (
        alreadyInLibrary
          ? current.map((entry) => (entry._id === saved._id ? saved : entry))
          : [saved, ...current]
      ));
      refreshStats();
      if (alreadyInLibrary) toast.info('Déjà dans ta liste — infos rafraîchies');
      else toast.success(`${saved.title} ajouté à ta liste`);
      return saved;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }

  const libraryKeys = libraryKeySet(library);
  const continueWatching = library.filter((item) => item.status === 'watching').slice(0, 12);
  const time = formatWatchTime(stats?.timeWatchedMinutes);
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Salut, {user.username} 👋</h1>
          <p className="page-sub">Voici où tu en es dans tes animés.</p>
        </div>
      </header>

      {loading ? (
        <SkeletonStats count={6} />
      ) : (
        <>
          <div className="big-stats">
            <article className="time-card">
              <span className="time-card-title"><ClockIcon size={16} /> Temps passé devant des animés</span>
              <div className="time-blocks">
                <div className="time-block"><strong>{time.months}</strong><span>mois</span></div>
                <div className="time-block"><strong>{time.days}</strong><span>jours</span></div>
                <div className="time-block"><strong>{time.hours}</strong><span>heures</span></div>
              </div>
            </article>
            <article className="time-card">
              <span className="time-card-title"><EyeIcon size={16} /> Épisodes vus</span>
              <div className="time-blocks">
                <div className="time-block solo"><strong>{(stats?.episodesWatched ?? 0).toLocaleString('fr-FR')}</strong></div>
              </div>
            </article>
          </div>

          <div className="stats-grid">
            <StatCard icon={<TvIcon />} label="Animés suivis" value={stats?.total ?? 0} tone="accent" />
            <StatCard icon={<PlayIcon />} label="En cours" value={stats?.watching ?? 0} tone="blue" />
            <StatCard icon={<CheckIcon />} label="Terminés" value={stats?.completed ?? 0} tone="green" />
            <StatCard icon={<LibraryIcon />} label="À voir" value={stats?.planning ?? 0} tone="violet" />
            <StatCard icon={<StarIcon />} label="Note moyenne" value={stats?.averageRating ? `${stats.averageRating}/10` : '—'} tone="amber" />
            <StatCard icon={<HeartIcon />} label="Favoris" value={stats?.favorites ?? 0} tone="teal" />
          </div>
        </>
      )}

      <section className="dash-section">
        <div className="section-head">
          <h2><PlayIcon size={18} /> Continuer à regarder</h2>
        </div>
        {loading ? (
          <SkeletonRow count={5} />
        ) : continueWatching.length > 0 ? (
          <div className="media-row">
            {continueWatching.map((item) => (
              <MediaCard
                key={item._id}
                item={item}
                mode="library"
                onOpen={() => setSelected({ item, mode: 'library' })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<PlayIcon size={28} />}
            title="Rien en cours de visionnage"
            message="Ajoute un animé et coche tes épisodes pour le retrouver ici."
            actionLabel="Explorer le catalogue"
            onAction={() => onNavigate('search')}
          />
        )}
      </section>

      <section className="dash-section">
        <div className="section-head">
          <h2><CalendarIcon size={18} /> Sorties à venir</h2>
          <p>Épisodes diffusés dans les 7 prochains jours (AniList).</p>
        </div>
        <MediaGrid
          loading={loading}
          items={airing}
          skeletonCount={6}
          renderItem={(item) => (
            <MediaCard
              key={item.externalId}
              item={item}
              mode="search"
              inLibrary={libraryKeys.has(String(item.externalId))}
              onOpen={() => setSelected({ item, mode: 'search' })}
              onAdd={addItem}
            />
          )}
          empty={(
            <EmptyState
              icon={<CalendarIcon size={28} />}
              title="Aucune sortie trouvée"
              message="Le planning AniList est momentanément indisponible."
            />
          )}
        />
      </section>

      {selected && (
        <MediaDetailModal
          item={selected.item}
          mode={selected.mode}
          inLibrary={selected.mode === 'search' && libraryKeys.has(String(selected.item.externalId))}
          onClose={() => setSelected(null)}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onAdd={addItem}
        />
      )}

      {!loading && library.length === 0 && (
        <div className="dash-cta">
          <SearchIcon size={16} />
          <span>Ta bibliothèque est vide — cherche un animé ou importe tes données TV Time.</span>
          <button className="btn btn-primary btn-small" onClick={() => onNavigate('search')}>Rechercher</button>
          <button className="btn btn-ghost btn-small" onClick={() => onNavigate('import')}>Importer</button>
        </div>
      )}
    </section>
  );
}
