import type { EventVisit, Item, Prisma, Season } from '@prisma/client';
import type { EventAction, EventView, LocalizedText } from '@dark/shared';
import {
  ALTAR_TIERS, BLESSING_MS, BLESSINGS, type CheckResult, type ClassId, type EventKind, type Floor, type GearRoll, MERCHANT_BUYS_AT,
  MERCHANT_MARKUP, RACE_DEFS, type RaceId, SUFFIXES, type Tier, abilityModifier, baseById, buybackPrice, cacheContents,
  chestBase, createRng, goblinDice, instantiate, isGear, itemName, merchantWares, monsterById, nextTier, offerAtAltar,
  pickLock, prayAtShrine, proficiencyBonus, rollGear, sellValue, springTrap, threeChests,
} from '@dark/engine';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { type CheckOutcome, type Outcome, fight, heroFloor, markCleared, t } from './fights.js';
import { gearData, rollView, toItemView } from './items.js';
import {
  type HeroWithItems, type Tx, dayNumber, destroyItem, earnCarried, giveItem, ownItem, spendCarried, stackTotal, takeStack,
} from './ledger.js';
import { dropGear, dropStack, withGoldFind } from './loot.js';

// Event rooms (docs/design.md → Event rooms). What a room holds comes from a seed
// per Hero, Room and day, so it can't be rerolled by leaving and coming back;
// EventVisit only stores what the Hero did.

interface VisitState {
  picked?: number;
  sold?: string[];
}

const seedFor = (season: Season, hero: HeroWithItems, floor: number, room: number, day: number) =>
  `${season.seed}:event:${hero.id}:${floor}:${room}:${day}`;

async function visitOf(tx: Tx, hero: HeroWithItems, floor: number, room: number, kind: EventKind, day: number): Promise<EventVisit> {
  return tx.eventVisit.upsert({
    where: { heroId_floor_room_day: { heroId: hero.id, floor, room, day } },
    create: { heroId: hero.id, floor, room, day, kind },
    update: {},
  });
}

const stateOf = (visit: EventVisit | null): VisitState => (visit?.state ?? {}) as VisitState;

async function finish(tx: Tx, visit: EventVisit, hero: HeroWithItems, floor: number, room: number, now: Date, state?: VisitState) {
  await tx.eventVisit.update({
    where: { id: visit.id },
    data: { doneAt: now, ...(state ? { state: state as Prisma.InputJsonValue } : {}) },
  });
  await markCleared(tx, await heroFloor(tx, hero.id, floor), room, now);
}

/** A fresh seed and its Rng; event rolls are logged with the seed like every roll that matters. */
function seeded() {
  const seed = newSeed();
  return { seed, rng: createRng(seed) };
}

async function logRoll(tx: Tx, hero: HeroWithItems, seed: string, detail: Record<string, unknown>) {
  await tx.rollLog.create({ data: { playerId: hero.playerId, kind: 'event', seed, detail: detail as Prisma.InputJsonValue } });
}

// ─── Checks, with the Lucky charm ─────────────────────────────────────────

const hasLuck = (hero: HeroWithItems) =>
  hero.talents.includes('lucky-charm') || hero.items.some((i) => i.place === 'WORN' && i.uniqueId === 'luckstone');

/**
 * Runs a roll that hinges on a Check. If it fails and the Hero still has its
 * once-per-Run reroll, it rolls again and keeps the better.
 */
export async function withLuck<R extends { check: CheckResult | null }>(tx: Tx, hero: HeroWithItems, label: LocalizedText, roll: () => R, out: Outcome): Promise<R> {
  let result = roll();
  let rerolled: number | null = null;
  if (result.check && !result.check.success && hero.lucky && hasLuck(hero)) {
    const again = roll();
    rerolled = result.check.roll.natural;
    if (again.check && (again.check.success || again.check.total > result.check.total)) result = again;
    hero.lucky = false;
    await tx.hero.update({ where: { id: hero.id }, data: { lucky: false } });
  }
  if (result.check) out.checks.push(checkView(label, result.check, rerolled));
  return result;
}

function checkView(label: LocalizedText, c: CheckResult, rerolled: number | null): CheckOutcome {
  return { label, dice: c.roll.rolls, natural: c.roll.natural, modifier: c.total - c.roll.natural, total: c.total, dc: c.dc, success: c.success, rerolled };
}

const race = (hero: HeroWithItems) => RACE_DEFS[hero.race as RaceId];
const mod = (score: number) => abilityModifier(score);

// ─── Entering ─────────────────────────────────────────────────────────────

/** Walking in: only the Trapped corridor acts on its own. */
export async function enterEvent(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, room: number, now: Date, out: Outcome): Promise<void> {
  const kind = floor.rooms[room]!.event;
  if (kind !== 'trapped-corridor') return;
  const day = dayNumber(now);
  const visit = await visitOf(tx, hero, floor.number, room, kind, day);
  if (visit.doneAt) return;
  const rogue = hero.class === 'rogue';
  const { seed, rng } = seeded();
  const trap = await withLuck(tx, hero, t('Dexterity against the trap', 'Ловкость против ловушки'), () => springTrap(rng, {
    modifier: mod(hero.dex), advantage: hero.class === 'wizard', rerollOnes: race(hero).rerollOnes, floor: floor.number, disarms: rogue,
  }), out);
  if (rogue) {
    out.notices.push(t('You spot the tripwire and disarm the trap.', 'Вы замечаете растяжку и обезвреживаете ловушку.'));
  } else if (trap.damage > 0) {
    const hp = Math.max(1, hero.hp - trap.damage);
    await tx.hero.update({ where: { id: hero.id }, data: { hp } });
    out.notices.push(t(`The trap springs: ${hero.hp - hp} damage.`, `Ловушка срабатывает: ${hero.hp - hp} урона.`));
    hero.hp = hp;
  } else {
    out.notices.push(t('You slip past the trap unhurt.', 'Вы проскальзываете мимо ловушки без единой царапины.'));
  }
  await logRoll(tx, hero, seed, { event: kind, floor: floor.number, room, damage: trap.damage, disarmed: rogue });
  await finish(tx, visit, hero, floor.number, room, now);
}

// ─── What the room shows ──────────────────────────────────────────────────

export async function eventView(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, room: number, now: Date): Promise<EventView | null> {
  const kind = floor.rooms[room]!.event;
  if (!kind) return null;
  const day = dayNumber(now);
  const visit = await tx.eventVisit.findUnique({ where: { heroId_floor_room_day: { heroId: hero.id, floor: floor.number, room, day } } });
  const done = Boolean(visit?.doneAt);
  const state = stateOf(visit);
  const seed = seedFor(season, hero, floor.number, room, day);
  switch (kind) {
    case 'three-chests': {
      const chests = threeChests(createRng(seed), floor.number);
      return { kind, done, chests: chests.map((content, i) => ({ picked: state.picked === i, content: state.picked === undefined ? null : content })) };
    }
    case 'gambler':
      return { kind, done, maxBet: hero.carriedGold };
    case 'merchant': {
      const wares = merchantWares(createRng(seed), { floor: floor.number, classId: hero.class as ClassId });
      const sold = new Set(state.sold ?? []);
      return {
        kind, done,
        wares: wares.map((roll, i) => ({ id: `ware-${i}`, item: rollView(roll, `ware-${i}`), price: buybackPrice(roll) * MERCHANT_MARKUP, sold: sold.has(`ware-${i}`) })),
        buysAt: MERCHANT_BUYS_AT,
      };
    }
    case 'locked-cache':
      return { kind, done, canOpen: hero.class === 'rogue' || stackTotal(hero, 'key-iron') > 0, free: hero.class === 'rogue' };
    default:
      return { kind, done };
  }
}

// ─── Acting ───────────────────────────────────────────────────────────────

/** Gear from the Bag for a trade or an offering. */
function bagGear(hero: HeroWithItems, itemId: string): Item {
  const item = ownItem(hero, itemId, ['BAG']);
  if (!isGear(baseById(item.base))) throw ApiError.badRequest('not_gear', 'Only gear');
  return item;
}

const nameOf = (item: Item): LocalizedText => (item.identified ? itemName(item) : baseById(item.base).name);

export async function eventAction(tx: Tx, hero: HeroWithItems, season: Season, floor: Floor, room: number, action: EventAction, now: Date, out: Outcome): Promise<void> {
  const kind = floor.rooms[room]!.event;
  if (!kind) throw ApiError.conflict('no_event', 'Nothing to do here');
  const day = dayNumber(now);
  const visit = await visitOf(tx, hero, floor.number, room, kind, day);
  const state = stateOf(visit);
  const seed = seedFor(season, hero, floor.number, room, day);
  const wrong = () => ApiError.badRequest('wrong_action', 'That doesn’t work here');
  if (visit.doneAt) throw ApiError.conflict('event_done', 'You have done what you can here today');

  switch (kind) {
    case 'three-chests': {
      if (action.action !== 'pick') throw wrong();
      const content = threeChests(createRng(seed), floor.number)[action.chest]!;
      await finish(tx, visit, hero, floor.number, room, now, { picked: action.chest });
      if (content.kind === 'gold') {
        const gold = withGoldFind(hero, content.amount);
        await earnCarried(tx, hero, gold);
        out.gold += gold;
      } else if (content.kind === 'item') {
        await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[content.tier, 1]], source: 'three-chests' }, out);
      } else {
        out.notices.push(t('The chest opens its teeth. A mimic!', 'Сундук раскрывает пасть. Мимик!'));
        await fight(tx, hero, season, floor, room, 'fight', out, {
          monsters: [instantiate(monsterById('mimic'), floor.number, 'm0')], bonusDrops: 1, clears: false,
        });
      }
      return;
    }

    case 'shrine': {
      if (action.action !== 'pray') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const cleric = hero.class === 'cleric';
      const prayer = await withLuck(tx, hero, t('Wisdom at the Shrine', 'Мудрость у святилища'), () => prayAtShrine(rng, {
        modifier: mod(hero.wis) + (cleric ? proficiencyBonus(hero.level) : 0), advantage: cleric, rerollOnes: race(hero).rerollOnes,
        sensesCurses: hero.class === 'wizard',
      }), out);
      await finish(tx, visit, hero, floor.number, room, now);
      await logRoll(tx, hero, rollSeed, { event: kind, floor: floor.number, room, outcome: prayer.outcome, blessing: prayer.blessing });
      if (prayer.outcome === 'blessing') {
        const b = BLESSINGS[prayer.blessing!];
        await tx.hero.update({ where: { id: hero.id }, data: { blessing: b.id, blessingUntil: new Date(now.getTime() + BLESSING_MS) } });
        out.notices.push(t(`The Shrine blesses you: ${b.name.en}. ${b.description.en}`, `Святилище благословляет вас: ${b.name.ru}. ${b.description.ru}`));
      } else if (prayer.outcome === 'curse') {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(hero.maxHp * 0.25)));
        await tx.hero.update({ where: { id: hero.id }, data: { hp: hero.hp - lost } });
        out.notices.push(t(`The Shrine burns you: ${lost} damage.`, `Святилище обжигает вас: ${lost} урона.`));
      } else if (prayer.outcome === 'sensed') {
        out.notices.push(t('You sense a curse in the stones and step back in time.', 'Вы чуете проклятие в камнях и вовремя отступаете.'));
      } else {
        out.notices.push(t('The Shrine stays silent.', 'Святилище молчит.'));
      }
      return;
    }

    case 'gambler': {
      const { seed: rollSeed, rng } = seeded();
      if (action.action === 'bet-gold') {
        await spendCarried(tx, hero, action.amount);
        const duel = goblinDice(rng, race(hero).rerollOnes);
        out.duel = duel;
        await logRoll(tx, hero, rollSeed, { event: kind, bet: action.amount, ...duel });
        if (duel.win) {
          await earnCarried(tx, hero, action.amount * 2);
          out.gold += action.amount;
          out.notices.push(t(`You win ${action.amount} gold!`, `Вы выигрываете ${action.amount} золота!`));
        } else {
          out.notices.push(t(`The goblin sweeps up your ${action.amount} gold.`, `Гоблин сгребает вашу ставку: ${action.amount} золота.`));
        }
      } else if (action.action === 'bet-item') {
        const item = bagGear(hero, action.itemId);
        const up = nextTier(item.tier as Tier);
        if (!up) throw ApiError.conflict('too_precious', 'The goblin has nothing better to bet against that');
        const duel = goblinDice(rng, race(hero).rerollOnes);
        out.duel = duel;
        const name = nameOf(item);
        await destroyItem(tx, hero, item);
        await logRoll(tx, hero, rollSeed, { event: kind, bet: item.id, from: item.tier, ...duel });
        if (duel.win) {
          const roll = rollGear(rng, { tier: up, itemLevel: Math.max(item.itemLevel, floor.number) });
          const won = await giveItem(tx, hero, { ...gearData(roll, rollSeed), seasonId: season.id });
          out.loot.push(toItemView(won));
          out.notices.push(t('You win! The goblin grudgingly hands over something better.', 'Вы выиграли! Гоблин нехотя отдаёт вещь получше.'));
        } else {
          out.notices.push(t(`The goblin pockets your ${name.en}.`, `Гоблин прячет ваш предмет «${name.ru}».`));
        }
      } else {
        throw wrong();
      }
      await finish(tx, visit, hero, floor.number, room, now);
      return;
    }

    case 'merchant': {
      if (action.action === 'buy') {
        const index = /^ware-(\d)$/.exec(action.ware)?.[1];
        const wares = merchantWares(createRng(seed), { floor: floor.number, classId: hero.class as ClassId });
        const roll = index === undefined ? undefined : wares[Number(index)];
        if (!roll) throw ApiError.notFound('no_ware', 'The merchant has no such thing');
        const sold = state.sold ?? [];
        if (sold.includes(action.ware)) throw ApiError.conflict('sold_out', 'Already sold');
        await spendCarried(tx, hero, buybackPrice(roll) * MERCHANT_MARKUP);
        const bought = await giveItem(tx, hero, { ...gearData(roll, `${seed}#${index}`), seasonId: season.id });
        out.loot.push(toItemView(bought));
        await tx.eventVisit.update({ where: { id: visit.id }, data: { state: { ...state, sold: [...sold, action.ware] } as Prisma.InputJsonValue } });
      } else if (action.action === 'sell') {
        const item = ownItem(hero, action.itemId, ['BAG']);
        if (item.tier === 'relic') throw ApiError.conflict('relic', 'Even the merchant won’t touch a Relic');
        const price = sellValue({ ...item, tier: item.tier as Tier }) * MERCHANT_BUYS_AT;
        await destroyItem(tx, hero, item);
        await earnCarried(tx, hero, price);
        out.gold += price;
        out.notices.push(t(`The merchant pays ${price} gold.`, `Торговец платит ${price} золота.`));
      } else {
        throw wrong();
      }
      return;
    }

    case 'cursed-altar': {
      if (action.action !== 'offer') throw wrong();
      const item = bagGear(hero, action.itemId);
      if (!item.identified) throw ApiError.conflict('identify_first', 'The altar wants to know what it is given');
      if (!ALTAR_TIERS.includes(item.tier as Tier)) throw ApiError.conflict('too_precious', 'The altar only takes Common, Uncommon and Rare gear');
      const { seed: rollSeed, rng } = seeded();
      const bonusStats = item.bonusStats as unknown as GearRoll['bonusStats'];
      const r = offerAtAltar(rng, { tier: item.tier as Tier, itemLevel: item.itemLevel, bonusStats });
      const name = nameOf(item);
      await logRoll(tx, hero, rollSeed, { event: kind, itemId: item.id, from: item.tier, ...r });
      await finish(tx, visit, hero, floor.number, room, now);
      if (r.success) {
        const updated = await tx.item.update({
          where: { id: item.id },
          data: {
            tier: r.tier,
            bonusStats: (r.stat ? [...bonusStats, r.stat] : bonusStats) as unknown as Prisma.InputJsonValue,
            suffix: item.suffix ?? rng.int(0, SUFFIXES.length - 1),
          },
        });
        out.loot.push(toItemView(updated));
        out.notices.push(t(`The altar drinks the offering. Your ${name.en} rises a Tier.`, `Алтарь принимает подношение: «${name.ru}» поднимается на ранг выше.`));
      } else {
        await destroyItem(tx, hero, item);
        out.notices.push(t(`The altar swallows your ${name.en}.`, `Алтарь поглощает «${name.ru}».`));
      }
      return;
    }

    case 'locked-cache': {
      if (action.action !== 'open') throw wrong();
      if (hero.class !== 'rogue') await takeStack(tx, hero, 'key-iron', 1, 'no_key');
      const { seed: rollSeed, rng } = seeded();
      const cache = cacheContents(rng, floor.number, 0);
      await logRoll(tx, hero, rollSeed, { event: kind, ...cache });
      await finish(tx, visit, hero, floor.number, room, now);
      for (const tier of cache.tiers) {
        await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[tier, 1]], source: 'locked-cache' }, out);
      }
      const gold = withGoldFind(hero, cache.gold);
      await earnCarried(tx, hero, gold);
      out.gold += gold;
      out.notices.push(t('The cache creaks open.', 'Тайник со скрипом открывается.'));
      return;
    }

    case 'lockpicking': {
      if (action.action !== 'pick-lock') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const rogue = hero.class === 'rogue';
      const picked = await withLuck(tx, hero, t('Dexterity at the lock', 'Ловкость у замка'), () => pickLock(rng, {
        modifier: mod(hero.dex) + (rogue ? proficiencyBonus(hero.level) : 0), advantage: rogue, rerollOnes: race(hero).rerollOnes, floor: floor.number,
      }), out);
      await finish(tx, visit, hero, floor.number, room, now);
      await logRoll(tx, hero, rollSeed, { event: kind, success: picked.check.success, chest: picked.chest });
      if (picked.chest) await dropStack(tx, hero, season, chestBase(picked.chest), 1, out);
      else out.notices.push(t('The lock jams for good.', 'Замок заклинило намертво.'));
      return;
    }

    default:
      throw wrong();
  }
}
