import { describe, expect, it } from 'vitest';
import { NEWS } from './news';
import { LATEST_NEWS_ID } from './newsState';

describe("What's new", () => {
  it('marks the newest entry as the latest, and gives every entry its own id', () => {
    expect(NEWS[0]!.id).toBe(LATEST_NEWS_ID);
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
  });

  it('keeps the entries newest first', () => {
    const dates = NEWS.map((n) => n.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
