import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, type ClassId, type FightEvent, type FightInput, type FightResult, type HeroAction, type HeroChoice, type HeroCombat, type HeroKey,
  InvalidChoice, type PausedFight, type TurnOptions, createRng, duoEncounter, forAlly, heroCombat, playFight, restUses, simulateFight, spawnEncounter,
  startingHealth,
} from '../src/index.js';

function starter(cls: ClassId, level: number, path: 'life' | null = null): HeroCombat {
  const primary = CLASS_DEFS[cls].primary;
  const scores = { str: 12, dex: 14, con: 14, int: 10, wis: 12, cha: 10, [primary]: 16 };
  const hp = startingHealth(cls, 'human', ['alert', 'tough'], scores.con) + (level - 1) * (Math.ceil(CLASS_DEFS[cls].hitDie / 2) + 5);
  const worn = CLASS_DEFS[cls].starterKit.map((base) => ({ base, quality: 50, upgrade: 0, radiant: false, bonusStats: [], uniqueId: null }));
  const h = heroCombat({ name: cls, class: cls, race: 'human', level, talents: ['alert', 'tough'], path, scores, maxHp: hp, hp, worn });
  return { ...h, hp: h.maxHp };
}
const side = (h: HeroCombat) => ({ hero: h, uses: restUses(h.class, h.level, h.path), potions: 2, runPowers: { deathless: false, lucky: false }, stance: 'steady' as const });
const solo = (h: HeroCombat, floor: number, seed: string): FightInput => ({ ...side(h), monsters: spawnEncounter(createRng(`${seed}:m`), floor, 'fight') });
const duo = (a: HeroCombat, b: HeroCombat, floor: number, seed: string): FightInput =>
  ({ ...side(a), monsters: duoEncounter(createRng(`${seed}:m`), floor, 'fight'), ally: side(b) });

const paused = (r: FightResult | PausedFight): r is PausedFight => 'paused' in r;

/** Plays a fight by hand to its end, asking `policy` at every turn of the manual Heroes, as the server does. */
function drive(seed: string, input: FightInput, manual: HeroKey[], policy: (turn: TurnOptions, events: FightEvent[]) => HeroAction) {
  const choices: HeroChoice[] = [];
  for (let i = 0; i < 500; i++) {
    const r = playFight(createRng(seed), input, { manual, choices });
    if (!paused(r)) return { result: r, choices };
    choices.push({ hero: r.turn.hero, action: policy(r.turn, r.events) });
  }
  throw new Error('the fight never ended');
}

describe('Manual fights', () => {
  it('play exactly like an automatic fight when nobody plays by hand, or hands over to the AI at once', () => {
    for (let i = 0; i < 25; i++) {
      const input = solo(starter(i % 2 ? 'wizard' : 'fighter', 3), 3, `same-${i}`);
      const auto = simulateFight(createRng(`same-${i}`), input);
      expect(playFight(createRng(`same-${i}`), input, { manual: [], choices: [] })).toEqual(auto);
      expect(playFight(createRng(`same-${i}`), input, { manual: ['hero'], choices: [{ hero: 'hero', action: { kind: 'auto' } }] })).toEqual(auto);
    }
  });

  it('stop at the Hero\'s turn with what it can do, and go on from the choice made', () => {
    const input = solo(starter('fighter', 3), 2, 'stop');
    const first = playFight(createRng('stop'), input, { manual: ['hero'], choices: [] });
    if (!paused(first)) throw new Error('expected a pause');
    expect(first.turn).toMatchObject({ hero: 'hero', continuing: false, rage: false, mark: false });
    expect(first.turn.actions).toEqual(expect.arrayContaining(['attack', 'second-wind', 'potion', 'escape', 'dodge']));
    expect(first.turn.actions).not.toContain('help');
    const target = first.turn.targets.at(-1)!;
    const next = playFight(createRng('stop'), input, { manual: ['hero'], choices: [{ hero: 'hero', action: { kind: 'attack', target } }] });
    const events = paused(next) ? next.events : next.events;
    // Everything before the choice is the same, and the Hero's first swing goes where it was told.
    expect(events.slice(0, first.events.length)).toEqual(first.events);
    const swing = events.slice(first.events.length).find((e) => e.type === 'attack' && e.actor === 'hero');
    expect(swing).toMatchObject({ target });
  });

  it('refuse a choice the Hero can\'t make, or one made out of turn', () => {
    const input = solo(starter('fighter', 3), 2, 'refuse');
    const play = (action: HeroAction, hero: HeroKey = 'hero') => () => playFight(createRng('refuse'), input, { manual: ['hero'], choices: [{ hero, action }] });
    expect(play({ kind: 'burst' })).toThrow(InvalidChoice);
    expect(play({ kind: 'attack', target: 'm9' })).toThrow(InvalidChoice);
    expect(play({ kind: 'help' })).toThrow(InvalidChoice);
    expect(play({ kind: 'attack', rage: true })).toThrow(InvalidChoice);
    expect(play({ kind: 'attack' }, 'ally')).toThrow(/turn/);
  });

  it('replay the same fight from the same seed and choices', () => {
    const input = duo(starter('wizard', 4), starter('cleric', 4), 3, 'replay');
    const { result, choices } = drive('replay', input, ['hero', 'ally'], (turn) => ({ kind: turn.actions.includes('burst') ? 'burst' : 'attack' }));
    expect(playFight(createRng('replay'), input, { manual: ['hero', 'ally'], choices })).toEqual(result);
  });

  it('let a Guard take the blows meant for its partner until its next turn', () => {
    let guarded = 0;
    for (let i = 0; i < 20; i++) {
      const input = duo(starter('fighter', 4), starter('wizard', 4), 4, `guard-${i}`);
      const { result } = drive(`guard-${i}`, input, ['hero'], (turn) => ({ kind: turn.actions.includes('guard') ? 'guard' : 'attack' }));
      // Between a Guard and the Fighter's next turn, no monster swings at the Wizard while the Fighter stands.
      let guarding = false;
      for (const e of result.events) {
        if (e.type === 'feature' && e.feature === 'guard' && !e.actor) guarding = true;
        else if (guarding && (e.type === 'attack' || e.type === 'heal') && e.actor === 'hero') guarding = false;
        else if (guarding && e.type === 'attack' && e.target !== 'hero' && e.actor.startsWith('m')) throw new Error(`${e.actor} got past the Guard`);
        if (guarding && e.type === 'attack' && e.target === 'hero') {
          guarded++;
          if (e.targetHp === 0) guarding = false;
        }
      }
    }
    expect(guarded).toBeGreaterThan(0);
  });

  it('keep a fallen Duo partner down, a death save a turn, until pulled up', () => {
    let pulled = 0;
    let acted = 0;
    let saves = 0;
    for (let i = 0; i < 300 && pulled < 5; i++) {
      const r = simulateFight(createRng(`fall-${i}`), duo(starter('fighter', 3), starter('wizard', 2), 4, `fall-${i}`));
      const down = r.events.findIndex((e) => e.type === 'down' && e.actor === 'ally');
      if (down < 0) continue;
      saves += r.events.filter((e) => e.type === 'death-save' && e.actor === 'ally').length;
      const up = r.events.findIndex((e, j) => j > down && e.type === 'revive' && e.success);
      if (up < 0) continue;
      pulled++;
      // Up again, it stops rolling death saves (until it falls again) and takes its turns.
      const after = r.events.slice(up + 1);
      const fallsAgain = after.findIndex((e) => e.type === 'down' && e.actor === 'ally');
      const before = fallsAgain < 0 ? after : after.slice(0, fallsAgain);
      expect(before.some((e) => e.type === 'death-save' && e.actor === 'ally')).toBe(false);
      if (before.some((e) => (e.type === 'attack' || e.type === 'burst' || e.type === 'heal') && e.actor === 'ally')) acted++;
    }
    expect(pulled).toBeGreaterThan(0);
    expect(acted).toBeGreaterThan(0);
    expect(saves).toBeGreaterThan(0);
  });

  it('show the partner a Guard, a Help and a pull-up from its own side', () => {
    let checked = 0;
    for (let i = 0; i < 300 && checked < 3; i++) {
      const input = duo(starter('fighter', 3), starter('wizard', 2), 4, `sides-${i}`);
      const policy = (turn: TurnOptions): HeroAction => ({
        kind: turn.actions.includes('revive') ? 'revive' : turn.round === 1 ? 'guard' : turn.round === 2 ? 'help' : 'attack',
      });
      const { result } = drive(`sides-${i}`, input, ['hero'], policy);
      if (!result.events.some((e) => e.type === 'revive')) continue;
      checked++;
      const theirs = forAlly(result.events, result.ally!.outcome);
      // Whoever guards, helps or pulls up whom, the other side sees the two Heroes trade places.
      const who = (key: string | undefined) => key ?? 'hero';
      const other = (key: string) => (key === 'hero' ? 'ally' : 'hero');
      result.events.forEach((e, j) => {
        if ((e.type === 'feature' && (e.feature === 'guard' || e.feature === 'help')) || e.type === 'revive') {
          const seen = theirs[j] as { actor?: string; target?: string };
          expect(who(seen.actor)).toBe(other(who(e.actor)));
          expect(seen.target).toBe(other(e.target!));
        }
      });
      expect(forAlly(theirs, result.outcome)).toEqual(result.events);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('haul a partner still down when the Duo wins', () => {
    let hauled = 0;
    for (let i = 0; i < 400 && hauled < 3; i++) {
      const input = duo(starter('barbarian', 5), starter('wizard', 2), 4, `haul-${i}`);
      // The Barbarian never stops to help: its partner stays down until the fight is won.
      const { result } = drive(`haul-${i}`, input, ['hero'], () => ({ kind: 'attack' }));
      const fell = result.events.some((e) => e.type === 'down' && e.actor === 'ally');
      const saved = result.events.filter((e): e is Extract<FightEvent, { type: 'death-save' }> => e.type === 'death-save' && e.actor === 'ally');
      const settled = saved.at(-1) && (saved.at(-1)!.successes >= 3 || saved.at(-1)!.failures >= 3);
      if (!fell || result.outcome !== 'victory' || settled || result.events.some((e) => e.type === 'rise' && e.actor === 'ally')) continue;
      expect(result.ally!.outcome).toBe('victory');
      expect(result.ally!.hp).toBe(1);
      hauled++;
    }
    expect(hauled).toBeGreaterThan(0);
  });

  it('give a Life Cleric a second action after its first Cure wounds', () => {
    const cleric = starter('cleric', 9, 'life');
    const input = { ...solo({ ...cleric, hp: Math.round(cleric.maxHp / 3) }, 3, 'life') };
    const first = playFight(createRng('life'), input, { manual: ['hero'], choices: [] });
    if (!paused(first)) throw new Error('expected a pause');
    expect(first.turn.cure).toEqual(['hero']);
    const second = playFight(createRng('life'), input, { manual: ['hero'], choices: [{ hero: 'hero', action: { kind: 'cure', target: 'hero' } }] });
    if (!paused(second)) throw new Error('expected a second pause');
    expect(second.turn).toMatchObject({ hero: 'hero', continuing: true });
    expect(second.turn.actions).not.toContain('cure');
  });
});
