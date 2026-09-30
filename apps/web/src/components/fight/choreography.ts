import type { FightEventView, FightReplay } from '@dark/shared';
import { duration } from './replay';

/** Cosmetic timing only; damage, health and status values still come from replay snapshots. */
export interface Cue {
  actor: string | null;
  targets: string[];
  contact: number;
  length: number;
  hold: number;
  slow: number;
}

export function cueFor(replay: FightReplay, event: FightEventView | null, reduced: boolean): Cue {
  const cue: Cue = { actor: null, targets: [], contact: 0, length: duration(event, reduced), hold: 0, slow: 0 };
  if (!event) return cue;
  if ('actor' in event) cue.actor = event.actor ?? null;
  if ('target' in event && event.target) cue.targets = [event.target];
  if (event.type === 'burst') cue.targets = event.targets.map(hit => hit.key);
  if (event.type === 'heal') { cue.actor = event.by ?? event.actor; cue.targets = [event.actor]; }
  if (['down', 'death-save', 'rise', 'reroll', 'save', 'feature', 'escape', 'revive'].includes(event.type)) {
    cue.actor = 'actor' in event ? event.actor ?? 'hero' : 'hero';
  }
  if (event.type === 'blocked') cue.targets = [event.target ?? 'hero'];
  if (event.type === 'down' || event.type === 'rise') cue.targets = [event.actor ?? 'hero'];
  if (event.type === 'held') cue.actor = event.target;
  if (event.type === 'feature') {
    cue.actor = event.actor ?? 'hero';
    cue.targets = ['mark', 'help', 'guard'].includes(event.feature) ? (event.target ? [event.target] : []) : [cue.actor];
  }
  if (reduced) return cue;
  switch (event.type) {
    case 'attack': {
      const actor = event.actor === 'hero' ? replay.hero : event.actor === 'ally' ? replay.ally : replay.monsters.find(m => m.key === event.actor);
      const ranged = event.kind === 'spell' || actor?.strike === 'shoot';
      cue.contact = ranged ? 400 : 260;
      cue.length = event.crit ? 1100 : ranged ? 900 : 800;
      if (event.hit) { cue.hold = 65; cue.slow = event.crit ? 180 : 0; }
      break;
    }
    case 'burst': cue.contact = 480; cue.length = 1400; cue.hold = 65; break;
    case 'heal': cue.contact = event.by ? 420 : 160; cue.length = 900; break;
    case 'revive': cue.contact = 500; cue.length = 1400; break;
    case 'feature':
      if (event.feature === 'rage') { cue.contact = 180; cue.length = 1100; cue.hold = 65; }
      if (event.feature === 'mark') { cue.contact = 420; cue.length = 850; }
      if (event.feature === 'relentless') { cue.contact = 400; cue.length = 1100; cue.hold = 65; }
      if (['help', 'guard', 'dodge'].includes(event.feature)) { cue.contact = 320; cue.length = 1000; }
      break;
    case 'power':
      cue.contact = event.power === 'breath' ? 300 : 180;
      if (event.power === 'breath' || event.power === 'explode' || event.power === 'wail') cue.hold = 65;
      break;
    case 'defeated': cue.contact = 80; cue.length = 750; break;
    case 'down': cue.contact = 80; break;
    default: break;
  }
  return cue;
}

/** Wall time includes the contact freeze and the extra time spent in a critical slow motion. */
export const cueDuration = (cue: Cue) => cue.length + cue.hold + cue.slow * .6;
export function sceneTime(wall: number, cue: Cue): number {
  if (wall <= cue.contact) return wall;
  if (wall <= cue.contact + cue.hold) return cue.contact;
  const afterHold = wall - cue.contact - cue.hold;
  return cue.contact + Math.min(afterHold, cue.slow) * .4 + Math.max(0, afterHold - cue.slow);
}

/** A pause/speed change first accounts for time at the old rate, so it never restarts a blow. */
export class Playhead {
  elapsed = 0;
  private at = 0;
  private rate = 0;
  update(now: number): number {
    this.elapsed += Math.max(0, now - this.at) * this.rate;
    this.at = now;
    return this.elapsed;
  }
  setRate(now: number, rate: number): void { this.update(now); this.rate = rate; }
}

export function readSpeed(): 1 | 2 {
  try { return localStorage.getItem('dc.fight.speed') === '2' ? 2 : 1; }
  catch { return 1; }
}
export function saveSpeed(speed: 1 | 2): void {
  try { localStorage.setItem('dc.fight.speed', String(speed)); }
  catch { /* The current replay still uses the selected speed in private windows. */ }
}
