/* ══════════════════════════════════════════════════
   REFERRALS.JS — Referral System
   ══════════════════════════════════════════════════ */

'use strict';

const Referrals = (() => {
  let _tgUser  = null;
  let _player  = null;
  let _refLink = '';

  function init(tgUser, player) {
    _tgUser  = tgUser;
    _player  = player;
    _refLink = `https://t.me/${window.ECHICK_CONFIG.PROJECT.tgBot.replace('@','')}?start=ref_${tgUser?.id || '0'}`;
    _bindButtons();
    _render();
  }

  function load() {
    DB.getPlayer(_tgUser?.id).then(p => {
      if (p) { _player = p; Auth.setPlayer(p); }
      _render();
    }).catch(() => _render());
  }

  function _render() {
    const count  = _player?.referral_count || 0;
    const needed = window.ECHICK_CONFIG.PROJECT.referralsNeeded;
    const pct    = Math.min(100, (count / needed) * 100);

    document.getElementById('ref-big-num').textContent   = count;
    document.getElementById('ref-link-val').textContent  = _refLink;
    document.getElementById('ref-prog-fill').style.width = pct + '%';
    document.getElementById('ref-prog-text').textContent = `${count} / ${needed} required`;

    // Also update gate on home
    const gfill = document.getElementById('gate-fill');
    const gtext = document.getElementById('gate-count-text');
    if (gfill) gfill.style.width = pct + '%';
    if (gtext) gtext.textContent = `${count} / ${needed}`;
  }

  function _bindButtons() {
    document.getElementById('btn-copy-ref').addEventListener('click', _copyLink);
    document.getElementById('btn-share-ref').addEventListener('click', _shareLink);
    document.getElementById('gate-invite-btn')?.addEventListener('click', () => {
      App.navigateTo('referrals');
    });
  }

  function _copyLink() {
    Audio2.sfxClick();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(_refLink)
        .then(() => showToast('✅ Link copied!'))
        .catch(() => _fallbackCopy());
    } else {
      _fallbackCopy();
    }
  }

  function _fallbackCopy() {
    const inp = document.createElement('input');
    inp.value = _refLink;
    document.body.appendChild(inp);
    inp.select(); document.execCommand('copy');
    document.body.removeChild(inp);
    showToast('✅ Link copied!');
  }

  function _shareLink() {
    Audio2.sfxClick();
    const text = encodeURIComponent(
      `🐓 Join me on ELON CHICKEN RUN — the only chicken going to the moon faster than Musk!\n\n💰 Play, collect $ECHICK coins and climb the leaderboard!\n\n👇 Join here:\n${_refLink}`
    );
    const tg = Auth.getTg();
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(_refLink)}&text=${text}`;
    if (tg?.openLink) tg.openLink(shareUrl);
    else window.open(shareUrl, '_blank');
  }

  return { init, load };
})();

window.Referrals = Referrals;
