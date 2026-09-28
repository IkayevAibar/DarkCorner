import type { FightReplay } from '@dark/shared';
import fixtures from './fightFixtures.json';

/** Engine-produced fixtures stay untouched; these extra examples exercise rare visual paths. */
export const REAL_FIGHTS = fixtures as unknown as Record<string, FightReplay>;
const base = REAL_FIGHTS['goblins-victory-crit']!;
export const EXTRA_FIGHTS: Record<string, FightReplay> = {
  'visual-lucky-reroll': {
    ...base,
    events: [
      { type: 'down' },
      { type: 'death-save', natural: 1, successes: 0, failures: 2 },
      { type: 'reroll', natural: 3 },
      { type: 'death-save', natural: 20, successes: 0, failures: 2 },
      { type: 'rise', hp: 1 },
      { type: 'escape', natural: 19, total: 22, dc: 12, success: true },
      { type: 'end', outcome: 'escaped' },
    ],
    outcome: 'escaped',
  },
  'visual-elite-powers-fallback': {
    ...base,
    monsters: ['frenzied', 'armored', 'vampiric', 'swift'].map((elite, i) => ({
      ...base.monsters[0]!, key: `m${i}`, hp: 12, maxHp: 30,
      elite: elite as 'frenzied' | 'armored' | 'vampiric' | 'swift', art: i === 1 ? null : base.monsters[0]!.art,
    })),
    events: [
      { type: 'initiative', order: ['hero', 'm0', 'm1', 'm2', 'm3'] },
      { type: 'power', actor: 'm1', power: 'mend', target: 'm0', amount: 8, hp: 20 },
      { type: 'power', actor: 'm2', power: 'drain', target: 'hero', amount: 4, hp: 16 },
      { type: 'power', actor: 'm0', power: 'enrage' },
      { type: 'blocked', actor: 'm0', by: 'aegis' },
      { type: 'heal', actor: 'hero', ability: 'life-steal', amount: 1, hp: base.hero.hp },
      { type: 'end', outcome: 'escaped' },
    ],
    outcome: 'escaped',
  },
};

export const FIGHTS = { ...REAL_FIGHTS, ...EXTRA_FIGHTS };
