import { type Text, text } from './text.js';

/** Origin Talents (docs/design.md, v0). Academy Talents come in a later Season. */
export const TALENTS = ['alert', 'tough', 'savage-attacker', 'lucky-charm', 'haggler', 'field-medic'] as const;
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
};
