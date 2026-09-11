const BASE = import.meta.env.VITE_API_URL || '';

async function request(method, path, body = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}/api${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error del servidor');
  return data;
}

export const api = {
  register: (d) => request('POST', '/auth/register', d),
  login: (d) => request('POST', '/auth/login', d),
  me: () => request('GET', '/auth/me'),
  searchUsers: (q) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),
  conversations: () => request('GET', '/conversations'),
  startDirect: (userId) => request('POST', '/conversations/direct', { userId }),
  createGroup: (d) => request('POST', '/conversations/group', d),
  messages: (id, before, limit = 50) => {
    const params = new URLSearchParams({ limit });
    if (before) params.set('before', before);
    return request('GET', `/conversations/${id}/messages?${params}`);
  },
  searchMessages: (id, q) => request('GET', `/conversations/${id}/messages/search?q=${encodeURIComponent(q)}`),
  sendMessage: (id, d) => request('POST', `/conversations/${id}/messages`, d),
  editMessage: (id, msgId, content) => request('PUT', `/conversations/${id}/messages/${msgId}`, { content }),
  deleteMessage: (id, msgId) => request('DELETE', `/conversations/${id}/messages/${msgId}`),
  reactToMessage: (id, msgId, emoji) => request('PUT', `/conversations/${id}/messages/${msgId}/reactions`, { emoji }),
  markRead: (id) => request('POST', `/conversations/${id}/read`),
  members: (id) => request('GET', `/conversations/${id}/members`),
  leaveGroup: (id) => request('DELETE', `/conversations/${id}/participants/me`),
  renameGroup: (id, name) => request('PUT', `/conversations/${id}`, { name }),
  deleteGroup: (id) => request('DELETE', `/conversations/${id}`)
};