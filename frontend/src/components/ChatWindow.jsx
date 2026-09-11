import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

function windowTitle(conv, currentUser) {
  if (!conv) return '';
  if (conv.type === 'group') return conv.name || 'Grupo';
  const other = conv.participants.find((p) => p.id !== currentUser.id);
  return other ? other.username : 'Chat';
}

function windowStatus(conv, currentUser, typing) {
  if (!conv) return '';
  if (typing) return `${typing} está escribiendo...`;
  if (conv.type === 'group') {
    const online = conv.participants.filter((p) => p.id !== currentUser.id && p.online).length;
    return `${online} en línea`;
  }
  const other = conv.participants.find((p) => p.id !== currentUser.id);
  return other?.online ? 'en línea' : 'desconectado';
}

function readReceipt(m, currentUser) {
  const othersRead = m.readBy?.filter((id) => id !== currentUser.id).length || 0;
  return othersRead > 0;
}

function timeOf(m) {
  return new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Bubble({ m, mine, currentUser, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (m.deleted) {
    return (
      <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
        {!mine && <div className="avatar avatar-tiny">{m.sender?.username[0]?.toUpperCase()}</div>}
        <div className="msg-bubble deleted">
          <span className="msg-deleted-text">🗑 Este mensaje fue eliminado</span>
          <span className="msg-time">{timeOf(m)}</span>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
        <div className="msg-bubble editing">
          <input
            className="edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <div className="edit-actions">
            <button type="button" className="edit-btn save" onClick={() => { if (draft.trim() && draft.trim() !== m.content) onEdit(m.id, draft.trim()); setEditing(false); }}>Guardar</button>
            <button type="button" className="edit-btn" onClick={() => { setDraft(m.content); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
      {!mine && <div className="avatar avatar-tiny">{m.sender?.username[0]?.toUpperCase()}</div>}
      <div className="msg-bubble">
        {!mine && <span className="msg-author">{m.sender?.username}</span>}
        {m.image && <img className="msg-image" src={m.image} alt="adjunto" />}
        {m.content && <p>{m.content}</p>}
        {m.edited && <span className="edited-tag">editado</span>}
        <span className="msg-meta">
          <span className="msg-time">{timeOf(m)}</span>
          {mine && <span title={readReceipt(m, currentUser) ? 'Leído' : 'Enviado'} className={`read-badge ${readReceipt(m, currentUser) ? 'read' : ''}`}>{readReceipt(m, currentUser) ? '✓✓' : '✓'}</span>}
        </span>
        {mine && (
          <span className="msg-actions">
            {!confirmDelete ? (
              <>
                <button type="button" title="Editar" onClick={() => setEditing(true)}>✎</button>
                <button type="button" title="Eliminar" onClick={() => setConfirmDelete(true)}>🗑</button>
              </>
            ) : (
              <>
                <button type="button" className="confirm-yes" onClick={() => { onDelete(m.id); setConfirmDelete(false); }}>Sí</button>
                <button type="button" className="confirm-no" onClick={() => setConfirmDelete(false)}>No</button>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function MembersModal({ conversation, currentUser, onClose }) {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    api.members(conversation.id).then((d) => setMembers(d)).catch(() => setMembers(null));
  }, [conversation.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="members-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h4>Miembros del grupo</h4>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </header>
        <div className="member-list">
          {!members && <p className="muted">Cargando...</p>}
          {members?.participants.map((p) => (
            <div key={p.id} className="member-row">
              <div className="avatar avatar-sm">{p.username[0]?.toUpperCase()}</div>
              <span className="member-name">
                {p.username}
                {p.id === members.ownerId && <span className="owner-badge">👑</span>}
                {p.id === currentUser.id && <span className="owner-badge you">tú</span>}
              </span>
              <span className={`presence-dot ${p.online ? 'online' : ''}`} />
            </div>
          ))}
        </div>
        <button type="button" className="leave-btn" onClick={() => { onClose(); }}>
          Salir del grupo
        </button>
      </div>
    </div>
  );
}

export default function ChatWindow({
  conversation, messages, hasMore, loadingOlder, typing, currentUser,
  onBack, onLoadOlder, onSend, onEdit, onDelete, onLeaveGroup, onTyping
}) {
  const [draft, setDraft] = useState('');
  const [typingFlag, setTypingFlag] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const endRef = useRef(null);
  const topRef = useRef(null);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);

  const title = windowTitle(conversation, currentUser);
  const status = windowStatus(conversation, currentUser, typing);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (searchOpen && searchQ.trim()) {
      setSearching(true);
      api.searchMessages(conversation.id, searchQ)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }
  }, [searchQ, searchOpen, conversation?.id]);

  useEffect(() => {
    setSearchResults([]);
    setSearchQ('');
    setImagePreview(null);
    setDraft('');
    setShowMembers(false);
  }, [conversation?.id]);

  function handleTyping(value) {
    setDraft(value);
    if (!typingFlag) {
      setTypingFlag(true);
      onTyping(true);
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTypingFlag(false);
      onTyping(false);
    }, 1200);
  }

  function submit(e) {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !imagePreview) || !conversation) return;
    onSend(content, imagePreview);
    setDraft('');
    setTypingFlag(false);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
    clearTimeout(typingTimer.current);
    onTyping(false);
  }

  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  if (!conversation) {
    return (
      <div className="chat-window empty">
        <div className="empty-state">
          <span className="empty-icon">💬</span>
          <p>Selecciona un chat o busca un usuario para comenzar a hablar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <header className="chat-header">
        <button type="button" className="back-btn" onClick={onBack} aria-label="Volver a la lista">←</button>
        <div className="header-avatar">{title[0]?.toUpperCase()}</div>
        <div className="header-info">
          <h3>{title}</h3>
          <span className="header-status">{status}</span>
        </div>
        <div className="header-actions">
          <button type="button" className={`tool-btn ${searchOpen ? 'active' : ''}`} title="Buscar mensajes"
            onClick={() => { setSearchResults([]); setSearchQ(''); setSearchOpen(!searchOpen); }}>
            🔍
          </button>
          {conversation.type === 'group' && (
            <button type="button" className="tool-btn" title="Miembros" onClick={() => setShowMembers(true)}>👥</button>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="msg-search-bar">
          <input
            placeholder="Buscar mensajes en esta conversación..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            autoFocus
          />
          <button type="button" className="tool-btn" title="Cerrar búsqueda" onClick={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}>×</button>
        </div>
      )}

      <div className="messages">
        {!searchOpen ? (
          <>
            {hasMore && (
              <div className="load-older-wrap">
                <button type="button" className="load-older" onClick={onLoadOlder} disabled={loadingOlder}>
                  {loadingOlder ? 'Cargando...' : 'Cargar mensajes anteriores ↑'}
                </button>
              </div>
            )}
            {messages.length === 0 && <p className="muted center">No hay mensajes. ¡Envía el primero!</p>}
            {messages.map((m) => (
              <Bubble key={m.id} m={m} mine={m.sender?.id === currentUser.id} currentUser={currentUser} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </>
        ) : (
          <>
            {searching && <p className="muted center">Buscando...</p>}
            {!searching && searchResults.length === 0 && searchQ.trim() && (
              <p className="muted center">Sin resultados para «{searchQ}»</p>
            )}
            {!searchQ.trim() && <p className="muted center">Escribe para buscar en el historial.</p>}
            {searchResults.map((m) => (
              <Bubble key={m.id} m={m} mine={m.sender?.id === currentUser.id} currentUser={currentUser} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </>
        )}
        {typing && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={endRef} />
      </div>

      {conversation.type === 'group' && showMembers && (
        <MembersModal conversation={conversation} currentUser={currentUser} onClose={() => setShowMembers(false)} />
      )}

      {conversation.type === 'group' && (
        <div className="leave-group-strip">
          <button type="button" className="leave-group-btn" onClick={() => { if (window.confirm('¿Salir del grupo?')) onLeaveGroup(); }}>
            Salir del grupo
          </button>
        </div>
      )}

      <form className="chat-input" onSubmit={submit}>
        {imagePreview && (
          <div className="image-preview">
            <img src={imagePreview} alt="preview" />
            <button type="button" onClick={() => { setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}>×</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
        <button type="button" className="attach-btn" title="Adjuntar imagen" onClick={() => fileRef.current?.click()}>📎</button>
        <input
          placeholder="Escribe un mensaje..."
          value={draft}
          onChange={(e) => handleTyping(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim() && !imagePreview}>➤</button>
      </form>
    </div>
  );
}