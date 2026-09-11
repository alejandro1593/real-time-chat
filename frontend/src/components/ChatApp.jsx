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
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState({});
  const activeIdRef = useRef(null);
  const farUserRef = useRef(null);

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
          ? prev.map((c) =>
              c.id === msg.conversationId
                ? {
                    ...c,
                    lastMessage: msg,
                    unreadCount: activeIdRef.current === c.id ? 0 : (c.unreadCount || 0) + 1
                  }
                : c
            )
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
        api.markRead(msg.conversationId).catch(() => {});
      }
    });

    socket.on('message:update', (msg) => {
      setMessages((m) => m.map((x) => (x.id === msg.id ? msg : x)));
      setConversations((prev) =>
        prev.map((c) => (c.id === msg.conversationId ? { ...c, lastMessage: msg } : c))
      );
    });

    socket.on('message:delete', ({ id, conversationId }) => {
      setMessages((m) =>
        m.map((x) =>
          x.id === id ? { ...x, deleted: true, deletedAt: new Date().toISOString(), content: '', image: null } : x
        )
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.lastMessage && c.lastMessage.id === id
            ? { ...c, lastMessage: { ...c.lastMessage, deleted: true, content: '', image: null } }
            : c
        )
      );
    });

    socket.on('messages:read', ({ conversationId, userId }) => {
      setMessages((m) =>
        m.map((x) => (x.conversationId === conversationId && userId !== user.id && !x.readBy?.includes(userId)
          ? { ...x, readBy: [...(x.readBy || []), userId] }
          : x))
      );
    });

    socket.on('members:update', ({ conversationId, participants }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, participants } : c))
      );
    });

    socket.on('conversation:removed', ({ conversationId }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeIdRef.current === conversationId) {
        setActiveId(null);
        setMessages([]);
      }
    });

    socket.on('typing', ({ conversationId, userId, username, typing: isTyping }) => {
      if (userId === user.id) return;
      setTyping((prev) => ({ ...prev, [conversationId]: isTyping ? username : null }));
    });

    return () => {
      socket.off('presence:update');
      socket.off('message:new');
      socket.off('message:update');
      socket.off('message:delete');
      socket.off('messages:read');
      socket.off('members:update');
      socket.off('conversation:removed');
      socket.off('typing');
    };
  }, [socket, user.id]);

  async function openConversation(conv, force) {
    if (!force && conv.id === activeId) return;
    setActiveId(conv.id);
    setTyping({});
    setMessages([]);
    setHasMore(false);
    try {
      const data = await api.messages(conv.id, null, 50);
      setMessages(data);
      setHasMore(data.length === 50);
    } catch (err) {
      console.error(err);
    }
    farUserRef.current = conv.type === 'group' ? null : conv.participants.find((p) => p.id !== user.id)?.id || null;
    api.markRead(conv.id).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  }

  async function loadOlder() {
    if (loadingOlder || !activeId || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const before = messages[0].id;
      const data = await api.messages(activeId, before, 50);
      setMessages((m) => [...data, ...m]);
      setHasMore(data.length === 50);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
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
        mobileHidden={!!activeId}
        onSelect={openConversation}
        onDirect={openDirect}
        onGroup={openGroup}
        onLogout={logout}
      />
      <ChatWindow
        conversation={conversations.find((c) => c.id === activeId) || null}
        messages={messages}
        hasMore={hasMore}
        loadingOlder={loadingOlder}
        typing={typing[activeId]}
        currentUser={user}
        onLoadOlder={loadOlder}
        onBack={() => {
          setActiveId(null);
          setMessages([]);
          setTyping({});
        }}
        onSend={async (content, image) => {
          if (!activeId) return;
          socket.emit('typing', { conversationId: activeId, typing: false });
          try {
            const msg = await api.sendMessage(activeId, { content, image });
            setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeId ? { ...c, lastMessage: msg, unreadCount: 0 } : c
              )
            );
          } catch (err) {
            console.error(err);
          }
        }}
        onEdit={async (msgId, content) => {
          if (!activeId) return;
          try {
            const msg = await api.editMessage(activeId, msgId, content);
            setMessages((m) => m.map((x) => (x.id === msg.id ? msg : x)));
          } catch (err) {
            console.error(err);
          }
        }}
        onDelete={async (msgId) => {
          if (!activeId) return;
          try {
            await api.deleteMessage(activeId, msgId);
          } catch (err) {
            console.error(err);
          }
        }}
        onLeaveGroup={async () => {
          if (!activeId) return;
          try {
            await api.leaveGroup(activeId);
          } catch (err) {
            console.error(err);
          }
        }}
        onTyping={(isTyping) => {
          if (activeId) socket.emit('typing', { conversationId: activeId, typing: isTyping });
        }}
      />
    </div>
  );
}