import type { FightEventView, FightReplay } from '@dark/shared';

export type Status = Extract<FightEventView, { type: 'status' }>['status'];
export interface FighterState {
  hp: number;
  fallen: boolean;
  fled: boolean;
  enraged: boolean;
  statuses: Partial<Record<Status, number>>;
  saves: { successes: number; failures: number } | null;
  ward: number;
  raging: boolean;
  marked: string | null;
  hexed: string | null;
  beast: boolean;
  beastMax: number;
  smite: string | null;
}
export interface Frame {
  fighters: Record<string, FighterState>;
  order: string[];
}

export function initialFrame(replay: FightReplay): Frame {
  return {
    fighters: Object.fromEntries([replay.hero, ...(replay.ally ? [replay.ally] : []), ...replay.monsters].map(who => [who.key, {
      hp: who.hp, fallen: false, fled: false, enraged: false, statuses: {},
      saves: null, ward: 0, raging: false, marked: null, hexed: null, beast: false, beastMax: 0, smite: null,
    }])),
    order: [],
  };
}

/** Only recorded server values change health. The renderer never rolls or simulates combat. */
export function advance(frame: Frame, event: FightEventView): Frame {
  const next: Frame = {
    ...frame,
    fighters: Object.fromEntries(Object.entries(frame.fighters).map(([key, value]) => [
      key, { ...value, statuses: { ...value.statuses } },
    ])),
  };
  const who = (key: string) => next.fighters[key];
  const actor = who('actor' in event && event.actor ? event.actor : 'hero');
  const hp = (key: string, value: number) => { const f = who(key); if (f) f.hp = value; };
  switch (event.type) {
    case 'initiative': next.order = [...event.order]; break;
    case 'attack':
      hp(event.target, event.targetHp);
      if (actor) actor.smite = null;
      break;
    case 'burst': for (const hit of event.targets) hp(hit.key, hit.hp); break;
    case 'heal':
      hp(event.actor, event.hp);
      if (event.by && event.hp > 0 && actor) { actor.fallen = false; actor.saves = null; }
      break;
    case 'feature':
      if (!actor) break;
      if (event.hp !== undefined) actor.hp = event.hp;
      if (event.feature === 'ward' || event.feature === 'wild-shape') actor.ward = event.left ?? actor.ward;
      if (event.feature === 'wild-shape') actor.beast = actor.ward > 0;
      if (event.feature === 'wild-shape' && event.amount === undefined && event.left) actor.beastMax = event.left;
      if (event.feature === 'rage') actor.raging = true;
      if (event.feature === 'mark' && event.target && who(event.target)) actor.marked = event.target;
      if (event.feature === 'hex' && event.target && who(event.target)) actor.hexed = event.target;
      if (event.feature === 'smite' && event.target && who(event.target)) actor.smite = event.target;
      break;
    case 'power':
      if (event.hp !== undefined) hp(
        event.power === 'drain' || event.power === 'undying' ? event.actor : event.target ?? event.actor,
        event.hp,
      );
      if (event.power === 'enrage' && who(event.actor)) who(event.actor)!.enraged = true;
      // A Twin Warden raises its fallen twin.
      if (event.power === 'twin' && event.target && who(event.target)) who(event.target)!.fallen = false;
      break;
    case 'status': if (who(event.target)) who(event.target)!.statuses[event.status] = event.turns; break;
    case 'expire': if (who(event.target)) delete who(event.target)!.statuses[event.status]; break;
    case 'tick': hp(event.target, event.hp); break;
    case 'fled': if (who(event.key)) who(event.key)!.fled = true; break;
    case 'escape': if (event.success && actor) actor.fled = true; break;
    case 'defeated':
      if (who(event.key)) { who(event.key)!.fallen = true; who(event.key)!.statuses = {}; }
      break;
    case 'down':
      if (actor) {
        actor.hp = 0;
        actor.fallen = true;
        actor.statuses = {};
        actor.beast = false; actor.smite = null;
        actor.saves = { successes: 0, failures: 0 };
      }
      break;
    case 'death-save': if (actor) actor.saves = { successes: event.successes, failures: event.failures }; break;
    case 'rise':
      if (actor) { actor.hp = event.hp; actor.fallen = false; actor.saves = null; }
      break;
    case 'revive':
      if (event.success && who(event.target)) {
        Object.assign(who(event.target)!, { hp: event.hp, fallen: false, saves: null });
      }
      break;
    case 'end':
      for (const f of Object.values(next.fighters)) { f.statuses = {}; f.raging = false; f.marked = null; f.hexed = null; f.beast = false; f.smite = null; }
      break;
    default: break;
  }
  return next;
}

/** Immutable snapshots make replay replacement, rendering and assertions share one source of truth. */
export function framesFor(replay: FightReplay): Frame[] {
  const frames = [initialFrame(replay)];
  for (const event of replay.events) frames.push(advance(frames[frames.length - 1]!, event));
  return frames;
}

export function duration(event: FightEventView | null, reduced: boolean): number {
  if (!event) return 450;
  if (reduced) return event.type === 'death-save' || event.type === 'reroll' ? 1350 : 800;
  switch (event.type) {
    case 'death-save': return 2300;
    case 'reroll': return 1600;
    case 'save': case 'escape': return 1150;
    case 'attack': return event.crit || event.natural === 1 ? 1050 : 720;
    case 'power': return ['breath', 'explode', 'wail'].includes(event.power) ? 1500 : 850;
    case 'down': case 'rise': case 'revive': return 1200;
    case 'burst': return 1150;
    case 'defeated': return 500;
    case 'expire': return 500;
    case 'end': return 500;
    default: return 750;
  }
}

/** The die always reveals the recorded result; cosmetic spin never invents intermediate rolls. */
export function dieFor(event: FightEventView | null): number | null {
  if (!event) return null;
  if (event.type === 'attack') return event.crit || event.natural === 1 || event.natural === 20 ? event.natural : null;
  return 'natural' in event ? event.natural : null;
}
