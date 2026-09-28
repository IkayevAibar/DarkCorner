import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLASS_DEFS, CLASSES, MONSTERS, PORTRAITS, RACES, THEMES, RECOVERY_PER_HOUR, STAMINA_MAX, STAMINA_REFILL_MS, UNIQUES, baseById, currentStamina, isGear, portraitsFor,
  recoveredHealth, startingHealth, validateHeroChoices, addStamina, lodgingPrice,
} from '../src/index.js';

describe('art', () => {
  const served = (url: string) => existsSync(new URL(`../../../apps/web/public${url}`, import.meta.url));

  it('offers two painted portraits for every Race and Class, then the hooded one', () => {
    for (const race of RACES) {
      for (const cls of CLASSES) {
        expect(portraitsFor(race, cls).map((p) => p.id)).toEqual([`${race}-${cls}-1`, `${race}-${cls}-2`, 'hooded']);
      }
    }
  });

  it('points every portrait, unique Item, monster and Room map at a file the web serves', () => {
    for (const p of PORTRAITS) expect(served(p.url), p.url).toBe(true);
    for (const u of UNIQUES) expect(u.art !== null && served(u.art), u.id).toBe(true);
    // A monster may still wait for its token (its initial stands in); any art it names must be served.
    for (const m of MONSTERS) if (m.art !== null) expect(served(m.art), m.id).toBe(true);
    for (const theme of Object.values(THEMES)) for (const map of theme.maps) expect(served(`/art/rooms/${map}.webp`), map).toBe(true);
  });
});

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

describe('recoveredHealth', () => {
  const hour = 60 * 60 * 1000;
  const t0 = new Date('2026-09-01T00:00:00Z');

  it('heals a twentieth of full health for every whole hour, and keeps the part hour', () => {
    const later = new Date(t0.getTime() + 3.5 * hour);
    const r = recoveredHealth(10, 100, t0, later);
    expect(r.hp).toBe(10 + Math.ceil(100 * RECOVERY_PER_HOUR * 3));
    expect(r.savedAt).toEqual(new Date(t0.getTime() + 3 * hour));
    expect(recoveredHealth(10, 100, t0, new Date(t0.getTime() + 59 * 60 * 1000))).toEqual({ hp: 10, savedAt: t0 });
  });

  it('stops at full health and keeps nothing in store', () => {
    const later = new Date(t0.getTime() + 30 * hour);
    expect(recoveredHealth(1, 100, t0, later)).toEqual({ hp: 100, savedAt: later });
    expect(recoveredHealth(100, 100, t0, later)).toEqual({ hp: 100, savedAt: later });
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

describe('resting', () => {
  const t0 = new Date('2026-11-06T12:00:00Z');

  it('adds Stamina on top of what came back with time, keeping the clock unless the bar fills', () => {
    const later = new Date(t0.getTime() + STAMINA_REFILL_MS * 1.5);
    expect(addStamina(4, t0, 10, later)).toEqual({ stamina: 15, savedAt: new Date(t0.getTime() + STAMINA_REFILL_MS) });
    expect(addStamina(15, t0, 10, later)).toEqual({ stamina: STAMINA_MAX, savedAt: later });
  });

  it('prices each night at the Tavern half again above the last, in tens', () => {
    expect([0, 1, 2, 3, 4, 5].map(lodgingPrice)).toEqual([50, 80, 110, 170, 250, 380]);
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
