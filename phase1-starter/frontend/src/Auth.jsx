import { useState } from 'react';
import { api, decodeJwtPayload } from './api';

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        await api.register(email, password);
      }
      const { token } = await api.login(email, password);
      const payload = decodeJwtPayload(token);
      if (!payload || payload.sub === undefined || payload.sub === null) {
        throw new Error('Logged in, but could not read your user id from the token.');
      }
      onAuthenticated({ token, userId: String(payload.sub), email: payload.email || email });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card">
        <div className="auth-switch">
          <button
            type="button"
            className="tab-btn"
            disabled={mode === 'login'}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className="tab-btn"
            disabled={mode === 'register'}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
