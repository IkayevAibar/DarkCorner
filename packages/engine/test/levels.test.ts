import { describe, expect, it } from 'vitest';
import { type LevelingHero, levelChoice, levelGains } from '../src/index.js';

const hero = (over: Partial<LevelingHero>): LevelingHero => ({ class: 'fighter', race: 'human', path: null, level: 1, con: 10, talents: [], ...over });
const gains = (over: Partial<LevelingHero>) => levelGains(hero(over)).map((g) => g.en);

describe('what a level gives', () => {
  it('always tells the health range: the Hit Die, never below its average, plus CON, Race and Tough', () => {
    expect(gains({ class: 'fighter', con: 10 })[0]).toBe('Health: +6 to +10');
    // A Dwarf Cleric with CON 14 and Tough: d8 → 5..8, +2 CON, +1 Dwarf, +2 Tough.
    expect(gains({ class: 'cleric', race: 'dwarf', con: 14, talents: ['tough'] })[0]).toBe('Health: +10 to +13');
  });

  it('names a Rogue’s new Sneak attack dice, Uncanny dodge, and the Path to choose at 3', () => {
    expect(gains({ class: 'rogue', level: 2 })).toEqual([
      'Health: +5 to +8',
      'Sneak attack: 1d6 → 2d6',
      'New: Uncanny dodge. The first hit on you each round deals half damage.',
      'Choose your Path.',
    ]);
  });

  it('gives a Fighter a second attack and a better proficiency at 5', () => {
    expect(gains({ class: 'fighter', level: 4, path: 'champion' })).toEqual([
      'Health: +6 to +10',
      'Proficiency bonus, on every attack and trained Check: +2 → +3',
      'Attacks a turn: 1 → 2',
    ]);
  });

  it('grows a Wizard’s spells when their numbers change, and only then', () => {
    expect(gains({ class: 'wizard', level: 4, path: 'evoker' })).toContain('Attack spell: 1d10 → 2d10');
    expect(gains({ class: 'wizard', level: 5, path: 'evoker' })).toEqual(['Health: +4 to +6', 'Burst of fire, on every monster: 3d6 → 4d6']);
    expect(gains({ class: 'wizard', level: 7, path: 'evoker' })).toContain('Bursts of fire a rest: 2 → 3');
  });

  it('grows a Cleric’s Cure wounds, and tells a Path’s mastery at 9', () => {
    expect(gains({ class: 'cleric', level: 3, path: 'life' })).toContain('Cure wounds: 1d8 → 2d8');
    expect(gains({ class: 'cleric', level: 8, path: 'life' }).join('\n')).toContain('Life mastery:');
  });

  it('asks for the level’s choice: a Path at 3, abilities or a Talent at the growth levels', () => {
    expect(levelChoice({ level: 2, path: null })).toBe('path');
    expect(levelChoice({ level: 3, path: 'champion' })).toBe('growth');
    expect(levelChoice({ level: 4, path: 'champion' })).toBeNull();
    expect(gains({ level: 7, path: 'champion' })).toContain('Raise your abilities or learn a Talent.');
  });
});
