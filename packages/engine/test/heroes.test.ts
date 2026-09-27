import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, CLASSES, STAMINA_MAX, STAMINA_REFILL_MS, baseById, currentStamina, isGear, startingHealth, validateHeroChoices,
} from '../src/index.js';

describe('startingHealth', () => {
  it('uses the full hit die plus CON, as in the SRD', () => {
    expect(startingHealth('fighter', 'human', ['alert', 'haggler'], 14)).toBe(12);
    expect(startingHealth('wizard', 'elf', ['alert'], 8)).toBe(5);
  });

  it('adds the Dwarf and Tough bonuses', () => {
    expect(startingHealth('cleric', 'dwarf', ['tough'], 10)).toBe(8 + 0 + 1 + 2);
  });

  it('never goes below 1', () => {
    expect(startingHealth('wizard', 'halfling', ['alert'], 1)).toBe(1);
  });
});

describe('validateHeroChoices', () => {
  const ok = { name: 'Garrick', race: 'human', class: 'fighter', talents: ['alert', 'tough'] } as const;

  it('accepts a valid Hero', () => {
    expect(validateHeroChoices({ ...ok, talents: [...ok.talents] })).toEqual([]);
  });

  it('wants two Talents from Humans and one from everyone else', () => {
    expect(validateHeroChoices({ ...ok, talents: ['alert'] })).toContain('talent_count');
    expect(validateHeroChoices({ ...ok, race: 'elf', talents: ['alert'] })).toEqual([]);
    expect(validateHeroChoices({ ...ok, race: 'elf', talents: ['alert', 'tough'] })).toContain('talent_count');
    expect(validateHeroChoices({ ...ok, talents: ['alert', 'alert'] })).toContain('talent_count');
  });

  it('checks names, including Cyrillic ones', () => {
    expect(validateHeroChoices({ ...ok, talents: [...ok.talents], name: 'Гаррик' })).toEqual([]);
    expect(validateHeroChoices({ ...ok, talents: [...ok.talents], name: 'X' })).toContain('name_length');
    expect(validateHeroChoices({ ...ok, talents: [...ok.talents], name: '<script>' })).toContain('name_characters');
  });
});

describe('currentStamina', () => {
  const t0 = new Date('2026-11-06T12:00:00Z');

  it('refills one point per 24 minutes and keeps the leftover time', () => {
    const later = new Date(t0.getTime() + STAMINA_REFILL_MS * 2.5);
    const result = currentStamina(10, t0, later);
    expect(result.stamina).toBe(12);
    expect(result.savedAt.getTime()).toBe(t0.getTime() + STAMINA_REFILL_MS * 2);
  });

  it('stops at the maximum', () => {
    const result = currentStamina(19, t0, new Date(t0.getTime() + STAMINA_REFILL_MS * 10));
    expect(result.stamina).toBe(STAMINA_MAX);
  });
});

describe('starter kits', () => {
  it('only contain gear the Class can use', () => {
    for (const id of CLASSES) {
      const cls = CLASS_DEFS[id];
      for (const baseId of cls.starterKit) {
        const base = baseById(baseId);
        expect(isGear(base)).toBe(true);
        if (!isGear(base)) continue;
        if (base.weapon) expect(cls.weapons).toContain(base.weapon);
        if (base.offHand) expect(cls.offHands).toContain(base.offHand);
        if (base.armor) expect(cls.armor).toContain(base.armor);
      }
    }
  });
});
