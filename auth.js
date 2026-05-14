/* ══════════════════════════════════════════════════
   AUTH.JS — Telegram SDK · Captcha · Boot Flow
   ══════════════════════════════════════════════════ */

'use strict';

const Auth = (() => {
  let _tgUser   = null;
  let _dbPlayer = null;
  let _tg       = null;
  let _refCode  = null;

  // ─── Captcha config ───
  const CAPTCHA_ITEMS = [
    { emoji:'🐓', isChicken: true  },
    { emoji:'🐔', isChicken: true  },
    { emoji:'🦅', isChicken: false },
    { emoji:'🐧', isChicken: false },
    { emoji:'🦆', isChicken: false },
    { emoji:'🐦', isChicken: false },
    { emoji:'🦉', isChicken: false },
    { emoji:'🥚', isChicken: false },
    { emoji:'🐣', isChicken: true  },
  ];

  function _shuffled(arr) {
    const a = [...arr]; for (let i = a.length-1; i>0; i--) { const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a;
  }

  // ─── Main boot ───
  async function boot() {
    _updateBootText('a believer is here');
    await _sleep(600);

    // Init Supabase
    DB.init();
    Audio2.loadDefault();

    // Init Telegram WebApp
    _tg = window.Telegram?.WebApp;
    if (_tg) {
      _tg.ready();
      _tg.expand();
      _tg.setHeaderColor('#0d0d14');
      _tg.setBackgroundColor('#0d0d14');
      _tgUser = _tg.initDataUnsafe?.user || null;

      // Parse start param for referral
      const startParam = _tg.initDataUnsafe?.start_param || '';
      if (startParam.startsWith('ref_')) {
        _refCode = startParam.replace('ref_', '');
      }
    }

    // Fallback for dev/testing outside Telegram
    if (!_tgUser) {
      _tgUser = { id: 999999 + Math.floor(Math.random()*1000), first_name: 'TestUser', username: 'testchicken', language_code: 'en' };
    }

    _updateBootText('loading your profile');
    await _sleep(400);

    // Load/create player from DB
    try {
      _dbPlayer = await DB.getOrCreatePlayer(_tgUser);
    } catch(e) {
      console.error('[Auth] DB error', e);
      _dbPlayer = _makeFallbackPlayer(_tgUser);
    }

    // Record referral if came via ref link
    if (_refCode && _refCode !== String(_tgUser.id)) {
      DB.recordReferral(_refCode, _tgUser.id).catch(() => {});
    }

    // Check if captcha needed
    const captchaDone = _dbPlayer?.captcha_done === true;
    _updateBootText('almost there');
    await _sleep(400);

    // Fade out loader
    const loader = document.getElementById('sdk-loader');
    loader.classList.add('fade-out');
    await _sleep(700);
    loader.classList.add('hidden');

    if (!captchaDone) {
      await _showCaptcha();
      try { await DB.markCaptchaDone(_tgUser.id); } catch(e){}
    }

    return { tgUser: _tgUser, dbPlayer: _dbPlayer };
  }

  // ─── Captcha UI ───
  function _showCaptcha() {
    return new Promise(resolve => {
      const overlay = document.getElementById('captcha-overlay');
      const grid    = document.getElementById('captcha-grid');
      const hint    = document.getElementById('captcha-hint');
      const btn     = document.getElementById('captcha-submit');

      const items    = _shuffled(CAPTCHA_ITEMS);
      const selected = new Set();

      overlay.classList.remove('hidden');
      grid.innerHTML = '';

      items.forEach((item, i) => {
        const cell = document.createElement('div');
        cell.className = 'cap-cell';
        cell.textContent = item.emoji;
        cell.addEventListener('click', () => {
          Audio2.sfxClick();
          if (selected.has(i)) { selected.delete(i); cell.classList.remove('selected'); }
          else                  { selected.add(i);    cell.classList.add('selected'); }
          hint.textContent = selected.size ? `${selected.size} selected` : '';
        });
        grid.appendChild(cell);
      });

      btn.onclick = () => {
        const correctCount  = items.filter(it => it.isChicken).length;
        const selectedItems = [...selected].map(i => items[i]);
        const correctSel    = selectedItems.filter(it => it.isChicken).length;
        const wrongSel      = selectedItems.filter(it => !it.isChicken).length;

        if (correctSel === correctCount && wrongSel === 0) {
          Audio2.sfxPowerup();
          overlay.classList.add('hidden');
          resolve(true);
        } else {
          hint.textContent = '❌ Try again — select ALL chickens!';
          hint.style.color = 'var(--red)';
          [...grid.children].forEach(c => c.classList.remove('selected'));
          selected.clear();
          setTimeout(() => { hint.textContent=''; hint.style.color=''; }, 2000);
        }
      };
    });
  }

  function _makeFallbackPlayer(u) {
    return {
      telegram_id: String(u.id),
      username: u.username || u.first_name || 'Anonymous',
      display_name: u.first_name || 'Chicken',
      coins: 0, total_coins: 0, best_score: 0, best_distance: 0,
      total_runs: 0, total_play_time: 0,
      owned_characters: ['og'], equipped_character: 'og',
      referral_count: 0, is_banned: false, captcha_done: false,
    };
  }

  function _updateBootText(txt) {
    const el = document.getElementById('boot-text');
    if (el) el.textContent = txt;
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getUser()   { return _tgUser; }
  function getPlayer() { return _dbPlayer; }
  function setPlayer(p){ _dbPlayer = p; }
  function getTg()     { return _tg; }
  function getRefCode(){ return _refCode; }

  return { boot, getUser, getPlayer, setPlayer, getTg, getRefCode };
})();

window.Auth = Auth;
