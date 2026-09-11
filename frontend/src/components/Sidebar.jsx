import { useState } from 'react';
import { api } from '../api/client';
import CreateGroup from './CreateGroup';

function conversationName(conv, currentUser) {
  if (conv.type === 'group') return conv.name || 'Grupo';
  const other = conv.participants.find((p) => p.id !== currentUser.id);
  return other ? other.username : 'Chat';
}

function lastPreview(msg) {
  if (!msg) return 'Sin mensajes todavía';
  return `${msg.sender?.username}: ${msg.content}`;
}

export default function Sidebar({ user, conversations, activeId, onSelect, onDirect, onGroup, onLogout }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showGroup, setShowGroup] = useState(false);

  const otherUsers = [
    ...new Map(
      conversations
        .filter((c) => c.type === 'direct')
        .flatMap((c) => c.participants.filter((p) => p.id !== user.id))
        .map((u) => [u.id, u])
    ).values()
  ];

  async function runSearch(e) {
    setSearch(e.target.value);
    const q = e.target.value.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await api.searchUsers(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>💬 Chats</h2>
        <div className="sidebar-account">
          <div className="avatar">{user.username[0]?.toUpperCase()}</div>
          <div className="account-info">
            <strong>{user.username}</strong>
            <span>en línea</span>
          </div>
          <button className="icon-btn" onClick={onLogout} title="Cerrar sesión">⏻</button>
        </div>
      </div>

      <div className="search-box">
        <input
          placeholder="Buscar usuario para chatear..."
          value={search}
          onChange={runSearch}
        />
        {search.trim() && (
          <div className="search-results">
            {searching && <p className="muted">Buscando...</p>}
            {!searching && results.length === 0 && <p className="muted">Sin resultados</p>}
            {results.map((u) => (
              <button key={u.id} className="search-result" onClick={() => { onDirect(u.id); setSearch(''); setResults([]); }}>
                <div className="avatar avatar-sm">{u.username[0]?.toUpperCase()}</div>
                <span>{u.username}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="btn-new-group" onClick={() => setShowGroup(true)}>＋ Nuevo grupo</button>

      <div className="conversation-list">
        {conversations.length === 0 && <p className="muted">No hay chats. Busca un usuario para empezar.</p>}
        {conversations.map((c) => {
          const onlineOther = c.type === 'direct'
            ? c.participants.find((p) => p.id !== user.id)?.online
            : false;
          return (
            <button
              key={c.id}
              className={`conversation ${activeId === c.id ? 'active' : ''}`}
              onClick={() => onSelect(c)}
            >
              {c.type === 'group' ? (
                <div className="avatar avatar-sm group">👥</div>
              ) : (
                <div className="avatar-wrap">
                  <div className="avatar avatar-sm">{conversationName(c, user)[0]?.toUpperCase()}</div>
                  <span className={`presence-dot ${onlineOther ? 'online' : ''}`} />
                </div>
              )}
              <div className="conversation-body">
                <strong>{conversationName(c, user)}</strong>
                <span className="conversation-preview">{lastPreview(c.lastMessage)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {showGroup && (
        <CreateGroup
          onCancel={() => setShowGroup(false)}
          onCreate={(name, ids) => { setShowGroup(false); onGroup(name, ids); }}
          existingUsers={otherUsers}
        />
      )}
    </aside>
  );
}