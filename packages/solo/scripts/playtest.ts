/**
 * A headless playtest of the solo game: bots play it through its API, each in a
 * World of its own, in in-game Days (docs/plan-solo-offline.md, Phase 3), to catch
 * what breaks and to show the pacing: levels, depth, deaths, loot and bounties per
 * Day, and the Chapter's end.
 *
 * Run: npm run playtest -w @dark/solo [-- days]
 *
 * apps/api/scripts/playtest.ts, moved to Days. The bots play like a careful friend:
 * each Day they spend their Stamina, then go to bed, in a Camp when they stand in
 * one, else at the Tavern (a night is free, and the only thing that moves the
 * clock). They pick the Stance with the best Threat, fight what looks winnable,
 * Sneak or Retreat from the rest, explore toward unknown Rooms, take the stairs
 * once a Floor is well explored, handle Event rooms, drink potions when hurt, take
 * a short rest when Stamina runs low, go back for their Grave with a Smoke bomb,
 * and in the City identify, equip, sell, salvage, upgrade, restock and grow.
 * PLAYTEST_NO_RESTS=1 plays without short rests; PLAYTEST_CLASSES=cleric,ranger plays only those. The World is compacted every
 * night, as the app compacts a Save, and server errors here are the solo backend's.
 */
import type {
  ClassId, ForgeQuote, HeroDraft, HeroView, LabyrinthResult, LabyrinthView, MyHeroResponse, Stance, Threat, UpgradeResult,
} from '@dark/shared';
import type { GearBase } from '@dark/engine';
import type { World } from '../src/world.js';

const { buildApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');
const { runDueJobs } = await import('../src/services/scheduler.js');
const { bindWorld, compactWorld, newWorld } = await import('../src/backend.js');
const { gameNowMs, sleepUntilMorning, worldDay } = await import('../src/gameClock.js');
const { CLASS_DEFS, CLUES, RIDDLES, TIERS, baseById, breaksWalls, canUse, isGear } = await import('@dark/engine');
/** What a Door says when a Waypoint is behind it (it can lie, as Clues do). */
const WAYPOINT_CLUES = new Set((CLUES.waypoint as { en: string }[]).map((c) => c.en));
/** What a Door says when a Camp is behind it: in Days a Camp is a bed, and a bed near is a Day not lost. */
const CAMP_CLUES = new Set((CLUES.camp as { en: string }[]).map((c) => c.en));

const DAYS = Number(process.argv[2] ?? 14);
const RESTS = !process.env.PLAYTEST_NO_RESTS;
/** PLAYTEST_TRACE_DAY=N: every step of that Day's session, to see why a bot does what it does. */
const TRACE_DAY = Number(process.env.PLAYTEST_TRACE_DAY ?? 0);
const THREAT_RANK: Record<Threat, number> = { trivial: 0, easy: 1, risky: 2, dangerous: 3, deadly: 4 };

const app = await buildApp();

interface Stats {
  fights: number; won: number; escaped: number; survived: number; deaths: number; sneaks: number; caught: number; retreats: number;
  events: number; bounties: number; hidden: number; graves: number; moves: number; xp: number; items: Record<string, number>;
  minibosses: number; minibossWins: number; chests: number; dropped: number; rests: number; nights: number; camps: number; rough: number; newRooms: number;
  salvaged: number; forge: Record<string, number>; goldForged: number; portals: number; dragon: string[];
  threats: Record<Threat, number>; errors: string[]; deathLog: string[];
}
interface Bot {
  name: string;
  cls: ClassId;
  cookie: string;
  /** Its own World: solo has one Hero to a Save. */
  world: World;
  stats: Stats;
  /** Rooms to leave alone today: "floor:room". */
  avoid: Set<string>;
  /** Rooms a Door refused this session (the Dragon's, before the Boss gate opens): explore elsewhere. */
  blocked: Set<string>;
  handled: Set<string>;
  /** Where the Hero last died, while its Grave lasts. */
  grave: { floor: number; room: number; until: number } | null;
  /** What the Hero was doing, for the death log. */
  doing: string;
  /** Graves looted since entering the Labyrinth. */
  looted: Set<string>;
  /** Threats met on each Floor, and how many were trivial: a Floor gone easy is time to go down. */
  seen: Map<number, { all: number; trivial: number }>;
}

const newStats = (): Stats => ({
  fights: 0, won: 0, escaped: 0, survived: 0, deaths: 0, sneaks: 0, caught: 0, retreats: 0, events: 0, bounties: 0, hidden: 0, graves: 0,
  moves: 0, xp: 0, items: {}, minibosses: 0, minibossWins: 0, chests: 0, dropped: 0, rests: 0, nights: 0, camps: 0, rough: 0, newRooms: 0, salvaged: 0, forge: {}, goldForged: 0, portals: 0, dragon: [], threats: { trivial: 0, easy: 0, risky: 0, dangerous: 0, deadly: 0 }, errors: [], deathLog: [],
});

async function call<T>(bot: Bot, method: 'GET' | 'POST', url: string, payload?: object): Promise<{ ok: boolean; status: number; body: T & { error?: string } }> {
  const response = await app.inject({ method, url, headers: { cookie: bot.cookie }, ...(method === 'POST' ? { payload: payload ?? {} } : {}) });
  const body = response.json() as T & { error?: string };
  if (response.statusCode >= 500) bot.stats.errors.push(`${method} ${url} → ${response.statusCode} ${response.body.slice(0, 200)}`);
  return { ok: response.statusCode === 200, status: response.statusCode, body };
}

/** Thrown when the bot has no Hero any more: its playtest ends there. */
class SeasonOver extends Error {}
const me = async (bot: Bot) => {
  const hero = (await call<MyHeroResponse>(bot, 'GET', '/api/heroes/me')).body.hero;
  if (!hero) throw new SeasonOver();
  return hero;
};
/** The bot's World's Day, from 1. */
const today = () => worldDay();
const kills: string[] = [];
const look = async (bot: Bot) => (await call<LabyrinthResult>(bot, 'GET', '/api/labyrinth')).body.view;

function tally(bot: Bot, result: LabyrinthResult, before: LabyrinthView | null) {
  bot.stats.xp += result.xp;
  if (result.fight) {
    bot.stats.fights++;
    if (result.fight.outcome === 'victory') bot.stats.won++;
    if (result.fight.outcome === 'escaped') bot.stats.escaped++;
    if (result.fight.outcome === 'survived') bot.stats.survived++;
  }
  if (result.died) {
    bot.stats.deaths++;
    const h = before?.hero;
    bot.stats.deathLog.push(`F${before?.floor?.number ?? '?'} lv${h?.level ?? '?'} ${h?.hp ?? '?'}/${h?.maxHp ?? '?'} hp, ${bot.doing}`);
    if (before?.floor && before.room) bot.grave = { floor: before.floor.number, room: before.room.id, until: gameNowMs() + 47 * 3_600_000 };
  }
  for (const item of result.loot) if (item.kind === 'gear') bot.stats.items[item.tier] = (bot.stats.items[item.tier] ?? 0) + 1;
  for (const n of result.notices) {
    if (n.en.startsWith('Bounty done')) bot.stats.bounties++;
    if (n.en.startsWith('A hidden hoard')) bot.stats.hidden++;
  }
}

async function act(bot: Bot, url: string, payload?: object, before: LabyrinthView | null = null): Promise<LabyrinthResult | null> {
  const r = await call<LabyrinthResult>(bot, 'POST', url, payload);
  if (!r.ok) return null;
  tally(bot, r.body, before);
  return r.body;
}

// ─── Growing ──────────────────────────────────────────────────────────────

async function grow(bot: Bot) {
  let hero = await me(bot);
  // Levels wait for the Player: take every one that's ready, with its choice.
  for (let guard = 0; guard < 20 && hero.levelUp; guard++) {
    const offer = hero.levelUp;
    const primary = CLASS_DEFS[bot.cls].primary;
    const body = offer.choice === 'path'
      ? { path: offer.paths![Math.floor(Math.random() * offer.paths!.length)]!.id }
      : offer.choice === 'growth'
        ? { grow: hero.abilities[primary] <= 18 && Math.random() < 0.6 ? { kind: 'ability', ability: primary } : { kind: 'talent', talent: offer.talents![0]!.id } }
        : {};
    const r = await call<{ hero: HeroView }>(bot, 'POST', '/api/heroes/level-up', body);
    if (!r.ok) break;
    hero = r.body.hero;
  }
  if (hero.pathChoices) {
    const pick = hero.pathChoices[Math.floor(Math.random() * hero.pathChoices.length)]!;
    await call(bot, 'POST', '/api/heroes/path', { path: pick.id });
  }
  for (let guard = 0; guard < 6; guard++) {
    hero = await me(bot);
    const level = hero.pendingGrowth[0];
    if (level === undefined) break;
    const primary = CLASS_DEFS[bot.cls].primary;
    const choice = hero.abilities[primary] <= 18 && Math.random() < 0.6
      ? { kind: 'ability', ability: primary }
      : { kind: 'talent', talent: hero.talentOffer![0]!.id };
    await call(bot, 'POST', '/api/heroes/grow', { level, choice });
  }
}

const rank = (tier: string) => TIERS.indexOf(tier as (typeof TIERS)[number]);

/** How each Class holds its weapons (docs/design.md → Hands): a bot keeps to one way, as a Player would. */
const HOLDS: Record<ClassId, { main: (b: GearBase) => boolean; off: (b: GearBase) => boolean }> = {
  fighter: { main: (b) => b.weapon === 'blade' || b.weapon === 'mace', off: (b) => b.offHand === 'shield' },
  barbarian: { main: (b) => b.weapon === 'heavy', off: () => false },
  ranger: { main: (b) => b.weapon === 'bow', off: () => false },
  rogue: { main: (b) => b.weapon === 'blade', off: (b) => b.weapon === 'dagger' },
  cleric: { main: (b) => b.weapon === 'mace', off: (b) => b.offHand === 'shield' },
  wizard: { main: (b) => b.weapon === 'staff', off: (b) => b.offHand === 'orb' },
  paladin: { main: (b) => b.weapon === 'mace' || b.weapon === 'blade', off: (b) => b.offHand === 'shield' },
  warlock: { main: (b) => b.weapon === 'staff' || b.weapon === 'dagger', off: (b) => b.offHand === 'orb' },
  monk: { main: (b) => b.weapon === 'staff', off: () => false },
  druid: { main: (b) => b.weapon === 'staff', off: (b) => b.offHand === 'shield' },
  bard: { main: (b) => b.weapon === 'blade', off: () => false },
  sorcerer: { main: (b) => b.weapon === 'staff', off: (b) => b.offHand === 'orb' },
};

/** Puts on whatever in the Bag beats what is worn (identified gear only), each weapon in the hand its Class holds it in. */
async function equipBest(bot: Bot) {
  let hero = await me(bot);
  for (const item of hero.bag.filter((i) => i.kind === 'gear' && i.identified)) {
    const base = baseById(item.base);
    if (!isGear(base) || !canUse(bot.cls, base)) continue;
    const hand = base.slot === 'main' || base.slot === 'off';
    const slot = hand
      ? (HOLDS[bot.cls].main(base) ? 'main' : HOLDS[bot.cls].off(base) ? 'off' : null)
      : base.slot === 'ring' ? (hero.worn.some((w) => w.slot === 'ring1') ? 'ring2' : 'ring1') : base.slot;
    if (!slot) continue;
    const worn = hero.worn.find((w) => w.slot === slot)?.item;
    if (!worn || rank(item.tier) > rank(worn.tier) || (rank(item.tier) === rank(worn.tier) && item.itemLevel > worn.itemLevel)) {
      await call(bot, 'POST', `/api/items/${item.id}/equip`, hand ? { slot } : {});
      hero = await me(bot);
    }
  }
}

// ─── The City ─────────────────────────────────────────────────────────────

async function city(bot: Bot) {
  await grow(bot);
  // Identify what can be, equip what is better, sell the rest of the gear.
  let hero = await me(bot);
  const scrolls = () => hero.bag.filter((i) => i.base === 'scroll-identify').reduce((s, i) => s + i.quantity, 0);
  for (const item of hero.bag.filter((i) => i.kind === 'gear' && !i.identified)) {
    if (bot.cls !== 'wizard' && scrolls() === 0) {
      if (hero.gold < 40) break;
      await call(bot, 'POST', '/api/shop/buy', { offer: 'scroll-identify', quantity: 2 });
      hero = await me(bot);
    }
    await call(bot, 'POST', `/api/items/${item.id}/identify`);
    hero = await me(bot);
  }
  await equipBest(bot);
  hero = await me(bot);
  // Commons (and what can't be read) sell; the rest is Salvaged into Materials for the Forge.
  for (const item of hero.bag.filter((i) => i.kind === 'gear' && i.tier !== 'relic')) {
    if (item.tier === 'common' || !item.identified) await call(bot, 'POST', `/api/items/${item.id}/sell`, {});
    else if ((await call(bot, 'POST', `/api/items/${item.id}/salvage`)).ok) bot.stats.salvaged++;
  }
  await forge(bot);
  // Chests: open any with a Key bought for it.
  hero = await me(bot);
  for (const chest of [...hero.bag, ...hero.storage].filter((i) => i.kind === 'chest')) {
    const grade = chest.base.replace('chest-', '');
    const price = { iron: 50, silver: 250, gold: 1000 }[grade] ?? 99999;
    if (hero.gold >= price + 150) {
      await call(bot, 'POST', '/api/shop/buy', { offer: `key-${grade}`, quantity: 1 });
      const opened = await call<{ items?: { tier: string; kind: string }[] }>(bot, 'POST', `/api/items/${chest.id}/open`);
      if (opened.ok) bot.stats.chests++;
      hero = await me(bot);
    }
  }
  // Restock: five potions, a Town Portal, and a Smoke bomb to get back to a Grave.
  const count = (base: string) => hero.bag.filter((i) => i.base === base).reduce((s, i) => s + i.quantity, 0);
  if (bot.cls !== 'wizard' && count('scroll-identify') < 3 && hero.gold >= 160) await call(bot, 'POST', '/api/shop/buy', { offer: 'scroll-identify', quantity: 3 - count('scroll-identify') });
  if (count('potion') < 5 && hero.gold >= 125) await call(bot, 'POST', '/api/shop/buy', { offer: 'potion', quantity: 5 - count('potion') });
  if (count('scroll-portal') < 2 && hero.gold >= 200) await call(bot, 'POST', '/api/shop/buy', { offer: 'scroll-portal', quantity: 2 - count('scroll-portal') });
  if (bot.grave && count('bomb-smoke') < 1 && hero.gold >= 30) await call(bot, 'POST', '/api/shop/buy', { offer: 'bomb-smoke', quantity: 1 });
  if (count('bomb-fire') < 1 && hero.gold >= 400) await call(bot, 'POST', '/api/shop/buy', { offer: 'bomb-fire', quantity: 1 });
}

/** Upgrades worn gear, weapon and armor first, up to +7: never below 40%, and past +5 only under a Protection scroll. */
async function forge(bot: Bot) {
  const order = ['main', 'body', 'off', 'head', 'hands', 'feet', 'amulet', 'ring1', 'ring2'];
  for (let guard = 0; guard < 15; guard++) {
    const hero = await me(bot);
    const worn = order.map((slot) => hero.worn.find((w) => w.slot === slot)?.item).filter((i) => i !== undefined);
    // The least upgraded piece first, so the whole kit climbs together.
    const next = [...worn].sort((a, b) => a.upgrade - b.upgrade)[0];
    if (!next) return;
    const quote = (await call<ForgeQuote>(bot, 'GET', `/api/items/${next.id}/forge`)).body;
    const up = quote.upgrade;
    if (!up || up.to > 7 || up.chance < 40) return;
    if (up.cost.materials.some((m) => m.have < m.quantity) || hero.gold < up.cost.gold + 300) return;
    if (up.risky && up.protectionScrolls === 0) {
      if (hero.gold < up.cost.gold + 500) return;
      await call(bot, 'POST', '/api/shop/buy', { offer: 'scroll-protection', quantity: 1 });
    }
    const r = await call<UpgradeResult>(bot, 'POST', `/api/items/${next.id}/upgrade`, { protect: up.risky });
    if (!r.ok) return;
    bot.stats.forge[r.body.outcome] = (bot.stats.forge[r.body.outcome] ?? 0) + 1;
    if (r.body.outcome === 'success') bot.stats.goldForged += up.cost.gold;
  }
}

async function enter(bot: Bot): Promise<boolean> {
  const view = await look(bot);
  if (bot.grave && bot.grave.until < gameNowMs()) bot.grave = null;
  bot.looted.clear();
  // Back through the open Town Portal, unless a Grave waits on another Floor.
  if (view.portal && (!bot.grave || bot.grave.floor === view.portal.floor)) {
    if ((await act(bot, '/api/labyrinth/enter', { portal: true })) !== null) {
      bot.stats.portals++;
      return true;
    }
  }
  const reachable = bot.grave ? view.waypoints.filter((w) => w <= bot.grave!.floor) : view.waypoints;
  const floor = Math.max(1, ...reachable);
  return (await act(bot, '/api/labyrinth/enter', { floor })) !== null;
}

// ─── The Labyrinth ────────────────────────────────────────────────────────

/** Next step on the shortest known path to the nearest Room that `goal` accepts, or null. */
function nextStep(bot: Bot, view: LabyrinthView, goal: (id: number) => boolean): number | null {
  const map = view.map!;
  const here = view.room!.id;
  const floor = view.floor!.number;
  const passable = new Map<number, number[]>();
  const link = (a: number, b: number) => passable.set(a, [...(passable.get(a) ?? []), b]);
  for (const d of map.doors) {
    if (d.kind === 'locked' && bot.cls !== 'rogue') continue;
    if (d.kind === 'cracked' && !breaksWalls(bot.cls)) continue;
    // Bots walk alone, and a Twin door opens only for a Duo.
    if (d.kind === 'twin') continue;
    link(d.a, d.b);
    link(d.b, d.a);
  }
  const prev = new Map<number, number>([[here, here]]);
  const queue = [here];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur !== here && goal(cur)) {
      let step = cur;
      while (prev.get(step) !== here) step = prev.get(step)!;
      return step;
    }
    for (const next of passable.get(cur) ?? []) {
      if (prev.has(next) || bot.avoid.has(`${floor}:${next}`)) continue;
      prev.set(next, cur);
      queue.push(next);
    }
  }
  return null;
}

/** How far off a Player's tap lands, either way (ms). */
const TAP_SLOP = 90;

/** Picks a lock by hand, a tap a pin: aimed at each pin's spot, a little early or late. */
async function pickLock(bot: Bot, view: LabyrinthView): Promise<boolean> {
  let shown = view;
  for (let guard = 0; guard < 12; guard++) {
    const e = shown.room?.eventView;
    if (e?.kind !== 'lockpicking' || e.done || !e.lock) return true;
    const pin = e.lock.pins[e.lock.set]!;
    const aim = ((((pin.center / 2 - pin.phase) % 1) + 1) % 1) * pin.period;
    const tap = Math.max(0, Math.round(aim + (Math.random() * 2 - 1) * TAP_SLOP));
    const r = await act(bot, '/api/labyrinth/event', { action: 'pick-lock', tap }, shown);
    if (!r) return false;
    shown = r.view;
  }
  return true;
}

/** A tenth of the gold carried on the goblin's cups: the gem followed most of the time, and a palm called when seen. */
async function playCups(bot: Bot, view: LabyrinthView): Promise<boolean> {
  const e = view.room!.eventView!;
  if (e.kind !== 'gambler' || !e.cups || e.cups.maxBet < 1) return false;
  const amount = Math.max(1, Math.min(e.cups.maxBet, Math.round(view.hero.carriedGold / 10)));
  const down = await act(bot, '/api/labyrinth/event', { action: 'cups-bet', amount }, view);
  const after = down?.view.room?.eventView;
  if (!down || after?.kind !== 'gambler' || !after.cups?.game) return false;
  const game = after.cups.game;
  let at = game.start;
  for (const [a, b] of game.swaps) at = at === a ? b : at === b ? a : at;
  const pick = game.palmed ? 'cheat' : Math.random() < 0.7 ? at : Math.floor(Math.random() * 3);
  return (await act(bot, '/api/labyrinth/event', { action: 'cups-pick', pick }, down.view)) !== null;
}

async function eventAction(bot: Bot, view: LabyrinthView): Promise<boolean> {
  const e = view.room!.eventView!;
  const key = `${view.floor!.number}:${view.room!.id}`;
  if (e.done || bot.handled.has(key)) return false;
  bot.handled.add(key);
  if (e.kind === 'lockpicking' || e.kind === 'gambler') {
    bot.stats.events++;
    bot.doing = `event ${e.kind}`;
    return e.kind === 'lockpicking' ? pickLock(bot, view) : playCups(bot, view);
  }
  const action = (() => {
    switch (e.kind) {
      case 'three-chests': return { action: 'pick', chest: Math.floor(Math.random() * 3) };
      case 'shrine': return { action: 'pray' };
      case 'locked-cache': return e.canOpen ? { action: 'open' } : null;
      case 'prisoner': return e.canOpen ? { action: 'free' } : null;
      case 'fountain': return view.hero.hp < view.hero.maxHp ? { action: 'drink' } : null;
      case 'library': return { action: 'read' };
      case 'bone-pile': return view.hero.hp > view.hero.maxHp * 0.6 ? { action: 'search' } : null;
      case 'cookpot': return view.hero.hp < view.hero.maxHp ? { action: 'eat' } : null;
      case 'webbed-body': return view.hero.hp > view.hero.maxHp * 0.6 ? { action: 'cut' } : null;
      case 'sarcophagus': return view.hero.hp > view.hero.maxHp * 0.6 ? { action: 'pry' } : null;
      case 'bargain': {
        // Clerics try the banishing; the rest pay in blood when they can spare it and keep half their health.
        if (bot.cls === 'cleric') return view.hero.hp > view.hero.maxHp * 0.6 ? { action: 'banish' } : null;
        if (view.hero.hp - e.itemPrice > view.hero.maxHp * 0.5) return { action: 'bargain', offer: 'item' };
        if (view.hero.hp - e.goldPrice > view.hero.maxHp * 0.5) return { action: 'bargain', offer: 'gold' };
        return null;
      }
      case 'whispering-skulls': return view.hero.hp > view.hero.maxHp * 0.5 ? { action: 'listen' } : null;
      // Greed grows with health: three handfuls only at full strength.
      case 'spilled-hoard': return { action: 'grab', handfuls: view.hero.hp >= view.hero.maxHp ? 3 : view.hero.hp > view.hero.maxHp * 0.6 ? 2 : 1 };
      case 'fallen-champion': return { action: view.hero.hp > view.hero.maxHp * 0.7 ? 'take' : 'bury' };
      case 'riddle': {
        // A thinking player knows most of these; the rest is a guess.
        const truth = RIDDLES.find((r) => r.question.en === e.question.en)!.answer.en;
        const knows = Math.random() < 0.7;
        return { action: 'answer', choice: knows ? e.answers.findIndex((a) => a.en === truth) : Math.floor(Math.random() * 3) };
      }
      default: return null;
    }
  })();
  if (!action) return false;
  bot.stats.events++;
  bot.doing = `event ${e.kind}`;
  return (await act(bot, '/api/labyrinth/event', action, view)) !== null;
}

const sneakChance = (s: { modifier: number; dc: number; edge: string }) => {
  const p = Math.min(0.95, Math.max(0.05, (21 - (s.dc - s.modifier)) / 20));
  return s.edge === 'advantage' ? 1 - (1 - p) ** 2 : s.edge === 'disadvantage' ? p * p : p;
};

/** Drinks a potion from the Bag; false when there is none. */
async function drink(bot: Bot): Promise<boolean> {
  const potion = (await me(bot)).bag.find((i) => i.base === 'potion');
  if (!potion) return false;
  return (await call(bot, 'POST', `/api/items/${potion.id}/drink`)).ok;
}

async function faceMonsters(bot: Bot, view: LabyrinthView) {
  const facing = view.room!.facing!;
  const hero = view.hero;
  // Hurt before a fight that looks hard: top up first, then look again.
  const worst = Math.min(...(['bold', 'steady', 'wary'] as const).map((s) => THREAT_RANK[facing.threat[s]]));
  const topUp = facing.kind === 'boss' ? 0.95 : 0.75;
  if (worst >= 2 && hero.hp < hero.maxHp * topUp && hero.potions > 0 && (await drink(bot))) return;
  const floor = view.floor!.number;
  const names = facing.monsters.map((m) => `${m.elite ? `${m.elite} ` : ''}${m.name.en}`).join(' + ');
  // The Stance with the lowest Threat; ties keep the current one, then Bold.
  const order: Stance[] = [hero.stance, 'bold', 'steady', 'wary'];
  const safest = order.reduce((best, s) => (THREAT_RANK[facing.threat[s]] < THREAT_RANK[facing.threat[best]] ? s : best), hero.stance);
  // Against the Dragon, all in (Bold, no escape) once that looks winnable; otherwise probe it with an escape ready.
  const stance: Stance = facing.kind === 'boss' && THREAT_RANK[facing.threat.bold] <= 2 ? 'bold' : safest;
  if (stance !== hero.stance) await call(bot, 'POST', '/api/labyrinth/stance', { stance });
  const threat = facing.threat[stance];
  bot.stats.threats[threat]++;
  const tally = bot.seen.get(floor) ?? { all: 0, trivial: 0 };
  bot.seen.set(floor, { all: tally.all + 1, trivial: tally.trivial + (threat === 'trivial' ? 1 : 0) });
  const boss = facing.kind === 'miniboss';
  const dragon = facing.kind === 'boss';
  const atGrave = bot.grave?.floor === floor && bot.grave.room === view.room!.id;
  const odds = facing.sneak ? sneakChance(facing.sneak) : 0;
  const full = hero.hp >= hero.maxHp * 0.9;

  if (atGrave && facing.sneak && hero.bombs.smoke > 0) {
    bot.doing = `smoke to the Grave past ${names}`;
    await act(bot, '/api/labyrinth/face', { action: 'sneak', smoke: true }, view);
  } else if (THREAT_RANK[threat] <= 2 || (threat === 'dangerous' && full && (hero.bombs.fire > 0 || (dragon && stance !== 'bold')))) {
    const bomb = hero.bombs.fire > 0 && THREAT_RANK[threat] >= 2;
    bot.doing = `fight ${threat} (${stance}${bomb ? ', bomb' : ''}) vs ${names}`;
    const r = await act(bot, '/api/labyrinth/face', { action: 'fight', bomb, auto: true }, view);
    if (boss) bot.stats.minibosses++;
    if (boss && r?.fight?.outcome === 'victory') bot.stats.minibossWins++;
    if (dragon) bot.stats.dragon.push(`day ${today()} lv${hero.level} ${threat}: ${r?.fight?.outcome ?? 'no fight'}`);
    if (dragon && r?.fight?.outcome === 'victory') kills.push(`${bot.name} on day ${today()} at level ${hero.level}`);
  } else if (facing.sneak && odds >= 0.6) {
    bot.stats.sneaks++;
    bot.doing = `sneak (${Math.round(odds * 100)}%) past ${threat} ${names}`;
    const r = await act(bot, '/api/labyrinth/face', { action: 'sneak', smoke: false }, view);
    // Caught: the ambush is a fight played turn by turn, and the bot hands it to the AI.
    if (r?.view.fight) {
      bot.stats.caught++;
      // With the Room it stood in, so a death there is logged and its Grave remembered.
      await act(bot, '/api/labyrinth/fight', { action: { kind: 'auto' } }, view);
    }
  } else {
    bot.stats.retreats++;
    bot.avoid.add(`${floor}:${view.room!.id}`);
    await act(bot, '/api/labyrinth/face', { action: 'retreat' });
  }
}

async function session(bot: Bot) {
  const trace = (line: string) => {
    if (TRACE_DAY && today() === TRACE_DAY) console.log(`  · ${bot.cls} ${line}`);
  };
  await grow(bot);
  bot.blocked.clear();
  for (let step = 0; step < 150; step++) {
    const view = await look(bot);
    if (view.location === 'city') {
      await city(bot);
      if (!(await enter(bot))) return;
      continue;
    }
    const room = view.room!;
    const floor = view.floor!.number;
    const hero = view.hero;

    if (room.facing) {
      await faceMonsters(bot, view);
      continue;
    }
    if (room.eventView && (await eventAction(bot, view))) continue;
    // Each Grave once per visit: with a full Bag the rest waits for the next trip.
    const fresh = view.graves.filter((g) => !bot.looted.has(g.id));
    if (fresh.length > 0) {
      for (const grave of fresh) {
        bot.looted.add(grave.id);
        const r = await act(bot, `/api/labyrinth/graves/${grave.id}/loot`);
        if (r && grave.owner === bot.name) {
          bot.stats.graves++;
          if (!r.view.graves.some((g) => g.id === grave.id)) bot.grave = null;
        }
      }
      await equipBest(bot);
      continue;
    }

    let bag = await me(bot);
    if (bag.bag.length >= bag.bagSlots - 1) {
      const junk = bag.bag
        .filter((i) => i.kind === 'gear' && i.identified && (rank(i.tier) <= 1 || !canUse(bot.cls, baseById(i.base) as never)))
        .sort((a, b) => a.worth - b.worth)
        .slice(0, 4);
      for (const item of junk) await call(bot, 'POST', `/api/items/${item.id}/drop`);
      if (junk.length > 0) bot.stats.dropped += junk.length;
      bag = await me(bot);
    }
    const unknown = bag.bag.filter((i) => i.kind === 'gear' && !i.identified);
    const scrolls = bag.bag.some((i) => i.base === 'scroll-identify');
    if (unknown.length > 0 && (bot.cls === 'wizard' || scrolls)) {
      await call(bot, 'POST', `/api/items/${unknown[0]!.id}/identify`);
      await equipBest(bot);
      continue;
    }
    if (hero.hp < hero.maxHp * 0.4 && hero.potions > 0 && (await drink(bot))) continue;
    // Home when the Bag is all but full, or when hurt with nothing to drink. (The server's bots also went home
    // for four Unidentified Items; in Days a trip home costs the rest of the Day, and a Mini-boss by the Town
    // Portal's Room would send a bot home every Day.)
    const goHome = bag.bag.length >= bag.bagSlots - 2 || (hero.hp < hero.maxHp * 0.3 && hero.potions === 0);
    if (goHome && hero.portalScrolls > 0) {
      await act(bot, '/api/labyrinth/portal');
      continue;
    }
    if (RESTS && hero.shortRests.left > 0 && (hero.stamina <= 2 || (hero.hp < hero.maxHp * 0.4 && hero.potions === 0))) {
      if (await act(bot, '/api/labyrinth/short-rest')) {
        bot.stats.rests++;
        continue;
      }
    }
    // Hurt with no potions: wait out the rest of the session at a Camp.
    if (room.type === 'camp' && hero.hp < hero.maxHp * 0.6) return trace('return: hurt in a Camp');
    // Out of Stamina: only known Rooms are free, so only the way home is still open.
    if (hero.stamina <= 0 && !goHome) return trace('return: out of Stamina');

    const known = new Map(view.map!.rooms.map((r) => [r.id, r]));
    const explored = view.map!.rooms.filter((r) => r.visited).length / (view.floor!.width * view.floor!.height);
    const grave = bot.grave && bot.grave.until > gameNowMs() ? bot.grave : null;
    const met = bot.seen.get(floor) ?? { all: 0, trivial: 0 };
    const easyFloor = met.all >= 4 && met.trivial / met.all >= 0.6;
    const wantStairs = !goHome && floor < 10 && (grave ? grave.floor > floor : explored > 0.35 || hero.level > floor + 1 || easyFloor);
    if (room.type === 'stairs' && wantStairs) {
      await act(bot, '/api/labyrinth/descend');
      continue;
    }
    if (goHome && ((floor === 1 && room.type === 'landing') || (room.type === 'waypoint' && view.waypoints.includes(floor)))) {
      await act(bot, '/api/labyrinth/leave');
      continue;
    }
    // No Waypoint here: back up the stairs, toward one or to Floor 1.
    if (goHome && room.type === 'landing' && floor > 1) {
      await act(bot, '/api/labyrinth/ascend');
      continue;
    }
    const unvisited = (id: number) => !known.get(id)?.visited && !bot.avoid.has(`${floor}:${id}`) && !bot.blocked.has(`${floor}:${id}`);
    const target = grave?.floor === floor ? nextStep(bot, view, (id) => id === grave.room)
      : hero.hp < hero.maxHp * 0.5 && hero.potions === 0 ? nextStep(bot, view, (id) => known.get(id)?.type === 'camp')
        : goHome ? nextStep(bot, view, (id) => (known.get(id)?.type === 'waypoint' && view.waypoints.includes(floor)) || known.get(id)?.type === 'landing')
          : wantStairs ? nextStep(bot, view, (id) => known.get(id)?.type === 'stairs') ?? nextStep(bot, view, unvisited)
            : nextStep(bot, view, unvisited);
    const exits = view.exits.filter((e) => e.passable && !bot.avoid.has(`${floor}:${e.to}`) && !bot.blocked.has(`${floor}:${e.to}`));
    // A Door that hums like a Waypoint on a Floor whose Waypoint isn't woken yet: take it.
    const waypointDoor = !view.waypoints.includes(floor) && !goHome ? exits.find((e) => !e.visited && WAYPOINT_CLUES.has(e.clue.en)) : undefined;
    // Late in the Day with no bed known on this Floor: a Door that smells of a Camp.
    const bedKnown = view.map!.rooms.some((r) => r.type === 'camp') || view.waypoints.includes(floor);
    const campDoor = !bedKnown && !goHome && hero.stamina <= 8 ? exits.find((e) => !e.visited && CAMP_CLUES.has(e.clue.en)) : undefined;
    const to = waypointDoor?.to ?? campDoor?.to ?? target ?? exits[Math.floor(Math.random() * exits.length)]?.to;
    const stairsKnown = view.map!.rooms.filter((r) => r.type === 'stairs').map((r) => r.id);
    trace(`F${floor}:${room.id}(${room.type}) st ${hero.stamina} hp ${hero.hp}/${hero.maxHp} bag ${bag.bag.length}/${bag.bagSlots} home ${goHome} stairs? ${wantStairs} known stairs [${stairsKnown}] target ${target} → ${to}`);
    if (to === undefined) return trace('return: nowhere to go');
    bot.doing = `walking into F${floor} room ${to}`;
    const moved = await act(bot, '/api/labyrinth/move', { to }, view);
    if (!moved) {
      if (bot.blocked.has(`${floor}:${to}`)) return;
      bot.blocked.add(`${floor}:${to}`);
      continue;
    }
    bot.stats.moves++;
    if (moved.view.hero.stamina < hero.stamina) bot.stats.newRooms++;
  }
}

/**
 * The Day ends: to bed in a Camp if the Hero stands in one or one is near, else
 * home to the Tavern. A night is free, and only a night moves the World's clock.
 */
async function bedtime(bot: Bot) {
  /** The way to bed, for a finding if none is reached. */
  const trail: string[] = [];
  const tried = async (what: string, url: string, payload?: object, before?: LabyrinthView) => {
    const r = await call<LabyrinthResult>(bot, 'POST', url, payload);
    if (r.ok) tally(bot, r.body, before ?? null);
    trail.push(`${what}${r.ok ? '' : ` refused: ${r.body.error}`}`);
    return r.ok;
  };
  for (let step = 0; step < 120; step++) {
    const view = await look(bot);
    if (view.location !== 'city') trail.push(`F${view.floor!.number}:${view.room!.id}(${view.room!.type})`);
    if (view.location === 'city') {
      await city(bot);
      if ((await call(bot, 'POST', '/api/tavern/lodging')).ok) {
        bot.stats.nights++;
        return;
      }
      break;
    }
    const room = view.room!;
    const floor = view.floor!.number;
    if (room.facing) {
      trail.push('fight');
      await faceMonsters(bot, view);
      continue;
    }
    if (room.type === 'camp') {
      if (await tried('sleep', '/api/labyrinth/sleep')) {
        bot.stats.camps++;
        return;
      }
      break;
    }
    if ((floor === 1 && room.type === 'landing') || (room.type === 'waypoint' && view.waypoints.includes(floor))) {
      await tried('leave', '/api/labyrinth/leave');
      continue;
    }
    const known = new Map(view.map!.rooms.map((r) => [r.id, r]));
    // A bed on this Floor first: a Camp, or a woken Waypoint home. Failing that, the landing, to climb toward
    // the City; and from the landing itself, straight up.
    const rest = (id: number) => known.get(id)?.type === 'camp' || (known.get(id)?.type === 'waypoint' && view.waypoints.includes(floor));
    const out = (id: number) => known.get(id)?.type === 'landing';
    // A Town Portal stays open through the night: home to bed, and back to this Floor in the morning.
    if (nextStep(bot, view, rest) === null && view.hero.portalScrolls > 0 && (await tried('portal', '/api/labyrinth/portal'))) continue;
    const to = nextStep(bot, view, rest) ?? (room.type === 'landing' ? null : nextStep(bot, view, out));
    if (to !== null) {
      bot.doing = `going to bed through F${floor} room ${to}`;
      if (await tried(`→${to}`, '/api/labyrinth/move', { to }, view)) continue;
    }
    if (room.type === 'landing' && floor > 1 && (await tried('ascend', '/api/labyrinth/ascend'))) continue;
    // No bed in reach: a rough night where the Hero stands.
    if (await tried('sleep on the stones', '/api/labyrinth/sleep')) {
      bot.stats.rough++;
      return;
    }
    trail.push(`stuck: next ${to}, portals ${view.hero.portalScrolls}`);
    break;
  }
  // No bed in reach: a Save stuck here is a finding. The night is forced, so the playtest goes on.
  const view = await look(bot);
  bot.stats.errors.push(`no bed on day ${today()}: ${view.location === 'city' ? 'in the City' : `F${view.floor?.number} room ${view.room?.id} (${view.room?.type})`}, stamina ${view.hero.stamina}; last steps ${trail.slice(-10).join(' ')}`);
  sleepUntilMorning(bot.world.clock);
}

// ─── Play ─────────────────────────────────────────────────────────────────

const CLASSES: [ClassId, string, string][] = [
  ['fighter', 'human', 'human-fighter-1'], ['rogue', 'halfling', 'halfling-rogue-1'],
  ['wizard', 'elf', 'elf-wizard-1'], ['cleric', 'dwarf', 'dwarf-cleric-1'],
  ['barbarian', 'dwarf', 'dwarf-barbarian-1'], ['ranger', 'elf', 'elf-ranger-1'],
  ['paladin', 'human', 'human-paladin-1'], ['warlock', 'elf', 'elf-warlock-1'],
  ['monk', 'human', 'human-monk-1'], ['druid', 'halfling', 'halfling-druid-1'],
  ['bard', 'halfling', 'halfling-bard-1'], ['sorcerer', 'human', 'human-sorcerer-1'],
];
const bots: Bot[] = [];
const only = process.env.PLAYTEST_CLASSES?.split(',').map((c) => c.trim()).filter(Boolean);
for (const [cls, race, portrait] of CLASSES.filter(([c]) => !only?.length || only.includes(c))) {
  const name = `${cls[0]!.toUpperCase()}${cls.slice(1)}bot`;
  // A World of its own (newWorld binds it): the same Labyrinth for every bot, a Chapter under way.
  const world = await newWorld({ clock: 'days', seed: 'playtest' });
  const bot: Bot = { name, cls, cookie: '', world, stats: newStats(), avoid: new Set(), blocked: new Set(), handled: new Set(), grave: null, doing: '', seen: new Map(), looted: new Set() };
  // Like a Player would: use every reroll, then keep the set with the best primary ability (and CON).
  let draft = (await call<{ draft: HeroDraft }>(bot, 'POST', '/api/heroes/draft')).body.draft;
  while (draft.rerollsLeft > 0) draft = (await call<{ draft: HeroDraft }>(bot, 'POST', '/api/heroes/draft/reroll')).body.draft;
  const primary = CLASS_DEFS[cls].primary;
  const worth = (i: number) => draft.sets[i]!.scores[primary] * 2 + draft.sets[i]!.scores.con;
  const set = draft.sets.map((_, i) => i).reduce((a, b) => (worth(b) > worth(a) ? b : a), 0);
  const talents = race === 'human' ? ['alert', 'tough'] : ['tough'];
  const made = await call(bot, 'POST', '/api/heroes', { name, race, class: cls, talents, portrait, banner: '#9e2a2a', set });
  if (!made.ok) throw new Error(`${name}: ${JSON.stringify(made.body)}`);
  bots.push(bot);
}

let jobsRun = 0;
const jobKinds = new Map<string, number>();
/** Runs what came due overnight, as the app does before each request, and counts it. */
async function morning(): Promise<void> {
  const before = await prisma.job.findMany({ where: { doneAt: { not: null } }, select: { id: true } });
  const done = new Set(before.map((j) => j.id));
  jobsRun += await runDueJobs();
  for (const j of await prisma.job.findMany({ where: { doneAt: { not: null } }, select: { id: true, kind: true } })) {
    if (!done.has(j.id)) jobKinds.set(j.kind, (jobKinds.get(j.kind) ?? 0) + 1);
  }
}

console.log(`Playtest in Days: ${bots.length} bots, a World each, ${DAYS} Days${RESTS ? '' : ', no short rests'}\n`);
const finished = new Set<string>();
for (let day = 1; day <= DAYS && finished.size < bots.length; day++) {
  const rows: string[] = [];
  for (const bot of bots) {
    if (finished.has(bot.name)) continue;
    bindWorld(bot.world);
    try {
      await morning();
      await session(bot);
      await bedtime(bot);
      await morning();
      await compactWorld();
    } catch (e) {
      if (!(e instanceof SeasonOver)) throw e;
      finished.add(bot.name);
      continue;
    }
    bot.avoid.clear();
    bot.handled.clear();
    const h = await prisma.hero.findFirstOrThrow({ where: { retiredAt: null }, include: { items: { where: { place: 'WORN' } } } });
    const best = h.items.reduce((top, i) => Math.max(top, rank(i.tier)), 0);
    const s = bot.stats;
    rows.push(`${bot.cls.padEnd(9)} lv ${String(h.level).padStart(2)} F${String(h.bestFloor).padStart(2)} ${(h.path ?? '-').padEnd(9)} gold ${String(h.gold).padStart(5)} `
      + `worn ${TIERS[best]!.padEnd(9)} won ${s.won}/${s.fights} ran ${s.escaped} dead ${s.deaths} graves ${s.graves} sneak ${s.sneaks - s.caught}/${s.sneaks} `
      + `back ${s.retreats} boss ${s.minibossWins}/${s.minibosses} chests ${s.chests} bounties ${s.bounties} hidden ${s.hidden} portals ${s.portals} wp ${h.waypoints.length} `
      + `moves ${s.moves} (new ${s.newRooms}) rests ${s.rests} nights ${s.nights} camps ${s.camps} rough ${s.rough}`);
  }
  console.log(`— day ${day}\n${rows.join('\n')}`);
}

console.log('\nThreats met (after choosing a Stance):');
for (const bot of bots) console.log(`  ${bot.cls.padEnd(9)} ${Object.entries(bot.stats.threats).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log('\nThe Forge:');
for (const bot of bots) {
  bindWorld(bot.world);
  const worn = await prisma.item.findMany({ where: { hero: { retiredAt: null }, place: 'WORN' } });
  const ups = worn.map((i) => `+${i.upgrade}`).join(' ');
  console.log(`  ${bot.cls.padEnd(9)} salvaged ${bot.stats.salvaged}, upgrades ${JSON.stringify(bot.stats.forge)}, gold spent on successes ${bot.stats.goldForged}; worn ${ups}`);
}
console.log('\nGear found:');
for (const bot of bots) console.log(`  ${bot.cls.padEnd(9)} ${TIERS.map((t) => `${t} ${bot.stats.items[t] ?? 0}`).join(', ')}`);
console.log('\nThe Dragon, and the Chapter:');
let vaults = 0;
let relics = 0;
const failed: string[] = [];
for (const bot of bots) {
  bindWorld(bot.world);
  const kill = await prisma.bossKill.findFirst({ orderBy: { place: 'asc' } });
  const gate = (await prisma.season.findFirstOrThrow()).bossGateAt;
  const tries = bot.stats.dragon.length ? `; ${bot.stats.dragon.join('; ')}` : '';
  console.log(`  ${bot.cls.padEnd(9)} gate day ${gate ? worldDay(gate.getTime()) : '-'}, ${kill ? `Chapter complete on day ${worldDay(kill.createdAt.getTime())}` : 'Chapter under way'}${tries}`);
  vaults += await prisma.vaultOpening.count().catch(() => 0);
  relics += await prisma.relicFind.count().catch(() => 0);
  for (const j of await prisma.job.findMany({ where: { lastError: { not: null } }, select: { kind: true, lastError: true } })) failed.push(`${bot.cls} ${j.kind}: ${j.lastError?.slice(0, 120)}`);
}
if (kills.length) console.log(`  Dragon kills: ${kills.join('; ')}`);
console.log(`\nJobs run: ${jobsRun} (${[...jobKinds].map(([k, n]) => `${k} ${n}`).join(', ')})${failed.length ? `; failed: ${failed.join('; ')}` : ''}`);
console.log(`Vaults announced: ${vaults}; Relics found: ${relics}`);
console.log('\nBags at the end (kind × stacks):');
for (const bot of bots) {
  bindWorld(bot.world);
  const bag = await prisma.item.findMany({ where: { hero: { retiredAt: null }, place: 'BAG' } });
  const kinds = new Map<string, number>();
  for (const item of bag) kinds.set(item.base.startsWith('chest-') ? item.base : isGear(baseById(item.base)) ? 'gear' : item.base, (kinds.get(item.base.startsWith('chest-') ? item.base : isGear(baseById(item.base)) ? 'gear' : item.base) ?? 0) + 1);
  console.log(`  ${bot.cls.padEnd(9)} ${bag.length} stacks: ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}`);
}
console.log('\nDeaths:');
for (const bot of bots) for (const d of bot.stats.deathLog) console.log(`  ${bot.cls.padEnd(9)} ${d}`);
const errors = bots.flatMap((b) => b.stats.errors.map((e) => `${b.name}: ${e}`));
console.log(errors.length ? `\nErrors (${errors.length}):\n${[...new Set(errors)].slice(0, 30).join('\n')}` : '\nNo server errors.');
await app.close();
