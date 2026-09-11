import { useEffect, useRef, useState } from 'react';

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

export default function ChatWindow({ conversation, messages, typing, currentUser, onBack, onSend, onTyping }) {
  const [draft, setDraft] = useState('');
  const [typingFlag, setTypingFlag] = useState(false);
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const title = windowTitle(conversation, currentUser);
  const status = windowStatus(conversation, currentUser, typing);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

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
    if (!content || !conversation) return;
    onSend(content);
    setDraft('');
    setTypingFlag(false);
    clearTimeout(typingTimer.current);
    onTyping(false);
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
        <div>
          <h3>{title}</h3>
          <span className="header-status">{status}</span>
        </div>
      </header>

      <div className="messages">
        {messages.length === 0 && <p className="muted center">No hay mensajes. ¡Envía el primero!</p>}
        {messages.map((m) => {
          const mine = m.sender?.id === currentUser.id;
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''}`}>
              {!mine && <div className="avatar avatar-tiny">{m.sender?.username[0]?.toUpperCase()}</div>}
              <div className="msg-bubble">
                {!mine && <span className="msg-author">{m.sender?.username}</span>}
                <p>{m.content}</p>
                <span className="msg-time">
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        {typing && <div className="typing-indicator"><span></span><span></span><span></span></div>}
        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={submit}>
        <input
          placeholder="Escribe un mensaje..."
          value={draft}
          onChange={(e) => handleTyping(e.target.value)}
        />
        <button type="submit" disabled={!draft.trim()}>➤</button>
      </form>
    </div>
  );
}