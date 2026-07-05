import { useState } from 'react';
import { authApi, setSession } from '../lib/api.js';

export default function Login({ onLogged, onSwitch }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(form);
      setSession(data);
      onLogged(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>Bon retour 👋</h2>
      <p className="auth-sub">Connecte-toi pour retrouver ta liste.</p>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
        />
      </label>

      <label className="field">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
      </label>

      {error && <p className="error-banner">{error}</p>}

      <button className="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>

      <p className="switch-auth">
        Pas encore de compte ?
        <button type="button" onClick={onSwitch}>Créer un compte</button>
      </p>
    </form>
  );
}
