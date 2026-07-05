import { useRef, useState } from 'react';
import { libraryApi, searchApi } from '../lib/api.js';
import { buildLibraryPayload } from '../lib/helpers.js';
import { parseTvTimeExport, bestMatch } from '../lib/tvtime.js';
import { useToast } from '../context/ToastContext.jsx';
import { UploadIcon, CheckIcon, CloseIcon, SearchIcon } from '../components/Icons.jsx';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Délai entre deux séries pour respecter la limite de requêtes AniList
// (~30 requêtes/minute, et il faut 2 à 3 requêtes par série).
const DELAY_BETWEEN_SHOWS = 4500;

const ROW_LABELS = {
  pending: 'En attente',
  searching: 'Recherche...',
  added: 'Importé',
  exists: 'Déjà présent',
  notfound: 'Introuvable',
  error: 'Erreur'
};

export default function Import({ onNavigate }) {
  const toast = useToast();
  const [shows, setShows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const stopRef = useRef(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTvTimeExport(text);
      if (parsed.length === 0) {
        toast.error('Aucune série avec des épisodes vus trouvée dans ce fichier.');
        return;
      }
      setFileName(file.name);
      setDone(false);
      setShows(parsed.map((show, index) => ({
        id: index,
        title: show.title,
        watched: show.watched,
        favorite: show.favorite,
        include: true,
        state: 'pending',
        matchedTitle: ''
      })));
    } catch (_error) {
      toast.error('Fichier illisible : il faut un export TV Time au format JSON.');
    }
  }

  function toggleShow(id) {
    setShows((current) => current.map((show) => (
      show.id === id ? { ...show, include: !show.include } : show
    )));
  }

  function setRow(id, patch) {
    setShows((current) => current.map((show) => (
      show.id === id ? { ...show, ...patch } : show
    )));
  }

  async function start() {
    if (!shows) return;
    setRunning(true);
    setDone(false);
    stopRef.current = false;

    const queue = shows.filter((show) => show.include && show.state !== 'added' && show.state !== 'exists');

    for (const show of queue) {
      if (stopRef.current) break;
      setRow(show.id, { state: 'searching' });
      try {
        const results = await searchApi.anime(show.title);
        const found = bestMatch(show.title, results);
        if (!found) {
          setRow(show.id, { state: 'notfound' });
        } else {
          const franchise = await searchApi.detail(found.match.externalId);
          const payload = buildLibraryPayload(franchise, 'planning', show.watched);
          if (show.favorite) payload.favorite = true;
          const { alreadyInLibrary } = await libraryApi.add(payload);
          setRow(show.id, {
            state: alreadyInLibrary ? 'exists' : 'added',
            matchedTitle: franchise.title
          });
        }
      } catch (error) {
        setRow(show.id, { state: 'error' });
        // Limite de requêtes atteinte : on laisse retomber avant de continuer.
        if (String(error.message).toLowerCase().includes('limite')) {
          await sleep(30000);
        }
      }
      await sleep(DELAY_BETWEEN_SHOWS);
    }

    setRunning(false);
    setDone(true);
  }

  const included = shows?.filter((show) => show.include) || [];
  const imported = shows?.filter((show) => ['added', 'exists'].includes(show.state)) || [];
  const estimatedMinutes = Math.max(1, Math.round((included.length * DELAY_BETWEEN_SHOWS) / 60000));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Migration</p>
          <h1>Importer depuis TV Time</h1>
          <p className="page-sub">
            Récupère tes séries et ta progression depuis un export TV Time (fichier JSON),
            puis retrouve-les ici avec les saisons regroupées.
          </p>
        </div>
      </header>

      <div className="import-panel">
        <ol className="import-steps">
          <li>Demande ton export de données dans l'app TV Time (Paramètres → Compte → Exporter mes données) ou par email à leur support (RGPD).</li>
          <li>Récupère le fichier <code>.json</code> de l'export (celui qui contient tes épisodes vus).</li>
          <li>Charge-le ci-dessous, vérifie la liste détectée, puis lance l'import.</li>
        </ol>
        <p className="import-note">
          Le format simple <code>[{'{'}"title": "One Piece", "watched": 1100{'}'}]</code> fonctionne aussi.
          Seuls les animés trouvés sur AniList seront importés — les séries occidentales seront marquées « introuvable ».
        </p>

        <label className="btn btn-primary import-file">
          <UploadIcon size={16} />
          {fileName ? `Changer de fichier (${fileName})` : 'Choisir le fichier JSON'}
          <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
        </label>
      </div>

      {shows && (
        <>
          <div className="import-toolbar">
            <span className="filter-count">
              {included.length}/{shows.length} série{shows.length > 1 ? 's' : ''} sélectionnée{included.length > 1 ? 's' : ''}
              {!running && !done && ` · ~${estimatedMinutes} min (limite AniList)`}
            </span>
            {running ? (
              <button className="btn btn-danger btn-small" onClick={() => { stopRef.current = true; }}>
                Arrêter
              </button>
            ) : (
              <button className="btn btn-primary" onClick={start} disabled={included.length === 0}>
                <UploadIcon size={15} /> Lancer l'import
              </button>
            )}
          </div>

          <div className="import-list">
            {shows.map((show) => (
              <div key={show.id} className={`import-row state-${show.state} ${show.include ? '' : 'excluded'}`}>
                <button
                  className="import-check"
                  disabled={running}
                  onClick={() => toggleShow(show.id)}
                  aria-label={show.include ? 'Exclure' : 'Inclure'}
                >
                  {show.include ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
                </button>
                <div className="import-titles">
                  <strong>{show.title}</strong>
                  {show.matchedTitle && show.matchedTitle !== show.title && (
                    <span>→ {show.matchedTitle}</span>
                  )}
                </div>
                <span className="import-watched">{show.watched} ép. vus</span>
                <span className={`import-state state-${show.state}`}>
                  {show.state === 'searching' && <SearchIcon size={13} />}
                  {ROW_LABELS[show.state]}
                </span>
              </div>
            ))}
          </div>

          {done && (
            <div className="dash-cta">
              <CheckIcon size={16} />
              <span>
                Import terminé : {imported.length} série{imported.length > 1 ? 's' : ''} dans ta liste.
              </span>
              <button className="btn btn-primary btn-small" onClick={() => onNavigate('library')}>
                Voir ma liste
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
