import { z } from 'zod';
import { itemViewSchema, localizedTextSchema } from './items.js';

export const RACE_IDS = ['human', 'elf', 'dwarf', 'halfling'] as const;
export const CLASS_IDS = ['fighter', 'rogue', 'wizard', 'cleric'] as const;
export const TALENT_IDS = [
  'alert', 'tough', 'savage-attacker', 'lucky-charm', 'haggler', 'field-medic',
  'iron-will', 'fireproof', 'scavenger', 'treasure-hunter', 'light-step', 'heavy-hitter', 'battle-hardened',
] as const;
export const PATH_IDS = ['champion', 'guardian', 'thief', 'assassin', 'evoker', 'abjurer', 'life', 'war'] as const;
export const ABILITY_IDS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const SLOT_IDS = ['main', 'off', 'head', 'body', 'hands', 'feet', 'amulet', 'ring1', 'ring2'] as const;

export const raceIdSchema = z.enum(RACE_IDS);
export const classIdSchema = z.enum(CLASS_IDS);
export const talentIdSchema = z.enum(TALENT_IDS);
export const pathIdSchema = z.enum(PATH_IDS);
export const abilityIdSchema = z.enum(ABILITY_IDS);
export const slotIdSchema = z.enum(SLOT_IDS);
export type RaceId = z.infer<typeof raceIdSchema>;
export type ClassId = z.infer<typeof classIdSchema>;
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
export type BlessingIdView = z.infer<typeof blessingIdSchema>;

/** Everything that tilts the Hero's drops: gear, a Blessing, and the Bad-luck meter. */
export const luckViewSchema = z.object({
  badLuck: z.number().int(),
  /** At this, the next Item that drops is Legendary or better. */
  badLuckMax: z.number().int(),
  /** Percent, from gear and the Blessing. */
  magicFind: z.number().int(),
  goldFind: z.number().int(),
  blessing: z.object({
    id: blessingIdSchema, name: localizedTextSchema, description: localizedTextSchema, until: z.string(),
  }).nullable(),
});
export type LuckView = z.infer<typeof luckViewSchema>;

export const talentViewSchema = z.object({ id: talentIdSchema, name: localizedTextSchema, description: localizedTextSchema });

/** A Path and its two features; `unlocked` once the Hero's level reaches the feature's. */
export const pathViewSchema = z.object({
  id: pathIdSchema,
  name: localizedTextSchema,
  blurb: localizedTextSchema,
  features: z.array(z.object({ level: z.number().int(), name: localizedTextSchema, text: localizedTextSchema, unlocked: z.boolean() })),
});
export type PathView = z.infer<typeof pathViewSchema>;

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
  abilities: abilityScoresSchema,
  maxHp: z.number().int(),
  hp: z.number().int(),
  armorClass: z.number().int(),
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
});
export type HeroView = z.infer<typeof heroSchema>;

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
