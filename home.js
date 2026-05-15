/* ══════════════════════════════════════════════════
   HOME.JS — Home Screen · Background Canvas · Daily Reward
   ══════════════════════════════════════════════════ */

'use strict';

const HomeScreen = (() => {
  let _player = null;
  let _tgUser = null;
  let _bgCanvas = null;
  let _bgCtx    = null;
  let _bgAnim   = null;
  let _particles = [];
  let _stars    = [];
  let _t        = 0;
  let _heroTaps  = 0;
  let _dailyInterval = null;

  function init(tgUser, player) {
    _tgUser = tgUser;
    _player = player;

    _render();
    _initBgCanvas();
    _spawnParticles();
    _initHeroTap();
    _bindButtons();
    _startDailyTimer();
  }

  function _render() {
    if (!_player) return;
    document.getElementById('home-username').textContent = _player.display_name || _player.username || 'ChickenKing';
    document.getElementById('home-coin-count').textContent = (_player.coins || 0).toLocaleString();
    document.getElementById('home-top-run').textContent = (_player.best_distance || 0).toLocaleString() + ' M';
    document.getElementById('home-total-eggs').textContent = (_player.total_coins || 0).toLocaleString();

    // Avatar
    if (_tgUser?.photo_url) {
      const av = document.getElementById('home-avatar');
      av.innerHTML = `<img src="${_tgUser.photo_url}" alt="avatar"/>`;
    }

    // Equipped character emoji
    const charId = _player.equipped_character || 'og';
    const char = window.ECHICK_CONFIG.CHARACTERS.find(c => c.id === charId);
    // Update hero character — try PNG first, fall back to SVG emoji
    const charId2 = charId;
    const heroImg = document.getElementById('hero-char-img');
    const heroSvg = document.getElementById('hero-char-svg');
    const spriteEl = document.getElementById('chicken-sprite');
    if (heroImg) {
      heroImg.src = `assets/char_${charId2}.png`;
      heroImg.style.display = 'block';
      heroImg.onerror = () => {
        heroImg.style.display = 'none';
        if (heroSvg) heroSvg.style.display = 'block';
      };
      heroImg.onload = () => {
        heroImg.style.display = 'block';
        if (heroSvg) heroSvg.style.display = 'none';
      };
    }
    if (spriteEl && char) spriteEl.textContent = char.emoji; // legacy fallback

    // XP bar (cosmetic — based on total_runs)
    const xpPct = Math.min(100, ((_player.total_runs || 0) % 20) * 5);
    document.getElementById('home-xp-fill').style.width = xpPct + '%';

    // Check referral gate
    _checkReferralGate();
  }

  function refreshPlayer(player) {
    _player = player;
    _render();
  }

  function _checkReferralGate() {
    if (!_player) return;
    const count = _player.referral_count || 0;
    const needed = window.ECHICK_CONFIG.PROJECT.referralsNeeded;
    const gate = document.getElementById('referral-gate');

    if (count < needed && !_player.is_banned) {
      gate.classList.remove('hidden');
      const pct = Math.min(100, (count / needed) * 100);
      document.getElementById('gate-fill').style.width = pct + '%';
      document.getElementById('gate-count-text').textContent = `${count} / ${needed}`;
    } else {
      gate.classList.add('hidden');
    }
  }

  function _bindButtons() {
    document.getElementById('btn-play').addEventListener('click', () => {
      Audio2.sfxClick();
      const count = _player?.referral_count || 0;
      const needed = window.ECHICK_CONFIG.PROJECT.referralsNeeded;
      if (count < needed) {
        document.getElementById('referral-gate').classList.remove('hidden');
        return;
      }
      App.navigateTo('game');
      GameEngine.start(_player);
    });

    document.getElementById('gate-invite-btn').addEventListener('click', () => {
      Audio2.sfxClick();
      App.navigateTo('referrals');
    });

    document.getElementById('gate-join-btn').addEventListener('click', () => {
      Audio2.sfxClick();
      const tg = Auth.getTg();
      if (tg?.openLink) tg.openLink(window.ECHICK_CONFIG.PROJECT.tgGroup);
      else window.open(window.ECHICK_CONFIG.PROJECT.tgGroup, '_blank');
    });

    document.getElementById('home-settings-btn').addEventListener('click', () => {
      Audio2.sfxClick();
      App.navigateTo('settings');
    });

    document.getElementById('daily-reward-chip').addEventListener('click', () => {
      Audio2.sfxPowerup();
      showToast('🎁 Daily reward coming soon!');
    });

    document.getElementById('free-eggs-chip').addEventListener('click', () => {
      Audio2.sfxClick();
      showToast('🥚 Watch ad to earn eggs!');
    });
  }

  // ─── Hero tap (secret triple-tap for admin) ───
  function _initHeroTap() {
    const hero = document.getElementById('hero-chicken');
    let _tapTimer = null;
    hero.addEventListener('click', () => {
      _heroTaps++;
      Audio2.sfxCoin();
      _showFloatingCoin(hero);
      clearTimeout(_tapTimer);
      _tapTimer = setTimeout(() => { _heroTaps = 0; }, 1000);
      if (_heroTaps >= 7) {
        _heroTaps = 0;
        document.getElementById('admin-modal').classList.remove('hidden');
        Audio2.sfxPowerup();
      }
    });
  }

  function _showFloatingCoin(el) {
    const rect = el.getBoundingClientRect();
    const fc = document.createElement('div');
    fc.textContent = '🪙';
    fc.style.cssText = `position:fixed;left:${rect.left+rect.width/2}px;top:${rect.top}px;font-size:1.3rem;
      pointer-events:none;z-index:9000;animation:floatCoinUp 0.8s ease-out forwards;`;
    document.body.appendChild(fc);
    setTimeout(() => fc.remove(), 800);
    if (!document.getElementById('floatCoinStyle')) {
      const s = document.createElement('style');
      s.id = 'floatCoinStyle';
      s.textContent = '@keyframes floatCoinUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(0.6)}}';
      document.head.appendChild(s);
    }
  }

  // ─── Daily timer countdown ───
  function _startDailyTimer() {
    const el = document.getElementById('daily-timer');
    if (!el) return;
    clearInterval(_dailyInterval);
    let secs = 25 * 3600 + 59 * 60 + 59;
    _dailyInterval = setInterval(() => {
      if (secs <= 0) { secs = 24 * 3600; return; }
      secs--;
      const h = String(Math.floor(secs/3600)).padStart(2,'0');
      const m = String(Math.floor((secs%3600)/60)).padStart(2,'0');
      const s = String(secs%60).padStart(2,'0');
      el.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }

  // ─── Background Canvas (Miami sunset parallax) ───
  let _bgImg = null;
  function _initBgCanvas() {
    _bgCanvas = document.getElementById('bg-canvas');
    if (!_bgCanvas) return;
    _bgCtx = _bgCanvas.getContext('2d');
    // Try to load the real Miami road photo
    _bgImg = new Image();
    _bgImg.src = 'assets/bg_miami.png';
    _bgImg.onerror = () => { _bgImg = null; };
    _resize();
    window.addEventListener('resize', _resize);
    _buildStars();
    _bgLoop();
  }

  function _resize() {
    if (!_bgCanvas) return;
    _bgCanvas.width  = window.innerWidth;
    _bgCanvas.height = window.innerHeight;
    _buildStars();
  }

  function _buildStars() {
    if (!_bgCanvas) return;
    _stars = Array.from({length:60}, () => ({
      x: Math.random() * _bgCanvas.width,
      y: Math.random() * _bgCanvas.height * 0.5,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random(),
      speed: 0.003 + Math.random() * 0.005,
    }));
  }

  function _bgLoop() {
    _bgAnim = requestAnimationFrame(_bgLoop);
    _drawBg();
    _t += 0.008;
  }

  function _drawBg() {
    if (!_bgCtx || !_bgCanvas) return;
    const W = _bgCanvas.width, H = _bgCanvas.height;

    // If real Miami road photo is loaded, use it
    if (_bgImg && _bgImg.complete && _bgImg.naturalWidth > 0) {
      _bgCtx.drawImage(_bgImg, 0, 0, W, H);
      const vig = _bgCtx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*0.85);
      vig.addColorStop(0,'rgba(0,0,0,0.1)'); vig.addColorStop(1,'rgba(0,0,0,0.65)');
      _bgCtx.fillStyle = vig; _bgCtx.fillRect(0,0,W,H);
      const top = _bgCtx.createLinearGradient(0,0,0,H*0.32);
      top.addColorStop(0,'rgba(8,8,20,0.85)'); top.addColorStop(1,'rgba(0,0,0,0)');
      _bgCtx.fillStyle = top; _bgCtx.fillRect(0,0,W,H);
      const bot = _bgCtx.createLinearGradient(0,H*0.52,0,H);
      bot.addColorStop(0,'rgba(8,8,20,0)'); bot.addColorStop(1,'rgba(8,8,20,0.96)');
      _bgCtx.fillStyle = bot; _bgCtx.fillRect(0,0,W,H);
      const gl = _bgCtx.createRadialGradient(W*0.5,H*0.36,0,W*0.5,H*0.36,110);
      gl.addColorStop(0,`rgba(255,220,80,${0.07+0.04*Math.sin(_t*1.2)})`);
      gl.addColorStop(1,'rgba(255,180,0,0)');
      _bgCtx.fillStyle = gl; _bgCtx.beginPath(); _bgCtx.arc(W*0.5,H*0.36,110,0,Math.PI*2); _bgCtx.fill();
      return;
    }

    // Sky gradient — Miami sunset
    const sky = _bgCtx.createLinearGradient(0, 0, 0, H * 0.65);
    sky.addColorStop(0, '#0a0510');
    sky.addColorStop(0.3, '#1a0a2e');
    sky.addColorStop(0.6, '#3d1c5e');
    sky.addColorStop(0.85, '#c45c2a');
    sky.addColorStop(1, '#f5a034');
    _bgCtx.fillStyle = sky;
    _bgCtx.fillRect(0, 0, W, H);

    // Sun
    const sunY = H * 0.55 + Math.sin(_t * 0.2) * 4;
    const sunGrad = _bgCtx.createRadialGradient(W/2, sunY, 0, W/2, sunY, 80);
    sunGrad.addColorStop(0, 'rgba(255,220,80,0.95)');
    sunGrad.addColorStop(0.4, 'rgba(255,140,60,0.6)');
    sunGrad.addColorStop(1, 'rgba(255,80,0,0)');
    _bgCtx.fillStyle = sunGrad;
    _bgCtx.beginPath(); _bgCtx.arc(W/2, sunY, 80, 0, Math.PI*2); _bgCtx.fill();

    // Stars
    _stars.forEach(s => {
      s.a += s.speed; if (s.a > 1) s.a = 0;
      const alpha = Math.abs(Math.sin(s.a * Math.PI));
      _bgCtx.fillStyle = `rgba(255,255,220,${alpha * 0.8})`;
      _bgCtx.beginPath(); _bgCtx.arc(s.x, s.y, s.r, 0, Math.PI*2); _bgCtx.fill();
    });

    // Palm tree silhouettes
    _drawPalm(_bgCtx, W * 0.08, H * 0.72, 0.7, _t);
    _drawPalm(_bgCtx, W * 0.88, H * 0.68, 0.9, _t * 0.8);
    _drawPalm(_bgCtx, W * 0.02, H * 0.78, 0.5, _t * 1.1);
    _drawPalm(_bgCtx, W * 0.95, H * 0.75, 0.6, _t * 0.9);

    // Road / ground
    const roadGrad = _bgCtx.createLinearGradient(0, H*0.7, 0, H);
    roadGrad.addColorStop(0, '#1a1a28');
    roadGrad.addColorStop(1, '#0d0d14');
    _bgCtx.fillStyle = roadGrad;
    _bgCtx.fillRect(0, H * 0.7, W, H * 0.3);

    // Road lines
    _bgCtx.strokeStyle = 'rgba(245,200,66,0.25)';
    _bgCtx.lineWidth = 2;
    _bgCtx.setLineDash([30, 20]);
    _bgCtx.lineDashOffset = -_t * 40;
    _bgCtx.beginPath();
    _bgCtx.moveTo(W/2 - 60, H * 0.7);
    _bgCtx.lineTo(W/2 - 100, H);
    _bgCtx.stroke();
    _bgCtx.beginPath();
    _bgCtx.moveTo(W/2 + 60, H * 0.7);
    _bgCtx.lineTo(W/2 + 100, H);
    _bgCtx.stroke();
    _bgCtx.setLineDash([]);

    // Ocean reflection
    const waterGrad = _bgCtx.createLinearGradient(0, H*0.6, 0, H*0.7);
    waterGrad.addColorStop(0, 'rgba(30,60,120,0.0)');
    waterGrad.addColorStop(1, 'rgba(30,60,120,0.18)');
    _bgCtx.fillStyle = waterGrad;
    _bgCtx.fillRect(0, H*0.6, W, H*0.1);

    // Lens flare
    const lf = _bgCtx.createRadialGradient(W*0.55, H*0.52, 0, W*0.55, H*0.52, 40);
    lf.addColorStop(0, `rgba(255,240,180,${0.08 + 0.04*Math.sin(_t*2)})`);
    lf.addColorStop(1, 'rgba(255,200,100,0)');
    _bgCtx.fillStyle = lf;
    _bgCtx.beginPath(); _bgCtx.ellipse(W*0.55, H*0.52, 40, 20, 0, 0, Math.PI*2); _bgCtx.fill();
  }

  function _drawPalm(ctx, x, y, scale, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // Trunk
    ctx.strokeStyle = 'rgba(30,20,10,0.85)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-10, -40, 10, -80, 5 + Math.sin(t)*3, -120);
    ctx.stroke();
    // Fronds
    ctx.strokeStyle = 'rgba(10,40,10,0.75)';
    ctx.lineWidth = 4;
    const baseX = 5 + Math.sin(t)*3;
    const baseY = -120;
    const fronds = [[-50,-20],[50,-10],[-60,10],[60,20],[-30,-40],[30,-35]];
    fronds.forEach(([fx,fy]) => {
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      const sway = Math.sin(t + fx * 0.03) * 5;
      ctx.quadraticCurveTo(baseX + fx/2, baseY + fy/2, baseX + fx + sway, baseY + fy);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ─── Floating particles ───
  function _spawnParticles() {
    const container = document.getElementById('hero-particles');
    if (!container) return;
    setInterval(() => {
      if (document.getElementById('screen-home').classList.contains('active')) {
        const p = document.createElement('div');
        p.className = 'hpart';
        p.style.cssText = `
          left:${30 + Math.random()*40}%;
          bottom:30%;
          --dx:${(Math.random()-0.5)*60}px;
          animation-duration:${1.5+Math.random()*1.5}s;
          animation-delay:0s;
          width:${3+Math.random()*3}px;
          height:${3+Math.random()*3}px;
          background:${Math.random()>0.5?'var(--gold)':'var(--orange)'};
        `;
        container.appendChild(p);
        setTimeout(() => p.remove(), 3000);
      }
    }, 300);
  }

  return { init, refreshPlayer };
})();

window.HomeScreen = HomeScreen;
