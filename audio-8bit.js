// ============================================================================
// AUDIO ENGINE: AUTO-PLAYING BGM + REAL MP3 SFX (THROW, SPLASH, FIREWORK)
// ============================================================================

class RetroAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;

    // 1. Background Music (bgm.mp3) - Plays continuously & auto-starts
    this.bgmAudio = new Audio('bgm.mp3');
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.42;
    this.bgmAudio.preload = 'auto';

    // 2. Real SFX Templates (cloned on play so overlapping SFX never cut each other off)
    this.sfxTemplates = {
      select: 'sfx-select.mp3',
      throw: 'sfx-throw.mp3',
      splash: 'sfx-splash.mp3',
      firework: 'sfx-firework.mp3'
    };

    // Preload single instances to warm browser cache
    Object.values(this.sfxTemplates).forEach((src) => {
      const a = new Audio(src);
      a.preload = 'auto';
    });

    // Dedicated firework audio handle so we can play short bursts from the 4-min firework clip
    this.fireworkAudio = new Audio('sfx-firework.mp3');
    this.fireworkAudio.preload = 'auto';
    this.fireworkAudio.volume = 0.78;
    this.fireworkStopTimer = null;

    this.setupAutoStartBgm();
  }

  // Attempt autoplay immediately; if browser blocks autoplay until first gesture, start on first click/touch/key
  setupAutoStartBgm() {
    const tryPlayBgm = () => {
      if (this.isPlaying) return;
      this.ensureContext();
      const p = this.bgmAudio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          this.isPlaying = true;
          window.removeEventListener('pointerdown', tryPlayBgm);
          window.removeEventListener('keydown', tryPlayBgm);
          window.removeEventListener('touchstart', tryPlayBgm);
        }).catch(() => {
          // Wait for user's first interaction
        });
      }
    };

    // Try immediately on load
    tryPlayBgm();

    // Fallback unlock on first interaction anywhere
    window.addEventListener('pointerdown', tryPlayBgm, { passive: true });
    window.addEventListener('keydown', tryPlayBgm, { passive: true });
    window.addEventListener('touchstart', tryPlayBgm, { passive: true });
  }

  ensureContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(1.2, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
        this.ctx.resume();
      }
    } catch (e) {
      // ignore
    }
    return this.ctx;
  }

  playOneShotFile(src, volume = 0.75) {
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch (e) {
      // ignore
    }
  }

  // Soft 8-bit UI blip for buttons / heart blessing
  playSquareNote(freq, duration, volume = 0.08, type = 'square') {
    this.ensureContext();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // 1. UI Click / Select (Real MP3: sfx-select.mp3)
  playClickSfx() {
    this.playOneShotFile(this.sfxTemplates.select, 0.72);
  }

  // 2. Krathong Throw Sound (Real MP3: sfx-throw.mp3)
  playThrowWhooshSfx() {
    this.playOneShotFile(this.sfxTemplates.throw, 0.8);
  }

  // 3. Krathong Water Splash Sound (Real MP3: sfx-splash.mp3)
  playSplashSfx() {
    this.playOneShotFile(this.sfxTemplates.splash, 0.85);
  }

  // 4. Firework Launch Whistle (silent or gentle — main explosion plays real firework audio)
  playFireworkSfx() {
    // Real firework clip already contains whistle + boom; triggered cleanly on burst
  }

  // 5. Firework Explosion Burst (Plays a crisp 3.5-second slice from sfx-firework.mp3)
  playFireworkBoomSfx() {
    try {
      if (this.fireworkStopTimer) {
        clearTimeout(this.fireworkStopTimer);
      }
      // Pick a lively moment inside the firework recording (e.g. 0s, 10s, 18s, 30s)
      const offsets = [0.2, 6.5, 13.5, 22.0, 35.0];
      const startAt = offsets[Math.floor(Math.random() * offsets.length)];
      if (this.fireworkAudio.readyState >= 1) {
        this.fireworkAudio.currentTime = startAt;
      }
      this.fireworkAudio.volume = 0.78;
      const p = this.fireworkAudio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
      this.fireworkStopTimer = setTimeout(() => {
        this.fireworkAudio.pause();
      }, 3200);
    } catch (e) {
      // ignore
    }
  }

  // 6. Blessing / Heart Chime
  playBlessSfx() {
    this.playSquareNote(587.33, 0.1, 0.1, 'square');
    setTimeout(() => {
      this.playSquareNote(880, 0.22, 0.1, 'square');
    }, 85);
  }
}

window.retroAudio = new RetroAudioEngine();
