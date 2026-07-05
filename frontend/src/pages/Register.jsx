import { useState } from 'react';
import { authApi, setSession } from '../lib/api.js';

export default function Register({ onRegistered, onSwitch }) {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.register(form);
      setSession(data);
      onRegistered(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <h2>Créer un compte</h2>
      <p className="auth-sub">Ta bibliothèque personnelle en 30 secondes.</p>

      <label className="field">
        <span>Pseudo</span>
        <input
          autoComplete="username"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })}
          required
          minLength={3}
          maxLength={30}
        />
      </label>

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
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
          minLength={6}
        />
      </label>

      {error && <p className="error-banner">{error}</p>}

      <button className="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Création...' : 'Créer mon compte'}
      </button>

      <p className="switch-auth">
        Déjà inscrit ?
        <button type="button" onClick={onSwitch}>Se connecter</button>
      </p>
    </form>
  );
}
