import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayer } from './player';

function audio() {
  const gain = () => ({ gain: { value: 1 }, connect: vi.fn().mockReturnThis(), disconnect: vi.fn() });
  const source = () => ({ buffer: null, playbackRate: { value: 1 }, onended: null as (() => void) | null,
    connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() });
  const context = { state: 'running', currentTime: 12, destination: {}, createGain: vi.fn(gain),
    createBufferSource: vi.fn(source), decodeAudioData: vi.fn().mockResolvedValue({ duration: 0.5 }) };
  const fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  vi.stubGlobal('fetch', fetch);
  const player = createPlayer(context as unknown as AudioContext);
  return { context, fetch, player, sources: () => context.createBufferSource.mock.results.map(result => result.value) };
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('audio lifecycle', () => {
  it('does not download before asked; caches a decoded file across simultaneous plays', async () => {
    const { player, fetch, context, sources } = audio();
    expect(fetch).not.toHaveBeenCalled();
    player.play('anvil'); player.play('anvil');
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources()).toHaveLength(2);
  });

  it('stops sounding and scheduled layers immediately, then releases their nodes', async () => {
    const { player, context, sources } = audio();
    player.play('anvil'); player.play('chips', { delay: 420 });
    await flush();
    expect(sources()[1]!.start).toHaveBeenCalledWith(12.42);
    player.mute(true);
    expect(context.createGain.mock.results[0]!.value.gain.value).toBe(0);
    for (const source of sources()) {
      expect(source.stop).toHaveBeenCalledOnce(); expect(source.disconnect).toHaveBeenCalledOnce();
    }
    player.mute(false);
    expect(context.createGain.mock.results[0]!.value.gain.value).toBe(0.8);
    expect(sources()).toHaveLength(2); // Turning on must not replay them.
  });

  it('discards a pending decode even when sound is turned off and back on', async () => {
    const { player, context, sources } = audio();
    let decode!: (buffer: object) => void;
    context.decodeAudioData.mockReturnValue(new Promise(resolve => { decode = resolve; }));
    player.play('anvil'); await flush();
    player.mute(true); player.mute(false);
    decode({ duration: 1 }); await flush();
    expect(sources()).toHaveLength(0);
    player.play('anvil'); await flush();
    expect(sources()).toHaveLength(1);
  });

  it('releases a finished source without stopping it on the next mute', async () => {
    const { player, sources, context } = audio();
    player.play('anvil'); await flush();
    const source = sources()[0]!; source.onended!();
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(context.createGain.mock.results[1]!.value.disconnect).toHaveBeenCalledOnce();
    player.mute(true);
    expect(source.stop).not.toHaveBeenCalled();
  });

  it('stays quiet for unsupported codecs, failed requests and suspended audio', async () => {
    const { player, context, fetch, sources } = audio();
    context.decodeAudioData.mockRejectedValue(new Error('unsupported codec'));
    player.play('anvil'); await flush();
    fetch.mockResolvedValue({ ok: false, statusText: 'missing' });
    player.play('page'); await flush();
    context.state = 'suspended'; player.play('grave'); await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sources()).toHaveLength(0);
  });

  it('never downloads or plays new sounds while muted', async () => {
    const { player, fetch, sources } = audio();
    player.mute(true); player.prime(); player.play('anvil'); await flush();
    expect(fetch).not.toHaveBeenCalled(); expect(sources()).toHaveLength(0);
  });

  it('drops a hit whose download finishes after its visual moment', async () => {
    const { player, context, sources } = audio();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    let decode!: (buffer: object) => void;
    context.decodeAudioData.mockReturnValue(new Promise(resolve => { decode = resolve; }));
    player.play('anvil'); await flush();
    clock.mockReturnValue(1001); decode({ duration: 1 }); await flush();
    expect(sources()).toHaveLength(0);
  });
});
