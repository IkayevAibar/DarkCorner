import { describe, expect, it } from 'vitest';
import {
  type BountyEvent, type BountySpec, DAILY_BOUNTIES, bountyStep, bountyTitle, createRng, dailyBounties, weekOf, weeklyBounty,
} from '../src/index.js';

describe('Tavern bounties', () => {
  it('draws three different kinds a day, the same for the same seed', () => {
    for (let i = 0; i < 200; i++) {
      const specs = dailyBounties(createRng(`b-${i}`), 1 + (i % 10));
      expect(specs).toHaveLength(DAILY_BOUNTIES);
      expect(new Set(specs.map((s) => s.kind)).size).toBe(DAILY_BOUNTIES);
      for (const s of specs) {
        expect(s.target).toBeGreaterThan(0);
        expect(s.reward.gold).toBeGreaterThan(0);
      }
    }
    expect(dailyBounties(createRng('same'), 4)).toEqual(dailyBounties(createRng('same'), 4));
  });

  it('asks for elites only once a Hero has been deep enough to meet them', () => {
    for (let i = 0; i < 300; i++) expect(dailyBounties(createRng(`f1-${i}`), 1).some((s) => s.kind === 'elite')).toBe(false);
  });

  it('pays more the deeper the Hero has been, and a Silver Chest each week', () => {
    const shallow = dailyBounties(createRng('pay'), 1)[0]!;
    const deep = dailyBounties(createRng('pay'), 9)[0]!;
    expect(deep.reward.gold).toBeGreaterThan(shallow.reward.gold);
    const week = weeklyBounty(createRng('week'), 5);
    expect(week.reward.item).toEqual({ base: 'chest-silver', quantity: 1 });
    expect(weeklyBounty(createRng('week'), 10).kind).not.toBe('depth');
  });

  it('counts only what each bounty asks for', () => {
    const spec = (kind: BountySpec['kind'], params: BountySpec['params'] = {}): BountySpec => ({ kind, target: 5, params, reward: { gold: 1, item: null } });
    const won: Extract<BountyEvent, { type: 'fight-won' }> = { type: 'fight-won', floor: 5, kins: ['undead', 'undead', 'beast'], elites: 1, threat: 'risky', miniboss: false };
    expect(bountyStep(spec('slay'), won)).toBe(3);
    expect(bountyStep(spec('slay-kin', { kin: 'undead' }), won)).toBe(2);
    expect(bountyStep(spec('deep', { floor: 5 }), won)).toBe(1);
    expect(bountyStep(spec('deep', { floor: 6 }), won)).toBe(0);
    expect(bountyStep(spec('elite'), won)).toBe(1);
    expect(bountyStep(spec('risky'), won)).toBe(1);
    expect(bountyStep(spec('risky'), { ...won, threat: 'easy' })).toBe(0);
    expect(bountyStep(spec('miniboss'), won)).toBe(0);
    expect(bountyStep(spec('miniboss'), { ...won, miniboss: true })).toBe(1);
    expect(bountyStep(spec('sneak'), { type: 'sneak' })).toBe(1);
    expect(bountyStep(spec('sneak'), won)).toBe(0);
    expect(bountyStep(spec('bank'), { type: 'bank', gold: 70 })).toBe(70);
    expect(bountyStep(spec('depth', { floor: 4 }), { type: 'depth', floor: 4 })).toBe(1);
    expect(bountyStep(spec('depth', { floor: 4 }), { type: 'depth', floor: 3 })).toBe(0);
  });

  it('writes every bounty in both languages, the number after a colon in Russian', () => {
    for (let i = 0; i < 50; i++) {
      for (const s of [...dailyBounties(createRng(`t-${i}`), 1 + (i % 10)), weeklyBounty(createRng(`w-${i}`), 1 + (i % 10))]) {
        const title = bountyTitle(s);
        expect(title.en.length).toBeGreaterThan(5);
        expect(title.ru.length).toBeGreaterThan(5);
        if (s.target > 1) expect(title.ru).toMatch(new RegExp(`: ${s.target}$`));
      }
    }
  });

  it('starts weeks on Monday', () => {
    // 2026-09-28 is a Monday; 2026-10-04 is the Sunday after.
    const monday = Math.floor(Date.UTC(2026, 8, 28) / 86_400_000);
    expect(weekOf(monday)).toBe(monday);
    expect(weekOf(monday + 6)).toBe(monday);
    expect(weekOf(monday + 7)).toBe(monday + 7);
    expect(weekOf(monday - 1)).toBe(monday - 7);
  });
});
