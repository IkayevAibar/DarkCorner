import { z } from 'zod';
import { classIdSchema } from './classes.js';
import { chestGradeSchema } from './economy.js';
import { itemViewSchema, localizedTextSchema } from './items.js';
import { facingSchema, fightReplaySchema, stanceSchema } from './labyrinth.js';

// The Daily Delve (docs/design.md → The Daily Delve): once a day, the same Rooms
// for every Hero, deeper each time; stop whenever you like. Nothing is lost.

export const BOON_IDS = ['mend', 'draught', 'breath', 'whetstone', 'ward', 'keen', 'leech'] as const;
export const boonIdSchema = z.enum(BOON_IDS);
export type BoonId = z.infer<typeof boonIdSchema>;

export const boonViewSchema = z.object({ id: boonIdSchema, name: localizedTextSchema, about: localizedTextSchema });
export type BoonView = z.infer<typeof boonViewSchema>;

/** stopped: the Player banked; fled: an Escape roll got the Hero out; fell: the Hero went down; cleared: every Room won. */
export const delveEndSchema = z.enum(['stopped', 'fled', 'fell', 'cleared']);
export type DelveEnd = z.infer<typeof delveEndSchema>;

/** The Player's Delve today. */
export const delveRunSchema = z.object({
  /** The Floor its first Room comes from; later ones go deeper. */
  floor: z.number().int(),
  /** Rooms won so far. */
  rooms: z.number().int(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  potions: z.number().int(),
  boons: z.array(boonViewSchema),
  end: delveEndSchema.nullable(),
  /** The final score once it has ended; until then, what stopping now would bank. */
  score: z.number().int(),
  /** City gold for the Rooms won so far, paid when it ends. */
  gold: z.number().int(),
  /** The next Room and who waits there (no sneaking past); null once it has ended. */
  next: z.object({ room: z.number().int(), floor: z.number().int(), facing: facingSchema }).nullable(),
  /** Two Boons to choose from before the next Room; null before the first Room. */
  offer: z.array(boonViewSchema).nullable(),
});
export type DelveRun = z.infer<typeof delveRunSchema>;

/** A line on the day's board. */
export const delveRowSchema = z.object({
  place: z.number().int(),
  hero: z.string(),
  class: classIdSchema,
  level: z.number().int(),
  portraitUrl: z.string(),
  banner: z.string(),
  title: localizedTextSchema.nullable(),
  floor: z.number().int(),
  rooms: z.number().int(),
  end: delveEndSchema,
  score: z.number().int(),
  mine: z.boolean(),
});
export type DelveRow = z.infer<typeof delveRowSchema>;

/** GET /api/delve */
export const delveViewSchema = z.object({
  /** Days since 1970-01-01, UTC. */
  day: z.number().int(),
  /** When today's Delve closes and its first three win their Chests: the next midnight UTC. */
  closesAt: z.string(),
  /** Rooms in every Delve. */
  rooms: z.number().int(),
  /** The Floor the Hero's Delve starts from today. */
  floor: z.number().int(),
  /** The Hero's Stance: the Delve's fights use it too. */
  stance: stanceSchema,
  run: delveRunSchema.nullable(),
  /** Today's finished Delves, best first: the top ten, and the Player's own line if lower. */
  board: z.array(delveRowSchema),
  /** Yesterday's first three. */
  yesterday: z.array(delveRowSchema),
  /** A Chest won on a board and not taken yet. */
  prize: z.object({ day: z.number().int(), place: z.number().int(), chest: chestGradeSchema }).nullable(),
});
export type DelveView = z.infer<typeof delveViewSchema>;

/** What a Delve action returns: the new state, the fight if there was one, and anything received. */
export const delveResultSchema = z.object({
  view: delveViewSchema,
  fight: fightReplaySchema.nullable(),
  loot: z.array(itemViewSchema),
  notices: z.array(localizedTextSchema),
});
export type DelveResult = z.infer<typeof delveResultSchema>;

/** POST /api/delve/fight: the Boon taken first (one of the offer; none before the first Room). */
export const delveFightRequestSchema = z.object({ boon: boonIdSchema.nullable().default(null) });
export type DelveFightRequest = z.infer<typeof delveFightRequestSchema>;
