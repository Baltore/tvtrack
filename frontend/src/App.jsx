import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Library from './pages/Library.jsx';
import Calendar from './pages/Calendar.jsx';
import Search from './pages/Search.jsx';
import Import from './pages/Import.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { clearSession, getStoredUser } from './lib/api.js';
import { PlayIcon, LibraryIcon, StarIcon, CalendarIcon } from './components/Icons.jsx';

const FEATURES = [
  { icon: LibraryIcon, text: 'Suis tes animés saison par saison, épisode par épisode' },
  { icon: StarIcon, text: 'Note, commente et garde tes favoris sous la main' },
  { icon: CalendarIcon, text: 'Ne rate plus les prochains épisodes en diffusion' }
];

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [view, setView] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    document.title = 'TVTrack — Ton tracker d\'animés';
  }, []);

  function logout() {
    clearSession();
    setUser(null);
    setView('dashboard');
    setAuthMode('login');
  }

  if (!user) {
    return (
      <ToastProvider>
        <main className="auth-shell">
          <section className="auth-hero">
            <span className="logo big">
              <span className="logo-mark"><PlayIcon size={20} /></span>
              <span className="logo-text">TV<em>Track</em></span>
            </span>
            <h1>Tous tes animés, <span className="gradient-text">au même endroit.</span></h1>
            <p>Ton tracker personnel d'animés : progression par saison, notes, favoris, sorties à venir et import depuis TV Time.</p>
            <ul className="auth-features">
              {FEATURES.map(({ icon: FeatureIcon, text }) => (
                <li key={text}><span className="feature-icon"><FeatureIcon size={17} /></span>{text}</li>
              ))}
            </ul>
          </section>
          <section className="auth-panel">
            {authMode === 'login' ? (
              <Login onLogged={setUser} onSwitch={() => setAuthMode('register')} />
            ) : (
              <Register onRegistered={setUser} onSwitch={() => setAuthMode('login')} />
            )}
          </section>
        </main>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar user={user} view={view} onView={setView} onLogout={logout} />
        <main className="app-main">
          {view === 'dashboard' && <Dashboard user={user} onNavigate={setView} />}
          {view === 'library' && <Library onNavigate={setView} />}
          {view === 'calendar' && <Calendar onNavigate={setView} />}
          {view === 'search' && <Search />}
          {view === 'import' && <Import onNavigate={setView} />}
        </main>
      </div>
    </ToastProvider>
  );
}
