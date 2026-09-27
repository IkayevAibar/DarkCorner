import { type Text, text } from './text.js';

export const RACES = ['human', 'elf', 'dwarf', 'halfling'] as const;
export type RaceId = (typeof RACES)[number];

export interface RaceDef {
  id: RaceId;
  name: Text;
  trait: Text;
  /** Origin Talents picked at creation (every Hero gets one; Humans two). */
  talentPicks: number;
  /** Added to max health for every level. */
  hpPerLevel: number;
  /** Halfling Lucky: a natural 1 on any d20 is rerolled. */
  rerollOnes: boolean;
  /** Elf Keen senses: advantage on Checks to see through lying Clues. */
  clueAdvantage: boolean;
  charmAdvantage: boolean;
  poisonResistance: boolean;
}

const base = { talentPicks: 1, hpPerLevel: 0, rerollOnes: false, clueAdvantage: false, charmAdvantage: false, poisonResistance: false };

export const RACE_DEFS: Record<RaceId, RaceDef> = {
  human: {
    ...base,
    id: 'human',
    name: text('Human', 'Человек'),
    trait: text('Versatile: one extra origin Talent.', 'Разносторонность: ещё один талант происхождения.'),
    talentPicks: 2,
  },
  elf: {
    ...base,
    id: 'elf',
    name: text('Elf', 'Эльф'),
    trait: text(
      'Keen senses: advantage on Checks to see through lying Clues, and against charm.',
      'Острые чувства: преимущество в проверках против лживых подсказок и против очарования.',
    ),
    clueAdvantage: true,
    charmAdvantage: true,
  },
  dwarf: {
    ...base,
    id: 'dwarf',
    name: text('Dwarf', 'Дварф'),
    trait: text(
      'Dwarven toughness: +1 health per level and resistance to poison.',
      'Дварфийская стойкость: +1 здоровья за уровень и сопротивление яду.',
    ),
    hpPerLevel: 1,
    poisonResistance: true,
  },
  halfling: {
    ...base,
    id: 'halfling',
    name: text('Halfling', 'Полурослик'),
    trait: text('Lucky: a natural 1 on any d20 is rerolled.', 'Везение: выпавшая на d20 единица перебрасывается.'),
    rerollOnes: true,
  },
};
