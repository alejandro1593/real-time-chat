import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">💬</div>
        <h1 className="auth-title">Chat en Tiempo Real</h1>
        <p className="auth-subtitle">Inicia sesión para chatear</p>
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="auth-switch">
          ¿No tienes cuenta? <span onClick={onSwitch}>Regístrate</span>
        </p>
        <div className="auth-demo">
          <p>Usuarios de prueba:</p>
          <code>eduardo / 123456 &nbsp;·&nbsp; ana / 123456 · jose / 123456</code>
        </div>
      </div>
    </div>
  );
}