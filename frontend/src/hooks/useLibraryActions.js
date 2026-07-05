import { libraryApi } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Actions communes sur les éléments de la bibliothèque (modifier, supprimer),
 * avec mise à jour de l'état local et toasts.
 * Les erreurs sont affichées en toast : les handlers ne lèvent jamais.
 */
export default function useLibraryActions({ setItems, setSelected, onChanged }) {
  const toast = useToast();

  function applySaved(updated) {
    setItems((current) => current.map((item) => (item._id === updated._id ? updated : item)));
    setSelected?.((current) => (
      current && current.item?._id === updated._id ? { ...current, item: updated } : current
    ));
  }

  async function updateItem(id, updates, message = 'Suivi mis à jour') {
    try {
      const updated = await libraryApi.update(id, updates);
      applySaved(updated);
      onChanged?.();
      if (message) toast.success(message);
      return updated;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }

  async function deleteItem(id) {
    try {
      await libraryApi.remove(id);
      setItems((current) => current.filter((item) => item._id !== id));
      onChanged?.();
      toast.success('Retiré de ta liste');
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }

  return { updateItem, deleteItem };
}
