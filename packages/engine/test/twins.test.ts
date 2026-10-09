import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type FightResult, type HeroAction, type HeroChoice, type HeroCombat, type HeroKey,
  type MonsterInstance, type PausedFight, type TurnOptions, TWIN_RISE, TWIN_WARDENS, WARDENS, createRng, floorMight, heroCombat, playFight, restUses,
  simulateFight, spawnEncounter, startingHealth,
} from '../src/index.js';

function starter(cls: ClassId, level: number): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const h = heroCombat({ name: cls, class: cls, race: 'human', level, talents: ['alert', 'tough'], scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}
const side = (h: HeroCombat) => ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 2, runPowers: { deathless: false, lucky: false }, stance: 'steady' as const });
const paused = (r: FightResult | PausedFight): r is PausedFight => 'paused' in r;

/** Plays a fight by hand to its end, asking `policy` at every turn of the manual Heroes, as the server does. */
function drive(seed: string, input: FightInput, manual: HeroKey[], policy: (turn: TurnOptions) => HeroAction): FightResult {
  const choices: HeroChoice[] = [];
  for (let i = 0; i < 500; i++) {
    const r = playFight(createRng(seed), input, { manual, choices });
    if (!paused(r)) return r;
    choices.push({ hero: r.turn.hero, action: policy(r.turn) });
  }
  throw new Error('the fight never ended');
}

/** The Floor 1 Wardens, easy to hit and with `hp` health left (their full health as it was). */
const wardens = (hp: [number, number]): MonsterInstance[] =>
  spawnEncounter(createRng('wardens'), 1, 'twin').map((mm, i) => ({ ...mm, ac: 1, hp: hp[i]! }));
const rises = (events: FightEvent[]) => events.filter((e): e is Extract<FightEvent, { type: 'power' }> => e.type === 'power' && e.power === 'twin');

describe('The Twin Wardens', () => {
  it('wait behind a Twin door as a pair, grown for the Floor like its own monsters', () => {
    const first = spawnEncounter(createRng('a'), 1, 'twin');
    expect(first.map((m) => m.id)).toEqual([...TWIN_WARDENS]);
    expect(first.map((m) => m.key)).toEqual(['m0', 'm1']);
    expect(first[0]).toMatchObject({ maxHp: WARDENS.warrens.hp, ac: WARDENS.warrens.ac, attack: WARDENS.warrens.attack });
    expect(first.every((m) => m.powers.some((p) => p.id === 'twin'))).toBe(true);
    // Floor 5: one Floor into the crypts, and three below Floor 2; a Duo's numbers, without the solo step.
    const fifth = spawnEncounter(createRng('a'), 5, 'twin');
    expect(fifth[1]!.maxHp).toBe(Math.round(WARDENS.crypts.hp * 1.15 * floorMight(5, false).hp));
    expect(fifth[1]!.attack).toBe(WARDENS.crypts.attack + 1 + floorMight(5, false).hit);
  });

  it('raise a Warden that fell alone at the end of the round, with half its health', () => {
    // The Hero cuts the Dawn Warden down; its partner only Dodges, so the round ends with the Dusk Warden standing.
    const input: FightInput = { ...side(starter('fighter', 3)), monsters: wardens([1, 26]), ally: side(starter('cleric', 3)) };
    const r = drive('rise', input, ['hero', 'ally'], (turn) => (turn.hero === 'hero' ? { kind: 'attack', target: 'm0' } : { kind: 'dodge' }));
    const fell = r.events.findIndex((e) => e.type === 'defeated' && e.key === 'm0');
    expect(fell).toBeGreaterThan(-1);
    const rose = rises(r.events)[0]!;
    expect(rose).toMatchObject({ actor: 'm1', target: 'm0', hp: Math.round(input.monsters[0]!.maxHp * TWIN_RISE) });
    expect(r.events.indexOf(rose)).toBeGreaterThan(fell);
    // Nobody wins by felling one at a time: the Wardens keep rising until the Duo can't go on.
    expect(r.outcome).not.toBe('victory');
  });

  it('fall for good only when both fall in the same round', () => {
    let seen = 0;
    for (let i = 0; i < 12; i++) {
      // Each Hero takes one Warden in the first round.
      const input: FightInput = { ...side(starter('fighter', 3)), monsters: wardens([1, 1]), ally: side(starter('rogue', 3)) };
      const r = drive(`both-${i}`, input, ['hero', 'ally'], (turn) => ({ kind: 'attack', target: turn.hero === 'hero' ? 'm0' : 'm1' }));
      if (rises(r.events).length > 0) continue; // A natural 1 missed.
      seen++;
      expect(r.outcome).toBe('victory');
      expect(r.defeated.sort()).toEqual(['m0', 'm1']);
      expect(r.xp).toBe(input.monsters[0]!.xp + input.monsters[1]!.xp);
    }
    expect(seen).toBeGreaterThan(6);
  });

  it('are worn down together on Auto: the healthier Warden first', () => {
    const r = simulateFight(createRng('auto'), { ...side(starter('fighter', 3)), monsters: wardens([20, 4]), ally: side(starter('wizard', 3)) });
    const first = r.events.find((e) => e.type === 'attack' && e.actor === 'hero');
    expect(first).toMatchObject({ target: 'm0' });
  });

  it('are felled together on Auto, never one alone while the other is out of reach', () => {
    // One Warden nearly down, the other still hale: felling the weak one alone would only raise it again.
    let rose = 0;
    for (let i = 0; i < 20; i++) {
      const r = simulateFight(createRng(`lopsided-${i}`), { ...side(starter('fighter', 3)), monsters: wardens([16, 3]), ally: side(starter('rogue', 3)) });
      expect(r.outcome).toBe('victory');
      rose += rises(r.events).length;
    }
    // Only a blow that lands harder or softer than reckoned leaves one standing for a round.
    expect(rose / 20).toBeLessThan(1);
  });
});
