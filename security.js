/* ══════════════════════════════════════════════════
   SECURITY.JS — Anti-Cheat · Validation · Session
   ══════════════════════════════════════════════════ */

'use strict';

const Security = (() => {
  // Session state (never persisted to localStorage)
  let _session = null;
  let _gameStart = null;
  let _lastTick = null;
  let _shadowCoins = 0;
  let _shadowScore = 0;
  let _shadowDist  = 0;
  let _tickCoins   = 0;
  let _tickScore   = 0;
  let _cheatFlags  = [];
  let _sessionToken = null;

  // Generate a per-session token (not stored anywhere)
  function _generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // Simple HMAC-like fingerprint for score submission
  async function _sign(payload) {
    const text = JSON.stringify(payload) + _sessionToken;
    const encoded = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
  }

  // Start a new game session
  function startSession() {
    _session    = { id: Date.now(), startTime: Date.now() };
    _gameStart  = Date.now();
    _lastTick   = Date.now();
    _shadowCoins = 0;
    _shadowScore = 0;
    _shadowDist  = 0;
    _tickCoins  = 0;
    _tickScore  = 0;
    _cheatFlags = [];
    _sessionToken = _generateToken();
    return _session;
  }

  // Called every game frame — validate deltas
  function validateTick(deltaCoins, deltaScore, deltaDist) {
    const now = Date.now();
    const dt  = (now - _lastTick) / 1000; // seconds
    _lastTick = now;

    const { maxCoinsPerSecond, maxScorePerSecond, maxDistancePerSecond } = window.ECHICK_CONFIG.ANTICHEAT;

    if (dt > 0) {
      const cps = deltaCoins / dt;
      const sps = deltaScore / dt;
      const dps = deltaDist  / dt;
      if (cps > maxCoinsPerSecond)   _flag(`coin_rate:${cps.toFixed(1)}`);
      if (sps > maxScorePerSecond)   _flag(`score_rate:${sps.toFixed(1)}`);
      if (dps > maxDistancePerSecond) _flag(`dist_rate:${dps.toFixed(1)}`);
    }

    // Negative inputs
    if (deltaCoins < 0 || deltaScore < 0 || deltaDist < 0) {
      _flag('negative_delta');
      return false;
    }

    _shadowCoins += deltaCoins;
    _shadowScore += deltaScore;
    _shadowDist  += deltaDist;
    return _cheatFlags.length === 0;
  }

  // Called when game ends — produces signed payload
  async function finalizeSession(reportedCoins, reportedScore, reportedDist) {
    // Check session duration
    const elapsed = (Date.now() - _gameStart) / 1000;
    const { maxCoinsPerSecond, maxScorePerSecond, maxDistancePerSecond, sessionTimeout } = window.ECHICK_CONFIG.ANTICHEAT;

    if (Date.now() - _gameStart > sessionTimeout) _flag('session_timeout');

    // Compare reported vs shadow
    const coinDrift  = Math.abs(reportedCoins - _shadowCoins);
    const scoreDrift = Math.abs(reportedScore - _shadowScore);
    const distDrift  = Math.abs(reportedDist  - _shadowDist);

    if (coinDrift  > _shadowCoins  * 0.05 + 5)  _flag(`coin_drift:${coinDrift}`);
    if (scoreDrift > _shadowScore  * 0.05 + 10) _flag(`score_drift:${scoreDrift}`);
    if (distDrift  > _shadowDist   * 0.1  + 5)  _flag(`dist_drift:${distDrift}`);

    // Hard caps based on time
    const maxCoins = maxCoinsPerSecond * elapsed * 1.1;
    const maxScore = maxScorePerSecond * elapsed * 1.1;
    const maxDist  = maxDistancePerSecond * elapsed * 1.1;

    const safeCoins = Math.min(reportedCoins, maxCoins);
    const safeScore = Math.min(reportedScore, maxScore);
    const safeDist  = Math.min(reportedDist,  maxDist);

    const isSuspicious = _cheatFlags.length > 0;
    const payload = {
      sessionId:   _session.id,
      coins:       Math.floor(safeCoins),
      score:       Math.floor(safeScore),
      distance:    Math.floor(safeDist),
      duration:    Math.floor(elapsed),
      flags:       _cheatFlags,
      suspicious:  isSuspicious,
      ts:          Date.now(),
    };

    payload.sig = await _sign(payload);
    return payload;
  }

  function _flag(reason) {
    if (!_cheatFlags.includes(reason)) {
      _cheatFlags.push(reason);
      console.warn('[ECHICK Security] Flag:', reason);
    }
  }

  function getFlags()    { return [..._cheatFlags]; }
  function isFlagged()   { return _cheatFlags.length > 0; }
  function getToken()    { return _sessionToken; }
  function getShadow()   { return { coins: _shadowCoins, score: _shadowScore, dist: _shadowDist }; }

  // Verify Telegram initData format (client-side check only; real verification on server/edge)
  function verifyInitData(initData) {
    if (!initData || typeof initData !== 'string') return false;
    const params = new URLSearchParams(initData);
    return params.has('user') && params.has('hash') && params.has('auth_date');
  }

  return { startSession, validateTick, finalizeSession, getFlags, isFlagged, getToken, getShadow, verifyInitData };
})();

window.Security = Security;
