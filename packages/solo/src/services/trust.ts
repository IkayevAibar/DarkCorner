import type { DuoChest, HeroFloor, Prisma, Season } from '@prisma/client';
import type { DuoChestView, OathChoice, OathView } from '@dark/shared';
import { BLESSING_MS, type Floor, LOOT, OATH_MS, type Oath, PICK_MS, bestLeft, createRng, nextPicker, oathOdds, oathOutcome } from '@dark/engine';
import { ApiError } from '../lib/errors.js';
import { newSeed } from '../lib/seed.js';
import { trackBounties } from './bounties.js';
import { countDeeds } from './deeds.js';
import { feed } from './feed.js';
import { type Outcome, clearedAt, heroFloor, isCleared, markCleared, t } from './fights.js';
import { rollView } from './items.js';
import { type HeroWithItems, type Tx, freePlace } from './ledger.js';
import { type Drop, dropChest, giveDrop, rollDrop, withGoldFind } from './loot.js';
import { omenOf } from './omens.js';
import { SHARE_EARNS, TAKE_COSTS, companionOath, isCompanion, shiftLoyalty } from './companion.js';

// Trust and greed (docs/design.md → Duos → Trust and greed): two things a Duo decides
// between its own two Players. At an Oathstone each swears in secret to share or to take;
// Treasure found together goes into one Duo Chest, split by picking in turns.

// ─── Oathstones ───────────────────────────────────────────────────────────

/** The pair in id order: how an Oath row names them. */
const inOrder = <H extends { id: string }>(a: H, b: H): [H, H] => (a.id < b.id ? [a, b] : [b, a]);

async function oathRow(tx: Tx, season: Season, floor: Floor, room: number, a: { id: string }, b: { id: string }) {
  const [first, second] = inOrder(a, b);
  return tx.oath.findUnique({
    where: { seasonId_floor_room_heroAId_heroBId: { seasonId: season.id, floor: floor.number, room, heroAId: first.id, heroBId: second.id } },
  });
}

/** When either Hero swore at this stone within the week: the stone answers the pair again after both weeks are out. */
function spentUntil(hfs: (HeroFloor | null)[], room: number, now: Date): Date | null {
  const until = hfs.map((hf) => clearedAt(hf, room)).filter((at): at is Date => at !== null && now.getTime() - at.getTime() < OATH_MS)
    .map((at) => at.getTime() + OATH_MS);
  return until.length > 0 ? new Date(Math.max(...until)) : null;
}

/** An Oathstone as its Player sees it: silent alone, spent for the week, or open with each oath kept secret. */
export async function oathView(tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, room: number, now: Date): Promise<OathView> {
  if (!partner) return { state: 'silent', mine: null, partnerSwore: false, until: null };
  const hfs = await Promise.all([hero, partner].map((h) => tx.heroFloor.findUnique({ where: { heroId_floor: { heroId: h.id, floor: floor.number } } })));
  const until = spentUntil(hfs, room, now);
  if (until) return { state: 'spent', mine: null, partnerSwore: false, until: until.toISOString() };
  const row = await oathRow(tx, season, floor, room, hero, partner);
  const mineA = row?.heroAId === hero.id;
  return {
    state: 'open',
    mine: ((mineA ? row?.choiceA : row?.choiceB) ?? null) as OathChoice | null,
    partnerSwore: Boolean(mineA ? row?.choiceB : row?.choiceA),
    until: null,
  };
}

/**
 * A Player swears at the Oathstone where its Duo stands. The first oath waits, secret,
 * for the second; the second settles both (oathOutcome).
 */
export async function swear(tx: Tx, hero: HeroWithItems, partner: HeroWithItems | null, season: Season, floor: Floor, room: number, choice: Oath,
  now: Date, out: Outcome, partnerOut: Outcome): Promise<void> {
  if (floor.rooms[room]!.type !== 'oathstone') throw ApiError.conflict('no_oathstone', 'There is no Oathstone here');
  const view = await oathView(tx, hero, partner, season, floor, room, now);
  if (view.state === 'silent' || !partner) throw ApiError.conflict('oath_alone', 'The Oathstone answers only a Duo');
  if (view.state === 'spent') throw ApiError.conflict('oath_spent', 'You have sworn here this week');
  if (view.mine) throw ApiError.conflict('already_sworn', 'Your oath is sworn');
  const [a, b] = inOrder(hero, partner);
  const field = hero.id === a.id ? 'choiceA' : 'choiceB';
  let row = await tx.oath.upsert({
    where: { seasonId_floor_room_heroAId_heroBId: { seasonId: season.id, floor: floor.number, room, heroAId: a.id, heroBId: b.id } },
    create: { seasonId: season.id, floor: floor.number, room, heroAId: a.id, heroBId: b.id, [field]: choice },
    update: { [field]: choice },
  });
  // A Companion swears at once, by its loyalty (companion.ts).
  const theirs = field === 'choiceA' ? 'choiceB' : 'choiceA';
  if (isCompanion(partner) && !row[theirs]) row = await tx.oath.update({ where: { id: row.id }, data: { [theirs]: await companionOath(tx) } });
  if (!row.choiceA || !row.choiceB) {
    out.notices.push(t(`You swear by the stone, in secret. Now ${partner.name} must choose.`, `Вы втайне клянётесь камнем. Теперь выбор за героем ${partner.name}.`));
    partnerOut.notices.push(t(`${hero.name} has sworn by the Oathstone. Your turn: share, or take.`, `${hero.name} клянётся камнем. Ваш черёд: поделиться или забрать.`));
    return;
  }
  const outs = new Map([[hero.id, out], [partner.id, partnerOut]]);
  await settleOaths(tx, season, floor, room, [a, b], [row.choiceA as Oath, row.choiceB as Oath], outs, now);
  await tx.oath.delete({ where: { id: row.id } });
  // Sharing with a Companion earns its loyalty, and taking costs it.
  if (isCompanion(partner)) await shiftLoyalty(tx, hero, choice === 'share' ? SHARE_EARNS : -TAKE_COSTS, out);
}

/** Both have sworn: the gifts, the curse, the Feed, and a week before this stone answers either again. */
async function settleOaths(tx: Tx, season: Season, floor: Floor, room: number, pair: [HeroWithItems, HeroWithItems], oaths: [Oath, Oath],
  outs: Map<string, Outcome>, now: Date): Promise<void> {
  const { gifts, cursed } = oathOutcome(oaths[0], oaths[1]);
  for (const [i, hero] of pair.entries()) {
    const out = outs.get(hero.id)!;
    // The reveal, for the screen: both oaths, from this Hero's side.
    out.oath = { mine: oaths[i]!, partner: oaths[1 - i]! };
    // A gift the stone gives goes into the Bag even when it is full. A Companion's gifts are its own.
    for (let g = 0; g < gifts[i]! && !isCompanion(hero); g++) {
      await giveDrop(tx, hero, season, await rollDrop(tx, hero, season, { floor: floor.number, odds: oathOdds(floor.number), source: 'oathstone' }), out, true);
    }
    if (cursed) {
      const curse = { blessing: 'oathbroken', blessingUntil: new Date(now.getTime() + BLESSING_MS) };
      await tx.hero.update({ where: { id: hero.id }, data: curse });
      Object.assign(hero, curse);
    }
    await markCleared(tx, await heroFloor(tx, hero.id, floor.number), room, now);
    // Both sharing is a kept oath for each; taking from a partner who shares, a broken one.
    if (!isCompanion(hero)) await countDeeds(tx, hero, { 'oaths-kept': !cursed && gifts[0] === 1 ? 1 : 0, 'oaths-broken': gifts[i] === 2 ? 1 : 0 }, out);
  }
  const [a, b] = pair;
  const said = (h: HeroWithItems, other: HeroWithItems, en: string, ru: string) => outs.get(h.id)!.notices.push(t(en.replaceAll('{other}', other.name), ru.replaceAll('{other}', other.name)));
  if (!cursed && gifts[0] === 1) {
    for (const [h, other] of [[a, b], [b, a]] as const) {
      said(h, other, 'You both shared. The stone keeps faith with you and {other}: a gift for each.', 'Вы с героем {other} делитесь. Камень верен вам двоим: каждому по дару.');
    }
    await feed(tx, season, a, 'oath-kept', { partner: b.name, floor: floor.number });
  } else if (cursed) {
    for (const [h, other] of [[a, b], [b, a]] as const) {
      said(h, other, 'You and {other} both reached to take. The Oathstone cracks, and its curse falls on you both: half the gold and dimmer luck for 3 hours.',
        'Вы и {other} тянетесь забрать. Камень клятв трескается, и проклятие падает на вас двоих: вдвое меньше золота и меньше удачи на 3 часа.');
    }
    await feed(tx, season, a, 'oath-cracked', { partner: b.name, floor: floor.number });
  } else {
    const [taker, giver] = gifts[0] === 2 ? [a, b] : [b, a];
    said(taker, giver, 'You took. {other} kept the oath, and both gifts are yours. Everyone will hear of it.',
      'Вы забираете. {other} держит слово, и оба дара достаются вам. Об этом услышат все.');
    said(giver, taker, '{other} took both gifts. You kept your oath, and the stone gives you nothing.',
      '{other} забирает оба дара. Вы держите слово, а камень не даёт вам ничего.');
    await feed(tx, season, taker, 'oath-broken', { partner: giver.name, floor: floor.number });
  }
}

// ─── Duo Chests ───────────────────────────────────────────────────────────

interface Pick { heroId: string; index: number }
const itemsOf = (chest: DuoChest) => chest.items as unknown as Drop[];
const picksOf = (chest: DuoChest) => chest.picks as unknown as Pick[];

export async function chestOf(tx: Tx, heroId: string): Promise<DuoChest | null> {
  return tx.duoChest.findFirst({ where: { OR: [{ heroAId: heroId }, { heroBId: heroId }] } });
}

/**
 * Treasure a Duo walks in on together: each Hero whose Treasure waits rolls its own
 * gold, Chest and Items as ever, but the Items go into one Duo Chest to be split.
 */
export async function duoTreasure(tx: Tx, pair: [HeroWithItems, HeroWithItems], season: Season, floor: Floor, room: number, now: Date,
  outs: Map<string, Outcome>): Promise<void> {
  const pool: Drop[] = [];
  for (const hero of pair) {
    const hf = await heroFloor(tx, hero.id, floor.number);
    if (isCleared(hf, room, now)) continue;
    const out = outs.get(hero.id)!;
    const rng = createRng(newSeed());
    let r = rng.next() * LOOT.treasureItems.reduce((sum, [, w]) => sum + w, 0);
    const count = LOOT.treasureItems.find(([, w]) => (r -= w) < 0)?.[0] ?? 1;
    for (let i = 0; i < count; i++) pool.push(await rollDrop(tx, hero, season, { floor: floor.number, source: 'treasure' }));
    // A Companion's share is in the Duo Chest: the Treasure's gold and Chest are the Hero's alone.
    if (isCompanion(hero)) {
      await markCleared(tx, hf, room, now);
      continue;
    }
    if (rng.chance(LOOT.treasureChest)) await dropChest(tx, hero, season, floor.number, out);
    const gold = withGoldFind(hero, Math.round(rng.int(5, 15) * (floor.number + 1) * (omenOf(season, now)?.gold ?? 1)));
    await tx.hero.update({ where: { id: hero.id }, data: { carriedGold: { increment: gold } } });
    hero.carriedGold += gold;
    out.gold += gold;
    await markCleared(tx, hf, room, now);
    await trackBounties(tx, hero, { type: 'treasure' }, out, now);
  }
  await openDuoChest(tx, season, floor, room, pair, pool, outs, now);
}

/** Puts Items in a Duo Chest for the pair to split, a coin deciding who picks first. */
export async function openDuoChest(tx: Tx, season: Season, floor: Floor, room: number, pair: [HeroWithItems, HeroWithItems], pool: Drop[],
  outs: Map<string, Outcome>, now: Date): Promise<void> {
  if (pool.length === 0) return;
  const [first, second] = createRng(newSeed()).chance(0.5) ? pair : [pair[1], pair[0]];
  const chest = await tx.duoChest.create({
    data: {
      seasonId: season.id, floor: floor.number, room, heroAId: first.id, heroBId: second.id,
      items: pool as unknown as Prisma.InputJsonValue, turnAt: now,
    },
  });
  const n = pool.length;
  outs.get(first.id)?.notices.push(t(`A Duo Chest with ${n} Items! A coin says you pick first, then ${second.name}: take turns.`,
    `Сундук дуэта, предметов: ${n}! Монетка решила: сначала выбираете вы, потом ${second.name}, и так по очереди.`));
  for (const hero of pair) {
    if (freePlace(hero) === null) {
      outs.get(hero.id)?.notices.push(t('Your Bag is full: your turns pass to your partner until you make room.', 'Ваша сумка полна: ваши ходы переходят напарнику, пока не освободите место.'));
    }
  }
  outs.get(second.id)?.notices.push(t(`A Duo Chest with ${n} Items! A coin says ${first.name} picks first, then you: take turns.`,
    `Сундук дуэта, предметов: ${n}! Монетка решила: сначала выбирает ${first.name}, потом вы, и так по очереди.`));
  // A Companion with the first pick takes it at once.
  if (isCompanion(first)) await takeTurns(tx, chest, new Map(pair.map((h) => [h.id, h])), season, outs, now);
}

/**
 * Brings a Duo Chest up to date: a pick left PICK_MS goes to the best Item left, `pick`
 * (a Player's choice) is taken when it is that Player's turn, and `finish` picks the rest
 * in turn (the Duo moved on, or is no more). It closes once empty, or once neither can
 * carry more. Returns the chest as it stands, or null when it closed.
 */
export async function takeTurns(tx: Tx, chest: DuoChest, heroes: Map<string, HeroWithItems>, season: Season, outs: Map<string, Outcome>, now: Date,
  opts: { pick?: Pick; finish?: boolean } = {}): Promise<DuoChest | null> {
  const items = itemsOf(chest);
  const picks = [...picksOf(chest)];
  const taken = new Set(picks.map((p) => p.index));
  const order = [chest.heroAId, chest.heroBId] as const;
  // A Companion picks at once on its turns, and keeps what it picks: nothing for it to carry (companion.ts).
  const companion = [...heroes.values()].find((h) => isCompanion(h)) ?? null;
  const canCarry = (id: string) => id === companion?.id || freePlace(heroes.get(id)!) !== null;
  let turnAt = chest.turnAt;
  let picked = false;
  const give = async (heroId: string, index: number) => {
    if (heroId !== companion?.id) await giveDrop(tx, heroes.get(heroId)!, season, items[index]!, outs.get(heroId)!);
    taken.add(index);
    picks.push({ heroId, index });
  };
  for (;;) {
    if (taken.size === items.length) break;
    const due = nextPicker(order, picks.at(-1)?.heroId ?? null, canCarry);
    if (!due) break;
    if (opts.pick && !picked && opts.pick.heroId === due) {
      if (opts.pick.index >= items.length || taken.has(opts.pick.index)) throw ApiError.conflict('already_taken', 'That Item is taken');
      await give(due, opts.pick.index);
      picked = true;
      turnAt = now;
      continue;
    }
    if (due === companion?.id) {
      await give(due, bestLeft(items.map((d) => d.roll), taken)!);
      turnAt = now;
      continue;
    }
    const late = now.getTime() - turnAt.getTime() >= PICK_MS;
    if (!opts.finish && !late) break;
    await give(due, bestLeft(items.map((d) => d.roll), taken)!);
    turnAt = opts.finish ? now : new Date(Math.min(now.getTime(), turnAt.getTime() + PICK_MS));
  }
  if (opts.pick && !picked) throw ApiError.conflict('not_your_pick', 'It is not your pick');
  const open = taken.size < items.length && nextPicker(order, picks.at(-1)?.heroId ?? null, canCarry) !== null;
  if (!open) {
    await tx.duoChest.delete({ where: { id: chest.id } });
    // Its last state, for the screen to finish the picks on: once, for each of the two.
    const last = { ...chest, picks: picks as unknown as Prisma.JsonValue, turnAt: now };
    for (const [heroId, out] of outs) out.closedChest = { ...chestView(last, heroId, heroes), turn: null };
    const left = items.length - taken.size;
    for (const out of outs.values()) {
      out.notices.push(left > 0
        ? t('Neither of you can carry more: the rest of the Duo Chest stays behind.', 'Никто из вас больше не унесёт: остальное в сундуке дуэта остаётся.')
        : t('The Duo Chest is empty.', 'Сундук дуэта опустел.'));
    }
    // Letting a Companion take its picks earns its loyalty.
    const master = companion ? [...heroes.values()].find((h) => h.id !== companion.id) : undefined;
    if (companion && master && picks.some((p) => p.heroId === companion.id)) await shiftLoyalty(tx, master, SHARE_EARNS, outs.get(master.id)!);
    return null;
  }
  return tx.duoChest.update({ where: { id: chest.id }, data: { picks: picks as unknown as Prisma.InputJsonValue, turnAt } });
}

/**
 * With a Companion, the Player takes every Item left at once, as far as the Bag holds (the
 * rest stays behind), and the Chest closes. The Companion minds: it costs loyalty.
 */
export async function takeAll(tx: Tx, chest: DuoChest, hero: HeroWithItems, companion: HeroWithItems, season: Season, out: Outcome, now: Date): Promise<void> {
  const items = itemsOf(chest);
  const picks = [...picksOf(chest)];
  const taken = new Set(picks.map((p) => p.index));
  for (const [index, drop] of items.entries()) {
    if (taken.has(index)) continue;
    if (freePlace(hero) === null) break;
    await giveDrop(tx, hero, season, drop, out);
    taken.add(index);
    picks.push({ heroId: hero.id, index });
  }
  await tx.duoChest.delete({ where: { id: chest.id } });
  const last = { ...chest, picks: picks as unknown as Prisma.JsonValue, turnAt: now };
  out.closedChest = { ...chestView(last, hero.id, new Map([[hero.id, hero], [companion.id, companion]])), turn: null };
  out.notices.push(taken.size < items.length
    ? t('You take all you can carry from the Duo Chest; the rest stays behind.', 'Вы забираете из сундука дуэта всё, что можете унести; остальное остаётся.')
    : t('You take everything in the Duo Chest.', 'Вы забираете всё из сундука дуэта.'));
  await shiftLoyalty(tx, hero, -TAKE_COSTS, out);
}

/** A Duo Chest as one of its Players sees it. */
export function chestView(chest: DuoChest, viewerId: string, heroes: Map<string, HeroWithItems>): DuoChestView {
  const picks = picksOf(chest);
  const by = new Map(picks.map((p) => [p.index, p.heroId]));
  const due = nextPicker([chest.heroAId, chest.heroBId], picks.at(-1)?.heroId ?? null, (id) => freePlace(heroes.get(id)!) !== null);
  return {
    items: itemsOf(chest).map((d, i) => ({
      item: rollView(d.roll, `chest-${i}`),
      takenBy: !by.has(i) ? null : by.get(i) === viewerId ? 'me' : 'partner',
    })),
    turn: due === null ? null : due === viewerId ? 'me' : 'partner',
    full: freePlace(heroes.get(viewerId)!) === null,
    deadline: new Date(chest.turnAt.getTime() + PICK_MS).toISOString(),
  };
}
