let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

export function playPing() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

let notificationsEnabled = false;

export function enableNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    notificationsEnabled = true;
    return;
  }
  Notification.requestPermission().then((p) => {
    if (p === 'granted') notificationsEnabled = true;
  });
}

export function isNotificationsEnabled() {
  return notificationsEnabled && 'Notification' in window && Notification.permission === 'granted';
}

export function sendDesktopNotification(title, body) {
  if (!isNotificationsEnabled()) return;
  try { new Notification(title, { body, icon: '💬' }); } catch {}
}