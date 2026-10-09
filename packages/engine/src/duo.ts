import { type FightEvent, type FightOutcome, type MonsterInstance, spawnEncounter } from './combat.js';
import type { OmenDef } from './content/omens.js';
import type { Rng } from './rng.js';

// Duos (docs/design.md → Duos): two Heroes walking the same Rooms and fighting
// side by side. Their monsters are two groups, hardier than usual, so a pair meets
// as real a fight as one Hero alone, and each Hero takes a share of what it pays.

/**
 * Tuning (v0), so a Duo fight is about as dangerous as one alone (balance:duo and
 * balance:duo-boss, which can try others): how much of a second group joins (1: all of it);
 * the health and damage of every monster that meets a Duo, lighter from Floor `deepFrom` on;
 * a Mini-boss's own extra health and damage on top; and the share of a fight's XP and gold
 * each Hero takes.
 */
export const DUO = { extra: 1, hp: 1.3, damage: 1.2, deepHp: 1.15, deepDamage: 1, deepFrom: 7, bossHp: 2.2, bossDamage: 1.25, share: 0.65 };

/**
 * Who waits for a Duo in a Room: the solo group, plus part of a second one from
 * the same Floor; a Mini-boss itself comes with more health and a harder hit.
 */
export function duoEncounter(rng: Rng, floor: number, kind: 'fight' | 'miniboss', weakening = 0, omen: OmenDef | null = null): MonsterInstance[] {
  // A Duo meets monsters at their Duo numbers, without the solo step (combat.ts floorMight).
  const base = spawnEncounter(rng, floor, kind, weakening, omen, false);
  const second = spawnEncounter(rng, floor, 'fight', 0, omen, false);
  const take = Math.max(1, Math.ceil(second.length * DUO.extra));
  const extra = second.slice(0, take).map((mm, i) => ({ ...mm, key: `m${base.length + i}` }));
  if (kind === 'miniboss') {
    const leader = base[0]!;
    const hp = Math.round(leader.maxHp * DUO.bossHp);
    base[0] = { ...leader, hp, maxHp: hp, damageFactor: leader.damageFactor * DUO.bossDamage };
  }
  // Monsters that meet two Heroes are hardier and hit harder.
  const deep = floor >= DUO.deepFrom;
  return [...base, ...extra].map((mm) => {
    const hp = Math.round(mm.maxHp * (deep ? DUO.deepHp : DUO.hp));
    return { ...mm, hp, maxHp: hp, damageFactor: mm.damageFactor * (deep ? DUO.deepDamage : DUO.damage) };
  });
}

/** How many times `key` stood its fallen partner back up in a fight: pulled up, or healed while down. */
export function partnerRaises(events: FightEvent[], key: string): number {
  const down = new Set<string>();
  let raised = 0;
  for (const e of events) {
    if (e.type === 'down') down.add(e.actor ?? 'hero');
    else if (e.type === 'rise') down.delete(e.actor ?? 'hero');
    else if (e.type === 'revive' && e.success && down.delete(e.target) && (e.actor ?? 'hero') === key) raised++;
    else if (e.type === 'heal' && down.delete(e.actor) && e.by === key) raised++;
  }
  return raised;
}

const swap = (key: string): string => (key === 'hero' ? 'ally' : key === 'ally' ? 'hero' : key);

/** An event's implicit subject (the Hero when no `actor` is given), seen from the other side. */
function swapImplicit<E extends { actor?: string }>(e: E): E {
  const { actor, ...rest } = e;
  const now = swap(actor ?? 'hero');
  return (now === 'hero' ? rest : { ...rest, actor: now }) as E;
}

/**
 * The same fight as the partner sees it: "hero" is always the one watching. Every
 * Hero key trades places, and the end is the partner's own.
 */
export function forAlly(events: FightEvent[], allyOutcome: FightOutcome): FightEvent[] {
  return events.map((e): FightEvent => {
    switch (e.type) {
      case 'initiative': return { ...e, order: e.order.map(swap) };
      case 'attack': return { ...e, actor: swap(e.actor), target: swap(e.target) };
      case 'blocked': {
        const { target, ...rest } = e;
        const now = swap(target ?? 'hero');
        return now === 'hero' ? rest : { ...rest, target: now };
      }
      case 'burst': return { ...e, actor: swap(e.actor) };
      case 'heal': return { ...e, actor: swap(e.actor), ...(e.by ? { by: swap(e.by) } : {}) };
      case 'power': return e.target ? { ...e, target: swap(e.target) } : e;
      case 'status': case 'tick': case 'held': case 'expire': return { ...e, target: swap(e.target) };
      // Help and Guard name the partner they are for; a Hunter's mark names a monster, which stays as it is.
      case 'feature': return e.target ? { ...swapImplicit(e), target: swap(e.target) } : swapImplicit(e);
      case 'revive': return { ...swapImplicit(e), target: swap(e.target) };
      case 'save': case 'down': case 'death-save': case 'rise': case 'reroll': case 'escape': return swapImplicit(e);
      case 'end': return { ...e, outcome: allyOutcome };
      default: return e;
    }
  });
}
