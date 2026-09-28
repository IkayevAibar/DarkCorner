import { z } from 'zod';
import { itemViewSchema, localizedTextSchema, tierSchema } from './items.js';
import { omenViewSchema, seasonStatusSchema } from './season.js';

export const ROOM_TYPES = [
  'landing', 'stairs', 'waypoint', 'camp', 'fight', 'empty', 'event', 'treasure', 'vault', 'miniboss', 'boss', 'hidden',
] as const;
export const roomTypeSchema = z.enum(ROOM_TYPES);
export type RoomTypeId = z.infer<typeof roomTypeSchema>;

/** A secret Door shows only to a Hero who has spotted it. */
export const doorKindSchema = z.enum(['open', 'cracked', 'locked', 'secret']);
export const directionSchema = z.enum(['n', 's', 'e', 'w']);
export type Direction = z.infer<typeof directionSchema>;

// ─── Fight replays ─────────────────────────────────────────────────────────
// Mirrors FightEvent in packages/engine/src/combat.ts; the API validates every
// replay against this before sending it, so the two cannot drift silently.

/** Monster signatures (engine: content/monsters.ts). */
export const MONSTER_POWERS = [
  'pack', 'quick', 'thief', 'brittle', 'paralyze', 'undying', 'drain', 'mend', 'burn', 'breath', 'multiattack', 'frighten', 'enrage',
] as const;
export const monsterPowerSchema = z.enum(MONSTER_POWERS);
export type MonsterPowerView = z.infer<typeof monsterPowerSchema>;

/** Elite gifts: one monster of a group may carry one, from Floor 2 down. */
export const ELITES = ['gilded', 'frenzied', 'armored', 'vampiric', 'swift'] as const;
export const eliteSchema = z.enum(ELITES);
export type Elite = z.infer<typeof eliteSchema>;

export const STATUSES = ['burning', 'paralyzed', 'frightened'] as const;
export const statusSchema = z.enum(STATUSES);

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
  /** A monster's elite gift, if it has one. */
  elite: eliteSchema.nullable(),
  /** A monster's powers, elite ones included; empty for a Hero. */
  powers: z.array(monsterPowerSchema),
});
export type Combatant = z.infer<typeof combatantSchema>;

/** Survived: Death saves held. Escaped: an Escape roll got the Hero out. Both end in the last safe Room. */
export const fightOutcomeSchema = z.enum(['victory', 'survived', 'escaped', 'dead']);
export type FightOutcomeId = z.infer<typeof fightOutcomeSchema>;

export const fightEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('initiative'), order: z.array(z.string()) }),
  /** That side was caught off guard (a failed Sneak) and loses its first round. */
  z.object({ type: z.literal('surprise'), side: z.enum(['hero', 'monsters']) }),
  z.object({
    type: z.literal('attack'), actor: z.string(), target: z.string(), natural: z.number().int(), total: z.number().int(),
    hit: z.boolean(), crit: z.boolean(), damage: z.number().int(), targetHp: z.number().int(), kind: z.enum(['weapon', 'spell']),
  }),
  /** A blow turned aside: by the Ashen Aegis, or by a Wizard's Shield. */
  z.object({ type: z.literal('blocked'), actor: z.string(), by: z.enum(['aegis', 'shield']).default('aegis') }),
  z.object({
    type: z.literal('burst'), actor: z.string(), source: z.enum(['spell', 'bomb']),
    targets: z.array(z.object({ key: z.string(), damage: z.number().int(), hp: z.number().int() })),
  }),
  z.object({
    type: z.literal('heal'), actor: z.string(), ability: z.enum(['second-wind', 'cure-wounds', 'potion', 'life-steal']),
    amount: z.number().int(), hp: z.number().int(),
  }),
  /** A Hero's Path at work: Survivor heals, Indomitable stands at 1, an Abjurer's ward rises (`left`) or soaks `amount`. */
  z.object({
    type: z.literal('feature'), feature: z.enum(['survivor', 'indomitable', 'ward']),
    amount: z.number().int().optional(), hp: z.number().int().optional(), left: z.number().int().optional(),
  }),
  /** A monster's power at work: `amount` is gold stolen, health restored or damage dealt; `hp` the target's health after. */
  z.object({
    type: z.literal('power'), actor: z.string(), power: monsterPowerSchema,
    target: z.string().optional(), amount: z.number().int().optional(), hp: z.number().int().optional(),
  }),
  /** A saving throw the Hero makes against a monster's power. */
  z.object({
    type: z.literal('save'), ability: z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']), natural: z.number().int(), total: z.number().int(),
    dc: z.number().int(), success: z.boolean(),
  }),
  z.object({ type: z.literal('status'), target: z.string(), status: statusSchema, turns: z.number().int() }),
  /** Burning damage at the start of a turn. */
  z.object({ type: z.literal('tick'), target: z.string(), damage: z.number().int(), hp: z.number().int() }),
  /** Paralyzed: the turn is lost. */
  z.object({ type: z.literal('held'), target: z.string() }),
  /** A monster runs off, a thief with what it stole. */
  z.object({ type: z.literal('fled'), key: z.string() }),
  z.object({ type: z.literal('defeated'), key: z.string() }),
  z.object({ type: z.literal('down') }),
  z.object({ type: z.literal('death-save'), natural: z.number().int(), successes: z.number().int(), failures: z.number().int() }),
  z.object({ type: z.literal('rise'), hp: z.number().int() }),
  z.object({ type: z.literal('reroll'), natural: z.number().int() }),
  /** An Escape roll the Hero's Stance made it try, badly hurt. */
  z.object({ type: z.literal('escape'), natural: z.number().int(), total: z.number().int(), dc: z.number().int(), success: z.boolean() }),
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

// ─── Before a fight: Stance, Threat, Sneaking ─────────────────────────────

export const STANCES = ['bold', 'steady', 'wary'] as const;
export const stanceSchema = z.enum(STANCES);
export type Stance = z.infer<typeof stanceSchema>;

export const THREATS = ['trivial', 'easy', 'risky', 'dangerous', 'deadly'] as const;
export const threatSchema = z.enum(THREATS);
export type Threat = z.infer<typeof threatSchema>;

/** Monsters the Hero has walked in on and not fought yet: it must Fight, Sneak past or Retreat. */
export const MONSTER_KINS = ['beast', 'goblinoid', 'undead', 'demon', 'dragonkin', 'humanoid'] as const;

/** What a monster's card shows beyond its token: what it is and how it fights, as it is on this Floor. */
export const foeSchema = z.object({
  /** Its `key` among the Facing's monsters. */
  key: z.string(),
  kin: z.enum(MONSTER_KINS),
  role: z.enum(['minion', 'brute', 'miniboss', 'boss']),
  about: localizedTextSchema,
  /** Added to its d20 to hit. */
  attack: z.number().int(),
  /** Each hit: [dice, sides, bonus], then times `damageFactor` (an elite's fury, the Boss weakening, the day's Omen). */
  damage: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  damageFactor: z.number(),
  /** Attacks each turn. */
  attacks: z.number().int(),
});
export type Foe = z.infer<typeof foeSchema>;

export const facingSchema = z.object({
  kind: z.enum(['fight', 'miniboss', 'boss']),
  monsters: z.array(combatantSchema),
  /** Each monster's card, in the same order. */
  foes: z.array(foeSchema),
  /** The Threat in each Stance, so switching Stance shows its effect at once. */
  threat: z.object({ bold: threatSchema, steady: threatSchema, wary: threatSchema }),
  /** The DEX Check to Sneak past; null where there is no sneaking past (Mini-bosses, the Boss). */
  sneak: z.object({
    modifier: z.number().int(),
    dc: z.number().int(),
    edge: z.enum(['normal', 'advantage', 'disadvantage']),
  }).nullable(),
});
export type Facing = z.infer<typeof facingSchema>;

/** POST /api/labyrinth/face — what the Hero does about the monsters it faces. */
export const faceActionSchema = z.discriminatedUnion('action', [
  /** `bomb`: throw a Fire bomb first. */
  z.object({ action: z.literal('fight'), bomb: z.boolean().default(false) }),
  /** `smoke`: a Smoke bomb makes it sure. */
  z.object({ action: z.literal('sneak'), smoke: z.boolean().default(false) }),
  z.object({ action: z.literal('retreat') }),
]);
export type FaceAction = z.infer<typeof faceActionSchema>;

export const stanceRequestSchema = z.object({ stance: stanceSchema });

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
  /** Walking in costs no Stamina: the Hero knows the Room and nothing new waits there today. */
  free: z.boolean(),
});
export type Exit = z.infer<typeof exitSchema>;

export const mapDoorSchema = z.object({ a: z.number().int(), b: z.number().int(), kind: doorKindSchema });

// ─── Event rooms ──────────────────────────────────────────────────────────

export const EVENT_KINDS = [
  'three-chests', 'shrine', 'gambler', 'merchant', 'trapped-corridor', 'cursed-altar', 'locked-cache', 'lockpicking',
  'fountain', 'prisoner', 'library', 'bone-pile', 'riddle',
] as const;
export const eventKindSchema = z.enum(EVENT_KINDS);
export type EventKindId = z.infer<typeof eventKindSchema>;

export const chestContentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), tier: tierSchema }),
  z.object({ kind: z.literal('gold'), amount: z.number().int() }),
  z.object({ kind: z.literal('mimic') }),
]);

/** What an Event room offers this Hero today, and what it has already done there. */
export const eventViewSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('three-chests'),
    done: z.boolean(),
    /** Contents stay hidden until one chest is picked; then all three show. */
    chests: z.array(z.object({ picked: z.boolean(), content: chestContentSchema.nullable() })),
  }),
  z.object({ kind: z.literal('shrine'), done: z.boolean() }),
  z.object({ kind: z.literal('gambler'), done: z.boolean(), maxBet: z.number().int() }),
  z.object({
    kind: z.literal('merchant'),
    done: z.boolean(),
    wares: z.array(z.object({ id: z.string(), item: itemViewSchema, price: z.number().int(), sold: z.boolean() })),
    /** The merchant pays this many times the Buyback price. */
    buysAt: z.number(),
  }),
  z.object({ kind: z.literal('trapped-corridor'), done: z.boolean() }),
  z.object({ kind: z.literal('cursed-altar'), done: z.boolean() }),
  z.object({ kind: z.literal('locked-cache'), done: z.boolean(), canOpen: z.boolean(), free: z.boolean() }),
  z.object({ kind: z.literal('lockpicking'), done: z.boolean() }),
  z.object({ kind: z.literal('fountain'), done: z.boolean() }),
  /** The chains need an Iron key, or a Rogue's hands. */
  z.object({ kind: z.literal('prisoner'), done: z.boolean(), canOpen: z.boolean(), free: z.boolean() }),
  z.object({ kind: z.literal('library'), done: z.boolean() }),
  /** The Riddling statue: today's riddle and three answers; once answered, which was chosen and which was right. */
  z.object({
    kind: z.literal('riddle'),
    done: z.boolean(),
    question: localizedTextSchema,
    answers: z.array(localizedTextSchema).length(3),
    chosen: z.number().int().nullable(),
    right: z.number().int().nullable(),
  }),
  z.object({ kind: z.literal('bone-pile'), done: z.boolean() }),
]);
export type EventView = z.infer<typeof eventViewSchema>;

/** POST /api/labyrinth/event — what the Hero does in the Event room it stands in. */
export const eventActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pick'), chest: z.number().int().min(0).max(2) }),
  z.object({ action: z.literal('pray') }),
  z.object({ action: z.literal('bet-gold'), amount: z.number().int().min(1) }),
  z.object({ action: z.literal('bet-item'), itemId: z.string() }),
  z.object({ action: z.literal('buy'), ware: z.string() }),
  z.object({ action: z.literal('sell'), itemId: z.string() }),
  z.object({ action: z.literal('offer'), itemId: z.string() }),
  z.object({ action: z.literal('open') }),
  z.object({ action: z.literal('pick-lock') }),
  z.object({ action: z.literal('drink') }),
  z.object({ action: z.literal('free') }),
  z.object({ action: z.literal('read') }),
  z.object({ action: z.literal('search') }),
  z.object({ action: z.literal('answer'), choice: z.number().int().min(0).max(2) }),
]);
export type EventAction = z.infer<typeof eventActionSchema>;

/** A Check rolled on screen: traps, Shrines, locks (docs/design.md → Dice shown on screen). */
export const checkViewSchema = z.object({
  label: localizedTextSchema,
  /** Every d20 that hit the table (two with advantage, a Halfling's rerolled 1 too). */
  dice: z.array(z.number().int()),
  natural: z.number().int(),
  modifier: z.number().int(),
  total: z.number().int(),
  dc: z.number().int(),
  success: z.boolean(),
  /** A Lucky charm or Luckstone rolled a failed d20 again: the first roll. */
  rerolled: z.number().int().nullable(),
});
export type CheckView = z.infer<typeof checkViewSchema>;

export const graveViewSchema = z.object({
  id: z.string(),
  owner: z.string(),
  items: z.number().int(),
  gold: z.number().int(),
  expiresAt: z.string(),
});

/** One class feature on the belt: what it does now, uses left, and what it becomes (engine features.ts). */
export const featureViewSchema = z.object({
  id: z.string(),
  icon: z.enum(['flame', 'shield', 'bolt', 'heart', 'wind', 'swords', 'sword', 'dodge', 'escape', 'skull', 'path']),
  name: localizedTextSchema,
  /** rest: uses that come back after a rest; fight: once each fight; passive: always on; locked: comes at a later level. */
  kind: z.enum(['rest', 'fight', 'passive', 'locked']),
  uses: z.object({ left: z.number().int(), of: z.number().int() }).nullable(),
  now: localizedTextSchema,
  next: localizedTextSchema.nullable(),
});
export type FeatureView = z.infer<typeof featureViewSchema>;

/** A Bag item the belt shows, for use in a Run. */
export const KIT_BASES = ['potion', 'bomb-fire', 'bomb-smoke', 'scroll-portal'] as const;
export const kitItemSchema = z.object({ base: z.enum(KIT_BASES), count: z.number().int(), name: localizedTextSchema, about: localizedTextSchema });
export type KitItemView = z.infer<typeof kitItemSchema>;

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
    stance: stanceSchema,
    bombs: z.object({ fire: z.number().int(), smoke: z.number().int() }),
    /** The belt: the Hero's class features, then the Bag items it carries for a Run. */
    features: z.array(featureViewSchema),
    kit: z.array(kitItemSchema),
    /**
     * Short rests left: each gives back half of full health and Stamina. They come back
     * when a Run starts, from `backAt` on (null when none are used or they are due already).
     */
    shortRests: z.object({ left: z.number().int(), of: z.number().int(), backAt: z.string().nullable() }),
  }),
  /** The Labyrinth opens when the Season starts; the Boss gate opens later. */
  season: z.object({ status: seasonStatusSchema, bossGateAt: z.string().nullable(), omen: omenViewSchema.nullable() }),
  /** Floors whose Waypoint this Hero has reached (entering there is allowed). */
  waypoints: z.array(z.number().int()),
  /** A Town Portal the Hero left open: step back through it from the City to where it was read, until `closesAt`. */
  portal: z.object({ floor: z.number().int(), closesAt: z.string() }).nullable(),
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
    /** Event rooms: what is on offer and what the Hero has done. */
    eventView: eventViewSchema.nullable(),
    /** Vaults: open to the first Hero in, sealed until an announced time, or already emptied. */
    vault: z.object({ state: z.enum(['open', 'sealed', 'claimed']), opensAt: z.string().nullable() }).nullable(),
    /** Monsters waiting to be fought, snuck past or retreated from; the other Doors are shut until then. */
    facing: facingSchema.nullable(),
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
  /** Checks to roll on screen, in order. */
  checks: z.array(checkViewSchema),
  /** The Goblin gambler's dice: both d20s. */
  duel: z.object({ hero: z.number().int(), goblin: z.number().int(), win: z.boolean() }).nullable(),
});
export type LabyrinthResult = z.infer<typeof labyrinthResultSchema>;

/** `portal`: step back through the open Town Portal instead (then `floor` is ignored). */
export const enterRequestSchema = z.object({ floor: z.number().int().min(1).default(1), portal: z.boolean().default(false) });
export const moveRequestSchema = z.object({ to: z.number().int().min(0) });
