// Audio: every sound is synthesised with the Web Audio API, so there are no
// asset downloads and no licensing concerns. Music is produced by a small
// step sequencer (MusicPlayer). To use recorded music later, implement the
// same play(trackId)/stop() interface with <audio> elements.

import { NEX } from '../data/nex.js';

const PENTA = [0, 2, 4, 7, 9];
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.track = null;
    this.music = null;
    this.lastPlay = new Map();
  }

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.comp);
      this.musicBus.connect(this.comp);
      this.applyVolumes();
      // Shared noise buffer for percussion / whooshes.
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.music = new MusicPlayer(this);
      if (this.track) this.music.play(this.track);
    } catch (err) {
      console.warn('[audio] unavailable', err);
      this.ctx = null;
    }
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVol * 0.9, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55, t, 0.08);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  playMusic(track) {
    this.track = track;
    if (this.music) this.music.play(track);
  }

  // ------------------------------------------------------------ primitives
  tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, delay = 0, dest = null, curve = 'exp', detune = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    if (f2) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      else osc.frequency.linearRampToValueAtTime(f2, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(dest || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, type = 'bandpass', freq = 1000, freq2 = null, q = 1, delay = 0, dest = null, attack = 0.005 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (freq2) filt.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  /** Play a named sound effect. Silently no-ops if audio is unavailable. */
  play(name, opt = {}) {
    if (!this.ctx || this.sfxVol <= 0.001 || this.ctx.state !== 'running') return;
    // Rate-limit identical sounds so bursts don't clip.
    const now = performance.now();
    const minGap = opt.gap ?? 28;
    if (now - (this.lastPlay.get(name) || 0) < minGap) return;
    this.lastPlay.set(name, now);
    const fn = SFX[name];
    if (!fn) return;
    try {
      fn(this, opt);
    } catch {
      /* audio must never break gameplay */
    }
  }
}

// ------------------------------------------------------------------ SFX bank
const SFX = {
  click(a) {
    a.tone({ f: 880, f2: 1320, type: 'triangle', dur: 0.07, vol: 0.12 });
  },
  back(a) {
    a.tone({ f: 700, f2: 480, type: 'triangle', dur: 0.08, vol: 0.1 });
  },
  tab(a) {
    a.tone({ f: 1040, type: 'sine', dur: 0.05, vol: 0.08 });
  },
  deny(a) {
    a.tone({ f: 220, f2: 180, type: 'square', dur: 0.14, vol: 0.06 });
    a.tone({ f: 165, type: 'square', dur: 0.12, vol: 0.05, delay: 0.07 });
  },
  pickup(a, { combo = 0 } = {}) {
    const step = Math.min(combo, 14);
    const note = 67 + PENTA[step % 5] + 12 * Math.floor(step / 5);
    const f = midi(note);
    a.tone({ f, f2: f * 1.5, type: 'triangle', dur: 0.09, vol: 0.14 });
    a.tone({ f: f * 2, type: 'sine', dur: 0.14, vol: 0.06, delay: 0.015 });
  },
  gold(a) {
    [0, 4, 7, 12].forEach((s, i) => a.tone({ f: midi(79 + s), type: 'triangle', dur: 0.16, vol: 0.12, delay: i * 0.045 }));
  },
  rainbow(a) {
    [0, 3, 7, 10, 14, 19].forEach((s, i) => a.tone({ f: midi(72 + s), type: 'sine', dur: 0.2, vol: 0.1, delay: i * 0.035 }));
  },
  giant(a) {
    a.tone({ f: 180, f2: 720, type: 'sawtooth', dur: 0.4, vol: 0.08 });
    [0, 7, 12, 16, 19].forEach((s, i) => a.tone({ f: midi(72 + s), type: 'triangle', dur: 0.3, vol: 0.1, delay: 0.08 + i * 0.05 }));
  },
  timeOrb(a) {
    a.tone({ f: 988, type: 'sine', dur: 0.1, vol: 0.12 });
    a.tone({ f: 1319, type: 'sine', dur: 0.18, vol: 0.12, delay: 0.08 });
  },
  shield(a) {
    a.tone({ f: 440, f2: 880, type: 'triangle', dur: 0.3, vol: 0.14 });
    a.tone({ f: 660, f2: 1320, type: 'sine', dur: 0.3, vol: 0.08, delay: 0.05 });
  },
  comboUp(a, { mult = 2 } = {}) {
    const base = 72 + (mult - 2) * 2;
    [0, 4, 7].forEach((s, i) => a.tone({ f: midi(base + s), type: 'square', dur: 0.12, vol: 0.05, delay: i * 0.05 }));
    a.tone({ f: midi(base + 12), type: 'triangle', dur: 0.3, vol: 0.1, delay: 0.15 });
    if (mult >= 5) a.noise({ dur: 0.5, vol: 0.12, type: 'highpass', freq: 3000, freq2: 8000, delay: 0.1 });
  },
  comboLost(a) {
    a.tone({ f: 520, f2: 260, type: 'triangle', dur: 0.22, vol: 0.08 });
  },
  damage(a) {
    a.noise({ dur: 0.25, vol: 0.3, type: 'lowpass', freq: 1800, freq2: 200 });
    a.tone({ f: 200, f2: 70, type: 'square', dur: 0.25, vol: 0.12 });
  },
  warn(a) {
    a.tone({ f: 620, type: 'square', dur: 0.08, vol: 0.04 });
  },
  hazardOff(a) {
    a.tone({ f: 400, f2: 90, type: 'sawtooth', dur: 0.3, vol: 0.06 });
  },
  ability(a, { id = 'bolt' } = {}) {
    SFX[`ability_${id}`] ? SFX[`ability_${id}`](a) : SFX.ability_bolt(a);
  },
  ability_bolt(a) {
    a.tone({ f: 220, f2: 1760, type: 'sawtooth', dur: 0.35, vol: 0.08 });
    a.noise({ dur: 0.35, vol: 0.1, type: 'bandpass', freq: 800, freq2: 6000, q: 2 });
    SFX.voice_bolt(a, 0.2);
  },
  ability_luma(a) {
    [0, 4, 7, 11, 14].forEach((s, i) => a.tone({ f: midi(76 + s), type: 'sine', dur: 0.4, vol: 0.08, delay: i * 0.05 }));
    a.tone({ f: 110, f2: 220, type: 'sine', dur: 0.6, vol: 0.12 });
  },
  ability_echo(a) {
    for (let i = 0; i < 4; i++) a.tone({ f: 660, f2: 440, type: 'sine', dur: 0.18, vol: 0.12 / (i + 1), delay: i * 0.11 });
  },
  ability_flux(a) {
    a.noise({ dur: 0.5, vol: 0.14, type: 'bandpass', freq: 400, freq2: 3000, q: 4 });
    a.tone({ f: 330, f2: 990, type: 'sine', dur: 0.4, vol: 0.08 });
  },
  ability_nova(a) {
    a.noise({ dur: 0.6, vol: 0.3, type: 'lowpass', freq: 3000, freq2: 100 });
    a.tone({ f: 120, f2: 40, type: 'sine', dur: 0.5, vol: 0.3 });
    a.tone({ f: 880, f2: 220, type: 'sawtooth', dur: 0.3, vol: 0.05 });
  },
  abilityReady(a) {
    a.tone({ f: 1175, type: 'sine', dur: 0.08, vol: 0.08 });
    a.tone({ f: 1568, type: 'sine', dur: 0.12, vol: 0.08, delay: 0.06 });
  },
  voice_bolt(a, delay = 0) {
    a.tone({ f: 900, f2: 1600, type: 'triangle', dur: 0.08, vol: 0.1, delay });
    a.tone({ f: 1400, f2: 2200, type: 'triangle', dur: 0.08, vol: 0.1, delay: delay + 0.09 });
  },
  voice_luma(a, delay = 0) {
    [0, 5, 9].forEach((s, i) => a.tone({ f: midi(84 + s), type: 'sine', dur: 0.2, vol: 0.07, delay: delay + i * 0.06 }));
  },
  voice_echo(a, delay = 0) {
    a.tone({ f: 523, f2: 494, type: 'sine', dur: 0.25, vol: 0.12, delay });
    a.tone({ f: 523, f2: 494, type: 'sine', dur: 0.25, vol: 0.05, delay: delay + 0.15 });
  },
  voice_flux(a, delay = 0) {
    a.noise({ dur: 0.3, vol: 0.08, type: 'bandpass', freq: 1500, freq2: 4000, q: 6, delay });
    a.tone({ f: 700, f2: 1100, type: 'sine', dur: 0.2, vol: 0.06, delay });
  },
  voice_nova(a, delay = 0) {
    a.tone({ f: 300, f2: 900, type: 'square', dur: 0.12, vol: 0.06, delay });
    a.noise({ dur: 0.15, vol: 0.12, type: 'lowpass', freq: 2000, delay: delay + 0.05 });
  },
  voice(a, { id = 'bolt' } = {}) {
    (SFX[`voice_${id}`] || SFX.voice_bolt)(a, 0);
  },
  countdown(a) {
    a.tone({ f: 660, type: 'square', dur: 0.12, vol: 0.06 });
  },
  go(a) {
    a.tone({ f: 1320, type: 'square', dur: 0.25, vol: 0.07 });
    a.tone({ f: 660, type: 'triangle', dur: 0.3, vol: 0.1 });
  },
  tick(a) {
    a.tone({ f: 1800, type: 'sine', dur: 0.04, vol: 0.07 });
  },
  gateOpen(a) {
    [0, 7, 12, 19].forEach((s, i) => a.tone({ f: midi(60 + s), type: 'triangle', dur: 0.4, vol: 0.09, delay: i * 0.08 }));
  },
  complete(a) {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => a.tone({ f: midi(67 + s), type: 'triangle', dur: 0.35, vol: 0.1, delay: i * 0.07 }));
    a.noise({ dur: 0.8, vol: 0.08, type: 'highpass', freq: 4000, delay: 0.3 });
  },
  fail(a) {
    [0, -3, -7].forEach((s, i) => a.tone({ f: midi(64 + s), type: 'triangle', dur: 0.35, vol: 0.1, delay: i * 0.16 }));
  },
  star(a, { i = 0 } = {}) {
    a.tone({ f: midi(79 + i * 4), type: 'triangle', dur: 0.3, vol: 0.12 });
    a.tone({ f: midi(91 + i * 4), type: 'sine', dur: 0.4, vol: 0.06, delay: 0.03 });
  },
  count(a) {
    a.tone({ f: 1400 + Math.random() * 300, type: 'sine', dur: 0.03, vol: 0.04 });
  },
  coin(a) {
    a.tone({ f: 1568, type: 'square', dur: 0.05, vol: 0.04 });
    a.tone({ f: 2093, type: 'square', dur: 0.1, vol: 0.04, delay: 0.05 });
  },
  reward(a) {
    a.noise({ dur: 0.4, vol: 0.15, type: 'bandpass', freq: 400, freq2: 4000, q: 1.5 });
    [0, 7, 12, 16].forEach((s, i) => a.tone({ f: midi(72 + s), type: 'triangle', dur: 0.3, vol: 0.09, delay: 0.15 + i * 0.05 }));
  },
  levelUp(a) {
    [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => a.tone({ f: midi(60 + s), type: i < 4 ? 'square' : 'triangle', dur: 0.25, vol: 0.07, delay: i * 0.06 }));
  },
  achievement(a) {
    [0, 7, 12].forEach((s, i) => a.tone({ f: midi(76 + s), type: 'triangle', dur: 0.3, vol: 0.09, delay: i * 0.08 }));
  },
  build(a) {
    a.noise({ dur: 1.4, vol: 0.12, type: 'bandpass', freq: 200, freq2: 2000, q: 2, attack: 0.3 });
    a.tone({ f: 110, f2: 440, type: 'sawtooth', dur: 1.4, vol: 0.04, curve: 'lin' });
  },
  buildDone(a) {
    [0, 4, 7, 12, 16].forEach((s, i) => a.tone({ f: midi(67 + s), type: 'triangle', dur: 0.4, vol: 0.1, delay: i * 0.06 }));
    a.tone({ f: 80, f2: 50, type: 'sine', dur: 0.4, vol: 0.2 });
  },
  purchase(a) {
    a.tone({ f: 1318, type: 'square', dur: 0.06, vol: 0.05 });
    a.tone({ f: 1760, type: 'square', dur: 0.12, vol: 0.05, delay: 0.06 });
    a.tone({ f: 2637, type: 'sine', dur: 0.2, vol: 0.05, delay: 0.12 });
  },
  whoosh(a) {
    a.noise({ dur: 0.45, vol: 0.18, type: 'bandpass', freq: 300, freq2: 3000, q: 1.2, attack: 0.15 });
  },
  unlock(a) {
    a.noise({ dur: 0.8, vol: 0.12, type: 'highpass', freq: 2000, freq2: 8000, attack: 0.2 });
    [0, 4, 7, 11, 14, 19].forEach((s, i) => a.tone({ f: midi(64 + s), type: 'triangle', dur: 0.5, vol: 0.08, delay: 0.2 + i * 0.07 }));
  },
  collect(a) {
    [0, 5, 10].forEach((s, i) => a.tone({ f: midi(81 + s), type: 'sine', dur: 0.15, vol: 0.1, delay: i * 0.05 }));
  },
  pause(a) {
    a.tone({ f: 600, f2: 400, type: 'sine', dur: 0.12, vol: 0.1 });
  },
};

// ------------------------------------------------------------------ Music
const TRACKS = {
  island: {
    bpm: 92,
    // Fmaj7 · Dm9 · Bbmaj7 · C6 — bright and relaxed
    chords: [
      [53, 57, 60, 64],
      [50, 57, 60, 64],
      [46, 53, 57, 62],
      [48, 55, 57, 64],
    ],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
    drums: 'soft',
    padVol: 0.05,
    arpVol: 0.045,
    bassVol: 0.08,
  },
  challenge: {
    bpm: 124,
    // Am · F · C · G — driving
    chords: [
      [45, 57, 60, 64],
      [41, 57, 60, 65],
      [48, 55, 60, 64],
      [43, 55, 59, 62],
    ],
    arp: [0, 2, 3, 1, 3, 2, 3, 1, 0, 3, 2, 3, 1, 2, 3, 2],
    drums: 'drive',
    padVol: 0.035,
    arpVol: 0.05,
    bassVol: 0.1,
  },
};

export class MusicPlayer {
  constructor(audio) {
    this.a = audio;
    this.ctx = audio.ctx;
    this.out = audio.musicBus;
    this.timer = 0;
    this.trackId = null;
  }

  play(id) {
    if (this.trackId === id) return;
    this.stop();
    const track = TRACKS[id];
    if (!track) return;
    this.trackId = id;
    this.track = track;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.schedule(), 30);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    this.trackId = null;
  }

  schedule() {
    if (this.ctx.state !== 'running') {
      this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    if (this.a.musicVol <= 0.001) {
      this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / this.track.bpm / 4;
    // Recover if we fell far behind (tab was hidden).
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  voice(note, time, dur, type, vol, filterFreq = 2400) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.value = midi(note);
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.out);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  pad(notes, time, dur, vol) {
    const ctx = this.ctx;
    for (const n of notes.slice(1)) {
      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.value = midi(n);
        osc.detune.value = det;
        f.type = 'lowpass';
        f.frequency.value = 900;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(vol, time + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, time + dur);
        osc.connect(f);
        f.connect(g);
        g.connect(this.out);
        osc.start(time);
        osc.stop(time + dur + 0.05);
      }
    }
  }

  kick(time, vol = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.18);
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    osc.connect(g);
    g.connect(this.out);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  hat(time, vol = 0.05, dur = 0.04) {
    this.a.noise({ dur, vol, type: 'highpass', freq: 7000, delay: time - this.ctx.currentTime, dest: this.out, attack: 0.002 });
  }

  clap(time, vol = 0.12) {
    this.a.noise({ dur: 0.14, vol, type: 'bandpass', freq: 1500, q: 0.8, delay: time - this.ctx.currentTime, dest: this.out, attack: 0.003 });
  }

  playStep(step, time, stepDur) {
    const tr = this.track;
    const bar = Math.floor(step / 16) % tr.chords.length;
    const s = step % 16;
    const chord = tr.chords[bar];
    if (s === 0) this.pad(chord, time, stepDur * 16, tr.padVol);
    // Bass
    if (tr.drums === 'drive') {
      if (s % 2 === 0) this.voice(chord[0] - 12 + (s % 8 === 6 ? 12 : 0), time, stepDur * 1.8, 'triangle', tr.bassVol, 600);
    } else if (s === 0 || s === 10) {
      this.voice(chord[0] - 12, time, stepDur * 6, 'triangle', tr.bassVol, 500);
    }
    // Arp
    const arpIdx = tr.arp[s % tr.arp.length];
    const arpEvery = tr.drums === 'drive' ? 1 : 2;
    if (s % arpEvery === 0) {
      const note = chord[arpIdx] + 12 + (bar % 2 === 1 && s >= 8 ? 12 : 0);
      this.voice(note, time, stepDur * 1.6, tr.drums === 'drive' ? 'square' : 'triangle', tr.arpVol, tr.drums === 'drive' ? 2200 : 3200);
    }
    // Drums
    if (tr.drums === 'drive') {
      if (s % 4 === 0) this.kick(time, 0.42);
      if (s === 4 || s === 12) this.clap(time, 0.09);
      if (s % 4 === 2) this.hat(time, 0.05, 0.05);
      else if (s % 2 === 1) this.hat(time, 0.018);
    } else {
      if (s === 0 || s === 10) this.kick(time, 0.25);
      if (s % 4 === 2) this.hat(time, 0.02);
      if (s === 12) this.clap(time, 0.04);
    }
  }
}

export function nexVoiceId(nexId) {
  return NEX[nexId] ? nexId : 'bolt';
}
