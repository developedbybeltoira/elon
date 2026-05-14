/* ══════════════════════════════════════════════════
   ADMIN.JS — Admin Panel (password-locked)
   Activated by 7 taps on home chicken
   ══════════════════════════════════════════════════ */

'use strict';

const Admin = (() => {
  let _authed   = false;
  let _activeTab = 'players';

  function init() {
    _bindModal();
    _bindTabs();
  }

  function _bindModal() {
    // Close overlay click
    document.getElementById('admin-overlay')?.addEventListener('click', _close);

    // Login
    document.getElementById('btn-admin-login').addEventListener('click', _login);
    document.getElementById('admin-pw-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') _login();
    });

    // Close X (drag handle area)
    document.querySelector('.admin-drag-handle')?.addEventListener('click', _close);
  }

  function _login() {
    const pw  = document.getElementById('admin-pw-input').value;
    const err = document.getElementById('admin-error');
    if (pw === window.ECHICK_CONFIG.PROJECT.adminPassword) {
      _authed = true;
      document.getElementById('admin-auth-form').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      err.classList.add('hidden');
      Audio2.sfxPowerup();
      _loadTab('players');
    } else {
      err.classList.remove('hidden');
      Audio2.sfxHit();
      setTimeout(() => err.classList.add('hidden'), 2000);
    }
  }

  function _close() {
    document.getElementById('admin-modal').classList.add('hidden');
    // Reset auth on close for security
    _authed = false;
    document.getElementById('admin-auth-form').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('admin-pw-input').value = '';
  }

  function _bindTabs() {
    document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!_authed) return;
        document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _activeTab = btn.dataset.atab;
        Audio2.sfxClick();
        _loadTab(_activeTab);
      });
    });
  }

  async function _loadTab(tab) {
    const content = document.getElementById('admin-content');
    content.innerHTML = '<p style="color:var(--txt-3);text-align:center;padding:20px">Loading…</p>';

    try {
      if (tab === 'players') {
        const players = await DB.adminGetAllPlayers(50);
        _renderPlayers(players, content);

      } else if (tab === 'logs') {
        const [allLogs, suspLogs] = await Promise.all([
          DB.adminGetLogs(80),
          DB.adminGetSuspiciousLogs(),
        ]);
        _renderLogs(allLogs, suspLogs, content);

      } else if (tab === 'json') {
        const players = await DB.adminGetAllPlayers(50);
        _renderJSON(players, content);
      }
    } catch(e) {
      content.innerHTML = `<p style="color:var(--red);text-align:center;padding:20px">Error: ${e.message}</p>`;
    }
  }

  function _renderPlayers(players, container) {
    container.innerHTML = '';

    const meta = document.createElement('div');
    meta.style.cssText = 'color:var(--txt-3);font-size:.75rem;margin-bottom:10px;padding:2px 4px';
    meta.textContent = `${players.length} players total`;
    container.appendChild(meta);

    players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'admin-player-row';
      const wallet = p.wallet_address ? `💼 ${p.wallet_address.slice(0,8)}…` : 'No wallet';
      row.innerHTML = `
        <div class="admin-player-info">
          <div class="admin-player-name">${p.is_banned ? '🚫 ' : ''}${p.username || 'Unknown'} <span style="color:var(--txt-3);font-size:.65rem">#${p.telegram_id}</span></div>
          <div class="admin-player-sub">
            Score: ${(p.best_score||0).toLocaleString()} · Dist: ${(p.best_distance||0).toLocaleString()}m ·
            Runs: ${p.total_runs||0} · Coins: ${(p.coins||0).toLocaleString()} · Refs: ${p.referral_count||0}
          </div>
          <div class="admin-player-sub">${wallet}</div>
        </div>
        <button class="admin-ban-btn ${p.is_banned ? 'admin-unban-btn' : ''}" data-id="${p.telegram_id}" data-banned="${p.is_banned}">
          ${p.is_banned ? 'Unban' : 'Ban'}
        </button>
      `;
      row.querySelector('.admin-ban-btn').addEventListener('click', async e => {
        const tid    = e.currentTarget.dataset.id;
        const banned = e.currentTarget.dataset.banned === 'true';
        try {
          await DB.adminBanPlayer(tid, !banned);
          p.is_banned = !banned;
          showToast(banned ? `✅ Unbanned ${p.username}` : `🚫 Banned ${p.username}`);
          _loadTab('players');
        } catch(err) { showToast('⚠️ Failed'); }
      });
      container.appendChild(row);
    });
  }

  function _renderLogs(allLogs, suspLogs, container) {
    container.innerHTML = '';

    const suspHeader = document.createElement('div');
    suspHeader.style.cssText = 'color:var(--red);font-size:.75rem;font-weight:700;margin-bottom:8px;letter-spacing:.06em';
    suspHeader.textContent = `🚨 SUSPICIOUS RUNS (${suspLogs.length})`;
    container.appendChild(suspHeader);

    suspLogs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'log-entry flag';
      entry.innerHTML = `
        <strong>#${log.telegram_id}</strong> — Score: ${log.score} · Coins: ${log.coins} · Dist: ${log.distance}m
        <br/>Flags: ${(log.flags||[]).join(', ') || 'none'}
        <div class="log-time">${new Date(log.created_at).toLocaleString()}</div>
      `;
      container.appendChild(entry);
    });

    const allHeader = document.createElement('div');
    allHeader.style.cssText = 'color:var(--txt-2);font-size:.75rem;font-weight:700;margin:14px 0 8px;letter-spacing:.06em';
    allHeader.textContent = `ALL RUNS (${allLogs.length})`;
    container.appendChild(allHeader);

    allLogs.slice(0, 60).forEach(log => {
      const entry = document.createElement('div');
      entry.className = 'log-entry' + (log.suspicious ? ' warn' : '');
      entry.innerHTML = `
        <strong>#${log.telegram_id}</strong> — Score: ${log.score} · Coins: ${log.coins} · Dist: ${log.distance}m · Duration: ${log.duration}s
        <div class="log-time">${new Date(log.created_at).toLocaleString()}${log.suspicious ? ' ⚠️' : ''}</div>
      `;
      container.appendChild(entry);
    });
  }

  function _renderJSON(players, container) {
    container.innerHTML = '';

    // Summary stats
    const stats = {
      total_players:    players.length,
      total_runs:       players.reduce((s,p) => s + (p.total_runs||0), 0),
      total_coins:      players.reduce((s,p) => s + (p.total_coins||0), 0),
      total_play_time:  players.reduce((s,p) => s + (p.total_play_time||0), 0),
      banned_count:     players.filter(p => p.is_banned).length,
      top_score:        Math.max(...players.map(p => p.best_score||0)),
      top_distance:     Math.max(...players.map(p => p.best_distance||0)),
      wallets_linked:   players.filter(p => p.wallet_address).length,
    };

    const exportBtn = document.createElement('button');
    exportBtn.className = 'char-action-btn btn-buy';
    exportBtn.style.cssText = 'width:100%;height:40px;margin-bottom:12px;border-radius:12px;font-size:.8rem';
    exportBtn.textContent = '📋 Copy Full JSON';
    exportBtn.addEventListener('click', () => {
      const json = JSON.stringify(players, null, 2);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(() => showToast('✅ JSON copied!'));
    });
    container.appendChild(exportBtn);

    const pre = document.createElement('pre');
    pre.className = 'admin-json-pre';
    pre.textContent = JSON.stringify(stats, null, 2);
    container.appendChild(pre);

    // Per-player detail
    const header = document.createElement('div');
    header.style.cssText = 'color:var(--txt-3);font-size:.72rem;margin:12px 0 8px;font-weight:700;letter-spacing:.06em';
    header.textContent = 'PER-PLAYER DETAIL';
    container.appendChild(header);

    players.slice(0, 20).forEach(p => {
      const detail = {
        id:            p.telegram_id,
        username:      p.username,
        coins:         p.coins,
        total_runs:    p.total_runs,
        total_coins:   p.total_coins,
        total_play_time_sec: p.total_play_time,
        best_score:    p.best_score,
        best_distance: p.best_distance,
        referrals:     p.referral_count,
        wallet:        p.wallet_address || null,
        banned:        p.is_banned,
        captcha_done:  p.captcha_done,
        last_seen:     p.last_seen,
      };
      const pre2 = document.createElement('pre');
      pre2.className = 'admin-json-pre';
      pre2.style.marginBottom = '8px';
      pre2.textContent = JSON.stringify(detail, null, 2);
      container.appendChild(pre2);
    });
  }

  return { init };
})();

window.Admin = Admin;
