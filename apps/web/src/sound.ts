import { useSyncExternalStore } from 'react';
import type { Tier } from '@dark/shared';
import type { PlayOptions, Sound } from './audio/catalog';
import type { createPlayer } from './audio/player';
export type { PlayOptions, Sound } from './audio/catalog';

const STORAGE_KEY = 'dc.sound';
let on = true;
try { on = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* Private windows can refuse storage. */ }
const listeners = new Set<() => void>();
let context: AudioContext | null = null;
let player: ReturnType<typeof createPlayer> | null = null;
let loading: Promise<void> | null = null;
let generation = 0;
const GESTURES = ['pointerup', 'click', 'keydown'] as const;

/** Sound and vibration share the persistent switch on the account sheet. */
export function setSoundOn(value: boolean): void {
  on = value;
  try { localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off'); } catch { /* Keep the choice for this page. */ }
  player?.mute(!value);
  if (!value) {
    generation++;
    vibrate(0);
  } else wake();
  listeners.forEach(listener => listener());
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => on,
  );
}

/** Kept alongside the existing hooks for the task-09 component contract. */
export function useSoundSetting(): [boolean, typeof setSoundOn] { return [useSoundOn(), setSoundOn]; }

function wake(): void {
  if (!on) return;
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    try { context = new Context(); } catch { return; }
  }
  const ctx = context;
  // Creation/resume stays inside the tap, including on iOS; the mixer can load later.
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  loading ??= import('./audio/player').then(({ createPlayer }) => {
    player = createPlayer(ctx);
    player.mute(!on);
    player.prime();
  }).catch(() => { loading = null; });
}

// Retain the listeners to resume audio after a phone returns from the background.
GESTURES.forEach(gesture => window.addEventListener(gesture, wake, true));

export function play(sound: Sound, options?: PlayOptions): void {
  // Do not queue anything before a real interaction unlocks audio.
  if (!on || !context || context.state !== 'running') return;
  if (player) { player.play(sound, options); return; }
  const stamp = generation, requestedAt = performance.now();
  void loading?.then(() => {
    if (on && stamp === generation && performance.now() - requestedAt < 1000) player?.play(sound, options);
  });
}

/** Common rustles; each higher Tier adds weight, with steel and vibration at Mythic. */
export function playTier(tier: Tier): void {
  switch (tier) {
    case 'common':
    case 'uncommon': play('loot'); break;
    case 'rare': play('reveal'); break;
    case 'epic': play('reveal'); play('chips', { delay: 140 }); break;
    case 'legendary':
      play('reveal', { rate: 0.94 }); play('coins', { delay: 110 }); play('chips', { delay: 300 }); break;
    case 'mythic':
    case 'relic':
      play('reveal', { rate: 0.86 }); play('crit', { rate: 0.78, delay: 90 });
      play('coins', { delay: 200 }); play('chips', { delay: 420 }); buzz([70, 50, 140]); break;
  }
}

function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* Unsupported on some phones. */ }
}

/** Android vibration; unsupported browsers stay silent. */
export function buzz(pattern: number | number[]): void { if (on) vibrate(pattern); }
