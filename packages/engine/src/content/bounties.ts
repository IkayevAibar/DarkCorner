import type { ThreatId } from '../combat.js';
import type { Rng } from '../rng.js';
import type { ThemeId } from './floors.js';
import { themeOf } from './floors.js';
import type { MonsterKin } from './monsters.js';
import { type Text, text } from './text.js';

/**
 * Tavern bounties: three small goals a day and one bigger one a week, per Hero
 * (docs/design.md → Tavern bounties, v0). They are drawn from a seed per Hero and
 * day, sized to how deep the Hero has been, and pay the moment they are done.
 */
export const DAILY_BOUNTIES = 3;

export const BOUNTY_KINDS = [
  'slay', 'slay-kin', 'deep', 'sneak', 'treasure', 'event', 'elite', 'risky', 'bank', 'miniboss', 'depth', 'slay-week',
] as const;
export type BountyKind = (typeof BOUNTY_KINDS)[number];

const DAILY_KINDS: BountyKind[] = ['slay', 'slay-kin', 'deep', 'sneak', 'treasure', 'event', 'elite', 'risky', 'bank'];
const WEEKLY_KINDS: BountyKind[] = ['miniboss', 'depth', 'slay-week'];

export interface BountyReward {
  gold: number;
  item: { base: string; quantity: number } | null;
}

export interface BountySpec {
  kind: BountyKind;
  target: number;
  /** The monster kin to defeat (slay-kin), or the Floor to fight on or reach (deep, depth). */
  params: { kin?: MonsterKin; floor?: number };
  reward: BountyReward;
}

/** What happened, as far as bounties care. */
export type BountyEvent =
  | { type: 'fight-won'; floor: number; kins: MonsterKin[]; elites: number; threat: ThreatId | null; miniboss: boolean }
  | { type: 'sneak' }
  | { type: 'treasure' }
  | { type: 'event' }
  | { type: 'bank'; gold: number }
  | { type: 'depth'; floor: number };

/** Which kin a Hero this deep meets most, for "defeat N …" bounties. */
const KIN_OF: Record<ThemeId, MonsterKin[]> = {
  warrens: ['goblinoid', 'beast'],
  crypts: ['undead'],
  depths: ['demon', 'humanoid'],
  lair: ['dragonkin'],
};

const DAILY_ITEMS: [BountyReward['item'], number][] = [
  [null, 3],
  [{ base: 'potion', quantity: 2 }, 3],
  [{ base: 'scroll-identify', quantity: 2 }, 2],
  [{ base: 'bomb-fire', quantity: 1 }, 2],
  [{ base: 'bomb-smoke', quantity: 1 }, 1],
  [{ base: 'key-iron', quantity: 1 }, 1],
];

function weighted<T>(rng: Rng, table: [T, number][]): T {
  let r = rng.next() * table.reduce((s, [, w]) => s + w, 0);
  return (table.find(([, w]) => (r -= w) < 0) ?? table[0]!)[0];
}

/** One daily bounty of a kind, sized for a Hero whose deepest Floor is `depth`. */
function daily(rng: Rng, kind: BountyKind, depth: number): BountySpec {
  const reward: BountyReward = { gold: 30 + 15 * depth, item: weighted(rng, DAILY_ITEMS) };
  switch (kind) {
    case 'slay': return { kind, target: rng.int(6, 10), params: {}, reward };
    case 'slay-kin': return { kind, target: rng.int(4, 6), params: { kin: rng.pick(KIN_OF[themeOf(depth)]) }, reward };
    case 'deep': return { kind, target: rng.int(3, 5), params: { floor: Math.max(1, depth - 1) }, reward };
    case 'sneak': return { kind, target: rng.int(2, 3), params: {}, reward };
    case 'treasure': return { kind, target: rng.int(1, 2), params: {}, reward };
    case 'event': return { kind, target: rng.int(2, 3), params: {}, reward };
    case 'elite': return { kind, target: 1, params: {}, reward: { ...reward, gold: reward.gold * 2 } };
    case 'risky': return { kind, target: rng.int(1, 2), params: {}, reward: { ...reward, gold: Math.round(reward.gold * 1.5) } };
    case 'bank': return { kind, target: 60 * depth, params: {}, reward };
    default: throw new Error(`${kind} is not a daily bounty`);
  }
}

/** Today's three for a Hero: three different kinds. Elites only exist from Floor 2. */
export function dailyBounties(rng: Rng, depth: number): BountySpec[] {
  const floor = Math.max(1, depth);
  const kinds = DAILY_KINDS.filter((k) => k !== 'elite' || floor >= 2);
  const out: BountySpec[] = [];
  while (out.length < DAILY_BOUNTIES) {
    const kind = rng.pick(kinds.filter((k) => !out.some((b) => b.kind === k)));
    out.push(daily(rng, kind, floor));
  }
  return out;
}

/** This week's bigger one: a Mini-boss, a new Floor, or a lot of monsters. It pays a Silver Chest on top of gold. */
export function weeklyBounty(rng: Rng, depth: number): BountySpec {
  const floor = Math.max(1, depth);
  const kinds = WEEKLY_KINDS.filter((k) => k !== 'depth' || floor < 10);
  const kind = rng.pick(kinds);
  const reward: BountyReward = { gold: 300 + 100 * floor, item: { base: 'chest-silver', quantity: 1 } };
  switch (kind) {
    case 'miniboss': return { kind, target: 1, params: {}, reward };
    case 'depth': return { kind, target: 1, params: { floor: floor + 1 }, reward };
    default: return { kind: 'slay-week', target: 60, params: {}, reward };
  }
}

const THREAT_RANK: ThreatId[] = ['trivial', 'easy', 'risky', 'dangerous', 'deadly'];

/** How much one event moves a bounty along (0 when it doesn't count). */
export function bountyStep(spec: BountySpec, event: BountyEvent): number {
  switch (spec.kind) {
    case 'slay':
    case 'slay-week':
      return event.type === 'fight-won' ? event.kins.length : 0;
    case 'slay-kin':
      return event.type === 'fight-won' ? event.kins.filter((k) => k === spec.params.kin).length : 0;
    case 'deep':
      return event.type === 'fight-won' && event.floor >= (spec.params.floor ?? 1) ? 1 : 0;
    case 'elite':
      return event.type === 'fight-won' ? event.elites : 0;
    case 'risky':
      return event.type === 'fight-won' && event.threat && THREAT_RANK.indexOf(event.threat) >= THREAT_RANK.indexOf('risky') ? 1 : 0;
    case 'miniboss':
      return event.type === 'fight-won' && event.miniboss ? 1 : 0;
    case 'sneak':
      return event.type === 'sneak' ? 1 : 0;
    case 'treasure':
      return event.type === 'treasure' ? 1 : 0;
    case 'event':
      return event.type === 'event' ? 1 : 0;
    case 'bank':
      return event.type === 'bank' ? event.gold : 0;
    case 'depth':
      return event.type === 'depth' && event.floor >= (spec.params.floor ?? 99) ? 1 : 0;
  }
}

const KIN_NAMES: Record<MonsterKin, Text> = {
  goblinoid: text('goblins', 'гоблинов'),
  beast: text('beasts', 'зверей'),
  undead: text('undead', 'нежить'),
  demon: text('demons', 'демонов'),
  humanoid: text('cultists', 'культистов'),
  dragonkin: text('dragonkin', 'драконидов'),
};

/**
 * What the bounty asks, in both languages. Russian names the goal and then the
 * number after a colon, which needs no agreement with it.
 */
export function bountyTitle(spec: BountySpec): Text {
  const n = spec.target;
  const f = spec.params.floor ?? 0;
  switch (spec.kind) {
    case 'slay':
    case 'slay-week': return text(`Defeat ${n} monsters`, `Одолеть монстров: ${n}`);
    case 'slay-kin': {
      const kin = KIN_NAMES[spec.params.kin ?? 'goblinoid'];
      return text(`Defeat ${n} ${kin.en}`, `Одолеть ${kin.ru}: ${n}`);
    }
    case 'deep': return text(`Win ${n} fights on Floor ${f} or deeper`, `Победы на этаже ${f} и глубже: ${n}`);
    case 'sneak': return text(`Sneak past ${n} groups of monsters`, `Прокрасться мимо монстров: ${n}`);
    case 'treasure': return text(`Loot ${n} Treasure rooms`, `Обчистить клады: ${n}`);
    case 'event': return text(`Deal with ${n} Event rooms`, `Разобраться со странными комнатами: ${n}`);
    case 'elite': return text('Defeat an elite', 'Одолеть элиту');
    case 'risky': return text(`Win ${n} fights rated Risky or worse`, `Победы в боях с угрозой от «Рискованно»: ${n}`);
    case 'bank': return text(`Bring ${n} gold back to the City`, `Принести в город золота: ${n}`);
    case 'miniboss': return text('Defeat a Mini-boss', 'Одолеть мини-босса');
    case 'depth': return text(`Reach Floor ${f}`, `Добраться до этажа ${f}`);
  }
}

/** Monday of the week `day` falls in, as a day number (day 0, 1970-01-01, was a Thursday). */
export const weekOf = (day: number): number => day - ((day + 3) % 7);
