import { z } from 'zod';
import { itemViewSchema, localizedTextSchema } from './items.js';

export const ROOM_TYPES = [
  'landing', 'stairs', 'waypoint', 'camp', 'fight', 'empty', 'event', 'treasure', 'vault', 'miniboss', 'boss',
] as const;
export const roomTypeSchema = z.enum(ROOM_TYPES);
export type RoomTypeId = z.infer<typeof roomTypeSchema>;

export const doorKindSchema = z.enum(['open', 'cracked', 'locked']);
export const directionSchema = z.enum(['n', 's', 'e', 'w']);
export type Direction = z.infer<typeof directionSchema>;

// ─── Fight replays ─────────────────────────────────────────────────────────
// Mirrors FightEvent in packages/engine/src/combat.ts; the API validates every
// replay against this before sending it, so the two cannot drift silently.

export const combatantSchema = z.object({
  /** "hero", or "m0", "m1", … for monsters. */
  key: z.string(),
  name: localizedTextSchema,
  /** Token art; null when a monster has none painted yet. */
  art: z.string().nullable(),
  hp: z.number().int(),
  maxHp: z.number().int(),
  ac: z.number().int(),
  boss: z.boolean(),
  /** A Hero's banner color, for its token ring; null for monsters. */
  banner: z.string().nullable(),
});
export type Combatant = z.infer<typeof combatantSchema>;

export const fightOutcomeSchema = z.enum(['victory', 'survived', 'dead']);
export type FightOutcomeId = z.infer<typeof fightOutcomeSchema>;

export const fightEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('initiative'), order: z.array(z.string()) }),
  z.object({
    type: z.literal('attack'), actor: z.string(), target: z.string(), natural: z.number().int(), total: z.number().int(),
    hit: z.boolean(), crit: z.boolean(), damage: z.number().int(), targetHp: z.number().int(), kind: z.enum(['weapon', 'spell']),
  }),
  z.object({ type: z.literal('blocked'), actor: z.string() }),
  z.object({
    type: z.literal('burst'), actor: z.string(),
    targets: z.array(z.object({ key: z.string(), damage: z.number().int(), hp: z.number().int() })),
  }),
  z.object({
    type: z.literal('heal'), actor: z.string(), ability: z.enum(['second-wind', 'cure-wounds', 'potion', 'life-steal']),
    amount: z.number().int(), hp: z.number().int(),
  }),
  z.object({ type: z.literal('defeated'), key: z.string() }),
  z.object({ type: z.literal('down') }),
  z.object({ type: z.literal('death-save'), natural: z.number().int(), successes: z.number().int(), failures: z.number().int() }),
  z.object({ type: z.literal('rise'), hp: z.number().int() }),
  z.object({ type: z.literal('reroll'), natural: z.number().int() }),
  z.object({ type: z.literal('end'), outcome: fightOutcomeSchema }),
]);
export type FightEventView = z.infer<typeof fightEventSchema>;

export const fightReplaySchema = z.object({
  /** The Room map it happens on: apps/web/public/art/rooms/<map>.jpg. */
  map: z.string(),
  hero: combatantSchema,
  monsters: z.array(combatantSchema),
  events: z.array(fightEventSchema),
  outcome: fightOutcomeSchema,
});
export type FightReplay = z.infer<typeof fightReplaySchema>;

// ─── What the Hero sees in the Labyrinth ──────────────────────────────────

export const mapRoomSchema = z.object({
  id: z.number().int(),
  x: z.number().int(),
  y: z.number().int(),
  /** Known once the Hero has stood in it. */
  type: roomTypeSchema.nullable(),
  visited: z.boolean(),
  cleared: z.boolean(),
});

export const exitSchema = z.object({
  to: z.number().int(),
  direction: directionSchema,
  kind: doorKindSchema,
  clue: localizedTextSchema,
  /** A Rogue or an Elf saw through a lying Clue. */
  suspicious: z.boolean(),
  /** Whether this Hero can go through (cracked walls: Fighters; locks: Rogues or a Key). */
  passable: z.boolean(),
  visited: z.boolean(),
});
export type Exit = z.infer<typeof exitSchema>;

export const mapDoorSchema = z.object({ a: z.number().int(), b: z.number().int(), kind: doorKindSchema });

export const graveViewSchema = z.object({
  id: z.string(),
  owner: z.string(),
  items: z.number().int(),
  gold: z.number().int(),
  expiresAt: z.string(),
});

export const labyrinthViewSchema = z.object({
  location: z.enum(['city', 'labyrinth']),
  hero: z.object({
    name: z.string(),
    portraitUrl: z.string(),
    banner: z.string(),
    hp: z.number().int(),
    maxHp: z.number().int(),
    level: z.number().int(),
    xp: z.number().int(),
    xpNext: z.number().int().nullable(),
    stamina: z.number().int(),
    staminaMax: z.number().int(),
    /** When the next Stamina point comes back; null when the bar is full. */
    staminaNextAt: z.string().nullable(),
    carriedGold: z.number().int(),
    spells: z.number().int(),
    heals: z.number().int(),
    potions: z.number().int(),
    portalScrolls: z.number().int(),
  }),
  /** Floors whose Waypoint this Hero has reached (entering there is allowed). */
  waypoints: z.array(z.number().int()),
  bestFloor: z.number().int(),
  floor: z.object({
    number: z.number().int(),
    name: localizedTextSchema,
    theme: z.string(),
    width: z.number().int(),
    height: z.number().int(),
  }).nullable(),
  room: z.object({
    id: z.number().int(),
    type: roomTypeSchema,
    event: z.string().nullable(),
    map: z.string(),
    cleared: z.boolean(),
    /** When a Hero waiting here is fully rested (Camps only). */
    restedAt: z.string().nullable(),
  }).nullable(),
  exits: z.array(exitSchema),
  /** The Hero's own Map of this Floor: Rooms stood in, the Rooms next to them, and the Doors between. */
  map: z.object({ rooms: z.array(mapRoomSchema), doors: z.array(mapDoorSchema) }).nullable(),
  graves: z.array(graveViewSchema),
});
export type LabyrinthView = z.infer<typeof labyrinthViewSchema>;

/** What a Move (or any Labyrinth action) brought. */
export const labyrinthResultSchema = z.object({
  view: labyrinthViewSchema,
  fight: fightReplaySchema.nullable(),
  loot: z.array(itemViewSchema),
  gold: z.number().int(),
  xp: z.number().int(),
  /** New level if the Hero leveled up. */
  levelUp: z.number().int().nullable(),
  died: z.boolean(),
  /** A line for the screen: "the Waypoint hums awake", "your Bag was full…". */
  notices: z.array(localizedTextSchema),
});
export type LabyrinthResult = z.infer<typeof labyrinthResultSchema>;

export const enterRequestSchema = z.object({ floor: z.number().int().min(1).default(1) });
export const moveRequestSchema = z.object({ to: z.number().int().min(0) });
