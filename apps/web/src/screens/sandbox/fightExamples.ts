import type { FightReplay } from '@dark/shared';
import fixtures from './fightFixtures.json';
import { framesFor } from '../../components/fight/replay';

/** Engine-produced fixtures stay untouched; these extra examples exercise rare visual paths. */
export const REAL_FIGHTS = fixtures as unknown as Record<string, FightReplay>;
const base = REAL_FIGHTS['goblins-victory-crit']!;
export const EXTRA_FIGHTS: Record<string, FightReplay> = {
  'visual-hero-bow': {
    ...base,
    hero: { ...base.hero, strike: 'shoot' },
    monsters: [{ ...base.monsters[0]!, key: 'm0', hp: 12, maxHp: 12 }],
    events: [
      { type: 'initiative', order: ['hero', 'm0'] },
      { type: 'attack', actor: 'hero', target: 'm0', natural: 14, total: 18, hit: true, crit: false, damage: 6, targetHp: 6, kind: 'weapon' },
      { type: 'attack', actor: 'm0', target: 'hero', natural: 5, total: 8, hit: false, crit: false, damage: 0, targetHp: base.hero.hp, kind: 'weapon' },
      { type: 'attack', actor: 'hero', target: 'm0', natural: 20, total: 24, hit: true, crit: true, damage: 12, targetHp: 0, kind: 'weapon' },
      { type: 'defeated', key: 'm0' },
      { type: 'end', outcome: 'victory' },
    ],
    outcome: 'victory',
  },
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

/** Preview the new paintings until Claude adds their art paths to the engine content. Events stay untouched. */
function paintedWardens(replay: FightReplay): FightReplay {
  if (!replay.monsters.some(m => m.powers.includes('twin'))) return replay;
  return { ...replay, monsters: replay.monsters.map(m => m.powers.includes('twin')
    ? { ...m, art: m.art ?? `/art/tokens/${m.powers.includes('mend') ? 'dawn' : 'dusk'}-warden.webp` } : m) };
}
export const FIGHTS = { ...Object.fromEntries(Object.entries(REAL_FIGHTS).map(([id, replay]) => [id, paintedWardens(replay)])), ...EXTRA_FIGHTS };

// A short live cut starts with the blow that fells Dusk. Its original HP and every subsequent event are recorded values.
const wardens = FIGHTS['duo-twin-wardens']!;
const cut = wardens.events.findIndex(e => e.type === 'defeated') - 1;
const atCut = framesFor(wardens)[cut]!;
export const WARDEN_RISE: FightReplay = { ...wardens,
  hero: { ...wardens.hero, hp: atCut.fighters.hero!.hp },
  ally: { ...wardens.ally!, hp: atCut.fighters.ally!.hp },
  monsters: wardens.monsters.map(m => ({ ...m, hp: atCut.fighters[m.key]!.hp })),
  events: wardens.events.slice(cut),
};
