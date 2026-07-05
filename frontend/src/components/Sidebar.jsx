import { HomeIcon, LibraryIcon, SearchIcon, LogoutIcon, PlayIcon, UploadIcon, CalendarIcon } from './Icons.jsx';

const NAV_LINKS = [
  { id: 'dashboard', label: 'Dashboard', short: 'Accueil', icon: HomeIcon },
  { id: 'library', label: 'Ma liste', short: 'Liste', icon: LibraryIcon },
  { id: 'calendar', label: 'Calendrier', short: 'Sorties', icon: CalendarIcon },
  { id: 'search', label: 'Recherche', short: 'Recherche', icon: SearchIcon },
  { id: 'import', label: 'Import TV Time', short: 'Import', icon: UploadIcon }
];

function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark"><PlayIcon size={16} /></span>
      <span className="logo-text">TV<em>Track</em></span>
    </span>
  );
}

export default function Sidebar({ user, view, onView, onLogout }) {
  return (
    <>
      {/* Sidebar desktop */}
      <aside className="sidebar">
        <button className="sidebar-brand" onClick={() => onView('dashboard')}>
          <Logo />
        </button>

        <nav className="sidebar-nav">
          {NAV_LINKS.map(({ id, label, icon: NavIcon }) => (
            <button
              key={id}
              className={`nav-link ${view === id ? 'active' : ''}`}
              onClick={() => onView(id)}
            >
              <NavIcon />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{(user.username || '?').charAt(0).toUpperCase()}</span>
            <div className="user-chip-text">
              <strong>{user.username}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button className="nav-link" onClick={onLogout}>
            <LogoutIcon />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Barre du haut mobile */}
      <header className="mobile-topbar">
        <button className="sidebar-brand" onClick={() => onView('dashboard')}>
          <Logo />
        </button>
        <button className="icon-btn" onClick={onLogout} aria-label="Déconnexion">
          <LogoutIcon />
        </button>
      </header>

      {/* Navigation du bas mobile */}
      <nav className="mobile-nav">
        {NAV_LINKS.map(({ id, label, short, icon: NavIcon }) => (
          <button
            key={id}
            className={`mobile-nav-link ${view === id ? 'active' : ''}`}
            onClick={() => onView(id)}
          >
            <NavIcon size={22} />
            <span>{short || label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
