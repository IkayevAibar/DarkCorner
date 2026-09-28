import type { EventVisit, Item, Prisma, Season } from '@prisma/client';
import type { EventAction, EventView, LocalizedText } from '@dark/shared';
import {
  ALTAR_TIERS, BLESSING_MS, BLESSINGS, type CheckResult, type ClassId, type EventKind, type Floor, type GearRoll, MERCHANT_BUYS_AT,
  MERCHANT_MARKUP, RACE_DEFS, type RaceId, SUFFIXES, type Tier, abilityModifier, baseById, buybackPrice, cacheContents,
  chestBase, createRng, goblinDice, instantiate, isGear, itemName, merchantWares, monsterById, nextTier, offerAtAltar,
  pickLock, prayAtShrine, proficiencyBonus, rollGear, sellValue, springTrap, threeChests, BLESSING_IDS, type PathId, drinkFountain, freePrisoner, readTome, restUses, searchBones,
  RIDDLES, STATUE_GAZE, STATUE_XP, statueRiddle, COOKPOT_STAMINA, addStamina, currentStamina, cutWeb, tasteStew,
  banishDevil, bloodPrice, devilOffers, pryLid,
} from '@dark/engine';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { type CheckOutcome, type Outcome, fight, heroFloor, markCleared, t } from './fights.js';
import { fullHealth } from './heroes.js';
import { gearData, rollView, toItemView } from './items.js';
import {
  type HeroWithItems, type Tx, dayNumber, destroyItem, earnCarried, giveItem, ownItem, spendCarried, stackTotal, takeStack,
} from './ledger.js';
import { dropGear, dropStack, withGoldFind } from './loot.js';
import { boostedXp, gainXp } from './progression.js';
import { trackBounties } from './bounties.js';

// Event rooms (docs/design.md → Event rooms). What a room holds comes from a seed
// per Hero, Room and day, so it can't be rerolled by leaving and coming back;
// EventVisit only stores what the Hero did.

interface VisitState {
  picked?: number;
  sold?: string[];
  /** The Riddling statue: the answer chosen. */
  answered?: number;
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

async function finish(tx: Tx, visit: EventVisit, hero: HeroWithItems, floor: number, room: number, now: Date, state?: VisitState, out?: Outcome) {
  await tx.eventVisit.update({
    where: { id: visit.id },
    data: { doneAt: now, ...(state ? { state: state as Prisma.InputJsonValue } : {}) },
  });
  await markCleared(tx, await heroFloor(tx, hero.id, floor), room, now);
  await trackBounties(tx, hero, { type: 'event' }, out ?? null, now);
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
  await finish(tx, visit, hero, floor.number, room, now, undefined, out);
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
    case 'prisoner':
      return { kind, done, canOpen: hero.class === 'rogue' || stackTotal(hero, 'key-iron') > 0, free: hero.class === 'rogue' };
    case 'riddle': {
      const today = statueRiddle(createRng(seed));
      return {
        kind, done,
        question: RIDDLES[today.riddle]!.question,
        answers: today.answers.map((i) => RIDDLES[i]!.answer),
        chosen: state.answered ?? null,
        right: done ? today.right : null,
      };
    }
    case 'bargain': {
      const offers = devilOffers(createRng(seed), floor.number);
      const full = fullHealth(hero);
      return {
        kind, done,
        gold: withGoldFind(hero, offers.gold), goldPrice: bloodPrice(full, offers.goldPrice),
        tier: offers.tier, itemPrice: bloodPrice(full, offers.itemPrice),
      };
    }
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
      await finish(tx, visit, hero, floor.number, room, now, { picked: action.chest }, out);
      if (content.kind === 'gold') {
        const gold = withGoldFind(hero, content.amount);
        await earnCarried(tx, hero, gold);
        out.gold += gold;
      } else if (content.kind === 'item') {
        await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[content.tier, 1]], source: 'three-chests' }, out);
      } else {
        out.notices.push(t('The chest opens its teeth. A mimic!', 'Сундук раскрывает пасть. Мимик!'));
        // It bites before the Hero can draw.
        await fight(tx, hero, season, floor, room, 'fight', out, {
          monsters: [instantiate(monsterById('mimic'), floor.number, 'm0')], bonusDrops: 1, clears: false, surprise: 'hero',
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
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      await logRoll(tx, hero, rollSeed, { event: kind, floor: floor.number, room, outcome: prayer.outcome, blessing: prayer.blessing });
      if (prayer.outcome === 'blessing') {
        const b = BLESSINGS[prayer.blessing!];
        await tx.hero.update({ where: { id: hero.id }, data: { blessing: b.id, blessingUntil: new Date(now.getTime() + BLESSING_MS) } });
        out.notices.push(t(`The Shrine blesses you: ${b.name.en}. ${b.description.en}`, `Святилище благословляет вас: ${b.name.ru}. ${b.description.ru}`));
      } else if (prayer.outcome === 'curse') {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(fullHealth(hero) * 0.25)));
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
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
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
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
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
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
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
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      await logRoll(tx, hero, rollSeed, { event: kind, success: picked.check.success, chest: picked.chest });
      if (picked.chest) await dropStack(tx, hero, season, chestBase(picked.chest), 1, out);
      else out.notices.push(t('The lock jams for good.', 'Замок заклинило намертво.'));
      return;
    }

    case 'fountain': {
      if (action.action !== 'drink') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const sip = await withLuck(tx, hero, t('The fountain’s water', 'Вода из фонтана'), () => drinkFountain(rng, { rerollOnes: race(hero).rerollOnes }), out);
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      await logRoll(tx, hero, rollSeed, { event: kind, outcome: sip.outcome });
      const full = fullHealth(hero);
      if (sip.outcome === 'foul') {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(full * 0.2)));
        await tx.hero.update({ where: { id: hero.id }, data: { hp: hero.hp - lost } });
        out.notices.push(t(`The water is foul: ${lost} damage.`, `Вода гнилая: ${lost} урона.`));
      } else if (sip.outcome === 'clean') {
        const hp = Math.min(full, hero.hp + Math.round(full * 0.5));
        await tx.hero.update({ where: { id: hero.id }, data: { hp } });
        out.notices.push(t(`Cool, clean water: +${hp - hero.hp} health.`, `Прохладная чистая вода: +${hp - hero.hp} здоровья.`));
      } else {
        const uses = restUses(hero.class as ClassId, hero.level, hero.path as PathId | null);
        await tx.hero.update({ where: { id: hero.id }, data: { hp: full, spellUses: uses.spells, healUses: uses.heals } });
        if (sip.outcome === 'spirit') {
          const b = BLESSINGS[rng.pick([...BLESSING_IDS])];
          await tx.hero.update({ where: { id: hero.id }, data: { blessing: b.id, blessingUntil: new Date(now.getTime() + BLESSING_MS) } });
          out.notices.push(t(`A spirit rises from the water and blesses you: ${b.name.en}. Fully healed and rested.`, `Из воды поднимается дух и благословляет вас: ${b.name.ru}. Здоровье и силы полностью восстановлены.`));
        } else {
          out.notices.push(t('The water glows as you drink: fully healed and rested.', 'Вода светится, пока вы пьёте: здоровье и силы полностью восстановлены.'));
        }
      }
      return;
    }

    case 'prisoner': {
      if (action.action !== 'free') throw wrong();
      if (hero.class !== 'rogue') await takeStack(tx, hero, 'key-iron', 1, 'no_key');
      const { seed: rollSeed, rng } = seeded();
      const freed = freePrisoner(rng, floor.number);
      await logRoll(tx, hero, rollSeed, { event: kind, ...freed });
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      if (freed.trap) {
        out.notices.push(t('The chains fall away, and the prisoner’s face melts into yours. A doppelganger!', 'Цепи падают, и лицо узника расплывается в ваше. Двойник!'));
        await fight(tx, hero, season, floor, room, 'fight', out, {
          monsters: [instantiate(monsterById('doppelganger'), floor.number, 'm0')], bonusDrops: 1, clears: false, surprise: 'hero',
        });
        return;
      }
      await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[freed.tier!, 1]], source: 'prisoner' }, out);
      const gold = withGoldFind(hero, freed.gold);
      await earnCarried(tx, hero, gold);
      out.gold += gold;
      out.notices.push(t('The prisoner presses their last treasures into your hands and slips away.', 'Узник вкладывает вам в руки последнее, что у него было, и исчезает.'));
      return;
    }

    case 'library': {
      if (action.action !== 'read') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const wizard = hero.class === 'wizard';
      const tome = await withLuck(tx, hero, t('Intelligence over the tome', 'Интеллект над фолиантом'), () => readTome(rng, {
        modifier: mod(hero.int) + (wizard ? proficiencyBonus(hero.level) : 0), advantage: wizard, rerollOnes: race(hero).rerollOnes, floor: floor.number,
      }), out);
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      await logRoll(tx, hero, rollSeed, { event: kind, xp: tome.xp, curse: tome.curse });
      if (tome.xp > 0) {
        const xp = await boostedXp(tx, hero, season, tome.xp);
        const levelUp = gainXp(hero, xp);
        await tx.hero.update({ where: { id: hero.id }, data: levelUp.data });
        Object.assign(hero, levelUp.data);
        out.xp += xp;
        out.levelUp = levelUp.newLevel ?? out.levelUp;
        out.notices.push(t('The old words make sense at last.', 'Древние слова наконец обретают смысл.'));
      } else if (tome.curse) {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(fullHealth(hero) * 0.1)));
        await tx.hero.update({ where: { id: hero.id }, data: { hp: hero.hp - lost } });
        out.notices.push(t(`The pages bite back: ${lost} damage.`, `Страницы кусаются: ${lost} урона.`));
      } else {
        out.notices.push(t('The script swims before your eyes.', 'Буквы плывут перед глазами.'));
      }
      return;
    }

    case 'riddle': {
      if (action.action !== 'answer') throw wrong();
      const today = statueRiddle(createRng(seed));
      await finish(tx, visit, hero, floor.number, room, now, { answered: action.choice }, out);
      await logRoll(tx, hero, seed, { event: kind, riddle: today.riddle, choice: action.choice, right: today.right });
      if (action.choice !== today.right) {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(fullHealth(hero) * STATUE_GAZE)));
        await tx.hero.update({ where: { id: hero.id }, data: { hp: hero.hp - lost } });
        hero.hp -= lost;
        out.notices.push(t(`Wrong. The statue's eyes burn: ${lost} damage.`, `Неверно. Глаза статуи обжигают: ${lost} урона.`));
        return;
      }
      const xp = await boostedXp(tx, hero, season, STATUE_XP * floor.number);
      const levelUp = gainXp(hero, xp);
      await tx.hero.update({ where: { id: hero.id }, data: levelUp.data });
      Object.assign(hero, levelUp.data);
      out.xp += xp;
      out.levelUp = levelUp.newLevel ?? out.levelUp;
      // It also points out a secret Door the Hero hasn't found: the room behind it goes on the Map.
      const known = await heroFloor(tx, hero.id, floor.number);
      const hidden = floor.rooms.find((r) => r.type === 'hidden' && !known.seen.includes(r.id));
      if (hidden) {
        await tx.heroFloor.update({ where: { id: known.id }, data: { seen: { push: hidden.id } } });
        out.notices.push(t('Right. The statue turns its eyes to a wall: a secret Door is there, and your Map shows the room behind it.', 'Верно. Статуя переводит взгляд на стену: там потайная дверь, и комната за ней теперь на вашей карте.'));
      } else {
        out.notices.push(t('Right. The statue closes its eyes, satisfied.', 'Верно. Статуя довольно закрывает глаза.'));
      }
      return;
    }

    case 'bone-pile': {
      if (action.action !== 'search') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const bones = searchBones(rng, floor.number);
      await logRoll(tx, hero, rollSeed, { event: kind, ...bones });
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      if (bones.rise) {
        out.notices.push(t('The bones clatter together and stand up!', 'Кости со стуком собираются и встают!'));
        const count = floor.number >= 4 ? 2 : 1;
        const risen = Array.from({ length: count }, (_, i) => instantiate(monsterById('skeleton'), Math.max(4, floor.number), `m${i}`));
        const result = await fight(tx, hero, season, floor, room, 'fight', out, { monsters: risen, clears: false, surprise: 'hero' });
        if (result !== 'victory') return;
      }
      const gold = withGoldFind(hero, bones.gold);
      await earnCarried(tx, hero, gold);
      out.gold += gold;
      if (bones.tier) await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[bones.tier, 1]], source: 'bone-pile' }, out);
      out.notices.push(t('Among the bones: an old adventurer’s purse.', 'Среди костей — кошель давнего искателя приключений.'));
      return;
    }

    case 'cookpot': {
      if (action.action !== 'eat') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      // A Dwarf's stomach has seen worse.
      const stew = await withLuck(tx, hero, t('Constitution against the stew', 'Телосложение против похлёбки'), () => tasteStew(rng, {
        modifier: mod(hero.con), advantage: hero.race === 'dwarf', rerollOnes: race(hero).rerollOnes, floor: floor.number,
      }), out);
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      await logRoll(tx, hero, rollSeed, { event: kind, good: stew.good });
      const full = fullHealth(hero);
      if (stew.good) {
        const hp = Math.min(full, hero.hp + Math.round(full / 3));
        const before = currentStamina(hero.stamina, hero.staminaAt, now).stamina;
        const stamina = addStamina(hero.stamina, hero.staminaAt, COOKPOT_STAMINA, now);
        await tx.hero.update({ where: { id: hero.id }, data: { hp, stamina: stamina.stamina, staminaAt: stamina.savedAt } });
        out.notices.push(t(
          `Greasy, hot and filling: +${hp - hero.hp} health, +${stamina.stamina - before} Stamina.`,
          `Жирно, горячо и сытно: +${hp - hero.hp} здоровья, +${stamina.stamina - before} выносливости.`,
        ));
        Object.assign(hero, { hp, stamina: stamina.stamina, staminaAt: stamina.savedAt });
      } else {
        const lost = Math.max(0, Math.min(hero.hp - 1, Math.round(full * 0.1)));
        await tx.hero.update({ where: { id: hero.id }, data: { hp: hero.hp - lost } });
        out.notices.push(t(`It was not meat. ${lost} damage.`, `Это было не мясо. ${lost} урона.`));
      }
      return;
    }

    case 'webbed-body': {
      if (action.action !== 'cut') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const rogue = hero.class === 'rogue';
      const cut = await withLuck(tx, hero, t('Dexterity against the web', 'Ловкость против паутины'), () => cutWeb(rng, {
        modifier: mod(hero.dex) + (rogue ? proficiencyBonus(hero.level) : 0), advantage: rogue, rerollOnes: race(hero).rerollOnes, floor: floor.number,
      }), out);
      await logRoll(tx, hero, rollSeed, { event: kind, success: cut.check.success, gold: cut.gold, tier: cut.tier });
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      if (!cut.check.success) {
        out.notices.push(t('The web shakes, and its owner drops from the dark!', 'Паутина дрожит, и из темноты падает её хозяин!'));
        const result = await fight(tx, hero, season, floor, room, 'fight', out, {
          monsters: [instantiate(monsterById('giant-spider'), floor.number, 'm0')], clears: false, surprise: 'hero',
        });
        if (result !== 'victory') return;
      }
      const gold = withGoldFind(hero, cut.gold);
      await earnCarried(tx, hero, gold);
      out.gold += gold;
      if (cut.tier) await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[cut.tier, 1]], source: 'webbed-body' }, out);
      out.notices.push(t('The cocoon splits open: an old adventurer’s purse.', 'Кокон лопается: кошель давнего искателя приключений.'));
      return;
    }

    case 'sarcophagus': {
      if (action.action !== 'pry') throw wrong();
      const { seed: rollSeed, rng } = seeded();
      const fighter = hero.class === 'fighter';
      const lid = await withLuck(tx, hero, t('Strength against the lid', 'Сила против крышки'), () => pryLid(rng, {
        modifier: mod(hero.str) + (fighter ? proficiencyBonus(hero.level) : 0), advantage: fighter, rerollOnes: race(hero).rerollOnes, floor: floor.number,
      }), out);
      await logRoll(tx, hero, rollSeed, { event: kind, success: lid.check.success, gold: lid.gold, tier: lid.tier });
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      if (!lid.check.success) {
        out.notices.push(t('The lid grinds loud, and whoever lies inside sits up.', 'Крышка громко скрежещет, и тот, кто лежит внутри, садится.'));
        const result = await fight(tx, hero, season, floor, room, 'fight', out, {
          monsters: [instantiate(monsterById('mummy'), floor.number, 'm0')], clears: false, surprise: 'hero',
        });
        if (result !== 'victory') return;
      }
      const gold = withGoldFind(hero, lid.gold);
      await earnCarried(tx, hero, gold);
      out.gold += gold;
      await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[lid.tier, 1]], source: 'sarcophagus' }, out);
      out.notices.push(t('Grave goods: gold, and something the dead won’t miss.', 'Погребальные дары: золото и то, что мёртвому уже ни к чему.'));
      return;
    }

    case 'bargain': {
      if (action.action === 'banish') {
        const { seed: rollSeed, rng } = seeded();
        const cleric = hero.class === 'cleric';
        const rite = await withLuck(tx, hero, t('Wisdom against the devil', 'Мудрость против дьявола'), () => banishDevil(rng, {
          modifier: mod(hero.wis) + (cleric ? proficiencyBonus(hero.level) : 0), advantage: cleric, rerollOnes: race(hero).rerollOnes, floor: floor.number,
        }), out);
        await logRoll(tx, hero, rollSeed, { event: kind, banished: rite.check.success });
        await finish(tx, visit, hero, floor.number, room, now, undefined, out);
        if (!rite.check.success) {
          out.notices.push(t('The salt scatters. The devil steps out of its circle, smiling.', 'Соль рассыпается. Дьявол с улыбкой выходит из круга.'));
          await fight(tx, hero, season, floor, room, 'fight', out, { monsters: [instantiate(monsterById('chain-devil'), floor.number, 'm0')], clears: false });
          return;
        }
        const xp = await boostedXp(tx, hero, season, rite.xp);
        const levelUp = gainXp(hero, xp);
        await tx.hero.update({ where: { id: hero.id }, data: levelUp.data });
        Object.assign(hero, levelUp.data);
        out.xp += xp;
        out.levelUp = levelUp.newLevel ?? out.levelUp;
        out.notices.push(t('The devil howls and sinks back to wherever it came from.', 'Дьявол воет и проваливается туда, откуда пришёл.'));
        return;
      }
      if (action.action !== 'bargain') throw wrong();
      const offers = devilOffers(createRng(seed), floor.number);
      const full = fullHealth(hero);
      const price = bloodPrice(full, action.offer === 'gold' ? offers.goldPrice : offers.itemPrice);
      const hp = Math.min(hero.hp, full);
      // The deal never kills: it needs more health than it takes.
      if (hp <= price) throw ApiError.conflict('too_weak', 'Not enough health for that deal');
      await tx.hero.update({ where: { id: hero.id }, data: { hp: hp - price } });
      hero.hp = hp - price;
      await logRoll(tx, hero, seed, { event: kind, offer: action.offer, price, ...offers });
      await finish(tx, visit, hero, floor.number, room, now, undefined, out);
      if (action.offer === 'gold') {
        const gold = withGoldFind(hero, offers.gold);
        await earnCarried(tx, hero, gold);
        out.gold += gold;
        out.notices.push(t(`The devil drinks ${price} health and pays in hot coins.`, `Дьявол выпивает ${price} здоровья и платит горячими монетами.`));
      } else {
        await dropGear(tx, hero, season, { floor: floor.number, count: 1, odds: [[offers.tier, 1]], source: 'bargain' }, out);
        out.notices.push(t(`The devil drinks ${price} health and hands over its gift.`, `Дьявол выпивает ${price} здоровья и отдаёт свой дар.`));
      }
      return;
    }

    default:
      throw wrong();
  }
}
