/* ══════════════════════════════════════════════════
   SETTINGS.JS — Audio · Graphics · Wallet · Links
   ══════════════════════════════════════════════════ */

'use strict';

const Settings = (() => {
  let _player  = null;
  let _tgUser  = null;

  function init(tgUser, player) {
    _tgUser  = tgUser;
    _player  = player;
    _render();
    _bindEvents();
  }

  function _render() {
    // Telegram status
    const tgStatus = document.getElementById('tg-connect-status');
    if (tgStatus) tgStatus.textContent = _tgUser ? 'Connected ✓' : 'Not connected';

    // User ID
    const uidEl = document.getElementById('tg-user-id');
    if (uidEl) uidEl.textContent = '#' + (_tgUser?.id || '0000000');

    // Wallet
    const walletEl = document.getElementById('wallet-display');
    if (walletEl) {
      const w = _player?.wallet_address || '';
      walletEl.textContent = w ? (w.slice(0,6) + '…' + w.slice(-4)) : 'Not set';
    }

    // CA copy
    document.getElementById('stc-ca').onclick = () => {
      const ca = window.ECHICK_CONFIG.PROJECT.ca;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(ca).then(() => showToast('✅ CA copied!'));
      }
      Audio2.sfxClick();
    };
  }

  function _bindEvents() {
    // Music volume
    document.getElementById('music-vol').addEventListener('input', e => {
      Audio2.setMusicVol(Number(e.target.value));
    });

    // SFX volume
    document.getElementById('sfx-vol').addEventListener('input', e => {
      Audio2.setSfxVol(Number(e.target.value));
    });

    // Quality segment
    document.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Audio2.sfxClick();
        showToast(`Graphics: ${btn.dataset.q}`);
      });
    });

    // Motion blur toggle
    document.getElementById('toggle-blur').addEventListener('change', e => {
      Audio2.sfxClick();
      showToast(e.target.checked ? '✅ Motion blur on' : 'Motion blur off');
    });

    // Wallet edit
    document.getElementById('btn-edit-wallet').addEventListener('click', () => {
      Audio2.sfxClick();
      const form = document.getElementById('wallet-form');
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) {
        document.getElementById('wallet-input').value = _player?.wallet_address || '';
        document.getElementById('wallet-input').focus();
      }
    });

    // Save wallet
    document.getElementById('btn-save-wallet').addEventListener('click', async () => {
      Audio2.sfxClick();
      const val = document.getElementById('wallet-input').value.trim();
      if (!val) { showToast('⚠️ Enter a wallet address'); return; }
      if (val.length < 32) { showToast('⚠️ Invalid Solana address'); return; }
      try {
        await DB.saveWallet(_player.telegram_id, val);
        _player.wallet_address = val;
        Auth.setPlayer(_player);
        document.getElementById('wallet-form').classList.add('hidden');
        _render();
        showToast('✅ Wallet saved!');
      } catch(e) { showToast('⚠️ Failed to save wallet'); }
    });

    // Music upload (settings screen)
    const musicUpload = document.getElementById('music-upload');
    if (musicUpload) {
      musicUpload.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) { Audio2.loadCustom(file); showToast('🎵 Custom track loaded!'); }
      });
    }

    // Links
    document.getElementById('link-twitter').addEventListener('click', () => {
      Audio2.sfxClick();
      const tg = Auth.getTg();
      const url = window.ECHICK_CONFIG.PROJECT.twitter;
      if (tg?.openLink) tg.openLink(url); else window.open(url, '_blank');
    });

    document.getElementById('link-community').addEventListener('click', () => {
      Audio2.sfxClick();
      const tg = Auth.getTg();
      const url = window.ECHICK_CONFIG.PROJECT.tgGroup;
      if (tg?.openLink) tg.openLink(url); else window.open(url, '_blank');
    });
  }

  return { init };
})();

window.Settings = Settings;
