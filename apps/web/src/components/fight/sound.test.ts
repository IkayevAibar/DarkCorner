import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sound } from './presentation';
import { buzz, play } from '../../sound';

vi.mock('../../sound', () => ({ buzz: vi.fn(), play: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe('fight sound cues', () => {
  it.each(['hero', 'ally', 'm0'])('vibrates for a Hero’s natural 20, including the Partner (%s)', actor => {
    sound({ type: 'attack', actor, target: 'm1', natural: 20, total: 24, hit: true, crit: true, damage: 8, targetHp: 0, kind: 'weapon' });
    expect(play).toHaveBeenCalledWith('crit');
    expect(buzz).toHaveBeenCalledTimes(actor === 'm0' ? 0 : 1);
  });

  it('does not vibrate on an expanded critical range without a natural 20', () => {
    sound({ type: 'attack', actor: 'hero', target: 'm0', natural: 19, total: 23, hit: true, crit: true, damage: 8, targetHp: 0, kind: 'weapon' });
    expect(play).toHaveBeenCalledWith('crit'); expect(buzz).not.toHaveBeenCalled();
  });

  it('plays and vibrates on the Partner’s Save, Escape roll and Pull up natural 20', () => {
    const roll = { actor: 'ally' as const, natural: 20, total: 22, dc: 15, success: true };
    sound({ type: 'save', ability: 'wis', ...roll });
    sound({ type: 'escape', ...roll });
    sound({ type: 'revive', target: 'hero', hp: 1, ...roll });
    expect(vi.mocked(play).mock.calls.filter(([name]) => name === 'die')).toHaveLength(3);
    expect(buzz).toHaveBeenCalledTimes(3);
  });
});
