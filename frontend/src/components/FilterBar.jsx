import { STATUSES, SORT_OPTIONS } from '../lib/helpers.js';
import { SearchIcon, HeartIcon } from './Icons.jsx';

const RATING_FILTERS = [
  { value: '', label: 'Toutes les notes' },
  { value: '9', label: '★ 9 et +' },
  { value: '8', label: '★ 8 et +' },
  { value: '7', label: '★ 7 et +' },
  { value: '5', label: '★ 5 et +' }
];

export default function FilterBar({ filters, onChange, count }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="search-field">
          <SearchIcon size={17} />
          <input
            value={filters.query}
            onChange={(event) => set('query', event.target.value)}
            placeholder="Filtrer par titre..."
          />
        </div>

        <select value={filters.sort} onChange={(event) => set('sort', event.target.value)} aria-label="Trier par">
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={filters.minRating} onChange={(event) => set('minRating', event.target.value)} aria-label="Note minimum">
          {RATING_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button
          className={`chip chip-fav ${filters.favoritesOnly ? 'active' : ''}`}
          onClick={() => set('favoritesOnly', !filters.favoritesOnly)}
        >
          <HeartIcon size={15} filled={filters.favoritesOnly} /> Favoris
        </button>
      </div>

      <div className="filter-row chips-row">
        <button
          className={`chip ${filters.status === '' ? 'active' : ''}`}
          onClick={() => set('status', '')}
        >
          Tous
        </button>
        {STATUSES.map((status) => (
          <button
            key={status.value}
            className={`chip ${filters.status === status.value ? 'active' : ''}`}
            onClick={() => set('status', filters.status === status.value ? '' : status.value)}
          >
            {status.label}
          </button>
        ))}
        {typeof count === 'number' && <span className="filter-count">{count} média{count > 1 ? 's' : ''}</span>}
      </div>
    </div>
  );
}
