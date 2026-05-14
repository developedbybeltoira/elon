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
      for (let i = 1; i <= 4; i++) {
        _ctx.globalAlpha = 0.12 * (5 - i);
        _ctx.font = `${dh * (1 - i*0.06)}px serif`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(_char.emoji, r.x + r.w/2 - i * 12, ry + dh/2);
      }
      _ctx.globalAlpha = 1;
    }

    if (_charImg && _charImg.complete && _charImg.naturalWidth > 0) {
      _ctx.save();
      if (r.ducking) { _ctx.translate(r.x + r.w/2, _groundY); _ctx.scale(1, DUCK_H); _ctx.translate(-(r.x + r.w/2), -_groundY); }
      // Lean forward slightly while running
      _ctx.translate(r.x + r.w/2, ry + dh/2);
      _ctx.rotate(0.06);
      _ctx.drawImage(_charImg, -r.w/2, -dh/2, r.w, dh);
      _ctx.restore();
    } else {
      _ctx.font = `${dh * 0.9}px serif`;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.save();
      _ctx.translate(r.x + r.w/2, ry + dh/2);
      if (r.ducking) _ctx.scale(1, DUCK_H);
      _ctx.rotate(r.grounded ? 0 : -0.15);
      _ctx.fillText(_char.emoji, 0, 0);
      _ctx.restore();
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
      // Emoji obstacles
      _ctx.font = `${Math.max(o.h, 36) * 0.9}px serif`;
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      // Slight wobble for drone/satellite
      const wobble = (o.type==='drone'||o.type==='satellite') ? Math.sin(Date.now()/300)*5 : 0;
      _ctx.fillText(obs.emoji, o.x + o.w/2, o.y + o.h + wobble);
    }
  }

  function _drawCoin(c) {
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 200 + c.x);
    _ctx.globalAlpha = c.collected ? 0 : 1;
    _ctx.font = `${22 * pulse}px serif`;
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('🪙', c.x + c.w/2, c.y + c.h/2);
    _ctx.globalAlpha = 1;
  }

  function _drawPuItem(p) {
    const puCfg = window.ECHICK_CONFIG.POWERUPS.find(pu => pu.id === p.puId);
    if (!puCfg) return;
    const pulse = 0.9 + 0.1 * Math.sin(Date.now()/250);
    // Glow
    _ctx.shadowBlur = 14; _ctx.shadowColor = puCfg.color;
    _ctx.font = `${30 * pulse}px serif`;
    _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
    _ctx.fillText(puCfg.emoji, p.x + p.w/2, p.y + p.h/2);
    _ctx.shadowBlur = 0;
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
