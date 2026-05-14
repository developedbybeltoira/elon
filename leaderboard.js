/* ══════════════════════════════════════════════════
   LEADERBOARD.JS — Global · Weekly · All-Time
   ══════════════════════════════════════════════════ */

'use strict';

const Leaderboard = (() => {
  let _tgUser   = null;
  let _scope    = 'global';
  let _loaded   = false;
  let _resetInterval = null;

  function init(tgUser) {
    _tgUser = tgUser;
    _bindScope();
    _startResetTimer();
  }

  function _bindScope() {
    document.querySelectorAll('.scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _scope = btn.dataset.scope;
        Audio2.sfxClick();
        load();
      });
    });
  }

  async function load() {
    _renderSkeleton();
    try {
      const data = await DB.getLeaderboard(_scope, 20);
      _renderPodium(data.slice(0, 3));
      _renderList(data.slice(3));
    } catch(e) {
      document.getElementById('lb-list').innerHTML =
        '<p style="text-align:center;color:var(--txt-3);padding:24px">Could not load leaderboard</p>';
    }
  }

  function _renderSkeleton() {
    const list = document.getElementById('lb-list');
    list.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const row = document.createElement('div');
      row.className = 'lb-row';
      row.style.cssText = 'opacity:0.3;animation:pulse 1s ease-in-out infinite alternate';
      row.innerHTML = `<div class="lb-rank-num">${i+4}</div>
        <div style="width:36px;height:36px;border-radius:50%;background:var(--glass-2)"></div>
        <div class="lb-player-info">
          <div style="height:12px;width:${80+Math.random()*60}px;background:var(--glass-2);border-radius:6px;margin-bottom:5px"></div>
          <div style="height:9px;width:50px;background:var(--glass-2);border-radius:6px"></div>
        </div>
        <div style="height:12px;width:50px;background:var(--glass-2);border-radius:6px"></div>`;
      list.appendChild(row);
    }
  }

  function _renderPodium(top3) {
    const podium = document.getElementById('lb-podium');
    podium.innerHTML = '';
    if (!top3 || top3.length === 0) { podium.innerHTML = '<p style="text-align:center;color:var(--txt-3);padding:20px 0;width:100%">No data yet 🐓</p>'; return; }

    const CROWNS = ['👑', '🥈', '🥉'];
    const RANKS  = ['1st', '2nd', '3rd'];
    // Order: 2nd, 1st, 3rd for visual podium effect
    const order  = [top3[1], top3[0], top3[2]];

    order.forEach((player, i) => {
      if (!player) return;
      const realRank = i === 0 ? 2 : i === 1 ? 1 : 3;
      const col = document.createElement('div');
      col.className = 'podium-col';

      const charId = player.equipped_character || 'og';
      const char   = window.ECHICK_CONFIG.CHARACTERS.find(c => c.id === charId);
      const emoji  = char?.emoji || '🐓';
      const name   = player.username || player.display_name || 'Anonymous';
      const score  = (player.best_score || 0).toLocaleString();

      col.innerHTML = `
        <div class="pod-crown">${CROWNS[realRank-1]}</div>
        <div class="pod-avatar">
          ${player.photo_url
            ? `<img src="${player.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
            : emoji}
        </div>
        <div class="pod-name">${name}</div>
        <div class="pod-score">${score}</div>
        <div class="pod-block">
          <span class="pod-rank">${RANKS[realRank-1]}</span>
        </div>
      `;
      podium.appendChild(col);
    });
  }

  function _renderList(players) {
    const list = document.getElementById('lb-list');
    list.innerHTML = '';

    if (!players || players.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt-3);padding:24px">No more players yet!</p>';
      return;
    }

    players.forEach((player, i) => {
      const rank    = i + 4;
      const isMe    = String(player.telegram_id) === String(_tgUser?.id);
      const charId  = player.equipped_character || 'og';
      const char    = window.ECHICK_CONFIG.CHARACTERS.find(c => c.id === charId);
      const emoji   = char?.emoji || '🐓';
      const name    = player.username || player.display_name || 'Anonymous';
      const score   = (player.best_score || 0).toLocaleString();
      const dist    = (player.best_distance || 0).toLocaleString() + ' M';

      const row = document.createElement('div');
      row.className = 'lb-row' + (isMe ? ' my-lb-row' : '');
      row.style.animationDelay = (i * 0.05) + 's';
      row.innerHTML = `
        <div class="lb-rank-num">${rank}</div>
        <div class="lb-avatar-icon">${emoji}</div>
        <div class="lb-player-info">
          <div class="lb-player-name">${isMe ? '🌟 ' : ''}${name}</div>
          <div class="lb-player-sub">Best: ${dist}</div>
        </div>
        <div class="lb-score-val">${score}</div>
      `;
      list.appendChild(row);
    });
  }

  function _startResetTimer() {
    _updateResetBadge();
    clearInterval(_resetInterval);
    _resetInterval = setInterval(_updateResetBadge, 60000);
  }

  function _updateResetBadge() {
    const el = document.getElementById('lb-reset-badge');
    if (!el) return;
    // Calculate days until next Monday 00:00
    const now   = new Date();
    const day   = now.getDay(); // 0=Sun, 1=Mon...
    const daysUntil = (7 - day + 1) % 7 || 7;
    const h     = now.getHours();
    const m     = now.getMinutes();
    const hoursLeft = daysUntil * 24 - h - m/60;
    const daysLeft  = Math.floor(hoursLeft / 24);
    el.textContent = `🔄 ${daysLeft}d reset`;
  }

  return { init, load };
})();

window.Leaderboard = Leaderboard;
