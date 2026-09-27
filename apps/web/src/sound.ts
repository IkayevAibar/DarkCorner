import { useSyncExternalStore } from 'react';
import type { Tier } from '@dark/shared';

/**
 * Sound effects from Kenney's RPG Audio and Casino Audio packs (CC0), kept as OGG
 * in public/sfx (docs/art/icons-and-sounds.md says where each one comes from).
 * Scenes call play(sound). A file loads the first time it's needed and is
 * decoded once. The only randomness here is cosmetic (which variant plays and a
 * slight change of pitch), so it stays in the browser.
 */
const FILES = {
  door: ['door-1', 'door-2'],
  creak: ['creak'],
  step: ['step-1', 'step-2'],
  draw: ['draw'],
  hit: ['hit-1', 'hit-2', 'hit-3'],
  miss: ['miss'],
  crit: ['crit'],
  grave: ['grave'],
  anvil: ['anvil'],
  die: ['die-1', 'die-2'],
  dice: ['dice'],
  shake: ['shake'],
  coins: ['coins-1', 'coins-2'],
  chips: ['chips'],
  loot: ['loot'],
  latch: ['latch'],
  tick: ['tick-1', 'tick-2'],
  reveal: ['reveal'],
  page: ['page'],
  equip: ['equip'],
} as const satisfies Record<string, readonly string[]>;

export type Sound = keyof typeof FILES;

/** Sounds heard many times in a row get a slightly different pitch each time, so they don't drone. */
const VARIED: ReadonlySet<Sound> = new Set(['door', 'step', 'hit', 'miss', 'die', 'tick', 'coins', 'loot']);
const LEVEL: Partial<Record<Sound, number>> = { tick: 0.35, step: 0.5, miss: 0.6, page: 0.7 };
/** Loaded as soon as audio wakes, so the first door or blow isn't late. */
const EARLY: Sound[] = ['door', 'hit', 'miss', 'die', 'coins', 'loot', 'tick'];

const STORAGE_KEY = 'dc.sound';
let on = readSetting();
const listeners = new Set<() => void>();

function readSetting(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Sound and vibration together: one switch on the account sheet. */
export function setSoundOn(value: boolean): void {
  on = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Private windows can refuse storage; the choice then lasts until the page closes.
  }
  listeners.forEach((listener) => listener());
  if (value) wake();
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => on,
  );
}

let context: AudioContext | null = null;
let output: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function audio(): AudioContext | null {
  if (context) return context;
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  context = new Context();
  output = context.createGain();
  output.gain.value = 0.8;
  output.connect(context.destination);
  return context;
}

/**
 * Browsers keep audio asleep until the first tap or key press, and iPhones only
 * count a tap once the finger lifts. Until then, play() stays quiet rather than
 * saving sounds up for later.
 */
const GESTURES = ['pointerup', 'click', 'keydown'] as const;

function wake(): void {
  if (!on) return;
  const ctx = audio();
  if (!ctx) return;
  const ready = () => {
    if (ctx.state !== 'running') return;
    GESTURES.forEach((gesture) => window.removeEventListener(gesture, wake, true));
    EARLY.forEach((sound) => FILES[sound].forEach(load));
  };
  if (ctx.state === 'suspended') void ctx.resume().then(ready, () => {});
  else ready();
}

GESTURES.forEach((gesture) => window.addEventListener(gesture, wake, true));

function load(file: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(file);
  if (!buffer) {
    buffer = fetch(`/sfx/${file}.ogg`)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((data) => audio()!.decodeAudioData(data))
      // Safari before 18.4 can't decode OGG: those phones stay silent.
      .catch(() => null);
    buffers.set(file, buffer);
  }
  return buffer;
}

export interface PlayOptions {
  /** 0–1, on top of the sound's own level. */
  volume?: number;
  /** Playback speed and pitch: 1 is as recorded, below 1 is deeper and slower. */
  rate?: number;
  /** Milliseconds to wait, for layering sounds. */
  delay?: number;
}

export function play(sound: Sound, { volume = 1, rate, delay = 0 }: PlayOptions = {}): void {
  if (!on || !context || !output || context.state !== 'running') return;
  const ctx = context;
  const out = output;
  const files = FILES[sound];
  const file = files[Math.floor(Math.random() * files.length)]!;
  void load(file).then((buffer) => {
    if (!buffer || ctx.state !== 'running') return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate ?? (VARIED.has(sound) ? 0.93 + Math.random() * 0.14 : 1);
    const gain = ctx.createGain();
    gain.gain.value = volume * (LEVEL[sound] ?? 1);
    source.connect(gain).connect(out);
    source.start(ctx.currentTime + delay / 1000);
  });
}

/** A reveal that grows with the Tier: a Common is a rustle, a Mythic a crash of steel and coin. */
export function playTier(tier: Tier): void {
  switch (tier) {
    case 'common':
    case 'uncommon':
      play('loot');
      break;
    case 'rare':
      play('reveal');
      break;
    case 'epic':
      play('reveal');
      play('chips', { delay: 140 });
      break;
    case 'legendary':
      play('reveal', { rate: 0.94 });
      play('coins', { delay: 110 });
      play('chips', { delay: 300 });
      break;
    case 'mythic':
    case 'relic':
      play('reveal', { rate: 0.86 });
      play('crit', { rate: 0.78, delay: 90 });
      play('coins', { delay: 200 });
      play('chips', { delay: 420 });
      buzz([70, 50, 140]);
      break;
  }
}

/** Android phones vibrate for Mythic-or-better drops and natural 20s; iPhones don't let websites vibrate. */
export function buzz(pattern: number | number[]): void {
  if (!on) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw instead of ignoring it.
  }
}
