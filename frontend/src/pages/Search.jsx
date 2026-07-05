import { useEffect, useState } from 'react';
import { libraryApi, searchApi } from '../lib/api.js';
import { libraryKeySet, buildLibraryPayload } from '../lib/helpers.js';
import { useToast } from '../context/ToastContext.jsx';
import MediaCard from '../components/MediaCard.jsx';
import MediaGrid from '../components/MediaGrid.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MediaDetailModal from '../components/MediaDetailModal.jsx';
import { SkeletonGrid } from '../components/LoadingSkeleton.jsx';
import { SearchIcon, SparklesIcon, CalendarIcon, StarIcon, PlayIcon } from '../components/Icons.jsx';

const BROWSE_SECTIONS = [
  { key: 'trending', label: 'Tendances en ce moment', icon: SparklesIcon },
  { key: 'currentSeason', label: 'Populaires cette saison', icon: CalendarIcon },
  { key: 'popular', label: 'Populaires de tous les temps', icon: PlayIcon },
  { key: 'topRated', label: 'Les mieux notés', icon: StarIcon }
];

export default function Search() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [browse, setBrowse] = useState(null);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [libraryKeys, setLibraryKeys] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  // Catalogue par défaut + contenu déjà en bibliothèque (pour le marquage).
  useEffect(() => {
    let cancelled = false;
    searchApi.browse()
      .then((data) => { if (!cancelled) setBrowse(data); })
      .catch((error) => { if (!cancelled) toast.error(error.message); })
      .finally(() => { if (!cancelled) setBrowseLoading(false); });
    libraryApi.list()
      .then((items) => { if (!cancelled) setLibraryKeys(libraryKeySet(items)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche automatique avec debounce.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchApi.anime(trimmed);
        if (!cancelled) setResults(data);
      } catch (error) {
        if (!cancelled) toast.error(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addItem(item) {
    try {
      // On récupère la franchise complète (toutes les saisons) avant l'ajout.
      const franchise = item.seasons?.length ? item : await searchApi.detail(item.externalId);
      const { item: saved, alreadyInLibrary } = await libraryApi.add(
        buildLibraryPayload(franchise, item.status || 'planning')
      );
      setLibraryKeys((current) => {
        const next = new Set(current);
        next.add(String(saved.externalId));
        for (const season of saved.seasons || []) next.add(String(season.anilistId));
        return next;
      });
      if (alreadyInLibrary) toast.info('Déjà dans ta liste — infos rafraîchies');
      else toast.success(`${saved.title} ajouté à ta liste`);
      return saved;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }

  const searching = query.trim().length >= 2;

  const renderCard = (item) => (
    <MediaCard
      key={item.externalId}
      item={item}
      mode="search"
      inLibrary={libraryKeys.has(String(item.externalId))}
      onOpen={() => setSelected(item)}
      onAdd={addItem}
    />
  );

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Recherche</h1>
          <p className="page-sub">Tous les animés via AniList — les saisons d'une même série sont regroupées.</p>
        </div>
      </header>

      <div className="search-hero">
        <div className="search-field big">
          <SearchIcon size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="One Piece, Mushoku Tensei, Frieren..."
          />
        </div>
      </div>

      {searching ? (
        <MediaGrid
          loading={loading}
          items={results}
          renderItem={renderCard}
          empty={(
            <EmptyState
              icon={<SearchIcon size={28} />}
              title={`Aucun résultat pour « ${query.trim()} »`}
              message="Essaie un autre titre (les saisons 2, 3... sont regroupées avec la première)."
            />
          )}
        />
      ) : browseLoading ? (
        <SkeletonGrid count={12} />
      ) : browse ? (
        BROWSE_SECTIONS.map(({ key, label, icon: SectionIcon }) => (
          (browse[key] || []).length > 0 && (
            <section key={key} className="dash-section">
              <div className="section-head">
                <h2><SectionIcon size={18} /> {label}</h2>
              </div>
              <div className="media-row">
                {browse[key].map(renderCard)}
              </div>
            </section>
          )
        ))
      ) : (
        <EmptyState
          icon={<SparklesIcon size={28} />}
          title="Catalogue indisponible"
          message="Impossible de charger le catalogue AniList. Utilise la barre de recherche."
        />
      )}

      {selected && (
        <MediaDetailModal
          item={selected}
          mode="search"
          inLibrary={libraryKeys.has(String(selected.externalId))}
          onClose={() => setSelected(null)}
          onAdd={addItem}
        />
      )}
    </section>
  );
}
