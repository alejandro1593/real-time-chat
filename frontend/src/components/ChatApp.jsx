import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { getSocket } from '../socket';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';

export default function ChatApp() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const activeIdRef = useRef(null);

  const socket = getSocket();

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.conversations();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    socket.on('presence:update', ({ userId, online }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((p) => (p.id === userId ? { ...p, online } : p))
        }))
      );
    });

    socket.on('message:new', (msg) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === msg.conversationId);
        const base = exists
          ? prev.map((c) => (c.id === msg.conversationId ? { ...c, lastMessage: msg } : c))
          : prev;
        return [...base].sort(
          (a, b) =>
            new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0)
        );
      });
      if (activeIdRef.current === msg.conversationId) {
        setMessages((m) => {
          const exists = m.some((x) => x.id === msg.id);
          return exists ? m : [...m, msg];
        });
      }
    });

    socket.on('typing', ({ conversationId, userId, username, typing: isTyping }) => {
      if (userId === user.id) return;
      setTyping((prev) => ({ ...prev, [conversationId]: isTyping ? username : null }));
    });

    return () => {
      socket.off('presence:update');
      socket.off('message:new');
      socket.off('typing');
    };
  }, [socket, user.id]);

  async function openConversation(conv, force) {
    if (!force && conv.id === activeId) return;
    setActiveId(conv.id);
    setTyping({});
    setMessages([]);
    try {
      const data = await api.messages(conv.id);
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function openDirect(userId) {
    const conv = await api.startDirect(userId);
    await loadConversations();
    await openConversation(conv, true);
  }

  async function openGroup(name, userIds) {
    const conv = await api.createGroup({ name, userIds });
    await loadConversations();
    await openConversation(conv, true);
  }

  return (
    <div className="chat-app">
      <Sidebar
        user={user}
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onDirect={openDirect}
        onGroup={openGroup}
        onLogout={logout}
      />
      <ChatWindow
        conversation={conversations.find((c) => c.id === activeId) || null}
        messages={messages}
        typing={typing[activeId]}
        currentUser={user}
        onSend={async (content) => {
          socket.emit('message:send', { conversationId: activeId, content }, () => {});
          socket.emit('typing', { conversationId: activeId, typing: false });
        }}
        onTyping={(isTyping) => {
          if (activeId) socket.emit('typing', { conversationId: activeId, typing: isTyping });
        }}
      />
    </div>
  );
}