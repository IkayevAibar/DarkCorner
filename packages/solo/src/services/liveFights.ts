import type { Fight, Player, Prisma, Season } from '@prisma/client';
import { type HeroActionView, type LiveFight, fightReplaySchema } from '@dark/shared';
import {
  DUO, type FightEvent, type FightInput, type FightResult, type Floor, type HeroChoice, type HeroKey, type PausedFight, type ThreatId, createRng, forAlly,
  playFight,
} from '@dark/engine';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { bossVictory } from './boss.js';
import { isCompanion } from './companion.js';
import { endDuo, isOnline } from './duo.js';
import {
  type FightKind, type Outcome, combatOf, combatant, duoInput, duoMonstersFor, emptyOutcome, fightInput, heroCombatant, monstersFor, settle, t,
} from './fights.js';
import type { HeroWithItems, Tx } from './ledger.js';
import { omenOf } from './omens.js';
import { grantBondRings } from './twins.js';
import type { Drop } from './loot.js';
import { openDuoChest } from './trust.js';
import { gameNow } from '../gameClock.js';

// Room fights played turn by turn (docs/design.md → Manual fights). A Fight row keeps
// what the engine needs to play the fight again from its first die: the seed, the input
// as it stood, and every choice made. Each look replays it to where it stands.

/** In a Duo, a Player has this long for a turn before the AI takes it (v0). */
export const TURN_MS = 30_000;

/**
 * A Duo turn's clock starts once the moves before it can have played on screen: the
 * waiting Player's next look (the web looks every 2 seconds in a Duo fight), then about
 * PLAYBACK_MS for each event, never more than PLAYBACK_CAP_MS in all (v0).
 */
export const PLAYBACK_MS = 800;
const LOOK_MS = 2_000;
const PLAYBACK_CAP_MS = 12_000;
const playback = (events: number): number => Math.min(PLAYBACK_CAP_MS, LOOK_MS + Math.max(0, events) * PLAYBACK_MS);

/** What paying out needs, kept with the fight. */
interface Context {
  spawnSeed: string;
  threat: ThreatId | null;
  bomb: boolean;
  surprise: 'hero' | null;
  stance: string;
}

/** The fight's Heroes, locked: `hero` started it, `ally` is its Duo partner. */
export interface FightHeroes {
  hero: HeroWithItems & { player: Player };
  ally: (HeroWithItems & { player: Player }) | null;
}

/** Where a fight stands after a look or a choice: still waiting, or over and paid out. */
export interface FightStep {
  paused: PausedFight | null;
  ended: { hero: Outcome; ally: Outcome | null } | null;
}

const isPaused = (r: FightResult | PausedFight): r is PausedFight => 'paused' in r;
const swap = (k: HeroKey): HeroKey => (k === 'hero' ? 'ally' : 'hero');
const choicesOf = (fight: Fight) => fight.choices as unknown as HeroChoice[];
const inputOf = (fight: Fight) => fight.input as unknown as FightInput;

/** The fight a Hero is in, as the one who started it or as its partner. */
export async function fightOf(tx: Tx, heroId: string): Promise<Fight | null> {
  return tx.fight.findFirst({ where: { OR: [{ heroId }, { partnerId: heroId }] } });
}

/** The fight's Heroes with their Players, locked in id order like every Duo action (or just read, for a look). */
export async function fightHeroes(tx: Tx, fight: Fight, lock = true): Promise<FightHeroes> {
  const ids = [fight.heroId, ...(fight.partnerId ? [fight.partnerId] : [])].sort();
  if (lock) for (const id of ids) await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${id} FOR UPDATE`;
  const load = (id: string) => tx.hero.findUniqueOrThrow({ where: { id }, include: { items: true, player: true } });
  return { hero: await load(fight.heroId), ally: fight.partnerId ? await load(fight.partnerId) : null };
}

/**
 * Starts a Room fight played turn by turn: the monsters waiting there (a Duo's for a
 * pair), the Heroes as they stand now, and a fresh seed. `auto` hands the Hero who
 * starts it to the AI from the first turn; a partner plays by hand until it chooses Auto.
 */
export async function startFight(tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, roomId: number,
  kind: FightKind, opts: { surprise?: 'hero'; bomb?: boolean; threat?: ThreatId | null; auto?: boolean }, now: Date): Promise<Fight> {
  if (partner && kind === 'boss') throw ApiError.conflict('duo_boss', 'The Dragon is faced alone: leave the Duo first');
  if (!partner && kind === 'twin') throw ApiError.conflict('twin_alone', 'The Twin Wardens face only a Duo');
  const omen = omenOf(season, now);
  const spawned = partner
    ? duoMonstersFor(season, hero, partner, floor, roomId, kind as 'fight' | 'miniboss' | 'twin', now)
    : monstersFor(season, hero, floor, roomId, kind, now);
  const shared = { surprise: opts.surprise ?? null, bombFloor: opts.bomb ? floor.number : null, escapeBonus: omen?.sneak ?? 0 };
  const input = partner
    ? duoInput(hero, partner, spawned.monsters, { ...shared, surprise: opts.surprise })
    : fightInput(hero, combatOf(hero), spawned.monsters, { ...shared, spare: opts.threat === 'trivial' });
  // A Companion is the AI's to play, on every turn (companion.ts).
  const manual: HeroKey[] = [...(opts.auto ? [] : ['hero' as const]), ...(partner && !isCompanion(partner) ? ['ally' as const] : [])];
  const context: Context = {
    spawnSeed: spawned.spawnSeed ?? '', threat: opts.threat ?? null, bomb: Boolean(opts.bomb), surprise: opts.surprise ?? null, stance: input.stance ?? 'steady',
  };
  const seed = newSeed();
  // A Duo's first turn waits for what happens before it (monsters quicker than both Heroes) to play out.
  const opening = partner ? playback(playFight(createRng(seed), input, { manual, choices: [] }).events.length) : 0;
  return tx.fight.create({
    data: {
      seasonId: season.id, heroId: hero.id, partnerId: partner?.id ?? null, floor: floor.number, room: roomId, kind, seed,
      input: input as unknown as Prisma.InputJsonValue, context: context as unknown as Prisma.InputJsonValue, manual,
      turnAt: new Date(now.getTime() + opening),
    },
  });
}

/**
 * Brings a fight up to date and plays `add` (a Player's choice) into it. In a Duo a turn
 * left TURN_MS (once the moves before it have played) goes to the AI, and a Player no
 * longer online hands its Hero over for the rest. Then the fight waits for the next
 * choice, or it is over and both Heroes are paid.
 * Throws InvalidChoice for a choice it can't take.
 */
export async function advance(tx: Tx, fight: Fight, heroes: FightHeroes, season: Season, floor: Floor, now: Date, add?: HeroChoice): Promise<FightStep> {
  let choices = choicesOf(fight);
  let turnAt = fight.turnAt;
  const replay = () => playFight(createRng(fight.seed), inputOf(fight), { manual: fight.manual as HeroKey[], choices });
  let r = replay();
  if (add) {
    const before = r.events.length;
    choices = [...choices, add];
    r = replay();
    turnAt = new Date(now.getTime() + playback(r.events.length - before));
  }
  // A Companion's turns are the AI's already, and its Hero's wait for its Player as a Hero alone's do.
  const timed = fight.partnerId !== null && !isCompanion(heroes.ally);
  while (isPaused(r) && timed && now.getTime() - turnAt.getTime() >= TURN_MS) {
    const waiting = r.turn.hero === 'hero' ? heroes.hero : heroes.ally!;
    const before = r.events.length;
    choices = [...choices, { hero: r.turn.hero, action: { kind: isOnline(waiting.player, now) ? 'ai' : 'auto' } }];
    const taken = Math.min(now.getTime(), turnAt.getTime() + TURN_MS);
    r = replay();
    turnAt = new Date(taken + playback(r.events.length - before));
  }
  if (isPaused(r)) {
    if (choices.length !== choicesOf(fight).length) {
      await tx.fight.update({ where: { id: fight.id }, data: { choices: choices as unknown as Prisma.InputJsonValue, turnAt } });
      fight.choices = choices as unknown as Prisma.JsonValue;
      fight.turnAt = turnAt;
    }
    return { paused: r, ended: null };
  }
  return { paused: null, ended: await finish(tx, fight, r, choices, heroes, season, floor) };
}

/** Whether a Hero went down and was never stood back up: its partner hauled it off at the end. */
function stillDown(events: FightEvent[], key: HeroKey): boolean {
  const of = (e: { actor?: string }) => (e.actor ?? 'hero') === key;
  let down = false;
  for (const e of events) {
    if (e.type === 'down' && of(e)) down = true;
    else if (e.type === 'rise' && of(e)) down = false;
    else if (e.type === 'revive' && e.success && e.target === key) down = false;
    else if (e.type === 'heal' && e.actor === key) down = false;
  }
  return down;
}

/** The end of a fight: each Hero is paid from its own side, the fight is logged and gone. */
async function finish(tx: Tx, fight: Fight, result: FightResult, choices: HeroChoice[], heroes: FightHeroes, season: Season, floor: Floor) {
  const input = inputOf(fight);
  const context = fight.context as unknown as Context;
  const kind = fight.kind as FightKind;
  const { monsters } = input;
  const ally = heroes.ally && input.ally && result.ally ? { hero: heroes.ally, combat: input.ally.hero, side: result.ally } : null;
  await tx.rollLog.create({
    data: {
      playerId: heroes.hero.playerId, kind: 'fight', seed: fight.seed,
      detail: {
        floor: floor.number, room: fight.room, kind, outcome: result.outcome, spawnSeed: context.spawnSeed, stance: context.stance,
        surprise: context.surprise, bomb: context.bomb, manual: fight.manual, choices: choices.length,
        ...(ally ? { partner: ally.hero.id, partnerOutcome: ally.side.outcome } : {}),
      } as Prisma.InputJsonObject,
    },
  });

  const map = floor.rooms[fight.room]!.map;
  const shown = monsters.map((m) => combatant(m.key, m));
  const heroOut = emptyOutcome();
  heroOut.fight = fightReplaySchema.parse({
    map, hero: heroCombatant('hero', heroes.hero, input.hero), ally: ally ? heroCombatant('ally', ally.hero, ally.combat) : null,
    monsters: shown, events: result.events, outcome: result.outcome,
  });
  const allyOut = ally ? emptyOutcome() : null;
  if (ally && allyOut) {
    allyOut.fight = fightReplaySchema.parse({
      map, hero: heroCombatant('hero', ally.hero, ally.combat), ally: heroCombatant('ally', heroes.hero, input.hero),
      monsters: shown, events: forAlly(result.events, ally.side.outcome), outcome: ally.side.outcome,
    });
  }

  const fought = { seed: fight.seed, events: result.events, xp: result.xp, defeated: result.defeated };
  // The Twin Wardens' hoard, both Heroes standing: one Duo Chest for the pair to split.
  const pool = kind === 'twin' && ally && result.outcome === 'victory' && ally.side.outcome === 'victory' ? [] as Drop[] : undefined;
  const opts = { threat: context.threat, share: ally ? DUO.share : 1, pool };
  await settle(tx, heroes.hero, 'hero', result, fought, monsters, season, floor, fight.room, kind, heroOut, opts);
  if (ally && allyOut) await settle(tx, ally.hero, 'ally', ally.side, fought, monsters, season, floor, fight.room, kind, allyOut, opts);
  if (kind === 'boss' && result.outcome === 'victory') await bossVictory(tx, heroes.hero, season, floor.number, fight.room, heroOut);
  // The Twin Wardens broken with both Heroes standing: the pair's Bond rings.
  if (kind === 'twin' && ally && allyOut && result.outcome === 'victory' && ally.side.outcome === 'victory') {
    await grantBondRings(tx, season, floor.number, [[heroes.hero, heroOut], [ally.hero, allyOut]]);
  }
  if (pool && ally && allyOut) {
    await openDuoChest(tx, season, floor, fight.room, [heroes.hero, ally.hero], pool, new Map([[heroes.hero.id, heroOut], [ally.hero.id, allyOut]]), gameNow());
  }

  if (ally && allyOut) {
    const companion = isCompanion(ally.hero);
    // Down at the end of a won fight: the partner hauled it up.
    if (result.outcome === 'victory' && stillDown(result.events, 'hero')) heroOut.notices.push(t(`${ally.hero.name} hauls you back to your feet.`, `${ally.hero.name} поднимает вас на ноги.`));
    if (ally.side.outcome === 'victory' && stillDown(result.events, 'ally')) {
      if (companion) heroOut.notices.push(t(`You haul ${ally.hero.name} back to its feet.`, `Вы поднимаете спутника ${ally.hero.name} на ноги.`));
      else allyOut.notices.push(t(`${heroes.hero.name} hauls you back to your feet.`, `${heroes.hero.name} поднимает вас на ноги.`));
    }
    // A death ends the Duo; whoever still stands goes on alone. A Companion's fall is told to its Hero.
    if (result.outcome === 'dead' || ally.side.outcome === 'dead') {
      await endDuo(tx, heroes.hero, ally.hero, null);
      const fell = (name: string) => t(`Death takes ${name}. The Duo is over: you go on alone.`, `Смерть забирает героя ${name}. Дуэт распался: дальше вы одни.`);
      if (companion) {
        if (ally.side.outcome === 'dead') heroOut.notices.push(...allyOut.notices);
      } else {
        if (result.outcome === 'dead' && ally.side.outcome !== 'dead') allyOut.notices.push(fell(heroes.hero.name));
        if (ally.side.outcome === 'dead' && result.outcome !== 'dead') heroOut.notices.push(fell(ally.hero.name));
      }
    }
  }
  await tx.fight.delete({ where: { id: fight.id } });
  return { hero: heroOut, ally: allyOut };
}

/** A Player's choice as the engine takes it: the web names Heroes from its own side. */
export function choiceOf(action: HeroActionView, viewer: HeroKey): HeroChoice {
  const target = action.kind === 'cure' && viewer === 'ally' && (action.target === 'hero' || action.target === 'ally') ? swap(action.target) : action.target;
  return {
    hero: viewer,
    action: {
      kind: action.kind, ...(target !== undefined ? { target } : {}), ...(action.rage ? { rage: true } : {}), ...(action.mark ? { mark: action.mark } : {}),
    },
  };
}

/** The fight as one of its Players sees it: 'hero' started it, and 'ally' sees it turned around. */
export function liveView(fight: Fight, paused: PausedFight, heroes: FightHeroes, viewer: HeroKey, floor: Floor): LiveFight {
  const input = inputOf(fight);
  const flip = viewer === 'ally';
  const mine = flip ? { row: heroes.ally!, combat: input.ally!.hero } : { row: heroes.hero, combat: input.hero };
  const other = flip ? { row: heroes.hero, combat: input.hero } : heroes.ally && input.ally ? { row: heroes.ally, combat: input.ally.hero } : null;
  const turn = paused.turn;
  const choices = choicesOf(fight);
  return {
    map: floor.rooms[fight.room]!.map,
    hero: heroCombatant('hero', mine.row, mine.combat),
    ally: other ? heroCombatant('ally', other.row, other.combat) : null,
    monsters: input.monsters.map((m) => combatant(m.key, m)),
    events: flip ? forAlly(paused.events, 'victory') : paused.events,
    turn: { ...turn, hero: flip ? swap(turn.hero) : turn.hero, cure: flip ? turn.cure.map(swap) : turn.cure },
    mine: turn.hero === viewer,
    deadline: fight.partnerId && !isCompanion(heroes.ally) ? new Date(fight.turnAt.getTime() + TURN_MS).toISOString() : null,
    auto: !(fight.manual as string[]).includes(viewer) || choices.some((c) => c.hero === viewer && c.action.kind === 'auto'),
  };
}

/** A fight's state for one look, without changing it: where it stands. */
export function replayOf(fight: Fight): FightResult | PausedFight {
  return playFight(createRng(fight.seed), inputOf(fight), { manual: fight.manual as HeroKey[], choices: choicesOf(fight) });
}
export { isPaused };
