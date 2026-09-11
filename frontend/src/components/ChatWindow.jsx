import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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

function avatarStyle(user) {
  const bg = user?.avatarColor || '#6366f1';
  return { background: bg };
}

function readReceipt(m, currentUser) {
  return m.readBy?.filter((id) => id !== currentUser.id).length > 0;
}

function timeOf(m) {
  return new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FileChip({ file }) {
  if (!file) return null;
  return (
    <a className="file-chip" href={file.dataUrl || '#'} target="_blank" rel="noreferrer" onClick={(e) => { if (!file.dataUrl) e.preventDefault(); }}>
      <span className="file-icon">📄</span>
      <span className="file-name">{file.name}</span>
    </a>
  );
}

function ReactionChips({ reactions, currentUser, onToggle }) {
  if (!reactions || typeof reactions !== 'object' || Object.keys(reactions).length === 0) return null;
  return (
    <div className="reaction-chips">
      {Object.entries(reactions).map(([emoji, ids]) => {
        const count = ids.length;
        const mine = ids.includes(currentUser.id);
        return (
          <button key={emoji} type="button" className={`reaction-chip ${mine ? 'mine' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle(emoji); }}>
            {emoji} {count > 1 && <span className="rc">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Bubble({ m, mine, currentUser, fresh, onEdit, onDelete, onReact, onReply }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [pickerUp, setPickerUp] = useState(true);
  const wrapperRef = useRef(null);

  const openPicker = () => {
    setShowReactions(true);
    requestAnimationFrame(() => {
      if (wrapperRef.current) setPickerUp(wrapperRef.current.getBoundingClientRect().top > 96);
    });
  };

  useEffect(() => {
    if (!showReactions) return;
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowReactions(false); };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [showReactions]);

  if (m.deleted) {
    return (
      <div key={m.id} className={`msg ${mine ? 'mine' : ''} ${fresh ? 'new-arrival' : ''}`}>
        {!mine && <div className="avatar avatar-tiny" style={avatarStyle(m.sender)}>{m.sender?.username[0]?.toUpperCase()}</div>}
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
          <input className="edit-input" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="edit-actions">
            <button type="button" className="edit-btn save" onClick={() => { if (draft.trim() && draft.trim() !== m.content) onEdit(m.id, draft.trim()); setEditing(false); }}>Guardar</button>
            <button type="button" className="edit-btn" onClick={() => { setDraft(m.content); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div key={m.id} ref={wrapperRef} className={`msg ${mine ? 'mine' : ''} ${fresh ? 'new-arrival' : ''}`}>
      {!mine && <div className="avatar avatar-tiny" style={avatarStyle(m.sender)}>{m.sender?.username[0]?.toUpperCase()}</div>}
      <div className="msg-bubble" onDoubleClick={openPicker}>
        {m.replyTo && (
          <div className="reply-quote">
            <span className="rq-author">{m.replyTo.sender || ''}</span>
            <span className="rq-text">{m.replyTo.content || (m.replyTo.image ? '📷 Imagen' : m.replyTo.file ? '📄 Archivo' : '')}</span>
          </div>
        )}
        {!mine && <span className="msg-author">{m.sender?.username}</span>}
        {m.image && <img className="msg-image" src={m.image} alt="adjunto" />}
        {m.file && <FileChip file={m.file} />}
        {m.content && <p>{m.content}</p>}
        <ReactionChips reactions={m.reactions} currentUser={currentUser} onToggle={(emoji) => onReact(m.id, emoji)} />
        {m.edited && <span className="edited-tag">editado</span>}
        <span className="msg-meta">
          <span className="msg-time">{timeOf(m)}</span>
          {mine && <span title={readReceipt(m, currentUser) ? 'Leído' : 'Enviado'} className={`read-badge ${readReceipt(m, currentUser) ? 'read' : ''}`}>{readReceipt(m, currentUser) ? '✓✓' : '✓'}</span>}
          <button type="button" className="reply-trigger" title="Responder" onClick={(e) => { e.stopPropagation(); onReply(m); }}>↩</button>
        </span>
        {mine && (
          <span className="msg-actions">
            {!confirmDelete ? (
              <>
                <button type="button" title="Reacciones" onClick={() => (showReactions ? setShowReactions(false) : openPicker())}>😀</button>
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
        {showReactions && (
          <div className={`reaction-picker ${pickerUp ? '' : 'below'}`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => { onReact(m.id, emoji); setShowReactions(false); }}>{emoji}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MembersModal({ conversation, currentUser, onClose, onRename, onDelete }) {
  const [members, setMembers] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(conversation.name || '');

  useEffect(() => { setNameDraft(conversation.name || ''); setRenaming(false); }, [conversation.id, conversation.name]);

  useEffect(() => {
    api.members(conversation.id).then((d) => setMembers(d)).catch(() => setMembers(null));
  }, [conversation.id]);

  const isOwner = members?.ownerId === currentUser.id;

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
              <div className="avatar avatar-sm" style={avatarStyle(p)}>{p.username[0]?.toUpperCase()}</div>
              <span className="member-name">
                {p.username}
                {p.id === members.ownerId && <span className="owner-badge">👑</span>}
                {p.id === currentUser.id && <span className="owner-badge you">tú</span>}
              </span>
              <span className={`presence-dot ${p.online ? 'online' : ''}`} />
            </div>
          ))}
        </div>
        {isOwner && (
          <>
            {renaming ? (
              <div className="rename-row">
                <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
                <button type="button" className="edit-btn save" onClick={() => { if (nameDraft.trim()) { onRename(nameDraft.trim()); setRenaming(false); } }}>Guardar</button>
                <button type="button" className="edit-btn" onClick={() => { setNameDraft(conversation.name || ''); setRenaming(false); }}>Cancelar</button>
              </div>
            ) : (
              <button type="button" className="rename-btn" onClick={() => setRenaming(true)}>✏ Renombrar grupo</button>
            )}
            <button type="button" className="delete-group-btn" onClick={() => { onClose(); onDelete(); }}>🗑 Eliminar grupo</button>
          </>
        )}
        <button type="button" className="leave-btn" onClick={() => { onClose(); }}>Salir del grupo</button>
      </div>
    </div>
  );
}

export default function ChatWindow({
  conversation, messages, hasMore, loadingOlder, typing, currentUser, freshIds,
  onBack, onLoadOlder, onSend, onEdit, onDelete, onLeaveGroup, onReact, onRenameGroup, onDeleteGroup, onTyping
}) {
  const [draft, setDraft] = useState('');
  const [typingFlag, setTypingFlag] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const fileRef = useRef(null);

  const title = windowTitle(conversation, currentUser);
  const status = windowStatus(conversation, currentUser, typing);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  useEffect(() => {
    if (searchOpen && searchQ.trim()) {
      setSearching(true);
      api.searchMessages(conversation.id, searchQ).then(setSearchResults).catch(() => setSearchResults([])).finally(() => setSearching(false));
    }
  }, [searchQ, searchOpen, conversation?.id]);

  useEffect(() => {
    setSearchResults([]); setSearchQ(''); setImagePreview(null); setFilePreview(null); setReplyingTo(null); setDraft(''); setShowMembers(false);
  }, [conversation?.id]);

  function handleTyping(value) {
    setDraft(value);
    if (!typingFlag) { setTypingFlag(true); onTyping(true); }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { setTypingFlag(false); onTyping(false); }, 1200);
  }

  function submit(e) {
    e.preventDefault();
    const content = draft.trim();
    const hasMedia = imagePreview || filePreview;
    if ((!content && !hasMedia) || !conversation) return;
    onSend(content, imagePreview, filePreview, replyingTo?.id);
    setDraft(''); setTypingFlag(false); setImagePreview(null); setFilePreview(null); setReplyingTo(null);
    if (fileRef.current) fileRef.current.value = '';
    clearTimeout(typingTimer.current); onTyping(false);
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('El archivo no puede superar 10MB'); return; }
    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
      reader.onload = () => { setImagePreview(reader.result); setFilePreview(null); };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        setFilePreview({ name: file.name, size: file.size, mime: file.type, dataUrl: reader.result });
        setImagePreview(null);
      };
      reader.readAsDataURL(file);
    }
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
        <div className="header-avatar" style={avatarStyle({ avatarColor: conversation.type === 'direct' ? conversation.participants.find((p) => p.id !== currentUser.id)?.avatarColor : '#6366f1' })}>{title[0]?.toUpperCase()}</div>
        <div className="header-info">
          <h3>{title}</h3>
          <span className="header-status">{status}</span>
        </div>
        <div className="header-actions">
          <button type="button" className={`tool-btn ${searchOpen ? 'active' : ''}`} title="Buscar mensajes"
            onClick={() => { setSearchResults([]); setSearchQ(''); setSearchOpen(!searchOpen); }}>🔍</button>
          {conversation.type === 'group' && (
            <button type="button" className="tool-btn" title="Miembros" onClick={() => setShowMembers(true)}>👥</button>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="msg-search-bar">
          <input placeholder="Buscar mensajes en esta conversación..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} autoFocus />
          <button type="button" className="tool-btn" title="Cerrar" onClick={() => { setSearchOpen(false); setSearchQ(''); setSearchResults([]); }}>×</button>
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
              <Bubble key={m.id} m={m} mine={m.sender?.id === currentUser.id} currentUser={currentUser}
                fresh={freshIds.has(m.id)} onEdit={onEdit} onDelete={onDelete} onReact={onReact} onReply={(msg) => setReplyingTo(msg)} />
            ))}
          </>
        ) : (
          <>
            {searching && <p className="muted center">Buscando...</p>}
            {!searching && searchResults.length === 0 && searchQ.trim() && <p className="muted center">Sin resultados para «{searchQ}»</p>}
            {searchResults.map((m) => (
              <Bubble key={m.id} m={m} mine={m.sender?.id === currentUser.id} currentUser={currentUser}
                fresh={false} onEdit={onEdit} onDelete={onDelete} onReact={onReact} onReply={(msg) => setReplyingTo(msg)} />
            ))}
          </>
        )}
        {typing && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={endRef} />
      </div>

      {conversation.type === 'group' && showMembers && (
        <MembersModal conversation={conversation} currentUser={currentUser} onClose={() => setShowMembers(false)} onRename={onRenameGroup} onDelete={onDeleteGroup} />
      )}

      {conversation.type === 'group' && (
        <div className="leave-group-strip">
          <button type="button" className="leave-group-btn" onClick={() => { if (window.confirm('¿Salir del grupo?')) onLeaveGroup(); }}>Salir del grupo</button>
        </div>
      )}

      {replyingTo && (
        <div className="reply-preview">
          <span className="rp-author">Respondiendo a {replyingTo.sender?.username || ' mensaje'}</span>
          <span className="rp-text">{replyingTo.content || (replyingTo.image ? '📷 Imagen' : replyingTo.file ? '📄 Archivo' : '')}</span>
          <button type="button" onClick={() => setReplyingTo(null)}>×</button>
        </div>
      )}

      <form className="chat-input" onSubmit={submit}>
        {(imagePreview || filePreview) && (
          <div className="media-preview">
            {imagePreview && <img src={imagePreview} alt="preview" />}
            {filePreview && <span className="file-preview">📄 {filePreview.name}</span>}
            <button type="button" className="preview-close" onClick={() => { setImagePreview(null); setFilePreview(null); if (fileRef.current) fileRef.current.value = ''; }}>×</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.zip,.rar,.json,.csv" hidden onChange={pickFile} />
        <button type="button" className="attach-btn" title="Adjuntar archivo o imagen" onClick={() => fileRef.current?.click()}>📎</button>
        <input placeholder="Escribe un mensaje..." value={draft} onChange={(e) => handleTyping(e.target.value)} />
        <button type="submit" disabled={!draft.trim() && !imagePreview && !filePreview}>➤</button>
      </form>
    </div>
  );
}