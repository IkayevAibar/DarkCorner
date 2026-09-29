import { type HeroCombat, type MonsterInstance, instantiate, spawnEncounter } from './combat.js';
import { FLOOR_COUNT, THEMES, themeOf } from './content/floors.js';
import { ELITES, monsterById } from './content/monsters.js';
import type { OmenDef } from './content/omens.js';
import { type Text, text } from './content/text.js';
import type { RestUses } from './levels.js';
import { createRng } from './rng.js';

// The Daily Delve (docs/design.md → The Daily Delve): once a day, every Hero goes
// down the same string of Rooms, each deeper than the last, and stops when it
// likes. Nothing is lost there: its health, potions and abilities are its own.

/** Rooms in a Delve; the last holds its guardian (v0). */
export const DELVE_ROOMS = 6;
/** How much deeper than the Delve's Floor each Room is (v0). */
export const DELVE_RISE = [0, 0, 1, 1, 2, 2] as const;
/** Healing potions the Delve hands out at the top; the Hero's Bag stays shut (v0). */
export const DELVE_POTIONS = 2;
/** Points for each Room won; stopping or clearing adds the health left, in percent (v0). */
export const DELVE_ROOM_POINTS = 100;
/** Gold for each Room won, times the Delve's Floor plus one (v0). */
export const DELVE_GOLD = 10;
/** The Chests the day's first three win, in order (v0). */
export const DELVE_PRIZES = ['gold', 'silver', 'iron'] as const;

/** How a Delve ended: the Player stopped, ran from a fight, fell, or won every Room. */
export const DELVE_ENDS = ['stopped', 'fled', 'fell', 'cleared'] as const;
export type DelveEnd = (typeof DELVE_ENDS)[number];

/** The Delve's Floor for a Hero: its deepest, or half its level, whichever is deeper. */
export function delveFloor(bestFloor: number, level: number): number {
  return Math.min(FLOOR_COUNT, Math.max(1, bestFloor, Math.ceil(level / 2)));
}

/** The Floor a Room's monsters come from; `room` counts from 0. */
export const delveRoomFloor = (floor: number, room: number): number => Math.min(FLOOR_COUNT, floor + DELVE_RISE[room]!);

export const delveRoomKind = (room: number): 'fight' | 'miniboss' => (room === DELVE_ROOMS - 1 ? 'miniboss' : 'fight');

/** One seed a day for the whole server: every Hero meets the same rolls and Boons. */
export const delveSeed = (seasonSeed: string, day: number): string => `${seasonSeed}:delve:${day}`;

/**
 * Who waits in a Room of the Delve. The Dragon's lair has no Mini-boss, so a guardian
 * that deep is a pair of Drakes, one of them an elite.
 */
export function delveEncounter(seed: string, floor: number, room: number, omen: OmenDef | null): MonsterInstance[] {
  const rng = createRng(`${seed}:room:${room}`);
  const at = delveRoomFloor(floor, room);
  if (delveRoomKind(room) === 'miniboss' && themeOf(at) === 'lair') {
    const drake = monsterById('drake');
    return [instantiate(drake, at, 'm0', 0, rng.pick([...ELITES])), instantiate(drake, at, 'm1')];
  }
  return spawnEncounter(rng, at, delveRoomKind(room), 0, omen);
}

/** The Room map a Delve fight is drawn on, from its Floor's theme. */
export const delveMap = (seed: string, floor: number, room: number): string =>
  createRng(`${seed}:map:${room}`).pick(THEMES[themeOf(delveRoomFloor(floor, room))].maps);

// ─── Boons ────────────────────────────────────────────────────────────────

export const BOON_IDS = ['mend', 'draught', 'breath', 'whetstone', 'ward', 'keen', 'leech'] as const;
export type BoonId = (typeof BOON_IDS)[number];

export interface BoonDef {
  id: BoonId;
  name: Text;
  about: Text;
}

/** Health a Mend gives back, and a Second breath, as a share of full health (v0). */
export const MEND_SHARE = 0.4;
export const BREATH_SHARE = 0.15;

export const BOONS: Record<BoonId, BoonDef> = {
  mend: { id: 'mend', name: text('Mend', 'Перевязка'), about: text('Heal 40% of full health.', 'Восстановить 40% здоровья.') },
  draught: { id: 'draught', name: text('Draught', 'Зелье'), about: text('One more Healing potion for this Delve.', 'Ещё одно лечебное зелье на этот спуск.') },
  breath: {
    id: 'breath', name: text('Second breath', 'Второе дыхание'),
    about: text(
      'What a rest brings back comes back (spells, healing prayers, Rages, Hunter’s marks), and 15% of full health.',
      'Возвращается всё, что даёт отдых (заклинания, лечебные молитвы, ярость, метки охотника), и ещё 15% здоровья.',
    ),
  },
  whetstone: { id: 'whetstone', name: text('Whetstone', 'Точильный камень'), about: text('+15% damage for the rest of the Delve.', '+15% урона до конца спуска.') },
  ward: { id: 'ward', name: text('Ward', 'Оберег'), about: text('+2 AC for the rest of the Delve.', '+2 к КД до конца спуска.') },
  keen: { id: 'keen', name: text('Keen eye', 'Зоркий глаз'), about: text('+10% critical hit chance for the rest of the Delve.', '+10% к шансу критического удара до конца спуска.') },
  leech: { id: 'leech', name: text('Leech', 'Пиявка'), about: text('Heal 10% of the damage you deal, for the rest of the Delve.', 'До конца спуска 10% нанесённого урона лечат вас.') },
};

/** The two Boons offered before Room `room` (from 1, after a win); the same for everyone that day. */
export function delveOffer(seed: string, room: number): [BoonId, BoonId] {
  const rng = createRng(`${seed}:boons:${room}`);
  const first = rng.pick([...BOON_IDS]);
  return [first, rng.pick(BOON_IDS.filter((b) => b !== first))];
}

/** The Hero as it fights in the Delve: the lasting Boons on top of its own gear. */
export function withBoons(hero: HeroCombat, boons: readonly BoonId[]): HeroCombat {
  const n = (id: BoonId) => boons.filter((b) => b === id).length;
  return {
    ...hero,
    ac: hero.ac + 2 * n('ward'),
    damagePct: hero.damagePct + 15 * n('whetstone'),
    critChance: hero.critChance + 10 * n('keen'),
    lifeSteal: hero.lifeSteal + 10 * n('leech'),
  };
}

/** What the Delve carries from Room to Room. */
export interface DelveState {
  hp: number;
  potions: number;
  uses: RestUses;
}

/** A Boon's gift the moment it is taken; the lasting ones work through withBoons(). */
export function takeBoon(state: DelveState, boon: BoonId, full: { maxHp: number; uses: RestUses }): DelveState {
  const heal = (share: number) => Math.min(full.maxHp, state.hp + Math.round(full.maxHp * share));
  switch (boon) {
    case 'mend': return { ...state, hp: heal(MEND_SHARE) };
    case 'draught': return { ...state, potions: state.potions + 1 };
    case 'breath': return { ...state, hp: heal(BREATH_SHARE), uses: { ...full.uses } };
    default: return state;
  }
}

// ─── Score and pay ────────────────────────────────────────────────────────

/**
 * Points: 100 a Room won, plus the health left in percent for a Hero that stopped or
 * won them all. Running from a fight keeps the Rooms; falling keeps half.
 */
export function delveScore(rooms: number, hp: number, maxHp: number, end: DelveEnd | null): number {
  if (end === 'fell') return Math.floor((rooms * DELVE_ROOM_POINTS) / 2);
  if (end === 'fled' || rooms === 0) return rooms * DELVE_ROOM_POINTS;
  return rooms * DELVE_ROOM_POINTS + Math.round((100 * Math.max(0, Math.min(hp, maxHp))) / maxHp);
}

/** City gold for the Rooms won, whatever the ending. */
export const delveGold = (floor: number, rooms: number): number => rooms * DELVE_GOLD * (floor + 1);
