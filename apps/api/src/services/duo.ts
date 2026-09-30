import { type Hero, type Player, Prisma } from '@prisma/client';
import type { DuoHero, DuoInvite, DuoPartner, DuoState, RunSummary } from '@dark/shared';
import { type ClassId, currentStamina } from '@dark/engine';
import { prisma } from '../db.js';
import { ApiError } from '../lib/errors.js';
import { type Outcome, emptyOutcome, t } from './fights.js';
import { fullHealth, portraitUrlOf } from './heroes.js';
import { type HeroWithItems, type Tx, noFight } from './ledger.js';
import { notify } from './push.js';
import { currentSeason } from './seasons.js';

// Duos (docs/design.md → Duos): two Players' Heroes walking the same Rooms and
// fighting side by side while both Players are online. Each Hero points at the
// other (Hero.partnerId); what one Player's actions bring the partner waits on the
// partner's Hero (duoNews) until its Player next looks.

/** A Player seen this recently is online: the Duo can act (v0). */
export const ONLINE_MS = 2 * 60_000;
/** A partner away this long ends the Duo by itself (v0). */
export const AWAY_END_MS = 30 * 60_000;
/** Invites last this long (v0). */
export const INVITE_MS = 10 * 60_000;

export type PartnerRow = HeroWithItems & { player: Player };

const seenAgo = (player: Pick<Player, 'lastSeenAt'>, now: Date) => (player.lastSeenAt ? now.getTime() - player.lastSeenAt.getTime() : Infinity);
export const isOnline = (player: Pick<Player, 'lastSeenAt'>, now: Date) => seenAgo(player, now) <= ONLINE_MS;

export function partnerView(partner: PartnerRow, now: Date): DuoPartner {
  return {
    heroId: partner.id, name: partner.name, portraitUrl: portraitUrlOf(partner), banner: partner.banner, class: partner.class as ClassId,
    level: partner.level, hp: Math.min(partner.hp, fullHealth(partner)), maxHp: fullHealth(partner),
    stamina: currentStamina(partner.stamina, partner.staminaAt, now).stamina,
    online: isOnline(partner.player, now), seenAt: partner.player.lastSeenAt?.toISOString() ?? null, waypoints: partner.waypoints,
  };
}

const heroCard = (hero: Hero): DuoHero => ({
  heroId: hero.id, name: hero.name, portraitUrl: portraitUrlOf(hero), banner: hero.banner, class: hero.class as ClassId, level: hero.level,
});

// ─── News for the partner ─────────────────────────────────────────────────

interface News {
  outcome: Outcome;
  /** The partner's Run summary, when the action ended its Run. */
  run: RunSummary | null;
}

/** Two things to show, one after the other: the older first, the newer's fight and level winning. */
export function mergeOutcomes(older: Outcome, newer: Outcome): Outcome {
  return {
    fight: newer.fight ?? older.fight,
    loot: [...older.loot, ...newer.loot],
    gold: older.gold + newer.gold,
    xp: older.xp + newer.xp,
    levelUp: newer.levelUp ?? older.levelUp,
    died: older.died || newer.died,
    notices: [...older.notices, ...newer.notices],
    checks: [...older.checks, ...newer.checks],
    duel: newer.duel ?? older.duel,
    explored: older.explored + newer.explored,
    depth: Math.max(older.depth, newer.depth),
    runEnd: newer.runEnd ?? older.runEnd,
    deeds: [...older.deeds, ...newer.deeds],
  };
}

/** Leaves what an action brought a Hero for its Player's next look, after anything still unseen. */
export async function addNews(tx: Tx, heroId: string, outcome: Outcome, run: RunSummary | null = null): Promise<void> {
  if (nothingNew(outcome) && !run) return;
  const row = await tx.hero.findUniqueOrThrow({ where: { id: heroId }, select: { duoNews: true } });
  const old = row.duoNews as News | null;
  const news: News = old ? { outcome: mergeOutcomes(old.outcome, outcome), run: run ?? old.run } : { outcome, run };
  await tx.hero.update({ where: { id: heroId }, data: { duoNews: news as unknown as Prisma.InputJsonValue } });
}

/** What a Hero's partner brought it since its Player last looked, taken once (two looks at once can't both take it). */
export async function takeNews(heroId: string): Promise<News | null> {
  const waiting = await prisma.hero.count({ where: { id: heroId, duoNews: { not: Prisma.DbNull } } });
  if (waiting === 0) return null;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${heroId} FOR UPDATE`;
    const row = await tx.hero.findUnique({ where: { id: heroId }, select: { duoNews: true } });
    if (!row?.duoNews) return null;
    await tx.hero.update({ where: { id: heroId }, data: { duoNews: Prisma.DbNull } });
    return row.duoNews as unknown as News;
  });
}

/** Nothing to show: no news worth a Player's look. */
export const nothingNew = (o: Outcome): boolean =>
  !o.fight && o.loot.length === 0 && o.gold === 0 && o.xp === 0 && o.levelUp === null && !o.died && o.notices.length === 0
  && o.checks.length === 0 && !o.duel && !o.runEnd && o.deeds.length === 0;

const note = (en: string, ru: string): Outcome => ({ ...emptyOutcome(), notices: [t(en, ru)] });

// ─── The pair ─────────────────────────────────────────────────────────────

/**
 * The Player's living Hero and its Duo partner, both locked in id order (two Players
 * acting at once never wait on each other in a circle), or the Hero alone.
 */
export async function loadActors(tx: Tx, player: Pick<Player, 'id'>, seasonId: string): Promise<{ hero: HeroWithItems; partner: PartnerRow | null }> {
  const row = await tx.hero.findFirst({ where: { playerId: player.id, seasonId, retiredAt: null }, select: { id: true, partnerId: true } });
  if (!row) throw ApiError.conflict('no_hero', 'Create a Hero first');
  const ids = [row.id, ...(row.partnerId ? [row.partnerId] : [])].sort();
  for (const id of ids) await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${id} FOR UPDATE`;
  const hero = await tx.hero.findUniqueOrThrow({ where: { id: row.id }, include: { items: true } });
  if (hero.retiredAt) throw ApiError.conflict('no_hero', 'Create a Hero first');
  if (!hero.partnerId) return { hero, partner: null };
  // Paired a moment ago, between the look and the lock: hold the partner too.
  if (hero.partnerId !== row.partnerId) await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${hero.partnerId} FOR UPDATE`;
  const partner = await tx.hero.findUnique({ where: { id: hero.partnerId }, include: { items: true, player: true } });
  // A partner Retired, or paired elsewhere since: the Duo is over.
  if (!partner || partner.retiredAt || partner.partnerId !== hero.id) {
    await tx.hero.update({ where: { id: hero.id }, data: { partnerId: null } });
    hero.partnerId = null;
    return { hero, partner: null };
  }
  return { hero, partner };
}

/** Ends a Duo: each Hero goes its own way, and the one whose Player didn't end it hears why. */
export async function endDuo(tx: Tx, hero: Hero, partner: Hero, tell: { en: string; ru: string } | null): Promise<void> {
  await tx.hero.updateMany({ where: { id: { in: [hero.id, partner.id] } }, data: { partnerId: null } });
  hero.partnerId = null;
  partner.partnerId = null;
  if (tell) await addNews(tx, partner.id, note(tell.en, tell.ru));
}

/**
 * The partner a Duo action goes ahead with. Away a short while, the Duo waits
 * ('partner_away', unless the Player only `looks`); away long, or no longer beside
 * the Hero (a death, a portal), the Duo ends and the Hero goes on alone (null).
 */
export async function activePartner(tx: Tx, hero: HeroWithItems, partner: PartnerRow | null, now: Date, out: Outcome, looks = false): Promise<PartnerRow | null> {
  if (!partner) return null;
  // A fight played turn by turn keeps its Duo: a Player away just loses turns to the AI.
  if (await tx.fight.count({ where: { OR: [{ heroId: hero.id }, { partnerId: hero.id }] } }) > 0) return partner;
  const apart = partner.location !== hero.location || partner.floor !== hero.floor || partner.room !== hero.room;
  if (apart) {
    await endDuo(tx, hero, partner, { en: `You and ${hero.name} are apart now: the Duo is over.`, ru: `Вы с героем ${hero.name} разлучены: дуэт распался.` });
    out.notices.push(t(`You and ${partner.name} are apart now: the Duo is over.`, `Вы с героем ${partner.name} разлучены: дуэт распался.`));
    return null;
  }
  if (seenAgo(partner.player, now) > AWAY_END_MS) {
    await endDuo(tx, hero, partner, { en: `You were away too long: the Duo with ${hero.name} is over.`, ru: `Вас долго не было: дуэт с героем ${hero.name} распался.` });
    out.notices.push(t(`${partner.name} has been away too long: the Duo is over.`, `Напарник ${partner.name} слишком долго не отвечает: дуэт распался.`));
    return null;
  }
  if (!looks && !isOnline(partner.player, now)) throw ApiError.conflict('partner_away', `${partner.name} is away: wait, or leave the Duo`);
  return partner;
}

// ─── Invites ──────────────────────────────────────────────────────────────

async function livingHero(tx: Tx, player: Pick<Player, 'id'>, seasonId: string): Promise<Hero> {
  const hero = await tx.hero.findFirst({ where: { playerId: player.id, seasonId, retiredAt: null } });
  if (!hero) throw ApiError.conflict('no_hero', 'Create a Hero first');
  return hero;
}

async function stateOf(tx: Tx, hero: Hero, seasonId: string, now: Date): Promise<DuoState> {
  const partner = hero.partnerId ? await tx.hero.findUnique({ where: { id: hero.partnerId }, include: { items: true, player: true } }) : null;
  const fresh = new Date(now.getTime() - INVITE_MS);
  const invites = await tx.duoInvite.findMany({ where: { OR: [{ toId: hero.id }, { fromId: hero.id }], createdAt: { gt: fresh } }, orderBy: { createdAt: 'desc' } });
  const ids = [...new Set(invites.flatMap((i) => [i.fromId, i.toId]))];
  const heroes = new Map((await tx.hero.findMany({ where: { id: { in: ids } } })).map((h) => [h.id, h]));
  const view = (i: (typeof invites)[number]): DuoInvite | null => {
    const from = heroes.get(i.fromId);
    const to = heroes.get(i.toId);
    return from && to ? { id: i.id, from: heroCard(from), to: heroCard(to), expiresAt: new Date(i.createdAt.getTime() + INVITE_MS).toISOString() } : null;
  };
  const candidates = hero.partnerId || hero.location !== 'CITY' ? [] : await tx.hero.findMany({
    where: {
      seasonId, retiredAt: null, partnerId: null, location: 'CITY', id: { not: hero.id },
      player: { lastSeenAt: { gt: new Date(now.getTime() - ONLINE_MS) }, approvedAt: { not: null }, bannedAt: null },
    },
    orderBy: { level: 'desc' },
    take: 20,
  });
  return {
    partner: partner && partner.partnerId === hero.id ? partnerView(partner, now) : null,
    incoming: invites.filter((i) => i.toId === hero.id).map(view).filter((v): v is DuoInvite => v !== null),
    outgoing: invites.filter((i) => i.fromId === hero.id).map(view).find((v): v is DuoInvite => v !== null) ?? null,
    candidates: candidates.map(heroCard),
    inside: hero.location === 'LABYRINTH',
  };
}

export async function duoState(player: Player): Promise<DuoState> {
  const season = await currentSeason();
  const now = new Date();
  return prisma.$transaction(async (tx) => stateOf(tx, await livingHero(tx, player, season.id), season.id, now));
}

/** An invite from the Player's Hero to another in the City whose Player is online. */
export async function inviteToDuo(player: Player, heroId: string): Promise<DuoState> {
  const season = await currentSeason();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const hero = await livingHero(tx, player, season.id);
    if (hero.partnerId) throw ApiError.conflict('in_duo', 'You are in a Duo already');
    if (hero.location !== 'CITY') throw ApiError.conflict('not_in_city', 'Only in the City');
    const other = await tx.hero.findUnique({ where: { id: heroId }, include: { player: true } });
    if (!other || other.seasonId !== season.id || other.retiredAt || other.id === hero.id) throw ApiError.notFound('no_hero_there', 'No such Hero');
    if (other.partnerId) throw ApiError.conflict('they_are_in_duo', `${other.name} is in a Duo already`);
    if (other.location !== 'CITY') throw ApiError.conflict('they_are_inside', `${other.name} is in the Labyrinth`);
    if (!isOnline(other.player, now)) throw ApiError.conflict('they_are_away', `${other.name} is not online`);
    // One invite out at a time.
    await tx.duoInvite.deleteMany({ where: { fromId: hero.id } });
    await tx.duoInvite.create({ data: { fromId: hero.id, toId: other.id } });
    await notify(tx, other.playerId, {
      kind: 'duo',
      title: { en: 'An invite to a Duo', ru: 'Приглашение в дуэт' },
      body: { en: `${hero.name} wants to walk the Labyrinth with you.`, ru: `${hero.name} зовёт вас в лабиринт вдвоём.` },
      url: '/city',
      tag: `duo-${hero.id}`,
    });
    return stateOf(tx, hero, season.id, now);
  });
}

export async function acceptDuo(player: Player, inviteId: string): Promise<DuoState> {
  const season = await currentSeason();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const hero = await livingHero(tx, player, season.id);
    const invite = await tx.duoInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.toId !== hero.id || invite.createdAt.getTime() < now.getTime() - INVITE_MS) throw ApiError.notFound('no_invite', 'That invite has gone');
    for (const id of [hero.id, invite.fromId].sort()) await tx.$queryRaw`SELECT id FROM "Hero" WHERE id = ${id} FOR UPDATE`;
    const me = await tx.hero.findUniqueOrThrow({ where: { id: hero.id } });
    const from = await tx.hero.findUnique({ where: { id: invite.fromId }, include: { player: true } });
    if (!from || from.retiredAt || from.seasonId !== season.id) throw ApiError.notFound('no_invite', 'That invite has gone');
    if (me.partnerId || from.partnerId) throw ApiError.conflict('in_duo', 'One of you is in a Duo already');
    if (me.location !== 'CITY' || from.location !== 'CITY') throw ApiError.conflict('not_in_city', 'Both Heroes must be in the City');
    if (!isOnline(from.player, now)) throw ApiError.conflict('they_are_away', `${from.name} is not online`);
    await tx.hero.update({ where: { id: me.id }, data: { partnerId: from.id } });
    await tx.hero.update({ where: { id: from.id }, data: { partnerId: me.id } });
    await tx.duoInvite.deleteMany({ where: { OR: [{ fromId: { in: [me.id, from.id] } }, { toId: { in: [me.id, from.id] } }] } });
    await addNews(tx, from.id, note(`${me.name} joined you: you are a Duo now.`, `${me.name} с вами: теперь вы дуэт.`));
    me.partnerId = from.id;
    return stateOf(tx, me, season.id, now);
  });
}

export async function declineDuo(player: Player, inviteId: string): Promise<DuoState> {
  const season = await currentSeason();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const hero = await livingHero(tx, player, season.id);
    // The one invited says no, or the one inviting takes it back.
    await tx.duoInvite.deleteMany({ where: { id: inviteId, OR: [{ toId: hero.id }, { fromId: hero.id }] } });
    return stateOf(tx, hero, season.id, now);
  });
}

/** Leaves the Duo: both Heroes go on alone from where they stand. */
export async function leaveDuo(player: Player): Promise<DuoState> {
  const season = await currentSeason();
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const { hero, partner } = await loadActors(tx, player, season.id);
    await noFight(tx, hero.id);
    if (partner) await endDuo(tx, hero, partner, { en: `${hero.name} left the Duo: you go on alone.`, ru: `${hero.name} покидает дуэт: дальше вы одни.` });
    return stateOf(tx, hero, season.id, now);
  });
}
