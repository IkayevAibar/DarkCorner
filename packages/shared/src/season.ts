import { z } from 'zod';
import { itemViewSchema, localizedTextSchema, tierSchema } from './items.js';

// The Season, the Tavern's Feed, the Hall of Fame (docs/design.md → Seasons, Feed and broadcasts).

export const seasonStatusSchema = z.enum(['planned', 'active', 'finale', 'ended']);
export type SeasonStatus = z.infer<typeof seasonStatusSchema>;

export const podiumEntrySchema = z.object({
  /** 1 is the Champion; 2 and 3 are won during the Finale. */
  place: z.number().int(),
  hero: z.string(),
  player: z.string(),
  at: z.string(),
});

/** Where the Season stands: the gate, the Boss's weakening, the podium, the Relics left. */
export const OMEN_IDS = [
  'blood-moon', 'still-air', 'scholars-day', 'fortunes-wind', 'hunting-season', 'hot-forges', 'free-market', 'dim-day',
] as const;

/** The day's Omen: how the Labyrinth leans today, for everyone. */
export const omenViewSchema = z.object({ id: z.enum(OMEN_IDS), name: localizedTextSchema, description: localizedTextSchema });
export type OmenView = z.infer<typeof omenViewSchema>;

export const seasonViewSchema = z.object({
  number: z.number().int(),
  status: seasonStatusSchema,
  startsAt: z.string().nullable(),
  bossGateAt: z.string().nullable(),
  /** When the Finale ends and the Wipe comes; null until someone beats the Boss. */
  wipeAt: z.string().nullable(),
  /** How much the Boss has weakened: 0 to 0.4. */
  weakening: z.number(),
  podium: z.array(podiumEntrySchema),
  relicsLeft: z.number().int(),
  /** Today's Omen; null on a plain day or outside a running Season. */
  omen: omenViewSchema.nullable(),
});
export type SeasonView = z.infer<typeof seasonViewSchema>;

export const feedEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  text: localizedTextSchema,
  /** The Tier color for lines about an Item. */
  tier: tierSchema.nullable(),
  at: z.string(),
});
export type FeedEntry = z.infer<typeof feedEntrySchema>;

export const onlinePlayerSchema = z.object({
  name: z.string(),
  hero: z.string().nullable(),
  /** The Title the Hero wears. */
  title: localizedTextSchema.nullable(),
  /** "In the City", "Floor 4"… */
  where: localizedTextSchema,
});

/** GET /api/tavern — the Feed, who's online, and the Season. */
export const tavernViewSchema = z.object({
  entries: z.array(feedEntrySchema),
  online: z.array(onlinePlayerSchema),
  season: seasonViewSchema,
});
export type TavernView = z.infer<typeof tavernViewSchema>;

/** One Tavern bounty (docs/design.md → Tavern bounties). Its reward is paid the moment it is done. */
export const bountyViewSchema = z.object({
  id: z.string(),
  title: localizedTextSchema,
  progress: z.number().int(),
  target: z.number().int(),
  done: z.boolean(),
  reward: z.object({ gold: z.number().int(), item: itemViewSchema.nullable() }),
  /** One untouched daily bounty a day can be swapped for another. */
  canSwap: z.boolean(),
});
export type BountyView = z.infer<typeof bountyViewSchema>;

/** The week's Hunt: the whole server against one kin of monster (docs/design.md → The Hunt). */
export const huntViewSchema = z.object({
  title: localizedTextSchema,
  target: z.number().int(),
  total: z.number().int(),
  /** This Hero's kills. */
  mine: z.number().int(),
  /** The top hunters so far, at most three. */
  top: z.array(z.object({ hero: z.string(), count: z.number().int() })),
  /** Kills a Hero needs to share the reward. */
  min: z.number().int(),
  done: z.boolean(),
  /** Next Monday, 00:00 UTC. */
  endsAt: z.string(),
});
export type HuntView = z.infer<typeof huntViewSchema>;

/** GET /api/tavern/bounties: today's three, this week's one, and the server's Hunt. */
export const bountiesViewSchema = z.object({
  daily: z.array(bountyViewSchema),
  weekly: bountyViewSchema.nullable(),
  hunt: huntViewSchema.nullable(),
});
export type BountiesView = z.infer<typeof bountiesViewSchema>;

export const HALL_KINDS = ['champion', 'second', 'third', 'relic', 'best-drop', 'deepest', 'highest-level'] as const;
export const hallEntrySchema = z.object({
  season: z.number().int(),
  kind: z.enum(HALL_KINDS),
  player: z.string(),
  hero: z.string(),
  detail: localizedTextSchema.nullable(),
  at: z.string(),
});
export type HallEntry = z.infer<typeof hallEntrySchema>;

/** GET /api/hall — Glory survives every Wipe. */
export const hallViewSchema = z.object({ entries: z.array(hallEntrySchema) });
export type HallView = z.infer<typeof hallViewSchema>;

/**
 * GET /api/tavern/lodging — a night at the Tavern for City gold: full Stamina and
 * short rests back, each night dearer than the last (docs/design.md → The City).
 */
export const lodgingViewSchema = z.object({
  /** What the next night costs. */
  price: z.number().int(),
  /** Nights this Hero has taken this Season. */
  nights: z.number().int(),
  gold: z.number().int(),
  stamina: z.number().int(),
  staminaMax: z.number().int(),
  shortRests: z.object({ left: z.number().int(), of: z.number().int() }),
  /** A bed is only for a Hero in the City. */
  inCity: z.boolean(),
  /** One night a day: when the next can be taken (midnight UTC), or null when it can now. */
  availableAt: z.string().nullable(),
});
export type LodgingView = z.infer<typeof lodgingViewSchema>;

/** The Tavern's Rankings: one board per record, each with its own podium (docs/design.md → Rankings). */
export const RANKINGS = ['deepest', 'level', 'richest', 'victories', 'deeds', 'finest', 'graves', 'vaults', 'deaths', 'dragon'] as const;
export type RankingKind = (typeof RANKINGS)[number];

export const rankingRowSchema = z.object({
  /** Tied values share a rank. */
  rank: z.number().int(),
  player: z.string(),
  hero: z.string(),
  /** The Title the Hero wears. */
  title: localizedTextSchema.nullable(),
  portraitUrl: z.string().nullable(),
  banner: z.string().nullable(),
  /** What the board counts: a Floor, a level, gold, a count, or a place on the Dragon's podium. */
  value: z.number().int(),
  /** The finest board's Item, named in both languages. */
  item: z.object({ name: localizedTextSchema, tier: tierSchema }).nullable(),
  me: z.boolean(),
});
export type RankingRow = z.infer<typeof rankingRowSchema>;

export const rankingSchema = z.object({
  kind: z.enum(RANKINGS),
  /** The top ten. */
  rows: z.array(rankingRowSchema),
  /** The Player's own row when it is below the top ten. */
  me: rankingRowSchema.nullable(),
});
export type Ranking = z.infer<typeof rankingSchema>;

/** GET /api/tavern/rankings */
export const rankingsViewSchema = z.object({ boards: z.array(rankingSchema) });
export type RankingsView = z.infer<typeof rankingsViewSchema>;

// ─── Admin ────────────────────────────────────────────────────────────────

export const adminJobSchema = z.object({
  id: z.string(),
  kind: z.string(),
  runAt: z.string(),
  doneAt: z.string().nullable(),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
});

/** GET /api/admin/season */
export const adminSeasonViewSchema = z.object({
  season: seasonViewSchema,
  heroes: z.number().int(),
  jobs: z.array(adminJobSchema),
  webhook: z.boolean(),
});
export type AdminSeasonView = z.infer<typeof adminSeasonViewSchema>;

/**
 * POST /api/admin/season — `gate` opens the Boss gate now; `vault` announces a
 * Vault opening in `minutes`; `discard` ends a test Season and forgets it, so the
 * next one is numbered as if it never happened.
 */
export const adminSeasonActionSchema = z.object({
  action: z.enum(['start', 'end', 'gate', 'vault', 'discard']),
  minutes: z.number().int().min(0).max(24 * 60).optional(),
});

/** POST /api/admin/grant — testing help: gold and Items for any Player's Hero. */
export const adminGrantSchema = z.object({
  playerId: z.string(),
  gold: z.number().int().min(1).max(1_000_000).optional(),
  item: z.object({
    base: z.string(),
    tier: tierSchema.default('common'),
    identified: z.boolean().default(true),
    quantity: z.number().int().min(1).max(99).default(1),
  }).optional(),
});
export type AdminGrant = z.infer<typeof adminGrantSchema>;

export const rollLogEntrySchema = z.object({
  id: z.string(),
  player: z.string().nullable(),
  kind: z.string(),
  seed: z.string(),
  detail: z.unknown(),
  at: z.string(),
});

/** GET /api/admin/rolls?kind=&player= */
export const rollLogViewSchema = z.object({ rolls: z.array(rollLogEntrySchema) });
export type RollLogView = z.infer<typeof rollLogViewSchema>;
