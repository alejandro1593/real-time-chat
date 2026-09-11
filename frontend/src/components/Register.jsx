import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username.trim(), form.email.trim(), form.password);
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
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Únete al chat en tiempo real</p>
        <form onSubmit={handleSubmit}>
          <input placeholder="Nombre de usuario" value={form.username} onChange={update('username')} required />
          <input type="email" placeholder="Correo electrónico" value={form.email} onChange={update('email')} required />
          <input type="password" placeholder="Contraseña (mín. 6 caracteres)" value={form.password} onChange={update('password')} required />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>
        <p className="auth-switch">
          ¿Ya tienes cuenta? <span onClick={onSwitch}>Inicia sesión</span>
        </p>
      </div>
    </div>
  );
}