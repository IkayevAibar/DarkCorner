import { describe, expect, it } from 'vitest';
import { type FeatureHero, heroFeatures } from '../src/index.js';

const hero = (over: Partial<FeatureHero>): FeatureHero => ({ class: 'wizard', level: 1, path: null, int: 16, wis: 10, spellUses: 1, healUses: 0, ...over });
const byId = (over: Partial<FeatureHero>) => Object.fromEntries(heroFeatures(hero(over)).map((f) => [f.id, f]));

describe('the belt’s class features', () => {
  it('gives a Wizard the burst with its uses, Shield, the attack spell, and the Path last', () => {
    const list = heroFeatures(hero({ level: 3, path: 'evoker', spellUses: 0 }));
    expect(list.map((f) => f.id)).toEqual(['burst', 'shield', 'attack-spell', 'path']);
    const burst = list[0]!;
    // Level 3: 3d6, and an Evoker adds INT twice (+3 → +6).
    expect(burst).toMatchObject({ kind: 'rest', uses: { left: 0, of: 1 } });
    expect(burst.now.en).toBe('Opens a fight against two or more monsters: 3d6 + 6 on each.');
    expect(burst.next!.en).toBe('4d6 at level 6. 2 a rest at level 4.');
    expect(list[2]!.now.en).toBe('Every turn, at will: 1d10 + 3.');
  });

  it('shows what a level will bring as locked, and says when', () => {
    const fighter = byId({ class: 'fighter', level: 2 });
    expect(fighter['extra-attack']).toMatchObject({ kind: 'locked' });
    expect(fighter['extra-attack']!.next!.en).toBe('2 attacks a turn at level 5.');
    expect(fighter.path).toMatchObject({ kind: 'locked' });

    const rogue = byId({ class: 'rogue', level: 2 });
    expect(rogue['uncanny-dodge']).toMatchObject({ kind: 'locked' });
    expect(byId({ class: 'rogue', level: 3 })['uncanny-dodge']).toMatchObject({ kind: 'passive', next: null });
    expect(rogue['sneak-attack']!.now.en).toContain('1d6');
    expect(rogue['sneak-attack']!.next!.en).toBe('2d6 at level 3.');
  });

  it('gives a Cleric Cure wounds with its uses and a Life Cleric’s bonus', () => {
    const cleric = byId({ class: 'cleric', level: 4, path: 'life', wis: 16, healUses: 2 });
    expect(cleric['cure-wounds']).toMatchObject({ uses: { left: 2, of: 2 } });
    expect(cleric['cure-wounds']!.now.en).toBe('Below 45% health in a fight: heals 2d8 + 3, and half again as much.');
    expect(cleric.bane!.kind).toBe('passive');
  });

  it('describes a chosen Path’s open features, and its mastery to come', () => {
    const path = byId({ class: 'fighter', level: 4, path: 'champion' }).path!;
    expect(path).toMatchObject({ kind: 'passive', name: { en: 'Champion' } });
    expect(path.now.en).toMatch(/^Improved critical:/);
    expect(path.next!.en).toMatch(/^At level 9, Survivor:/);
  });

  it('writes every feature in both languages', () => {
    for (const cls of ['fighter', 'rogue', 'wizard', 'cleric'] as const) {
      for (const f of heroFeatures(hero({ class: cls, level: 7, path: null }))) {
        expect(f.name.ru && f.now.ru, `${cls} ${f.id}`).toBeTruthy();
        if (f.next) expect(f.next.ru, `${cls} ${f.id}`).toBeTruthy();
      }
    }
  });
});
