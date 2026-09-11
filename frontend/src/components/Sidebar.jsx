import { useState } from 'react';
import { api } from '../api/client';
import { enableNotifications, isNotificationsEnabled } from '../utils/notify';
import CreateGroup from './CreateGroup';

function conversationName(conv, currentUser) {
  if (conv.type === 'group') return conv.name || 'Grupo';
  const other = conv.participants.find((p) => p.id !== currentUser.id);
  return other ? other.username : 'Chat';
}

function lastPreview(msg) {
  if (!msg) return 'Sin mensajes todavía';
  const who = msg.sender?.username ? `${msg.sender.username}: ` : '';
  if (msg.deleted) return `${who}🗑 Mensaje eliminado`;
  if (msg.image && !msg.content) return `${who}📷 Imagen`;
  if (msg.image && msg.content) return `${who}📷 ${msg.content}`;
  if (msg.file && !msg.content) return `${who}📄 Archivo`;
  if (msg.file && msg.content) return `${who}📄 ${msg.file.name}`;
  return `${who}${msg.content}`;
}

function avatarStyle(user) {
  return { background: user?.avatarColor || '#6366f1' };
}

export default function Sidebar({
  user, conversations, activeId, mobileHidden, hiddenConvs, onSelect, onDirect, onGroup, onLogout, onHide
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [notifOn, setNotifOn] = useState(isNotificationsEnabled());
  const [showHideConfirm, setShowHideConfirm] = useState(null);

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
    try { setResults(await api.searchUsers(q)); } catch { setResults([]); }
    finally { setSearching(false); }
  }

  function toggleNotif() {
    enableNotifications();
    setTimeout(() => setNotifOn(isNotificationsEnabled()), 500);
    setNotifOn(true);
  }

  return (
    <aside className={`sidebar ${mobileHidden ? 'hide-mobile' : ''}`}>
      <div className="sidebar-header">
        <h2>💬 Chats</h2>
        <div className="sidebar-account">
          <div className="avatar" style={avatarStyle(user)}>{user.avatar ? <img src={user.avatar} alt="avatar" /> : user.username[0]?.toUpperCase()}</div>
          <div className="account-info">
            <strong>{user.username}</strong>
            <span>en línea</span>
          </div>
          <button
            className={`logout-btn notif ${notifOn ? 'on' : ''}`}
            onClick={toggleNotif}
            title="Activar/desactivar notificaciones y sonido"
          >🔔</button>
          <button className="logout-btn" onClick={onLogout} title="Cerrar sesión">
            <span aria-hidden="true">⏻</span> Salir
          </button>
        </div>
      </div>

      <div className="search-box">
        <input placeholder="Buscar usuario para chatear..." value={search} onChange={runSearch} />
        {search.trim() && (
          <div className="search-results">
            {searching && <p className="muted">Buscando...</p>}
            {!searching && results.length === 0 && <p className="muted">Sin resultados</p>}
            {results.map((u) => (
              <button key={u.id} className="search-result" onClick={() => { onDirect(u.id); setSearch(''); setResults([]); }}>
                <div className="avatar avatar-sm" style={avatarStyle(u)}>{u.username[0]?.toUpperCase()}</div>
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
          if (hiddenConvs.includes(c.id)) return null;
          const onlineOther = c.type === 'direct'
            ? c.participants.find((p) => p.id !== user.id)?.online
            : false;
          const other = c.type === 'direct' ? c.participants.find((p) => p.id !== user.id) : null;
          return (
            <div key={c.id} className={`conversation-wrap ${activeId === c.id ? 'active' : ''}`}>
              <button
                className={`conversation ${activeId === c.id ? 'active' : ''}`}
                onClick={() => onSelect(c)}
              >
                {c.type === 'group' ? (
                  <div className="avatar avatar-sm group">👥</div>
                ) : (
                  <div className="avatar-wrap">
                    <div className="avatar avatar-sm" style={avatarStyle(other)}>{conversationName(c, user)[0]?.toUpperCase()}</div>
                    <span className={`presence-dot ${onlineOther ? 'online' : ''}`} />
                  </div>
                )}
                <div className="conversation-body">
                  <strong>{conversationName(c, user)}</strong>
                  <span className="conversation-preview">{lastPreview(c.lastMessage)}</span>
                </div>
                <span className={`arrival-tick ${c.unreadCount > 0 ? 'show' : ''}`} title="Mensaje nuevo">✓</span>
                {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
              </button>
              <button
                type="button"
                className="hide-conv-btn"
                title="Ocultar conversación"
                onClick={() => setShowHideConfirm(c.id)}
              >🗑</button>
              {showHideConfirm === c.id && (
                <div className="hide-confirm">
                  <span>¿Ocultar este chat?</span>
                  <button type="button" className="edit-btn save" onClick={() => { onHide(c.id); setShowHideConfirm(null); }}>Sí</button>
                  <button type="button" className="edit-btn" onClick={() => setShowHideConfirm(null)}>No</button>
                </div>
              )}
            </div>
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