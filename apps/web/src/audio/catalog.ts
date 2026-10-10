/** Approved Kenney RPG / Casino Audio (CC0), kept unchanged in public/sfx. */
export const FILES = {
  door: ['door-1', 'door-2'], creak: ['creak'], step: ['step-1', 'step-2'],
  draw: ['draw'], hit: ['hit-1', 'hit-2', 'hit-3'], miss: ['miss'], crit: ['crit'],
  grave: ['grave'], anvil: ['anvil'], die: ['die-1', 'die-2'], dice: ['dice'],
  shake: ['shake'], coins: ['coins-1', 'coins-2'], chips: ['chips'], loot: ['loot'],
  latch: ['latch'], tick: ['tick-1', 'tick-2'], reveal: ['reveal'], page: ['page'], equip: ['equip'],
} as const;

export type Sound = keyof typeof FILES;

export interface PlayOptions {
  /** 0–1, on top of the sound's own level. */
  volume?: number;
  /** Playback speed and pitch: 1 as recorded, below 1 deeper and slower. */
  rate?: number;
  /** Milliseconds to wait, for layering sounds. */
  delay?: number;
}
