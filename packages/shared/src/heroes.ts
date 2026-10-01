import { z } from 'zod';
import { CLASS_IDS, type ClassId, classIdSchema } from './classes.js';
import { itemViewSchema, localizedTextSchema, bonusStatIdSchema } from './items.js';

export { CLASS_IDS, type ClassId, classIdSchema };

export const RACE_IDS = ['human', 'elf', 'dwarf', 'halfling'] as const;
export const TALENT_IDS = [
  'alert', 'tough', 'savage-attacker', 'lucky-charm', 'haggler', 'field-medic',
  'iron-will', 'fireproof', 'scavenger', 'treasure-hunter', 'light-step', 'heavy-hitter', 'battle-hardened',
] as const;
export const PATH_IDS = ['champion', 'guardian', 'thief', 'assassin', 'evoker', 'abjurer', 'life', 'war', 'berserker', 'bearheart', 'hunter', 'stalker'] as const;
export const ABILITY_IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const SLOT_IDS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring1', 'ring2'] as const;

export const raceIdSchema = z.enum(RACE_IDS);
export const talentIdSchema = z.enum(TALENT_IDS);
export const pathIdSchema = z.enum(PATH_IDS);
export const abilityIdSchema = z.enum(ABILITY_IDS);
export const slotIdSchema = z.enum(SLOT_IDS);
export type RaceId = z.infer<typeof raceIdSchema>;
export type TalentId = z.infer<typeof talentIdSchema>;
export type PathIdView = z.infer<typeof pathIdSchema>;
export type AbilityId = z.infer<typeof abilityIdSchema>;
export type SlotId = z.infer<typeof slotIdSchema>;

export const abilityScoresSchema = z.object({
  str: z.number().int(), dex: z.number().int(), con: z.number().int(),
  int: z.number().int(), wis: z.number().int(), cha: z.number().int(),
});
export type AbilityScoresView = z.infer<typeof abilityScoresSchema>;

/** GET /api/heroes/options: everything the creation screens offer. */
export const creationOptionsSchema = z.object({
  races: z.array(z.object({
    id: raceIdSchema, name: localizedTextSchema, trait: localizedTextSchema, talentPicks: z.number().int(),
  })),
  classes: z.array(z.object({
    id: classIdSchema, name: localizedTextSchema, hitDie: z.number().int(), fights: localizedTextSchema, trick: localizedTextSchema,
    /** The ability the Class attacks and casts with, marked when rolling abilities. */
    primary: abilityIdSchema,
    /** The Class whose portraits it wears: its own, or a painted Class's until its own are painted. */
    wears: classIdSchema,
  })),
  /** Every Talent; `origin` ones can be picked when creating a Hero, the rest are learned by growing. */
  talents: z.array(z.object({ id: talentIdSchema, name: localizedTextSchema, description: localizedTextSchema, origin: z.boolean() })),
  /** `race`/`class` null means the portrait suits anyone. */
  portraits: z.array(z.object({
    id: z.string(), race: raceIdSchema.nullable(), class: classIdSchema.nullable(), url: z.string(),
  })),
  banners: z.array(z.string()),
});
export type CreationOptions = z.infer<typeof creationOptionsSchema>;

/** One 4d6-drop-lowest roll, shown die by die. */
export const abilityRollViewSchema = z.object({
  dice: z.array(z.number().int()),
  dropped: z.number().int(),
  total: z.number().int(),
});

export const abilitySetViewSchema = z.object({
  rolls: z.object({
    str: abilityRollViewSchema, dex: abilityRollViewSchema, con: abilityRollViewSchema,
    int: abilityRollViewSchema, wis: abilityRollViewSchema, cha: abilityRollViewSchema,
  }),
  scores: abilityScoresSchema,
  total: z.number().int(),
});
export type AbilitySetView = z.infer<typeof abilitySetViewSchema>;

/** Ability sets rolled so far. The Player may keep any one of them. */
export const heroDraftSchema = z.object({
  sets: z.array(abilitySetViewSchema).min(1),
  rerollsLeft: z.number().int().min(0),
});
export type HeroDraft = z.infer<typeof heroDraftSchema>;

export const BLESSING_IDS = ['fortune', 'greed', 'providence'] as const;
export const blessingIdSchema = z.enum(BLESSING_IDS);
/** Curses take a Blessing's place: a cracked Oathstone's. */
export const CURSE_IDS = ['oathbroken'] as const;
export type BlessingIdView = z.infer<typeof blessingIdSchema>;

/** Everything that tilts the Hero's drops: gear, a Blessing, and the Bad-luck meter. */
export const luckViewSchema = z.object({
  badLuck: z.number().int(),
  /** At this, the next Item that drops is Legendary or better. */
  badLuckMax: z.number().int(),
  /** Percent, from gear and the Blessing. */
  magicFind: z.number().int(),
  goldFind: z.number().int(),
  /** The Blessing on the Hero now, or a curse in its place. */
  blessing: z.object({
    id: z.enum([...BLESSING_IDS, ...CURSE_IDS]), name: localizedTextSchema, description: localizedTextSchema, until: z.string(),
    curse: z.boolean().default(false),
  }).nullable(),
});
export type LuckView = z.infer<typeof luckViewSchema>;

export const talentViewSchema = z.object({ id: talentIdSchema, name: localizedTextSchema, description: localizedTextSchema });
export type TalentView = z.infer<typeof talentViewSchema>;

/** A Path and its two features; `unlocked` once the Hero's level reaches the feature's. */
export const pathViewSchema = z.object({
  id: pathIdSchema,
  name: localizedTextSchema,
  blurb: localizedTextSchema,
  features: z.array(z.object({ level: z.number().int(), name: localizedTextSchema, text: localizedTextSchema, unlocked: z.boolean() })),
});
export type PathView = z.infer<typeof pathViewSchema>;

/**
 * The next level, once the Hero has the XP for it: what it gives, and the choice
 * it asks for. The Player takes it by hand (docs/design.md → Levels).
 */
export const levelUpViewSchema = z.object({
  level: z.number().int(),
  /** Ready-made lines, such as "Sneak attack: 1d6 → 2d6". */
  gains: z.array(localizedTextSchema),
  choice: z.enum(['path', 'growth']).nullable(),
  /** choice "path": the Class's two Paths. */
  paths: z.array(pathViewSchema).nullable(),
  /** choice "growth": the Talents on offer at this level (or abilities instead). */
  talents: z.array(talentViewSchema).nullable(),
});
export type LevelUpView = z.infer<typeof levelUpViewSchema>;

/** One Deed: what it asks, how far along the Hero is, and when it was done (docs/design.md → Deeds and Titles). */
export const deedViewSchema = z.object({
  id: z.string(),
  /** The Title it earns. */
  title: localizedTextSchema,
  about: localizedTextSchema,
  progress: z.number().int(),
  target: z.number().int(),
  gold: z.number().int(),
  doneAt: z.string().nullable(),
});
export type DeedView = z.infer<typeof deedViewSchema>;

export const heroSchema = z.object({
  id: z.string(),
  name: z.string(),
  race: raceIdSchema,
  class: classIdSchema,
  talents: z.array(talentIdSchema),
  portrait: z.string(),
  portraitUrl: z.string(),
  banner: z.string(),
  level: z.number().int(),
  xp: z.number().int(),
  /** The Hero's own scores, before gear (level-up choices build on these). */
  abilities: abilityScoresSchema,
  maxHp: z.number().int(),
  hp: z.number().int(),
  armorClass: z.number().int(),
  /** What worn gear adds, as fights and Checks count it. */
  gear: z.object({
    /** Added to each ability score: ability Bonus stats, and the Phylactery's +2. */
    abilities: abilityScoresSchema,
    /** Every other Bonus stat worn, summed by kind (Radiant and Upgrades in); kinds with none are left out. */
    stats: z.record(bonusStatIdSchema, z.number().int()),
    /** The lowest natural d20 that crits: 20 alone, lower with critical chance (each full 5%) and a Champion's edge. */
    critFrom: z.number().int(),
    /** Added to Sneak Checks and Escape rolls by escape chance (each full 5%). */
    escape: z.number().int(),
    /** Charisma's better prices at the Shops and the Wandering merchant, in percent. */
    charm: z.number().int(),
  }),
  /** Safe in the City. */
  gold: z.number().int(),
  stamina: z.number().int(),
  staminaMax: z.number().int(),
  worn: z.array(z.object({ slot: slotIdSchema, item: itemViewSchema })),
  bag: z.array(itemViewSchema),
  storage: z.array(itemViewSchema),
  bagSlots: z.number().int(),
  storageSlots: z.number().int(),
  /** City buildings and Storage only work while the Hero is in the City. */
  inCity: z.boolean(),
  luck: luckViewSchema,
  /** The Path chosen at level 3. */
  path: pathViewSchema.nullable(),
  /** From level 3 until a Path is chosen: the two on offer. */
  pathChoices: z.array(pathViewSchema).nullable(),
  /** Growth levels reached and not yet chosen, lowest first. */
  pendingGrowth: z.array(z.number().int()),
  /** The Talents offered for the lowest pending growth level, null when none is pending. */
  talentOffer: z.array(talentViewSchema).nullable(),
  /** XP needed for the next level, null at the top. */
  xpNext: z.number().int().nullable(),
  /** The next level, when its XP is there and the Player can take it. */
  levelUp: levelUpViewSchema.nullable(),
  deeds: z.array(deedViewSchema),
  /** The Title worn after the Hero's name: a done Deed's id, or none. */
  title: z.string().nullable(),
});
export type HeroView = z.infer<typeof heroSchema>;

/** POST /api/heroes/title: wear a done Deed's Title, or none. */
export const titleRequestSchema = z.object({ deed: z.string().nullable() });
export type TitleRequest = z.infer<typeof titleRequestSchema>;

/** POST /api/heroes/path */
export const choosePathRequestSchema = z.object({ path: pathIdSchema });

/** POST /api/heroes/grow: +2 to one ability, +1 to two, or one of the Talents offered at `level`. */
export const growRequestSchema = z.object({
  level: z.number().int(),
  choice: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('ability'), ability: abilityIdSchema }),
    z.object({ kind: z.literal('abilities'), abilities: z.tuple([abilityIdSchema, abilityIdSchema]) }),
    z.object({ kind: z.literal('talent'), talent: talentIdSchema }),
  ]),
});
export type GrowRequest = z.infer<typeof growRequestSchema>;

/** POST /api/heroes/level-up: take the next level, with its choice when it asks for one. */
export const levelUpRequestSchema = z.object({
  path: pathIdSchema.optional(),
  grow: growRequestSchema.shape.choice.optional(),
});
export type LevelUpRequest = z.infer<typeof levelUpRequestSchema>;

export const levelUpResponseSchema = z.object({
  hero: heroSchema,
  /** The health the level gave: the Hit Die, what it rolled, and the gain with CON and the rest. */
  health: z.object({ die: z.number().int(), roll: z.number().int(), gain: z.number().int() }),
});
export type LevelUpResponse = z.infer<typeof levelUpResponseSchema>;

/** GET /api/heroes/me: the Player's state in the current Season. */
export const myHeroResponseSchema = z.object({
  season: z.number().int(),
  hero: heroSchema.nullable(),
  draft: heroDraftSchema.nullable(),
  /** No living Hero, and this Season still allows one (the first, or after one Retire). */
  canCreate: z.boolean(),
  /** Retiring is allowed once per Season. */
  canRetire: z.boolean(),
});
export type MyHeroResponse = z.infer<typeof myHeroResponseSchema>;

/** POST /api/items/:id/equip — `slot` picks a ring slot; otherwise the first free fitting slot. */
export const equipRequestSchema = z.object({ slot: slotIdSchema.optional() });
export type EquipRequest = z.infer<typeof equipRequestSchema>;

/** POST /api/items/:id/move — between the Bag and Storage. */
export const moveItemRequestSchema = z.object({ to: z.enum(['bag', 'storage']) });
export type MoveItemRequest = z.infer<typeof moveItemRequestSchema>;

/** Every inventory action answers with the whole Hero, so the screen redraws from one source. */
export const heroResponseSchema = z.object({ hero: heroSchema });
export type HeroResponse = z.infer<typeof heroResponseSchema>;

/** POST /api/heroes */
export const createHeroRequestSchema = z.object({
  name: z.string().trim().min(2).max(20),
  race: raceIdSchema,
  class: classIdSchema,
  talents: z.array(talentIdSchema).min(1).max(2),
  portrait: z.string(),
  banner: z.string(),
  /** Index into the draft's `sets`. */
  set: z.number().int().min(0),
});
export type CreateHeroRequest = z.infer<typeof createHeroRequestSchema>;
