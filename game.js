/* ══════════════════════════════════════════════════
   GAME.JS — Full Canvas Game Engine
   Runner game: jump/duck, collect coins, dodge obstacles
   ══════════════════════════════════════════════════ */

'use strict';

const GameEngine = (() => {
  // ── Canvas & context
  let _cv = null, _ctx = null;
  let _W = 0, _H = 0;

  // ── Game state
  let _state    = 'idle'; // idle | running | paused | dead
  let _raf      = null;
  let _lastTime = 0;

  // ── Player
  let _player = null;
  let _char   = null;
  let _charImg = null; // PNG sprite if available

  // ── Physics
  const GROUND_H = 0.72; // fraction of canvas height
  let _groundY   = 0;
  const GRAVITY   = 2400; // px/s²
  const JUMP_VEL  = -820;
  const DUCK_H    = 0.55; // fraction of normal height

  // ── Runner object
  let _runner = {
    x: 0, y: 0,
    vy: 0,
    w: 60, h: 90,
    grounded: true,
    jumping: false,
    doubleJumped: false,
    ducking: false,
    invincible: false,
    invincibleTimer: 0,
    blinkTimer: 0,
  };

  // ── Score / currency
  let _score    = 0;
  let _coins    = 0;
  let _distance = 0;
  let _combo    = 1;
  let _comboTimer = 0;

  // ── Speed
  let _speed     = 280; // px/s starting
  const SPEED_MAX = 700;
  const SPEED_INC = 4;   // per second

  // ── Environment
  let _envIndex  = 0;
  let _envBgImg  = null;
  let _bgImages  = {};
  let _bgLoaded  = {};

  // ── Obstacles & coins
  let _obstacles = [];
  let _coinItems = [];
  let _obstTimer = 0;
  let _obstInterval = 1.8; // seconds
  let _coinTimer = 0;

  // ── Powerups
  let _powerups  = []; // active powerup effects
  let _puItems   = []; // spawned on track

  // ── Layers (parallax)
  let _layers = [];

  // ── Session (anti-cheat)
  let _secSession = null;
  let _lastValidation = 0;
  let _deltaCoinsSinceVal = 0;
  let _deltaScoreSinceVal = 0;
  let _deltaDistSinceVal  = 0;

  // ── HUD elements (cached)
  let _hudDist, _hudScore, _hudCoins, _hudCombo, _comboVal,
      _speedFill, _powerupRow, _gamePopup;

  // ─────────────────────────────────────────────
  //  PUBLIC: start
  // ─────────────────────────────────────────────
  function start(playerData) {
    _player = playerData;
    _cv  = document.getElementById('game-canvas');
    _ctx = _cv.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);

    // Cache HUD
    _hudDist    = document.getElementById('hud-distance');
    _hudScore   = document.getElementById('hud-score');
    _hudCoins   = document.getElementById('hud-coins');
    _hudCombo   = document.getElementById('hud-combo');
    _comboVal   = document.getElementById('combo-val');
    _speedFill  = document.getElementById('speed-fill');
    _powerupRow = document.getElementById('powerup-row');
    _gamePopup  = document.getElementById('game-popup');

    // Character
    const charId = _player?.equipped_character || 'og';
    _char = window.ECHICK_CONFIG.CHARACTERS.find(c => c.id === charId)
          || window.ECHICK_CONFIG.CHARACTERS[0];
    _tryLoadCharSprite();

    // Choose random environment
    _envIndex = Math.floor(Math.random() * window.ECHICK_CONFIG.ENVIRONMENTS.length);
    _preloadEnvImages();

    // Reset state
    _reset();

    // Start security session
    _secSession = Security.startSession();

    // Touch / keyboard
    _bindInput();

    // Pause / resume buttons
    document.getElementById('btn-pause').onclick   = pause;
    document.getElementById('btn-resume').onclick  = resume;
    document.getElementById('btn-quit').onclick    = () => { _quit(); };
    document.getElementById('btn-replay').onclick  = () => { _hideGameOver(); start(playerData); };
    document.getElementById('btn-go-home').onclick = () => { _hideGameOver(); App.navigateTo('home'); };

    _state = 'running';
    _lastTime = performance.now();
    cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(_loop);

    Audio2.playBg();
  }

  // ─────────────────────────────────────────────
  //  Reset all game vars
  // ─────────────────────────────────────────────
  function _reset() {
    _groundY  = _H * GROUND_H;
    _score    = 0; _coins = 0; _distance = 0;
    _combo    = 1; _comboTimer = 0;
    _speed    = 280;
    _obstacles = []; _coinItems = []; _puItems = [];
    _powerups  = [];
    _obstTimer = 0; _coinTimer = 0;
    _deltaCoinsSinceVal = 0; _deltaScoreSinceVal = 0; _deltaDistSinceVal = 0;
    _lastValidation = performance.now();

    _runner.x         = _W * 0.18;
    _runner.y         = _groundY - _runner.h;
    _runner.vy        = 0;
    _runner.grounded  = true;
    _runner.jumping   = false;
    _runner.doubleJumped = false;
    _runner.ducking   = false;
    _runner.invincible = false;
    _runner.invincibleTimer = 0;

    _buildLayers();
    _powerupRow.innerHTML = '';
    _gamePopup.innerHTML  = '';
    document.getElementById('hud-combo').classList.add('hidden');
  }

  // ─────────────────────────────────────────────
  //  Main loop
  // ─────────────────────────────────────────────
  function _loop(now) {
    if (_state !== 'running') return;
    _raf = requestAnimationFrame(_loop);

    const dt = Math.min((now - _lastTime) / 1000, 0.05);
    _lastTime = now;

    _update(dt);
    _draw();
    _updateHUD();

    // Anti-cheat periodic check every 3 seconds
    if (now - _lastValidation > 3000) {
      Security.validateTick(_deltaCoinsSinceVal, _deltaScoreSinceVal, _deltaDistSinceVal);
      _deltaCoinsSinceVal = _deltaScoreSinceVal = _deltaDistSinceVal = 0;
      _lastValidation = now;
    }
  }

  // ─────────────────────────────────────────────
  //  Update
  // ─────────────────────────────────────────────
  function _update(dt) {
    // Speed ramp
    if (_speed < SPEED_MAX) _speed += SPEED_INC * dt;

    // Distance
    const distDelta = _speed * dt / 10;
    _distance += distDelta;
    _deltaDistSinceVal += distDelta;

    // Score
    const scoreDelta = Math.floor(_speed * dt * 0.5 * _combo);
    _score += scoreDelta;
    _deltaScoreSinceVal += scoreDelta;

    // Combo decay
    if (_combo > 1) {
      _comboTimer -= dt;
      if (_comboTimer <= 0) { _combo = 1; _comboTimer = 0; document.getElementById('hud-combo').classList.add('hidden'); }
    }

    // Runner physics
    _updateRunner(dt);

    // Layers
    _layers.forEach(l => { l.x -= l.speed * _speed * dt; if (l.x < -l.w) l.x = _W; });

    // Spawn obstacles
    _obstTimer -= dt;
    if (_obstTimer <= 0) {
      _spawnObstacle();
      _obstInterval = Math.max(0.6, 1.8 - _distance / 5000);
      _obstTimer = _obstInterval + (Math.random() * 0.4 - 0.2);
    }

    // Spawn coins
    _coinTimer -= dt;
    if (_coinTimer <= 0) {
      _spawnCoinRow();
      _coinTimer = 0.6 + Math.random() * 0.5;
    }

    // Move obstacles
    _obstacles = _obstacles.filter(o => {
      o.x -= _speed * dt;
      return o.x > -200;
    });

    // Move coins
    _coinItems = _coinItems.filter(c => {
      c.x -= _speed * dt;
      if (!c.collected && _collides(_runner, c)) {
        _collectCoin(c);
        return false;
      }
      return c.x > -100;
    });

    // Move powerup items
    _puItems = _puItems.filter(p => {
      p.x -= _speed * dt;
      if (!p.collected && _collides(_runner, p)) {
        _activatePowerup(p);
        return false;
      }
      return p.x > -100;
    });

    // Powerup timers
    _powerups = _powerups.filter(p => {
      p.timeLeft -= dt;
      if (p.timeLeft <= 0) { _deactivatePowerup(p); return false; }
      return true;
    });

    // Obstacle collision
    if (!_runner.invincible) {
      for (const o of _obstacles) {
        if (_collides(_runner, o)) {
          if (_hasPowerup('shield')) {
            _removePowerup('shield');
            _runner.invincible = true; _runner.invincibleTimer = 1.5;
            _showPopup('🛡️ Shield!');
          } else {
            _die(); return;
          }
        }
      }
    }

    // Invincibility timer
    if (_runner.invincible) {
      _runner.invincibleTimer -= dt;
      _runner.blinkTimer += dt;
      if (_runner.invincibleTimer <= 0) { _runner.invincible = false; _runner.blinkTimer = 0; }
    }

    // Spawn powerup item occasionally
    if (Math.random() < 0.003) _spawnPowerupItem();
  }

  function _updateRunner(dt) {
    if (!_runner.grounded) {
      _runner.vy += GRAVITY * dt;
      _runner.y  += _runner.vy * dt;
    }
    const targetH = _runner.ducking ? _runner.h * DUCK_H : (_charImg ? 90 : 80);
    const groundY = _groundY - targetH;
    if (_runner.y >= groundY) {
      _runner.y = groundY;
      _runner.vy = 0;
      _runner.grounded  = true;
      _runner.jumping   = false;
      _runner.doubleJumped = false;
    }
  }

  // ─────────────────────────────────────────────
  //  Draw
  // ─────────────────────────────────────────────
  function _draw() {
    if (!_ctx) return;
    _ctx.clearRect(0, 0, _W, _H);

    // Background
    _drawBackground();

    // Ground
    _drawGround();

    // Coin items
    _coinItems.forEach(c => _drawCoin(c));

    // Powerup items on track
    _puItems.forEach(p => _drawPuItem(p));

    // Obstacles
    _obstacles.forEach(o => _drawObstacle(o));

    // Runner
    _drawRunner();

    // Particles / effects
    _drawEffects();
  }

  function _drawBackground() {
    const env = window.ECHICK_CONFIG.ENVIRONMENTS[_envIndex];
    const img = _bgImages[env.id];

    if (img && img.complete && img.naturalWidth > 0) {
      // Draw tiled scrolling bg
      _ctx.drawImage(img, 0, 0, _W, _H * GROUND_H + 20);
    } else {
      // Fallback gradient sky
      const sky = _ctx.createLinearGradient(0, 0, 0, _H * GROUND_H);
      const cols = env.sky.split(',');
      cols.forEach((c, i) => sky.addColorStop(i / (cols.length - 1), c.trim()));
      _ctx.fillStyle = sky;
      _ctx.fillRect(0, 0, _W, _H * GROUND_H + 20);

      // Sun / moon
      _drawSkyElements(env);
    }

    // Parallax layers (trees, buildings)
    _layers.forEach(l => {
      _ctx.globalAlpha = l.alpha;
      _ctx.fillStyle   = l.color;
      l.shapes.forEach(s => {
        _ctx.beginPath();
        _ctx.rect(l.x + s.x, s.y, s.w, s.h);
        _ctx.fill();
      });
      _ctx.globalAlpha = 1;
    });
  }

  function _drawSkyElements(env) {
    if (env.id === 'miami') {
      // Sun
      const sg = _ctx.createRadialGradient(_W * 0.5, _H * 0.3, 0, _W * 0.5, _H * 0.3, 60);
      sg.addColorStop(0,'rgba(255,220,80,0.9)');
      sg.addColorStop(0.5,'rgba(255,140,60,0.5)');
      sg.addColorStop(1,'transparent');
      _ctx.fillStyle = sg; _ctx.beginPath();
      _ctx.arc(_W * 0.5, _H * 0.3, 60, 0, Math.PI * 2); _ctx.fill();
    } else if (env.id === 'tokyo') {
      // Moon
      _ctx.fillStyle = 'rgba(200,220,255,0.85)';
      _ctx.beginPath(); _ctx.arc(_W * 0.8, _H * 0.15, 28, 0, Math.PI * 2); _ctx.fill();
    } else if (env.id === 'space') {
      // Stars
      for (let i = 0; i < 80; i++) {
        const sx = (i * 173 + 50) % _W;
        const sy = (i * 97 + 20) % (_H * 0.65);
        _ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 3) * 0.2})`;
        _ctx.beginPath(); _ctx.arc(sx, sy, 0.8 + (i%3)*0.6, 0, Math.PI*2); _ctx.fill();
      }
    }
  }

  function _drawGround() {
    const env = window.ECHICK_CONFIG.ENVIRONMENTS[_envIndex];
    // Road asphalt
    const rg = _ctx.createLinearGradient(0, _groundY, 0, _H);
    rg.addColorStop(0, '#2a2a3a');
    rg.addColorStop(0.3, '#1e1e2e');
    rg.addColorStop(1, '#111118');
    _ctx.fillStyle = rg;
    _ctx.fillRect(0, _groundY, _W, _H - _groundY);

    // Road texture (grain)
    _ctx.globalAlpha = 0.04;
    for (let i = 0; i < _W; i += 4) {
      for (let j = _groundY; j < _H; j += 4) {
        if (Math.random() > 0.7) { _ctx.fillStyle = '#fff'; _ctx.fillRect(i, j, 1, 1); }
      }
    }
    _ctx.globalAlpha = 1;

    // Road lane line
    _ctx.strokeStyle = 'rgba(245,200,66,0.3)';
    _ctx.lineWidth = 3;
    _ctx.setLineDash([40, 30]);
    _ctx.lineDashOffset = -(_distance * 8) % 70;
    _ctx.beginPath();
    _ctx.moveTo(0, _groundY + 12);
    _ctx.lineTo(_W, _groundY + 12);
    _ctx.stroke();
    _ctx.setLineDash([]);

    // Edge line
    _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    _ctx.lineWidth = 2;
    _ctx.setLineDash([]);
    _ctx.beginPath();
    _ctx.moveTo(0, _groundY);
    _ctx.lineTo(_W, _groundY);
    _ctx.stroke();

    // Shadow under runner
    const sx = _runner.x + _runner.w / 2;
    const sg = _ctx.createRadialGradient(sx, _groundY + 3, 2, sx, _groundY + 3, 30);
    sg.addColorStop(0, 'rgba(0,0,0,0.5)');
    sg.addColorStop(1, 'transparent');
    _ctx.fillStyle = sg;
    _ctx.beginPath(); _ctx.ellipse(sx, _groundY + 3, 28, 8, 0, 0, Math.PI * 2); _ctx.fill();
  }

  function _drawChickenShape(cx, cy, w, h, charId, ducking) {
    const ctx = _ctx;
    const scaleY = ducking ? 0.55 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, scaleY);

    const bw = w * 0.55, bh = h * 0.45;
    // Determine colors per character
    const colors = {
      guardian:   { body:'#e8e8f0', acc:'#60a5fa', glow:'rgba(96,165,250,0.5)' },
      magnet:     { body:'#8B5E3C', acc:'#ef4444', glow:'rgba(239,68,68,0.5)' },
      jumper:     { body:'#c8a060', acc:'#a855f7', glow:'rgba(168,85,247,0.5)' },
      speed:      { body:'#d4a853', acc:'#f59e0b', glow:'rgba(245,158,11,0.5)' },
      royal:      { body:'#d4af37', acc:'#f5c842', glow:'rgba(245,200,66,0.6)' },
    };
    const col = colors[charId] || { body:'#c8a060', acc:'#f5c842', glow:'rgba(245,200,66,0.4)' };

    // Glow aura
    const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.7);
    grd.addColorStop(0, col.glow);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.7, h * 0.55, 0, 0, Math.PI * 2); ctx.fill();

    // Body (oval)
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
    ctx.stroke();

    // Wing
    ctx.fillStyle = col.acc;
    ctx.beginPath();
    ctx.ellipse(bw * 0.3, bh * 0.2, bw * 0.35, bh * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = col.acc;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.85, -bh * 0.1);
    ctx.lineTo(-bw * 1.2, -bh * 0.5);
    ctx.lineTo(-bw * 0.9, -bh * 0.6);
    ctx.lineTo(-bw * 0.65, -bh * 0.25);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-bw * 0.85, bh * 0.1);
    ctx.lineTo(-bw * 1.25, bh * 0.4);
    ctx.lineTo(-bw * 0.9, bh * 0.5);
    ctx.lineTo(-bw * 0.65, bh * 0.2);
    ctx.closePath(); ctx.fill();

    // Head
    const hx = bw * 0.6, hy = -bh * 0.55;
    const hr = h * 0.18;
    ctx.fillStyle = col.body;
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hx + hr * 0.35, hy - hr * 0.1, hr * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx + hr * 0.28, hy - hr * 0.18, hr * 0.08, 0, Math.PI * 2); ctx.fill();

    // Beak
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.85, hy);
    ctx.lineTo(hx + hr * 1.55, hy + hr * 0.08);
    ctx.lineTo(hx + hr * 0.85, hy + hr * 0.32);
    ctx.closePath(); ctx.fill();

    // Comb / wattle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(hx - hr * 0.2, hy - hr * 0.9);
    ctx.bezierCurveTo(hx + hr * 0.1, hy - hr * 1.4, hx + hr * 0.5, hy - hr * 1.3, hx + hr * 0.4, hy - hr * 0.9);
    ctx.closePath(); ctx.fill();
    // Wattle
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.65, hy + hr * 0.55, hr * 0.2, hr * 0.32, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Legs (animated bob)
    const t = Date.now() / 200;
    const legSwing = ducking ? 0 : Math.sin(t) * 8;
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    // Leg 1
    ctx.beginPath();
    ctx.moveTo(bw * 0.1, bh * 0.85);
    ctx.lineTo(bw * 0.1 + legSwing, bh * 0.85 + 18);
    ctx.lineTo(bw * 0.1 + legSwing + 10, bh * 0.85 + 18);
    ctx.stroke();
    // Leg 2
    ctx.beginPath();
    ctx.moveTo(-bw * 0.1, bh * 0.85);
    ctx.lineTo(-bw * 0.1 - legSwing, bh * 0.85 + 18);
    ctx.lineTo(-bw * 0.1 - legSwing + 10, bh * 0.85 + 18);
    ctx.stroke();

    // Character-specific accessories
    if (charId === 'guardian') {
      // Shield ring
      ctx.strokeStyle = 'rgba(96,165,250,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath(); ctx.ellipse(0, 0, bw * 1.15, bh * 1.15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    } else if (charId === 'magnet') {
      // Cap
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(hx, hy - hr * 0.85, hr * 1.1, hr * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(hx - hr * 0.9, hy - hr * 1.15, hr * 1.8, hr * 0.32);
      // Magnet sparks
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Date.now() / 400;
        ctx.beginPath();
        ctx.moveTo(bw * 1.0 * Math.cos(a), bh * 1.0 * Math.sin(a));
        ctx.lineTo(bw * 1.3 * Math.cos(a), bh * 1.3 * Math.sin(a));
        ctx.stroke();
      }
    } else if (charId === 'jumper') {
      // Visor
      ctx.fillStyle = 'rgba(168,85,247,0.6)';
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.1, hy, hr * 0.75, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      // Jump glow under feet
      const jg = ctx.createRadialGradient(0, bh * 0.9, 2, 0, bh * 0.9, 24);
      jg.addColorStop(0, 'rgba(168,85,247,0.7)'); jg.addColorStop(1, 'transparent');
      ctx.fillStyle = jg;
      ctx.beginPath(); ctx.ellipse(0, bh * 0.9, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
    } else if (charId === 'speed') {
      // Cowboy hat
      ctx.fillStyle = '#7c4a1e';
      ctx.beginPath(); ctx.ellipse(hx, hy - hr * 0.85, hr * 1.35, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(hx - hr * 0.65, hy - hr * 1.65, hr * 1.3, hr * 0.85);
      ctx.fillStyle = '#5a3614';
      ctx.beginPath(); ctx.ellipse(hx, hy - hr * 1.6, hr * 0.5, hr * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      // Speed streaks
      ctx.strokeStyle = 'rgba(245,158,11,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const sy = -bh * 0.2 + i * bh * 0.2;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.9, sy);
        ctx.lineTo(-bw * 1.6 - i * 10, sy);
        ctx.stroke();
      }
    } else if (charId === 'royal') {
      // Crown
      ctx.fillStyle = '#f5c842';
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.7, hy - hr * 0.9);
      ctx.lineTo(hx - hr * 0.7, hy - hr * 1.6);
      ctx.lineTo(hx - hr * 0.2, hy - hr * 1.25);
      ctx.lineTo(hx + hr * 0.1, hy - hr * 1.7);
      ctx.lineTo(hx + hr * 0.4, hy - hr * 1.25);
      ctx.lineTo(hx + hr * 0.8, hy - hr * 1.6);
      ctx.lineTo(hx + hr * 0.8, hy - hr * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8a020'; ctx.lineWidth = 1.5; ctx.stroke();
      // Gold particles
      for (let i = 0; i < 5; i++) {
        const pa = (i / 5) * Math.PI * 2 + Date.now() / 600;
        const pr = bw * 0.9 + Math.sin(Date.now() / 300 + i) * 6;
        ctx.fillStyle = `rgba(245,200,66,${0.3 + 0.3 * Math.sin(Date.now() / 200 + i)})`;
        ctx.beginPath();
        ctx.arc(pr * Math.cos(pa), pr * Math.sin(pa), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function _drawRunner() {
    const r  = _runner;
    const dh = r.ducking ? r.h * DUCK_H : r.h;
    const ry = _groundY - dh;

    if (r.invincible && Math.floor(r.blinkTimer * 10) % 2 === 0) return;

    // Shield glow
    if (_hasPowerup('shield')) {
      const sg = _ctx.createRadialGradient(r.x + r.w/2, ry + dh/2, 10, r.x + r.w/2, ry + dh/2, 50);
      sg.addColorStop(0, 'rgba(167,139,250,0.2)');
      sg.addColorStop(1, 'transparent');
      _ctx.fillStyle = sg;
      _ctx.beginPath(); _ctx.ellipse(r.x + r.w/2, ry + dh/2, 50, 55, 0, 0, Math.PI*2); _ctx.fill();
    }

    // Turbo trail
    if (_hasPowerup('turbo') || _hasPowerup('rocket')) {
      _ctx.save();
      for (let i = 1; i <= 4; i++) {
        _ctx.globalAlpha = 0.12 * (5 - i);
        _drawChickenShape(r.x + r.w/2 - i * 12, ry + dh/2, r.w * (1 - i*0.06), dh * (1 - i*0.06), _char.id, r.ducking);
      }
      _ctx.globalAlpha = 1;
      _ctx.restore();
    }

    if (_charImg && _charImg.complete && _charImg.naturalWidth > 0) {
      _ctx.save();
      if (r.ducking) { _ctx.translate(r.x + r.w/2, _groundY); _ctx.scale(1, DUCK_H); _ctx.translate(-(r.x + r.w/2), -_groundY); }
      _ctx.translate(r.x + r.w/2, ry + dh/2);
      _ctx.rotate(0.06);
      _ctx.drawImage(_charImg, -r.w/2, -dh/2, r.w, dh);
      _ctx.restore();
    } else {
      _drawChickenShape(r.x + r.w/2, ry + dh/2, r.w, dh, _char.id, r.ducking);
    }
  }

  function _drawObstacle(o) {
    const obs = window.ECHICK_CONFIG.OBSTACLES.find(ob => ob.type === o.type);
    if (!obs) return;

    // Shadow
    const sg = _ctx.createRadialGradient(o.x + o.w/2, _groundY + 2, 1, o.x + o.w/2, _groundY + 2, 24);
    sg.addColorStop(0,'rgba(0,0,0,0.4)'); sg.addColorStop(1,'transparent');
    _ctx.fillStyle = sg;
    _ctx.beginPath(); _ctx.ellipse(o.x+o.w/2, _groundY+2, 24, 6, 0, 0, Math.PI*2); _ctx.fill();

    if (o.type === 'gap') {
      // Crack in road
      _ctx.strokeStyle = '#111'; _ctx.lineWidth = 8;
      _ctx.beginPath(); _ctx.moveTo(o.x, _groundY); _ctx.lineTo(o.x + o.w, _groundY); _ctx.stroke();
      _ctx.strokeStyle = 'rgba(255,80,0,0.4)'; _ctx.lineWidth = 3;
      _ctx.beginPath(); _ctx.moveTo(o.x+4, _groundY); _ctx.lineTo(o.x+o.w-4, _groundY); _ctx.stroke();
    } else if (o.type === 'laser') {
      // Animated laser beam
      _ctx.strokeStyle = `rgba(255,50,50,${0.6 + 0.4 * Math.sin(Date.now() / 100)})`;
      _ctx.lineWidth = 4;
      _ctx.shadowBlur = 12; _ctx.shadowColor = '#ff3232';
      _ctx.beginPath(); _ctx.moveTo(o.x, o.y); _ctx.lineTo(o.x + o.w, o.y); _ctx.stroke();
      _ctx.shadowBlur = 0;
    } else if (o.type === 'cage') {
      // Cage bars
      _ctx.strokeStyle = 'rgba(180,140,60,0.85)'; _ctx.lineWidth = 3;
      _ctx.strokeRect(o.x, o.y, o.w, o.h);
      for (let i = 1; i < 4; i++) {
        _ctx.beginPath(); _ctx.moveTo(o.x + (o.w/4)*i, o.y);
        _ctx.lineTo(o.x + (o.w/4)*i, o.y + o.h); _ctx.stroke();
      }
    } else {
      // Canvas shape obstacles
      const cx = o.x + o.w/2, cy = o.y + o.h/2;
      const wobble = (o.type==='drone'||o.type==='satellite') ? Math.sin(Date.now()/300)*5 : 0;
      _ctx.save();
      _ctx.translate(0, wobble);
      if (o.type === 'car') {
        // Car body
        _ctx.fillStyle = '#e11d48'; _ctx.beginPath();
        _ctx.roundRect(o.x, o.y + o.h*0.25, o.w, o.h*0.5, 6); _ctx.fill();
        _ctx.fillStyle = '#fbbf24'; _ctx.beginPath();
        _ctx.roundRect(o.x + o.w*0.15, o.y + o.h*0.05, o.w*0.7, o.h*0.35, 4); _ctx.fill();
        // Wheels
        _ctx.fillStyle = '#111';
        _ctx.beginPath(); _ctx.arc(o.x + o.w*0.22, o.y + o.h*0.78, o.h*0.18, 0, Math.PI*2); _ctx.fill();
        _ctx.beginPath(); _ctx.arc(o.x + o.w*0.78, o.y + o.h*0.78, o.h*0.18, 0, Math.PI*2); _ctx.fill();
      } else if (o.type === 'drone' || o.type === 'satellite') {
        // Drone body
        _ctx.fillStyle = '#475569';
        _ctx.beginPath(); _ctx.roundRect(o.x + o.w*0.2, o.y + o.h*0.2, o.w*0.6, o.h*0.6, 8); _ctx.fill();
        // Rotors
        _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 2;
        _ctx.beginPath(); _ctx.moveTo(o.x, o.y + o.h*0.1); _ctx.lineTo(o.x + o.w*0.35, o.y + o.h*0.35); _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(o.x + o.w, o.y + o.h*0.1); _ctx.lineTo(o.x + o.w*0.65, o.y + o.h*0.35); _ctx.stroke();
        _ctx.fillStyle = 'rgba(148,163,184,0.5)';
        _ctx.beginPath(); _ctx.ellipse(o.x + o.w*0.05, o.y + o.h*0.05, 12, 4, 0, 0, Math.PI*2); _ctx.fill();
        _ctx.beginPath(); _ctx.ellipse(o.x + o.w*0.95, o.y + o.h*0.05, 12, 4, 0, 0, Math.PI*2); _ctx.fill();
        // Red blink
        if (Math.floor(Date.now()/500) % 2 === 0) {
          _ctx.fillStyle = '#ef4444';
          _ctx.beginPath(); _ctx.arc(cx, o.y + o.h*0.45, 4, 0, Math.PI*2); _ctx.fill();
        }
      } else if (o.type === 'rocket') {
        // Rocket body
        const rg = _ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y);
        rg.addColorStop(0, '#94a3b8'); rg.addColorStop(1, '#cbd5e1');
        _ctx.fillStyle = rg;
        _ctx.beginPath(); _ctx.roundRect(o.x + o.w*0.3, o.y + o.h*0.2, o.w*0.4, o.h*0.65, 8); _ctx.fill();
        // Nose
        _ctx.fillStyle = '#ef4444';
        _ctx.beginPath(); _ctx.moveTo(cx, o.y); _ctx.lineTo(o.x+o.w*0.3, o.y+o.h*0.25); _ctx.lineTo(o.x+o.w*0.7, o.y+o.h*0.25); _ctx.closePath(); _ctx.fill();
        // Flame
        const fg = _ctx.createLinearGradient(cx, o.y+o.h*0.85, cx, o.y+o.h*1.15);
        fg.addColorStop(0,'#f59e0b'); fg.addColorStop(0.5,'#ef4444'); fg.addColorStop(1,'transparent');
        _ctx.fillStyle = fg;
        _ctx.beginPath(); _ctx.ellipse(cx, o.y+o.h*0.95, o.w*0.15, o.h*0.22+Math.sin(Date.now()/80)*4, 0, 0, Math.PI*2); _ctx.fill();
      } else if (o.type === 'meme' || o.type === 'debris') {
        // Bomb shape
        _ctx.fillStyle = '#1e293b';
        _ctx.beginPath(); _ctx.arc(cx, cy, Math.min(o.w, o.h)*0.4, 0, Math.PI*2); _ctx.fill();
        _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 2; _ctx.stroke();
        // Fuse
        _ctx.strokeStyle = '#92400e'; _ctx.lineWidth = 2;
        _ctx.beginPath(); _ctx.moveTo(cx + Math.min(o.w,o.h)*0.35, cy - Math.min(o.w,o.h)*0.3);
        _ctx.bezierCurveTo(cx+Math.min(o.w,o.h)*0.5, cy-Math.min(o.w,o.h)*0.6, cx+Math.min(o.w,o.h)*0.3, cy-Math.min(o.w,o.h)*0.7, cx+Math.min(o.w,o.h)*0.4, cy-Math.min(o.w,o.h)*0.8);
        _ctx.stroke();
        // Spark
        if (Math.floor(Date.now()/150) % 2 === 0) {
          _ctx.fillStyle = '#fbbf24';
          _ctx.beginPath(); _ctx.arc(cx+Math.min(o.w,o.h)*0.4, cy-Math.min(o.w,o.h)*0.82, 3, 0, Math.PI*2); _ctx.fill();
        }
      } else if (o.type === 'cone') {
        _ctx.fillStyle = '#f97316';
        _ctx.beginPath(); _ctx.moveTo(cx, o.y); _ctx.lineTo(o.x+o.w, o.y+o.h); _ctx.lineTo(o.x, o.y+o.h); _ctx.closePath(); _ctx.fill();
        _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 2;
        _ctx.beginPath(); _ctx.moveTo(cx-o.w*0.2, o.y+o.h*0.5); _ctx.lineTo(cx+o.w*0.2, o.y+o.h*0.5); _ctx.stroke();
      } else {
        // Generic obstacle - colored rectangle with label
        const typeColors = { box:'#7c3aed', barrel:'#78350f', man:'#059669', rug:'#dc2626', sign:'#0891b2' };
        _ctx.fillStyle = typeColors[o.type] || '#6b7280';
        _ctx.beginPath(); _ctx.roundRect(o.x, o.y, o.w, o.h, 6); _ctx.fill();
        _ctx.strokeStyle = 'rgba(255,255,255,0.3)'; _ctx.lineWidth = 1.5; _ctx.stroke();
        // Type initial
        _ctx.fillStyle = '#fff';
        _ctx.font = `bold ${Math.min(o.w,o.h)*0.45}px sans-serif`;
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(o.type[0].toUpperCase(), cx, cy);
      }
      _ctx.restore();
    }
  }

  function _drawCoin(c) {
    if (c.collected) return;
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 200 + c.x);
    const cx = c.x + c.w/2, cy = c.y + c.h/2;
    const r = 10 * pulse;
    _ctx.save();
    // Glow
    _ctx.shadowBlur = 10; _ctx.shadowColor = '#f5c842';
    // Gold circle
    const cg = _ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, 1, cx, cy, r);
    cg.addColorStop(0, '#ffd700'); cg.addColorStop(0.6, '#f5c842'); cg.addColorStop(1, '#e8a020');
    _ctx.fillStyle = cg;
    _ctx.beginPath(); _ctx.arc(cx, cy, r, 0, Math.PI * 2); _ctx.fill();
    // Inner ring
    _ctx.strokeStyle = 'rgba(255,255,255,0.4)'; _ctx.lineWidth = 1.5;
    _ctx.beginPath(); _ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2); _ctx.stroke();
    // $ symbol
    _ctx.shadowBlur = 0;
    _ctx.fillStyle = '#7c4a00';
    _ctx.font = `bold ${r * 1.1}px sans-serif`;
    _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
    _ctx.fillText('$', cx, cy + 0.5);
    _ctx.restore();
  }

  function _drawPuItem(p) {
    const puCfg = window.ECHICK_CONFIG.POWERUPS.find(pu => pu.id === p.puId);
    if (!puCfg) return;
    const pulse = 0.9 + 0.1 * Math.sin(Date.now()/250);
    const cx = p.x + p.w/2, cy = p.y + p.h/2;
    const r = 16 * pulse;
    _ctx.save();
    _ctx.shadowBlur = 16; _ctx.shadowColor = puCfg.color;
    // Hexagon
    _ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      i === 0 ? _ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : _ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    _ctx.closePath();
    _ctx.fillStyle = puCfg.color + 'cc'; _ctx.fill();
    _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 2; _ctx.stroke();
    _ctx.shadowBlur = 0;
    // Label letter
    const labels = { magnet:'M', turbo:'T', rocket:'R', shield:'S', slow:'~', vacuum:'V', fly:'F', rage:'!', double:'x2' };
    _ctx.fillStyle = '#fff';
    _ctx.font = `bold ${r * 0.9}px sans-serif`;
    _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
    _ctx.fillText(labels[p.puId] || '?', cx, cy + 0.5);
    _ctx.restore();
  }

  function _drawEffects() {
    // Magnet beam
    if (_hasPowerup('magnet') || _hasPowerup('vacuum')) {
      const mg = _ctx.createRadialGradient(_runner.x + _runner.w/2, _runner.y + _runner.h/2, 5,
                                            _runner.x + _runner.w/2, _runner.y + _runner.h/2, 120);
      mg.addColorStop(0, 'rgba(96,165,250,0.12)');
      mg.addColorStop(1, 'transparent');
      _ctx.fillStyle = mg;
      _ctx.beginPath();
      _ctx.arc(_runner.x + _runner.w/2, _runner.y + _runner.h/2, 120, 0, Math.PI*2);
      _ctx.fill();
    }
    // Rage glow
    if (_hasPowerup('rage')) {
      _ctx.shadowBlur = 20; _ctx.shadowColor = '#f87171';
      _ctx.shadowBlur = 0;
    }
  }

  // ─────────────────────────────────────────────
  //  Spawning
  // ─────────────────────────────────────────────
  function _spawnObstacle() {
    const cfg = window.ECHICK_CONFIG.OBSTACLES;
    const obs = cfg[Math.floor(Math.random() * cfg.length)];
    let y, h = obs.h;

    if (obs.type === 'drone' || obs.type === 'satellite' || obs.type === 'rocket') {
      // Air obstacle — duck under or jump over depending on height
      y = _groundY - h - 60 - Math.random() * 40;
    } else if (obs.type === 'laser') {
      y = _groundY - 30 - Math.random() * 60;
    } else {
      y = _groundY - h;
    }

    _obstacles.push({ type: obs.type, x: _W + 40, y, w: obs.w, h });
  }

  function _spawnCoinRow() {
    const count  = 3 + Math.floor(Math.random() * 5);
    const baseY  = _groundY - 50 - Math.random() * 80;
    const startX = _W + 60;
    for (let i = 0; i < count; i++) {
      _coinItems.push({ x: startX + i * 36, y: baseY, w: 24, h: 24, collected: false });
    }
  }

  function _spawnPowerupItem() {
    const pus = window.ECHICK_CONFIG.POWERUPS;
    const pu  = pus[Math.floor(Math.random() * pus.length)];
    _puItems.push({ puId: pu.id, x: _W + 60, y: _groundY - 70, w: 36, h: 36, collected: false });
  }

  // ─────────────────────────────────────────────
  //  Collect / activate
  // ─────────────────────────────────────────────
  function _collectCoin(c) {
    c.collected = true;
    const multiplier = _hasPowerup('double') ? 2 : 1;
    const charMult   = (_char?.abilityVal && _char?.ability === 'Coin Multiplier') ? _char.abilityVal : 1;
    const earned     = 1 * multiplier * charMult;
    _coins  += earned;
    _deltaCoinsSinceVal += earned;
    _combo   = Math.min(8, _combo + 0.2);
    _comboTimer = 2.5;
    if (_combo >= 2) { document.getElementById('hud-combo').classList.remove('hidden'); }
    Audio2.sfxCoin();
    if (_coins % 10 === 0) {
      const msgs = window.ECHICK_CONFIG.POPUPS;
      _showPopup(msgs[Math.floor(Math.random() * msgs.length)]);
    }
  }

  function _activatePowerup(p) {
    const puCfg = window.ECHICK_CONFIG.POWERUPS.find(pu => pu.id === p.puId);
    if (!puCfg) return;
    // Remove old instance
    _powerups = _powerups.filter(pw => pw.id !== puCfg.id);
    _powerups.push({ id: puCfg.id, timeLeft: puCfg.duration / 1000, total: puCfg.duration / 1000, config: puCfg });
    Audio2.sfxPowerup();
    _showPopup(`${puCfg.emoji} ${puCfg.name}!`);
    _renderPowerupSlots();
    // Apply effects
    if (puCfg.id === 'turbo' || puCfg.id === 'rocket') _speed = Math.min(SPEED_MAX, _speed * 1.4);
    if (puCfg.id === 'fly')    { _runner.y = _groundY - _runner.h - 100; _runner.grounded = false; _runner.vy = -200; }
    if (puCfg.id === 'slow')   _speed *= 0.6;
  }

  function _deactivatePowerup(p) {
    if (p.id === 'slow' && _speed < 280) _speed = 280;
    _renderPowerupSlots();
  }

  function _hasPowerup(id) { return _powerups.some(p => p.id === id); }
  function _removePowerup(id) { _powerups = _powerups.filter(p => p.id !== id); _renderPowerupSlots(); }

  function _renderPowerupSlots() {
    if (!_powerupRow) return;
    _powerupRow.innerHTML = '';
    _powerups.forEach(p => {
      const slot = document.createElement('div');
      slot.className = 'powerup-slot';
      slot.textContent = p.config.emoji;
      const bar = document.createElement('div');
      bar.className = 'powerup-slot-timer';
      bar.style.animationDuration = p.total + 's';
      slot.appendChild(bar);
      _powerupRow.appendChild(slot);
    });
  }

  // ─────────────────────────────────────────────
  //  Magnet / vacuum coin attraction
  // ─────────────────────────────────────────────
  function _attractCoins(dt) {
    if (!_hasPowerup('magnet') && !_hasPowerup('vacuum')) return;
    const range = _hasPowerup('vacuum') ? 200 : 130;
    _coinItems.forEach(c => {
      if (c.collected) return;
      const dx = (_runner.x + _runner.w/2) - (c.x + c.w/2);
      const dy = (_runner.y + _runner.h/2) - (c.y + c.h/2);
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < range) {
        c.x += dx * 6 * dt;
        c.y += dy * 6 * dt;
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Collision
  // ─────────────────────────────────────────────
  function _collides(a, b) {
    const margin = 10;
    const ah = a.ducking ? a.h * DUCK_H : a.h;
    const ay = _groundY - ah;
    return (
      a.x + margin < b.x + b.w - margin &&
      a.x + a.w - margin > b.x + margin &&
      ay + margin < b.y + b.h - margin &&
      ay + ah - margin > b.y + margin
    );
  }

  // ─────────────────────────────────────────────
  //  Popup messages
  // ─────────────────────────────────────────────
  function _showPopup(text) {
    if (!_gamePopup) return;
    _gamePopup.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'popup-msg';
    msg.textContent = text;
    _gamePopup.appendChild(msg);
    setTimeout(() => { if (_gamePopup) _gamePopup.innerHTML = ''; }, 1200);
  }

  // ─────────────────────────────────────────────
  //  HUD update
  // ─────────────────────────────────────────────
  function _updateHUD() {
    if (_hudDist)   _hudDist.textContent   = Math.floor(_distance) + ' M';
    if (_hudScore)  _hudScore.textContent  = Math.floor(_score).toLocaleString();
    if (_hudCoins)  _hudCoins.textContent  = Math.floor(_coins).toLocaleString();
    if (_comboVal && _combo >= 2) _comboVal.textContent = 'x' + Math.floor(_combo);
    const speedPct = Math.min(100, ((_speed - 280) / (SPEED_MAX - 280)) * 100);
    if (_speedFill) _speedFill.style.width = (20 + speedPct * 0.8) + '%';
    _attractCoins(1/60);
  }

  // ─────────────────────────────────────────────
  //  Die
  // ─────────────────────────────────────────────
  function _die() {
    _state = 'dead';
    cancelAnimationFrame(_raf);
    Audio2.sfxGameOver();

    // Fill game-over modal
    document.getElementById('go-dist').textContent  = Math.floor(_distance) + ' M';
    document.getElementById('go-score').textContent = Math.floor(_score).toLocaleString();
    document.getElementById('go-coins').textContent = '🪙 ' + Math.floor(_coins).toLocaleString();
    const prevBest = _player?.best_distance || 0;
    document.getElementById('go-best').textContent  = Math.max(prevBest, Math.floor(_distance)) + ' M';

    setTimeout(() => document.getElementById('gameover-modal').classList.remove('hidden'), 600);

    // Submit to DB with security
    _submitRun();
  }

  async function _submitRun() {
    try {
      const payload = await Security.finalizeSession(Math.floor(_coins), Math.floor(_score), Math.floor(_distance));
      const result  = await DB.submitRun(_player.telegram_id, payload);
      if (result) {
        // Refresh player data
        const updated = await DB.getPlayer(_player.telegram_id);
        if (updated) { Auth.setPlayer(updated); HomeScreen.refreshPlayer(updated); }
      }
    } catch(e) { console.error('[GameEngine] Submit run failed', e); }
  }

  // ─────────────────────────────────────────────
  //  Pause / Resume / Quit
  // ─────────────────────────────────────────────
  function pause() {
    if (_state !== 'running') return;
    _state = 'paused';
    cancelAnimationFrame(_raf);
    Audio2.pauseBg();
    document.getElementById('pause-modal').classList.remove('hidden');
  }

  function resume() {
    if (_state !== 'paused') return;
    document.getElementById('pause-modal').classList.add('hidden');
    _state    = 'running';
    _lastTime = performance.now();
    _raf      = requestAnimationFrame(_loop);
    Audio2.playBg();
  }

  function _quit() {
    _state = 'idle';
    cancelAnimationFrame(_raf);
    Audio2.stopBg();
    document.getElementById('pause-modal').classList.add('hidden');
    App.navigateTo('home');
  }

  function _hideGameOver() {
    document.getElementById('gameover-modal').classList.add('hidden');
    cancelAnimationFrame(_raf);
    Audio2.stopBg();
  }

  // ─────────────────────────────────────────────
  //  Input (touch + keyboard)
  // ─────────────────────────────────────────────
  function _bindInput() {
    // Remove old listeners
    _cv.removeEventListener('touchstart', _onTouch);
    _cv.removeEventListener('touchend',   _onTouchEnd);
    document.removeEventListener('keydown', _onKey);
    document.removeEventListener('keyup',   _onKeyUp);

    _cv.addEventListener('touchstart', _onTouch, { passive: false });
    _cv.addEventListener('touchend',   _onTouchEnd, { passive: false });
    document.addEventListener('keydown', _onKey);
    document.addEventListener('keyup',   _onKeyUp);
  }

  let _touchStartX = 0, _touchStartY = 0;

  function _onTouch(e) {
    e.preventDefault();
    if (_state !== 'running') return;
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
  }

  function _onTouchEnd(e) {
    e.preventDefault();
    if (_state !== 'running') return;
    const dx = e.changedTouches[0].clientX - _touchStartX;
    const dy = e.changedTouches[0].clientY - _touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -20) _jump();       // swipe up = jump
      else if (dy > 20) _duck();   // swipe down = duck
    } else {
      _jump(); // tap = jump
    }
  }

  function _onKey(e) {
    if (_state !== 'running') return;
    if (e.code === 'Space' || e.code === 'ArrowUp')   _jump();
    if (e.code === 'ArrowDown') _duck(true);
  }
  function _onKeyUp(e) {
    if (e.code === 'ArrowDown') _duck(false);
  }

  function _jump() {
    if (_runner.grounded) {
      _runner.vy = JUMP_VEL * (_hasPowerup('fly') ? 1.3 : 1);
      _runner.grounded = false;
      _runner.jumping  = true;
      Audio2.sfxJump();
    } else if (!_runner.doubleJumped && (_char?.ability === 'Double Jump' || _hasPowerup('fly'))) {
      _runner.vy = JUMP_VEL * 0.85;
      _runner.doubleJumped = true;
      Audio2.sfxJump();
    }
  }

  function _duck(active = true) {
    _runner.ducking = active;
  }

  // ─────────────────────────────────────────────
  //  Parallax layers
  // ─────────────────────────────────────────────
  function _buildLayers() {
    const env = window.ECHICK_CONFIG.ENVIRONMENTS[_envIndex];
    _layers = [];
    if (env.id === 'miami') {
      _layers = [
        { x: 0, w: _W, speed: 0.1, alpha: 0.5, color: 'rgba(20,10,5,0.6)',
          shapes: _buildBuildings(4, _W * 0.15, _H * 0.3, _H * 0.45) },
        { x: _W, w: _W, speed: 0.1, alpha: 0.5, color: 'rgba(20,10,5,0.6)',
          shapes: _buildBuildings(4, _W * 0.15, _H * 0.3, _H * 0.45) },
      ];
    } else if (env.id === 'tokyo') {
      _layers = [
        { x: 0, w: _W, speed: 0.12, alpha: 0.7, color: 'rgba(0,20,50,0.8)',
          shapes: _buildBuildings(6, _W * 0.1, _H * 0.1, _H * 0.55) },
        { x: _W, w: _W, speed: 0.12, alpha: 0.7, color: 'rgba(0,20,50,0.8)',
          shapes: _buildBuildings(6, _W * 0.1, _H * 0.1, _H * 0.55) },
      ];
    }
  }

  function _buildBuildings(count, baseW, minH, maxH) {
    const shapes = [];
    for (let i = 0; i < count; i++) {
      const w = baseW + Math.random() * baseW;
      const h = minH + Math.random() * (maxH - minH);
      shapes.push({ x: i * (_W / count) + Math.random() * 20, y: _H * GROUND_H - h, w, h });
    }
    return shapes;
  }

  // ─────────────────────────────────────────────
  //  Asset loading
  // ─────────────────────────────────────────────
  function _tryLoadCharSprite() {
    const img = new Image();
    img.src = `assets/char_${_char.id}.png`;
    img.onload = () => { _charImg = img; };
    img.onerror = () => { _charImg = null; };
  }

  function _preloadEnvImages() {
    window.ECHICK_CONFIG.ENVIRONMENTS.forEach(env => {
      if (!_bgImages[env.id]) {
        const img = new Image();
        img.src = `assets/bg_${env.id}.png`;
        img.onload = () => { _bgImages[env.id] = img; };
        img.onerror = () => {};
        _bgImages[env.id] = img;
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Resize
  // ─────────────────────────────────────────────
  function _resize() {
    if (!_cv) return;
    _W = _cv.width  = window.innerWidth;
    _H = _cv.height = window.innerHeight;
    _groundY = _H * GROUND_H;
    if (_runner) { _runner.x = _W * 0.18; }
  }

  return { start, pause, resume };
})();

window.GameEngine = GameEngine;
