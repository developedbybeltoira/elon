/* ══════════════════════════════════════════════════
   APP.JS — Navigation · Init · Toast · Global State
   ══════════════════════════════════════════════════ */

'use strict';

const App = (() => {
  let _currentScreen = 'home';
  let _screens = {};
  let _navBtns = {};
  let _indicator = null;
  let _toastTimer = null;

  // ─── Init ───
  async function init() {
    // Boot auth (SDK + DB + captcha)
    let result;
    try {
      result = await Auth.boot();
    } catch(e) {
      console.error('[App] Boot failed', e);
      showToast('⚠️ Connection error. Please try again.');
      return;
    }

    // Show app
    const appEl = document.getElementById('app');
    appEl.classList.remove('hidden');

    // Cache DOM
    _indicator = document.getElementById('nav-indicator');
    document.querySelectorAll('.screen').forEach(s => _screens[s.dataset.screen] = s);
    document.querySelectorAll('.nav-btn').forEach(btn => {
      _navBtns[btn.dataset.nav] = btn;
      btn.addEventListener('click', () => {
        Audio2.sfxClick();
        navigateTo(btn.dataset.nav);
      });
    });

    // Init all modules
    HomeScreen.init(result.tgUser, result.dbPlayer);
    Store.init(result.dbPlayer);
    Leaderboard.init(result.tgUser);
    Referrals.init(result.tgUser, result.dbPlayer);
    Settings.init(result.tgUser, result.dbPlayer);
    Admin.init();

    // Start home screen (with background)
    navigateTo('home');
    _positionIndicator('home');

    // Background music on first interaction
    document.addEventListener('touchstart', () => { if (!Audio2.getPlaying()) Audio2.playBg(); }, { once: true });
    document.addEventListener('click', () => { if (!Audio2.getPlaying()) Audio2.playBg(); }, { once: true });
  }

  // ─── Navigation ───
  function navigateTo(screen) {
    if (screen === _currentScreen && screen !== 'home') return;

    // Hide game nav when in-game
    const nav = document.getElementById('bottom-nav');
    nav.style.display = screen === 'game' ? 'none' : '';

    // Screen transition
    if (_screens[_currentScreen]) _screens[_currentScreen].classList.remove('active');
    if (_screens[screen])         _screens[screen].classList.add('active');
    _currentScreen = screen;

    // Nav indicator
    Object.values(_navBtns).forEach(b => b.classList.remove('active'));
    if (_navBtns[screen]) {
      _navBtns[screen].classList.add('active');
      _positionIndicator(screen);
    }

    // Screen-specific load
    if (screen === 'leaderboard') Leaderboard.load();
    if (screen === 'store')       Store.render();
    if (screen === 'referrals')   Referrals.load();
  }

  function _positionIndicator(screen) {
    const btn = _navBtns[screen];
    if (!btn || !_indicator) return;
    const nav  = document.getElementById('bottom-nav');
    const br   = nav.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    _indicator.style.left  = (btnR.left - br.left + 4) + 'px';
    _indicator.style.width = (btnR.width - 8) + 'px';
  }

  function currentScreen() { return _currentScreen; }

  // ─── Toast ───
  function showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    requestAnimationFrame(() => { requestAnimationFrame(() => { el.classList.add('show'); }); });
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, duration);
  }

  // Make toast globally accessible
  window.showToast = showToast;

  return { init, navigateTo, currentScreen };
})();

// ─── Boot on DOM ready ───
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
