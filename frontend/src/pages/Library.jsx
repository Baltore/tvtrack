import { useEffect, useMemo, useState } from 'react';
import { libraryApi } from '../lib/api.js';
import { progressPercent } from '../lib/helpers.js';
import { useToast } from '../context/ToastContext.jsx';
import useLibraryActions from '../hooks/useLibraryActions.js';
import MediaCard from '../components/MediaCard.jsx';
import MediaGrid from '../components/MediaGrid.jsx';
import FilterBar from '../components/FilterBar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MediaDetailModal from '../components/MediaDetailModal.jsx';
import { LibraryIcon } from '../components/Icons.jsx';

const DEFAULT_FILTERS = {
  query: '',
  status: '',
  favoritesOnly: false,
  minRating: '',
  sort: 'recent'
};

export default function Library({ onNavigate }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState(null); // { item, mode: 'library' }

  const { updateItem, deleteItem } = useLibraryActions({
    setItems,
    setSelected
  });

  // Petite latence sur la saisie pour éviter une requête par frappe.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.query.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    libraryApi.list({
      status: filters.status,
      favorite: filters.favoritesOnly,
      minRating: filters.minRating,
      q: debouncedQuery,
      // Le tri "progression" se fait côté client (pourcentage calculé).
      sort: filters.sort === 'progress' ? 'recent' : filters.sort
    })
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((error) => { if (!cancelled) toast.error(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.status, filters.favoritesOnly, filters.minRating, filters.sort, debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(() => {
    if (filters.sort !== 'progress') return items;
    return [...items].sort((a, b) => progressPercent(b) - progressPercent(a));
  }, [items, filters.sort]);

  const hasActiveFilters = filters.status || filters.favoritesOnly
    || filters.minRating || debouncedQuery;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ma bibliothèque</p>
          <h1>Ma liste</h1>
          <p className="page-sub">Tous les animés que tu suis, au même endroit.</p>
        </div>
      </header>

      <FilterBar filters={filters} onChange={setFilters} count={loading ? undefined : displayed.length} />

      <MediaGrid
        loading={loading}
        items={displayed}
        renderItem={(item) => (
          <MediaCard
            key={item._id}
            item={item}
            mode="library"
            onOpen={() => setSelected({ item, mode: 'library' })}
          />
        )}
        empty={(
          <EmptyState
            icon={<LibraryIcon size={28} />}
            title={hasActiveFilters ? 'Aucun résultat pour ces filtres' : 'Ta liste est vide'}
            message={hasActiveFilters
              ? 'Essaie d\'élargir les filtres ou de vider la recherche.'
              : 'Ajoute ton premier animé depuis la recherche, ou importe tes données TV Time.'}
            actionLabel={hasActiveFilters ? 'Réinitialiser les filtres' : 'Explorer le catalogue'}
            onAction={hasActiveFilters
              ? () => setFilters(DEFAULT_FILTERS)
              : () => onNavigate('search')}
          />
        )}
      />

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
