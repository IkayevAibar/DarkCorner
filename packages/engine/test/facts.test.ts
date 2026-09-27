import { describe, expect, it } from 'vitest';
import { BASES, CLASSES, CLASS_DEFS, type GearBase, armorClass, baseById, gearFacts, isGear, itemAbout } from '../src/index.js';

const gearBase = (id: string) => baseById(id) as GearBase;
const plain = { quality: 50, upgrade: 0, radiant: false };

describe('gear facts', () => {
  it('reads a weapon: its dice, their range, the damage type, and who may wield it', () => {
    expect(gearFacts(gearBase('longsword'), plain)).toEqual({
      slot: 'main',
      group: 'blade',
      classes: CLASSES.filter((c) => CLASS_DEFS[c].weapons.includes('blade')),
      damage: { dice: 1, sides: 8, min: 1, max: 8, percent: 100, hits: 'slash' },
      armor: null,
      heavy: false,
    });
    const upgraded = gearFacts(gearBase('greatsword'), { quality: 100, upgrade: 10, radiant: false }).damage!;
    expect(upgraded).toMatchObject({ dice: 2, sides: 6, percent: 161, min: 3, max: 19 });
  });

  it('gives body armor the Armor Class a fight would, and marks heavy armor', () => {
    for (const quality of [1, 50, 100]) {
      for (const upgrade of [0, 5, 10]) {
        for (const radiant of [false, true]) {
          const facts = gearFacts(gearBase('plate'), { quality, upgrade, radiant });
          // DEX 10 adds nothing, so the Hero's Armor Class is exactly the armor's.
          expect(facts.armor!.ac).toBe(armorClass(10, [{ base: 'plate', quality, upgrade, radiant, bonusStats: [] }]));
          expect(facts).toMatchObject({ heavy: true, armor: { body: true, maxDex: 0 } });
        }
      }
    }
    expect(gearFacts(gearBase('robes'), plain).armor).toEqual({ ac: 13, body: true, maxDex: null });
  });

  it('says what a shield adds, and nothing for gear worn only for its Bonus stats', () => {
    expect(gearFacts(gearBase('shield'), plain)).toMatchObject({ group: 'shield', armor: { ac: 2, body: false }, damage: null });
    expect(gearFacts(gearBase('ring'), plain)).toEqual({ slot: 'ring', group: null, classes: null, damage: null, armor: null, heavy: false });
  });
});

describe('what using an Item does', () => {
  it('describes every stackable in both languages, and leaves gear to its numbers', () => {
    for (const base of BASES) {
      const about = itemAbout(base.id);
      if (isGear(base)) expect(about, base.id).toBeNull();
      else expect(about?.en && about.ru, base.id).toBeTruthy();
    }
  });

  it('reads Chest odds and Material uses from the rules', () => {
    expect(itemAbout('chest-gold')!.en).toBe('Open it with a Gold key: Epic 75% · Legendary 21% · Mythic 4%.');
    expect(itemAbout('scrap')!.en).toBe('A Forge Material. Upgrades +1 to +3. Reforging Uncommon Items. Crafts an Iron key from 6.');
    expect(itemAbout('essence')!.ru).toContain('Создание: серебряный ключ (нужно 4) и свиток защиты (нужно 3).');
  });
});
