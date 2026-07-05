import { SkeletonGrid } from './LoadingSkeleton.jsx';

/**
 * Grille de médias avec gestion du chargement (skeletons) et de l'état vide.
 * renderItem doit retourner un élément avec sa propre `key`.
 */
export default function MediaGrid({ loading, items, renderItem, empty, skeletonCount = 10 }) {
  if (loading) return <SkeletonGrid count={skeletonCount} />;
  if (!items || items.length === 0) return empty || null;
  return <div className="media-grid">{items.map(renderItem)}</div>;
}
