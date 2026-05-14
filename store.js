/* ══════════════════════════════════════════════════
   STORE.JS — Store Screen: Characters · Eggs · Music
   ══════════════════════════════════════════════════ */

'use strict';

const Store = (() => {
  let _player     = null;
  let _activeTab  = 'characters';
  let _customFile = null;

  function init(player) {
    _player = player;
    _bindTabs();
    render();
  }

  function render() {
    _updateCoinChip();
    if (_activeTab === 'characters') _renderCharacters();
    else if (_activeTab === 'eggs')  _renderEggs();
    else if (_activeTab === 'special') _renderMusic();
  }

  function _updateCoinChip() {
    const el = document.getElementById('store-coins');
    if (el) el.textContent = (_player?.coins || 0).toLocaleString();
  }

  // ── Tabs ──
  function _bindTabs() {
    document.querySelectorAll('.store-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.store-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _activeTab = btn.dataset.tab;
        Audio2.sfxClick();
        render();
      });
    });
  }

  // ── Characters ──
  function _renderCharacters() {
    const body = document.getElementById('store-body');
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'store-grid';

    const owned    = _player?.owned_characters || ['og'];
    const equipped = _player?.equipped_character || 'og';

    window.ECHICK_CONFIG.CHARACTERS.forEach(char => {
      const isOwned    = owned.includes(char.id) || char.price === 0;
      const isEquipped = equipped === char.id;

      const card = document.createElement('div');
      card.className = 'char-card' + (isEquipped ? ' equipped' : '') + (isOwned && !isEquipped ? ' owned-card' : '');

      // Try PNG first, fallback to emoji
      const imgOrEmoji = `<img src="assets/char_${char.id}.png" class="char-emoji" alt="${char.name}"
        onerror="this.outerHTML='<span class=char-emoji>${char.emoji}</span>'" />`;

      card.innerHTML = `
        ${imgOrEmoji}
        <div class="char-name">${char.name}</div>
        <div class="char-ability">${char.ability}</div>
        ${isOwned
          ? `<div class="char-owned-badge">✓</div>`
          : `<div class="char-price">🪙 ${char.price.toLocaleString()}</div>`}
        <button class="char-action-btn ${isEquipped ? 'btn-equipped' : isOwned ? 'btn-equip' : 'btn-buy'}">
          ${isEquipped ? 'Equipped ✓' : isOwned ? 'Equip' : 'Buy'}
        </button>
      `;

      const btn = card.querySelector('.char-action-btn');
      btn.addEventListener('click', () => _handleCharAction(char, isOwned, isEquipped));
      grid.appendChild(card);
    });

    body.appendChild(grid);
  }

  async function _handleCharAction(char, isOwned, isEquipped) {
    Audio2.sfxClick();
    if (isEquipped) return;

    if (isOwned || char.price === 0) {
      // Equip
      try {
        await DB.equipCharacter(_player.telegram_id, char.id);
        _player.equipped_character = char.id;
        Auth.setPlayer(_player);
        const sprite = document.getElementById('chicken-sprite');
        if (sprite) sprite.textContent = char.emoji;
        showToast(`${char.emoji} ${char.name} equipped!`);
        Audio2.sfxPurchase();
        render();
      } catch(e) { showToast('⚠️ Failed to equip'); }
    } else {
      // Buy
      if ((_player?.coins || 0) < char.price) {
        showToast('🪙 Not enough coins!'); return;
      }
      try {
        await DB.spendCoins(_player.telegram_id, char.price, char.id, 'character');
        _player.coins -= char.price;
        if (!_player.owned_characters) _player.owned_characters = ['og'];
        _player.owned_characters.push(char.id);
        Auth.setPlayer(_player);
        showToast(`✅ ${char.name} unlocked!`);
        Audio2.sfxPurchase();
        render();
        HomeScreen.refreshPlayer(_player);
      } catch(e) {
        const msg = e.message === 'Not enough coins' ? '🪙 Not enough coins!' : '⚠️ Purchase failed';
        showToast(msg);
      }
    }
  }

  // ── Eggs ──
  function _renderEggs() {
    const body = document.getElementById('store-body');
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'eggs-grid';

    window.ECHICK_CONFIG.EGGS.forEach(egg => {
      const card = document.createElement('div');
      card.className = 'egg-card';
      card.innerHTML = `
        <div class="egg-icon">${egg.emoji}</div>
        <div class="egg-name">${egg.name}</div>
        <div class="egg-desc">${egg.reward}</div>
        <div class="egg-price">🪙 ${egg.price.toLocaleString()}</div>
        <button class="char-action-btn btn-buy" style="margin-top:4px">Open</button>
      `;
      card.querySelector('.char-action-btn').addEventListener('click', () => _openEgg(egg));
      grid.appendChild(card);
    });

    body.appendChild(grid);
  }

  async function _openEgg(egg) {
    Audio2.sfxClick();
    if ((_player?.coins || 0) < egg.price) { showToast('🪙 Not enough coins!'); return; }
    try {
      await DB.spendCoins(_player.telegram_id, egg.price, egg.id, 'egg');
      _player.coins -= egg.price;
      const [min, max] = egg.coins;
      const reward = min + Math.floor(Math.random() * (max - min + 1));
      // Award coins back (simulated egg reward)
      _player.coins += reward;
      await DB.submitRun(_player.telegram_id, { coins: reward, score: 0, distance: 0, duration: 0, flags: [], suspicious: false, sessionId: Date.now(), sig: '' });
      Auth.setPlayer(_player);
      showToast(`${egg.emoji} Got ${reward} coins!`);
      Audio2.sfxPowerup();
      render();
      HomeScreen.refreshPlayer(_player);
    } catch(e) { showToast('⚠️ Failed to open egg'); }
  }

  // ── Music ──
  function _renderMusic() {
    const body = document.getElementById('store-body');
    body.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'music-section';

    // Upload area
    const uploadArea = document.createElement('label');
    uploadArea.className = 'music-upload-area';
    uploadArea.htmlFor = 'music-file-input';
    uploadArea.innerHTML = `
      <div class="mu-icon">🎵</div>
      <div class="mu-title">Upload Your Music</div>
      <div class="mu-sub">Tap to pick an MP3 from your device</div>
      ${_customFile ? `<div style="color:var(--green);font-size:.8rem">✓ ${_customFile.name}</div>` : ''}
    `;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.id = 'music-file-input';
    fileInput.accept = '.mp3,audio/*'; fileInput.style.display = 'none';
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        _customFile = file;
        Audio2.loadCustom(file);
        render();
      }
    });
    uploadArea.appendChild(fileInput);
    section.appendChild(uploadArea);

    // Default track
    const trackList = document.createElement('div');
    trackList.className = 'music-track-list';
    const defaultTrack = document.createElement('div');
    defaultTrack.className = 'track-row';
    defaultTrack.innerHTML = `
      <div class="track-icon">🐓</div>
      <div class="track-info">
        <div class="track-name">ECHICK Anthem</div>
        <div class="track-sub">Default · elon.mp3</div>
      </div>
      <button class="track-play-btn" id="track-play-default">▶</button>
    `;
    defaultTrack.querySelector('#track-play-default').addEventListener('click', () => {
      Audio2.playBg();
      Audio2.sfxClick();
      showToast('🎵 Playing ECHICK Anthem');
    });
    trackList.appendChild(defaultTrack);
    section.appendChild(trackList);
    body.appendChild(section);
  }

  return { init, render };
})();

window.Store = Store;
