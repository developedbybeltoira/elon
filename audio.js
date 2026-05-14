/* ══════════════════════════════════════════════════
   AUDIO.JS — Music · SFX · Custom Upload
   ══════════════════════════════════════════════════ */

'use strict';

const Audio = (() => {
  let _bgMusic    = null;
  let _customTrack = null;
  let _musicVol   = 0.7;
  let _sfxVol     = 0.8;
  let _muted      = false;
  let _ctx        = null;
  let _playing    = false;

  // Lazy-init AudioContext
  function _getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  }

  // Load the default elon.mp3
  function loadDefault() {
    if (_bgMusic) return;
    _bgMusic = new window.Audio('assets/elon.mp3');
    _bgMusic.loop    = true;
    _bgMusic.volume  = _musicVol;
    _bgMusic.preload = 'auto';
  }

  function loadCustom(file) {
    if (!file) return;
    if (_customTrack) {
      _customTrack.pause();
      URL.revokeObjectURL(_customTrack.src);
    }
    _customTrack = new window.Audio(URL.createObjectURL(file));
    _customTrack.loop   = true;
    _customTrack.volume = _musicVol;
    if (_playing) playBg();
    showToast('🎵 Custom music loaded!');
  }

  function playBg() {
    _playing = true;
    const track = _customTrack || _bgMusic;
    if (!track) return;
    track.volume = _muted ? 0 : _musicVol;
    track.play().catch(() => {});
    // Pause whichever isn't active
    if (_customTrack && _bgMusic) _bgMusic.pause();
  }

  function pauseBg() {
    _playing = false;
    if (_bgMusic)     _bgMusic.pause();
    if (_customTrack) _customTrack.pause();
  }

  function stopBg() {
    _playing = false;
    if (_bgMusic)     { _bgMusic.pause();     _bgMusic.currentTime     = 0; }
    if (_customTrack) { _customTrack.pause(); _customTrack.currentTime = 0; }
  }

  function setMusicVol(v) {
    _musicVol = v / 100;
    const track = _customTrack || _bgMusic;
    if (track) track.volume = _muted ? 0 : _musicVol;
  }

  function setSfxVol(v) { _sfxVol = v / 100; }

  // Generate tones via Web Audio API for SFX
  function _beep(freq, dur, type = 'sine', vol = 1) {
    try {
      const ctx  = _getCtx();
      if (_muted) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type      = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol * _sfxVol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch(e){}
  }

  function sfxCoin()      { _beep(880, 0.08, 'sine',     0.3); setTimeout(() => _beep(1100, 0.08,'sine',0.25), 60); }
  function sfxJump()      { _beep(440, 0.12, 'sine',     0.4); setTimeout(() => _beep(550, 0.08,'sine',0.3), 80); }
  function sfxHit()       { _beep(200, 0.2,  'sawtooth', 0.5); }
  function sfxPowerup()   { [0,60,120].forEach((d,i) => setTimeout(() => _beep(550+i*110, 0.1, 'sine', 0.35), d)); }
  function sfxGameOver()  { _beep(200, 0.3, 'sawtooth', 0.4); setTimeout(() => _beep(150, 0.5, 'sawtooth', 0.3), 200); }
  function sfxPurchase()  { [0,80,160].forEach((d,i) => setTimeout(() => _beep(660+i*220, 0.1,'sine',0.4), d)); }
  function sfxClick()     { _beep(600, 0.05, 'sine', 0.2); }

  return {
    loadDefault, loadCustom,
    playBg, pauseBg, stopBg,
    setMusicVol, setSfxVol,
    sfxCoin, sfxJump, sfxHit, sfxPowerup, sfxGameOver, sfxPurchase, sfxClick,
    getPlaying: () => _playing,
  };
})();

window.Audio2 = Audio; // use Audio2 to avoid collision with window.Audio
