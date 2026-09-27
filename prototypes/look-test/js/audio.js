// PROTOTYPE sound: everything is synthesized with WebAudio, no sound files.
import { tierRank } from './data.js';

let ctx = null;
let master = null;
let enabled = true;

function ac() {
  if (!enabled) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const setSound = (on) => { enabled = on; };
export const soundOn = () => enabled;

function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, at = 0, slide = 0, attack = 0.005 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.15, vol = 0.3, at = 0, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  tick: () => tone(1800, { type: 'square', dur: 0.03, vol: 0.06 }),
  click: () => tone(900, { type: 'triangle', dur: 0.05, vol: 0.08 }),
  door: () => { tone(90, { type: 'sawtooth', dur: 0.6, vol: 0.08, slide: 40 }); noise({ dur: 0.5, vol: 0.12, freq: 400 }); },
  swing: () => noise({ dur: 0.18, vol: 0.18, freq: 2500, q: 0.6 }),
  hit: () => { noise({ dur: 0.12, vol: 0.35, freq: 700 }); tone(110, { type: 'sine', dur: 0.18, vol: 0.4, slide: -50 }); },
  miss: () => noise({ dur: 0.25, vol: 0.12, freq: 3000, q: 0.4 }),
  crit: () => {
    tone(80, { type: 'sine', dur: 0.5, vol: 0.5, slide: -40 });
    noise({ dur: 0.25, vol: 0.4, freq: 900 });
    [880, 1320, 1760].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.8, vol: 0.12, at: 0.02 * i }));
  },
  dice: () => { for (let i = 0; i < 6; i++) tone(700 + Math.random() * 900, { type: 'square', dur: 0.025, vol: 0.05, at: i * 0.07 }); },
  diceLand: (good) => {
    tone(good ? 660 : 180, { type: 'triangle', dur: 0.35, vol: 0.2 });
    if (good) tone(990, { type: 'triangle', dur: 0.5, vol: 0.14, at: 0.08 });
  },
  kill: () => { tone(220, { type: 'sawtooth', dur: 0.4, vol: 0.08, slide: -150 }); noise({ dur: 0.3, vol: 0.15, freq: 300 }); },
  victory: () => [392, 523, 659, 784].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.5, vol: 0.14, at: i * 0.09 })),
  down: () => { tone(160, { type: 'sawtooth', dur: 1.2, vol: 0.12, slide: -100 }); noise({ dur: 0.6, vol: 0.2, freq: 200 }); },
  identify: () => { noise({ dur: 0.9, vol: 0.08, freq: 5000, q: 2 }); tone(300, { type: 'sine', dur: 0.9, vol: 0.1, slide: 600 }); },
  statPop: (i) => tone(520 + i * 90, { type: 'triangle', dur: 0.12, vol: 0.1 }),
  reveal(tier) {
    const r = tierRank(tier);
    const scale = [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5];
    const notes = scale.slice(0, 2 + Math.min(r, 5));
    notes.forEach((f, i) => tone(f, { type: 'triangle', dur: 0.6 + r * 0.15, vol: 0.12, at: i * 0.06 }));
    if (r >= 3) tone(notes[notes.length - 1] * 2, { type: 'sine', dur: 1.2, vol: 0.08, at: 0.3 });
    if (r >= 5) {
      tone(55, { type: 'sine', dur: 1.6, vol: 0.55, slide: -20 });
      noise({ dur: 0.8, vol: 0.3, freq: 150, type: 'lowpass' });
    }
    if (r >= 6) [1318.5, 1568, 2093].forEach((f, i) => tone(f, { type: 'sine', dur: 1.4, vol: 0.06, at: 0.45 + i * 0.12 }));
  },
};
