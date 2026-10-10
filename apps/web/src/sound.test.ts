import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const engine = vi.hoisted(() => ({ prime: vi.fn(), mute: vi.fn(), play: vi.fn() }));
vi.mock('./audio/player', () => ({ createPlayer: () => engine }));

let gestures: EventTarget;
let context: { state: string; resume: ReturnType<typeof vi.fn> };
let construct: ReturnType<typeof vi.fn>;
let vibrate: ReturnType<typeof vi.fn>;
let setting: Map<string, string>;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  gestures = new EventTarget();
  context = { state: 'running', resume: vi.fn().mockResolvedValue(undefined) };
  construct = vi.fn(function () { return context; });
  vi.stubGlobal('window', { AudioContext: construct, addEventListener: gestures.addEventListener.bind(gestures) });
  vibrate = vi.fn(); vi.stubGlobal('navigator', { vibrate });
  setting = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => setting.get(key), setItem: (key: string, value: string) => setting.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe('sound switch and unlock', () => {
  it('creates and resumes audio synchronously in the gesture, with no pre-tap queue', async () => {
    const { play } = await import('./sound');
    play('hit'); await flush();
    expect(construct).not.toHaveBeenCalled();
    expect(engine.play).not.toHaveBeenCalled();
    context.state = 'suspended'; gestures.dispatchEvent(new Event('pointerup'));
    expect(construct).toHaveBeenCalledOnce(); expect(context.resume).toHaveBeenCalledOnce();
    context.state = 'running'; await flush();
    expect(engine.prime).toHaveBeenCalledOnce();
    play('hit'); expect(engine.play).toHaveBeenCalledWith('hit', undefined);
  });

  it('remembers off across reloads and cancels vibration as well as audio', async () => {
    setting.set('dc.sound', 'off');
    const { play, buzz, setSoundOn } = await import('./sound');
    gestures.dispatchEvent(new Event('click')); play('hit'); buzz(60);
    expect(construct).not.toHaveBeenCalled(); expect(vibrate).not.toHaveBeenCalled();
    setSoundOn(true); await flush(); play('hit'); buzz(60); setSoundOn(false);
    expect(setting.get('dc.sound')).toBe('off');
    expect(engine.mute).toHaveBeenLastCalledWith(true);
    expect(vibrate.mock.calls).toEqual([[60], [0]]);
    play('grave'); buzz([70, 50, 140]);
    expect(engine.play).toHaveBeenCalledOnce(); expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('does not release a queued cue after off/on while the mixer imports', async () => {
    const { play, setSoundOn } = await import('./sound');
    gestures.dispatchEvent(new Event('pointerup'));
    play('hit'); setSoundOn(false); setSoundOn(true); await flush();
    expect(engine.play).not.toHaveBeenCalled();
    play('hit'); expect(engine.play).toHaveBeenCalledOnce();
  });

  it('resumes again after a background interruption without creating another context', async () => {
    await import('./sound');
    gestures.dispatchEvent(new Event('click')); await flush();
    context.state = 'suspended'; gestures.dispatchEvent(new Event('pointerup'));
    expect(construct).toHaveBeenCalledOnce(); expect(context.resume).toHaveBeenCalledOnce();
  });

  it('layers Tiers and respects mute even if storage and vibration throw', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('private'); }, setItem: () => { throw Error('private'); } });
    vibrate.mockImplementation(() => { throw Error('unsupported'); });
    const { playTier, setSoundOn } = await import('./sound');
    gestures.dispatchEvent(new Event('click')); await flush();
    playTier('common'); expect(engine.play).toHaveBeenCalledTimes(1);
    engine.play.mockClear(); playTier('relic'); expect(engine.play).toHaveBeenCalledTimes(4);
    expect(vibrate).toHaveBeenCalledWith([70, 50, 140]);
    engine.play.mockClear(); setSoundOn(false); playTier('mythic'); expect(engine.play).not.toHaveBeenCalled();
  });
});
