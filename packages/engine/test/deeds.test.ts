import { describe, expect, it } from 'vitest';
import { DEEDS, KILL_METRIC, deedById, newlyEarned, tallyDeeds } from '../src/index.js';

describe('Deeds', () => {
  it('each has its own id, a Title and a way to earn it in both languages, and a reward', () => {
    expect(new Set(DEEDS.map((d) => d.id)).size).toBe(DEEDS.length);
    for (const d of DEEDS) {
      expect(d.target).toBeGreaterThan(0);
      expect(d.gold).toBeGreaterThan(0);
      for (const t of [d.title, d.about]) {
        expect(t.en.length).toBeGreaterThan(3);
        expect(t.ru.length).toBeGreaterThan(3);
      }
      expect(deedById(d.id)).toBe(d);
    }
    expect(deedById('nope')).toBeUndefined();
  });

  it('adds up counts, keeps the deepest Floor as a maximum, and earns each Deed once', () => {
    let counts = tallyDeeds({}, { 'kills-goblinoid': 60, rooms: 1 });
    counts = tallyDeeds(counts, { 'kills-goblinoid': 40 }, { depth: 7 });
    counts = tallyDeeds(counts, {}, { depth: 4 });
    expect(counts).toEqual({ 'kills-goblinoid': 100, rooms: 1, depth: 7 });
    expect(newlyEarned(counts, []).map((d) => d.id)).toEqual(['goblin-bane']);
    expect(newlyEarned(counts, ['goblin-bane'])).toEqual([]);
    expect(newlyEarned(tallyDeeds(counts, {}, { depth: 10 }), ['goblin-bane']).map((d) => d.id)).toEqual(['deep-delver']);
  });

  it('counts kills for the kins the Labyrinth is full of', () => {
    for (const metric of Object.values(KILL_METRIC)) expect(DEEDS.some((d) => d.metric === metric)).toBe(true);
  });
});
