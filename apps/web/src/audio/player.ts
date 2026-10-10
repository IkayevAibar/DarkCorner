import { FILES, type PlayOptions, type Sound } from './catalog';

const VARIED: ReadonlySet<Sound> = new Set(['door', 'step', 'hit', 'miss', 'die', 'tick', 'coins', 'loot']);
const LEVEL: Partial<Record<Sound, number>> = { tick: 0.35, step: 0.5, miss: 0.6, page: 0.7 };
const EARLY: Sound[] = ['door', 'hit', 'miss', 'die', 'coins', 'loot', 'tick'];

/** Loaded after the first tap. Only cosmetic variation happens here. */
export function createPlayer(context: AudioContext) {
  const output = context.createGain();
  output.gain.value = 0.8;
  output.connect(context.destination);
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const active = new Map<AudioBufferSourceNode, GainNode>();
  let muted = false, generation = 0;

  function release(source: AudioBufferSourceNode): void {
    source.onended = null;
    source.disconnect();
    active.get(source)?.disconnect();
    active.delete(source);
  }

  function load(file: string): Promise<AudioBuffer | null> {
    let buffer = buffers.get(file);
    if (!buffer) {
      buffer = fetch(`/sfx/${file}.ogg`)
        .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText)))
        .then(data => context.decodeAudioData(data))
        // Missing files and unsupported codecs must never interrupt a game action.
        .catch(() => null);
      buffers.set(file, buffer);
    }
    return buffer;
  }

  return {
    prime(): void { if (!muted) EARLY.forEach(sound => FILES[sound].forEach(load)); },
    mute(value: boolean): void {
      muted = value;
      output.gain.value = value ? 0 : 0.8;
      if (!value) return;
      generation++;
      for (const source of active.keys()) { source.stop(); release(source); }
    },
    play(sound: Sound, { volume = 1, rate, delay = 0 }: PlayOptions = {}): void {
      if (muted || context.state !== 'running') return;
      const stamp = generation, requestedAt = performance.now();
      const files = FILES[sound], file = files[Math.floor(Math.random() * files.length)]!;
      void load(file).then(buffer => {
        // No stale hit after a slow download, or after an off/on cycle during decode.
        if (!buffer || muted || stamp !== generation || context.state !== 'running' || performance.now() - requestedAt > 1000) return;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate ?? (VARIED.has(sound) ? 0.93 + Math.random() * 0.14 : 1);
        gain.gain.value = Math.max(0, Math.min(1, volume)) * (LEVEL[sound] ?? 1);
        source.connect(gain).connect(output);
        active.set(source, gain);
        source.onended = () => release(source);
        source.start(context.currentTime + Math.max(0, delay) / 1000);
      });
    },
  };
}
