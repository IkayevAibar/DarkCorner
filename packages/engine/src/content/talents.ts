import { type Text, text } from './text.js';

/** Talents a new Hero picks from (docs/design.md → Origin talents, v0). */
export const ORIGIN_TALENTS = ['alert', 'tough', 'savage-attacker', 'lucky-charm', 'haggler', 'field-medic'] as const;

/**
 * Every Talent: the origin ones, and those a Hero can also learn as it grows
 * (docs/design.md → Growing: Paths and Talents, v0).
 */
export const TALENTS = [
  ...ORIGIN_TALENTS,
  'iron-will', 'fireproof', 'scavenger', 'treasure-hunter', 'light-step', 'heavy-hitter', 'battle-hardened',
] as const;
export type TalentId = (typeof TALENTS)[number];

export interface TalentDef {
  id: TalentId;
  name: Text;
  description: Text;
}

export const TALENT_DEFS: Record<TalentId, TalentDef> = {
  alert: {
    id: 'alert',
    name: text('Alert', 'Бдительность'),
    description: text('+5 to initiative.', '+5 к инициативе.'),
  },
  tough: {
    id: 'tough',
    name: text('Tough', 'Крепость'),
    description: text('+2 health per level.', '+2 здоровья за уровень.'),
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: text('Savage attacker', 'Свирепый боец'),
    description: text(
      'Roll weapon damage twice and keep the higher, once per turn.',
      'Раз в ход бросает урон оружия дважды и берёт больший.',
    ),
  },
  'lucky-charm': {
    id: 'lucky-charm',
    name: text('Lucky charm', 'Талисман удачи'),
    description: text('Once per Run, reroll any one d20.', 'Раз за вылазку перебрасывает любой d20.'),
  },
  haggler: {
    id: 'haggler',
    name: text('Haggler', 'Торгаш'),
    description: text('Shops pay 10% more and sell for 10% less.', 'Лавки платят на 10% больше и продают на 10% дешевле.'),
  },
  'field-medic': {
    id: 'field-medic',
    name: text('Field medic', 'Полевой лекарь'),
    description: text('Potions heal 50% more.', 'Зелья лечат на 50% больше.'),
  },
  'iron-will': {
    id: 'iron-will',
    name: text('Iron will', 'Железная воля'),
    description: text('Proficiency in CON and WIS saves.', 'Владение спасбросками ТЕЛ и МДР.'),
  },
  fireproof: {
    id: 'fireproof',
    name: text('Fireproof', 'Огнеупорность'),
    description: text('Fire breath and burning deal half damage.', 'Огненное дыхание и горение наносят половину урона.'),
  },
  scavenger: {
    id: 'scavenger',
    name: text('Scavenger', 'Мародёрство'),
    description: text('+10% magic find.', '+10% к удаче в добыче.'),
  },
  'treasure-hunter': {
    id: 'treasure-hunter',
    name: text('Treasure hunter', 'Кладоискательство'),
    description: text('+20% gold find.', '+20% к золоту.'),
  },
  'light-step': {
    id: 'light-step',
    name: text('Light step', 'Лёгкий шаг'),
    description: text(
      '+2 to Sneak and Escape rolls, and heavy armor no longer hinders Sneaking.',
      '+2 к проверкам скрытности и броскам побега, а тяжёлая броня больше не мешает прокрадываться.',
    ),
  },
  'heavy-hitter': {
    id: 'heavy-hitter',
    name: text('Heavy hitter', 'Тяжёлая рука'),
    description: text('+2 damage on every hit.', '+2 к урону каждого попадания.'),
  },
  'battle-hardened': {
    id: 'battle-hardened',
    name: text('Battle-hardened', 'Закалка'),
    description: text('+1 AC.', '+1 к КД.'),
  },
};
