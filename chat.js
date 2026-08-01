(function () {
  'use strict';

  if (window.location.pathname.includes('admin')) return;

  let _s;
  try { _s = JSON.parse(localStorage.getItem('helix_session') || 'null'); } catch (e) { return; }
  if (!_s || !_s.token) return;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    #hxc-btn {
      position: fixed; bottom: 24px; right: 24px;
      width: 54px; height: 54px; border-radius: 50%;
      background: var(--primary, #6366f1);
      border: none; cursor: pointer;
      box-shadow: 0 4px 24px rgba(99,102,241,0.45);
      z-index: 9990; display: flex; align-items: center; justify-content: center;
      color: white; transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    #hxc-btn:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(99,102,241,0.6); }
    #hxc-badge {
      position: absolute; top: -3px; right: -3px;
      background: #ef4444; color: white; border-radius: 10px;
      min-width: 18px; height: 18px; padding: 0 4px;
      font-size: 10px; font-weight: 700; display: none;
      align-items: center; justify-content: center;
      font-family: -apple-system, sans-serif; border: 2px solid var(--bg, #0f0f1a);
    }
    #hxc-panel {
      position: fixed; bottom: 88px; right: 24px;
      width: 340px; height: 480px;
      background: var(--surface, #13131f);
      border: 1px solid var(--border, rgba(255,255,255,0.08));
      border-radius: 16px; box-shadow: 0 12px 48px rgba(0,0,0,0.5);
      z-index: 9989; display: flex; flex-direction: column; overflow: hidden;
      opacity: 0; transform: translateY(16px) scale(0.97); pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #hxc-panel.hxc-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
    #hxc-header {
      padding: 14px 16px;
      background: linear-gradient(135deg, var(--primary, #6366f1) 0%, #8b5cf6 100%);
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #hxc-header-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    #hxc-header-info { flex: 1; min-width: 0; }
    #hxc-header-title { font-size: 0.88rem; font-weight: 700; color: white; letter-spacing: -0.01em; }
    #hxc-header-sub { font-size: 0.7rem; color: rgba(255,255,255,0.7); margin-top: 1px; }
    #hxc-close {
      background: rgba(255,255,255,0.15); border: none;
      width: 28px; height: 28px; border-radius: 50%;
      cursor: pointer; color: white; font-size: 13px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background 0.15s;
    }
    #hxc-close:hover { background: rgba(255,255,255,0.28); }
    #hxc-messages {
      flex: 1; overflow-y: auto; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #hxc-messages::-webkit-scrollbar { width: 3px; }
    #hxc-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
    .hxc-msg { display: flex; flex-direction: column; max-width: 84%; }
    .hxc-msg-user { align-self: flex-end; align-items: flex-end; }
    .hxc-msg-admin { align-self: flex-start; align-items: flex-start; }
    .hxc-sender {
      font-size: 0.63rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--text-3, rgba(255,255,255,0.35));
      margin-bottom: 3px;
    }
    .hxc-bubble {
      padding: 9px 12px; border-radius: 12px;
      font-size: 0.82rem; line-height: 1.5; word-break: break-word; white-space: pre-wrap;
    }
    .hxc-msg-user .hxc-bubble {
      background: var(--primary, #6366f1); color: white; border-bottom-right-radius: 3px;
    }
    .hxc-msg-admin .hxc-bubble {
      background: rgba(255,255,255,0.05); color: var(--text, #e2e8f0);
      border: 1px solid var(--border, rgba(255,255,255,0.08)); border-bottom-left-radius: 3px;
    }
    .hxc-time { font-size: 0.61rem; color: var(--text-3, rgba(255,255,255,0.3)); margin-top: 3px; }
    #hxc-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 100%; text-align: center; padding: 28px;
    }
    #hxc-empty-icon { font-size: 2.4rem; margin-bottom: 12px; }
    #hxc-empty-title { font-size: 0.88rem; font-weight: 600; color: var(--text, #e2e8f0); margin-bottom: 6px; }
    #hxc-empty-sub { font-size: 0.78rem; color: var(--text-2, rgba(255,255,255,0.5)); line-height: 1.55; }
    #hxc-footer {
      padding: 10px 12px; border-top: 1px solid var(--border, rgba(255,255,255,0.07));
      display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
    }
    #hxc-input {
      flex: 1; background: rgba(255,255,255,0.05);
      border: 1px solid var(--border, rgba(255,255,255,0.1));
      border-radius: 10px; padding: 9px 12px;
      color: var(--text, #e2e8f0); font-size: 0.82rem; font-family: inherit;
      resize: none; outline: none; line-height: 1.45; max-height: 100px;
      transition: border-color 0.15s;
    }
    #hxc-input:focus { border-color: var(--primary, #6366f1); }
    #hxc-input::placeholder { color: var(--text-3, rgba(255,255,255,0.3)); }
    #hxc-send {
      background: var(--primary, #6366f1); border: none; border-radius: 9px;
      width: 36px; height: 36px; cursor: pointer; color: white;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.15s;
    }
    #hxc-send:hover { opacity: 0.85; }
    #hxc-send:disabled { opacity: 0.35; cursor: default; }
    @media (max-width: 400px) { #hxc-panel { right: 8px; left: 8px; width: auto; } }
  `;
  document.head.appendChild(styleEl);

  // ── DOM ─────────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.innerHTML = `
    <div id="hxc-panel" role="dialog" aria-modal="true" aria-label="Support Chat">
      <div id="hxc-header">
        <div id="hxc-header-avatar">🛟</div>
        <div id="hxc-header-info">
          <div id="hxc-header-title">Helix Support</div>
          <div id="hxc-header-sub">We usually reply within a few hours</div>
        </div>
        <button id="hxc-close" aria-label="Close">✕</button>
      </div>
      <div id="hxc-messages"></div>
      <div id="hxc-footer">
        <textarea id="hxc-input" placeholder="Ask a question or report a bug…" rows="1" aria-label="Message"></textarea>
        <button id="hxc-send" aria-label="Send message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
    <button id="hxc-btn" aria-label="Open support chat" aria-expanded="false">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span id="hxc-badge"></span>
    </button>
  `;
  document.body.appendChild(root);

  const panel   = document.getElementById('hxc-panel');
  const btn     = document.getElementById('hxc-btn');
  const badge   = document.getElementById('hxc-badge');
  const msgsEl  = document.getElementById('hxc-messages');
  const input   = document.getElementById('hxc-input');
  const sendBtn = document.getElementById('hxc-send');

  // ── State ────────────────────────────────────────────────────────────────────
  let isOpen  = false;
  let poll    = null;
  let bgPoll  = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const AUTH = { 'Authorization': 'Bearer ' + _s.token };

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    const diff = Date.now() - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // ── API ──────────────────────────────────────────────────────────────────────
  async function loadMessages() {
    try {
      const res = await fetch('/api/chat', { headers: AUTH });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      renderMessages(data.messages);
    } catch (e) {}
  }

  async function checkUnread() {
    try {
      const res = await fetch('/api/chat/unread', { headers: AUTH });
      if (!res.ok) return;
      const data = await res.json();
      setBadge(data.count || 0);
    } catch (e) {}
  }

  async function sendMessage() {
    const content = input.value.trim();
    if (!content || sendBtn.disabled) return;
    sendBtn.disabled = true;
    input.value = '';
    autoResize();
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      await loadMessages();
    } catch (e) {}
    sendBtn.disabled = false;
    input.focus();
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function renderMessages(messages) {
    if (!messages || !messages.length) {
      msgsEl.innerHTML = `
        <div id="hxc-empty">
          <div id="hxc-empty-icon">💬</div>
          <div id="hxc-empty-title">How can we help?</div>
          <div id="hxc-empty-sub">Ask a question, report a bug, or share feedback. We read every message.</div>
        </div>`;
      return;
    }
    const atBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 60;
    msgsEl.innerHTML = messages.map(m => `
      <div class="hxc-msg ${m.is_from_admin ? 'hxc-msg-admin' : 'hxc-msg-user'}">
        <div class="hxc-sender">${m.is_from_admin ? 'Helix Support' : 'You'}</div>
        <div class="hxc-bubble">${esc(m.content)}</div>
        <div class="hxc-time">${fmtTime(m.created_at)}</div>
      </div>`).join('');
    if (atBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function setBadge(count) {
    if (count > 0 && !isOpen) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function autoResize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  }

  // ── Open / Close ─────────────────────────────────────────────────────────────
  function open() {
    isOpen = true;
    panel.classList.add('hxc-open');
    btn.setAttribute('aria-expanded', 'true');
    badge.style.display = 'none';
    clearInterval(bgPoll);
    loadMessages();
    poll = setInterval(loadMessages, 10000);
    setTimeout(() => input.focus(), 220);
  }

  function close() {
    isOpen = false;
    panel.classList.remove('hxc-open');
    btn.setAttribute('aria-expanded', 'false');
    clearInterval(poll);
    bgPoll = setInterval(checkUnread, 30000);
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  btn.addEventListener('click', () => (isOpen ? close : open)());
  document.getElementById('hxc-close').addEventListener('click', close);
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('input', autoResize);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  checkUnread();
  bgPoll = setInterval(checkUnread, 30000);
})();
