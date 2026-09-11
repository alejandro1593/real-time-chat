import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import { getSocket, disconnectSocket } from '../socket';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(({ user: u }) => { setUser(u); getSocket(); })
      .catch(() => { localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { user: u, token } = await api.login({ username, password });
    localStorage.setItem('token', token);
    setUser(u);
    getSocket();
  }

  async function register(username, email, password) {
    const { user: u, token } = await api.register({ username, email, password });
    localStorage.setItem('token', token);
    setUser(u);
    getSocket();
  }

  function logout() {
    localStorage.removeItem('token');
    disconnectSocket();
    setUser(null);
  }

  if (loading) return <div className="loading-screen">Conectando...</div>;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}