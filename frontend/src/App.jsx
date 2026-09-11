import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import ChatApp from './components/ChatApp';

function AppContent() {
  const { user } = useAuth();
  const [view, setView] = useState('login');

  if (user) return <ChatApp />;

  return view === 'login'
    ? <Login onSwitch={() => setView('register')} />
    : <Register onSwitch={() => setView('login')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}