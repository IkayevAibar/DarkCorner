import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Combatant, FightEventView, FightReplay } from '@dark/shared';
import { useText } from '../../components/items/ItemChip';
import { BOSS_RING, MONSTER_RING, Token } from '../../components/Token';
import { useI18n } from '../../i18n';
import { buzz, play } from '../../sound';

/**
 * Plays a fight replay back, event by event.
 *
 * Stand-in until Codex's PixiJS FightScene lands (docs/tasks/codex-03-fight-scene.md):
 * same props, so swapping it is a one-line change in Labyrinth.tsx.
 */
export function FightPlayback({ replay, onDone }: { replay: FightReplay; onDone: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const [step, setStep] = useState(0);
  const finished = step >= replay.events.length;

  useEffect(() => {
    if (finished) return;
    const id = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : pause(replay.events[step - 1]!));
    return () => clearTimeout(id);
  }, [step, finished, replay.events]);

  const names = useMemo(() => displayNames(replay, text), [replay, text]);
  const frame = useMemo(() => frameAt(replay, step), [replay, step]);
  const event = step > 0 ? replay.events[step - 1]! : null;

  useEffect(() => {
    if (event) sound(event);
  }, [event]);
  const lines = useMemo(
    () => replay.events.slice(0, step).map((e) => describe(t, e, names)).filter((l): l is string => l !== null).slice(-4),
    [replay.events, step, t, names],
  );
  const size = replay.monsters.length <= 2 ? 84 : replay.monsters.length <= 4 ? 66 : 54;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={t('fight.title')}>
      <div className="grid w-full max-w-[540px] gap-3">
        <div className="relative aspect-square overflow-hidden rounded-[2px] border border-brass-dim shadow-[0_0_0_1px_#000,0_18px_40px_rgb(0_0_0/0.8)]">
          <img src={`/art/rooms/${replay.map}.jpg`} alt="" className="absolute inset-0 size-full object-cover brightness-[0.62]" draggable={false} />
          <div className="absolute inset-x-3 top-[9%] flex flex-wrap justify-center gap-x-3 gap-y-5">
            {replay.monsters.map((m) => (
              <Fighter
                key={m.key}
                who={m}
                name={names[m.key]!}
                hp={frame.hp[m.key]!}
                fallen={frame.fallen.has(m.key)}
                size={m.boss && replay.monsters.length === 1 ? 128 : size}
                event={event}
                step={step}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-[7%] flex justify-center">
            <Fighter
              who={replay.hero}
              name={names.hero!}
              hp={frame.hp.hero!}
              fallen={frame.heroDown}
              size={88}
              event={event}
              step={step}
              saves={frame.saves}
            />
          </div>
          {finished && (
            <div className="anim-pop absolute inset-x-0 top-1/2 -translate-y-1/2 bg-black/70 py-3 text-center">
              <span
                className={`font-head text-[34px] font-extrabold tracking-wide [text-shadow:0_2px_0_#000] ${
                  replay.outcome === 'victory' ? 'text-gold' : replay.outcome === 'dead' ? 'text-tier-mythic' : 'text-bone'
                }`}
              >
                {t(`fight.${replay.outcome}`)}
              </span>
            </div>
          )}
        </div>

        <div className="panel grid min-h-[104px] content-end gap-0.5 px-3 py-2 text-[15px]" aria-live="polite">
          {lines.map((line, i) => (
            <p key={`${step}-${i}`} className={`m-0 ${i === lines.length - 1 ? 'text-bone' : 'text-muted'}`}>{line}</p>
          ))}
        </div>

        {finished ? (
          <button type="button" className="btn btn-primary" onClick={onDone}>{t('report.dismiss')}</button>
        ) : (
          <button type="button" className="btn" onClick={onDone}>{t('fight.skip')}</button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Fighter({ who, name, hp, fallen, size, event, step, saves }: {
  who: Combatant;
  name: string;
  hp: number;
  fallen: boolean;
  size: number;
  event: FightEventView | null;
  step: number;
  saves?: { successes: number; failures: number } | null;
}) {
  const effect = effectOn(who.key, event);
  const ring = who.banner ?? (who.boss ? BOSS_RING : MONSTER_RING);
  const percent = who.maxHp > 0 ? Math.max(0, Math.min(100, (100 * hp) / who.maxHp)) : 0;
  return (
    <div className="relative grid justify-items-center gap-1" style={{ width: Math.max(size, 72) }}>
      <span key={effect?.shake ? step : 'still'} className={effect?.shake ? 'anim-shake' : ''}>
        <Token art={who.art} label={name} ring={ring} size={size} fallen={fallen} />
      </span>
      <span className="h-1.5 w-[80%] overflow-hidden rounded bg-black/70">
        <span className="block h-full bg-[linear-gradient(90deg,#7a1d1d,#d23a2a)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </span>
      <span className="max-w-full truncate rounded-[2px] bg-black/60 px-1.5 font-head text-xs font-bold text-bone">{name}</span>
      {saves && (
        <span className="rounded-[2px] bg-black/75 px-1.5 font-head text-xs font-bold">
          <span className="text-tier-uncommon">{'●'.repeat(saves.successes)}{'○'.repeat(3 - saves.successes)}</span>{' '}
          <span className="text-tier-mythic">{'●'.repeat(saves.failures)}{'○'.repeat(3 - saves.failures)}</span>
        </span>
      )}
      {effect?.float && (
        <span
          key={`f${step}`}
          className={`anim-float pointer-events-none absolute top-[18%] left-1/2 font-head font-extrabold [text-shadow:0_2px_0_#000,0_0_8px_#000] ${
            effect.float.tone === 'heal' ? 'text-tier-uncommon' : effect.float.tone === 'crit' ? 'text-gold' : 'text-[#ff6a55]'
          }`}
          style={{ fontSize: effect.float.tone === 'crit' ? 30 : 24 }}
        >
          {effect.float.text}
        </span>
      )}
      {effect?.d20 !== undefined && (
        <span
          key={`d${step}`}
          className={`anim-pop absolute -top-1 -right-1 grid size-8 place-items-center rounded-full border-2 bg-[#120f0c] font-head text-sm font-extrabold ${
            effect.d20 === 20 ? 'border-gold text-gold' : effect.d20 === 1 ? 'border-tier-mythic text-tier-mythic' : 'border-bone/60 text-bone'
          }`}
          title="d20"
        >
          {effect.d20}
        </span>
      )}
    </div>
  );
}

interface Frame {
  hp: Record<string, number>;
  fallen: Set<string>;
  heroDown: boolean;
  saves: { successes: number; failures: number } | null;
}

/** Everyone's state after the first `step` events. */
function frameAt(replay: FightReplay, step: number): Frame {
  const hp: Record<string, number> = { hero: replay.hero.hp };
  for (const m of replay.monsters) hp[m.key] = m.hp;
  const frame: Frame = { hp, fallen: new Set(), heroDown: false, saves: null };
  for (const e of replay.events.slice(0, step)) {
    switch (e.type) {
      case 'attack': hp[e.target] = e.targetHp; break;
      case 'burst': for (const x of e.targets) hp[x.key] = x.hp; break;
      case 'heal': hp[e.actor] = e.hp; break;
      case 'defeated': frame.fallen.add(e.key); break;
      case 'down': hp.hero = 0; frame.heroDown = true; frame.saves = { successes: 0, failures: 0 }; break;
      case 'death-save': frame.saves = { successes: e.successes, failures: e.failures }; break;
      case 'rise': hp.hero = e.hp; frame.heroDown = false; frame.saves = null; break;
      default: break;
    }
  }
  return frame;
}

interface Effect {
  shake?: boolean;
  float?: { text: string; tone: 'hit' | 'crit' | 'heal' };
  d20?: number;
}

/** What the latest event does to one token. */
function effectOn(key: string, event: FightEventView | null): Effect | null {
  if (!event) return null;
  switch (event.type) {
    case 'attack':
      if (event.actor === key) return { d20: event.natural };
      if (event.target === key) return event.hit
        ? { shake: true, float: { text: `−${event.damage}`, tone: event.crit ? 'crit' : 'hit' } }
        : { float: { text: '✕', tone: 'hit' } };
      return null;
    case 'burst': {
      const hit = event.targets.find((x) => x.key === key);
      return hit ? { shake: true, float: { text: `−${hit.damage}`, tone: 'hit' } } : null;
    }
    case 'heal':
      return event.actor === key ? { float: { text: `+${event.amount}`, tone: 'heal' } } : null;
    case 'death-save':
    case 'reroll':
      return key === 'hero' ? { d20: event.natural } : null;
    case 'down':
      return key === 'hero' ? { shake: true } : null;
    default:
      return null;
  }
}

/** The sound of each event as it shows. */
function sound(event: FightEventView): void {
  switch (event.type) {
    case 'initiative': play('draw'); break;
    case 'attack':
      if (!event.hit) play('miss');
      else if (event.crit) {
        play('crit');
        play('hit', { delay: 70 });
        if (event.actor === 'hero' && event.natural === 20) buzz(60);
      } else play('hit');
      break;
    case 'burst':
      play('hit', { rate: 0.8 });
      play('hit', { delay: 110 });
      break;
    case 'blocked': play('crit', { volume: 0.45, rate: 1.25 }); break;
    case 'defeated': play('loot', { rate: 0.75, volume: 0.7 }); break;
    case 'down': play('loot', { rate: 0.6 }); break;
    case 'death-save':
    case 'reroll':
      play('die');
      if (event.natural === 20) buzz([60, 40, 60]);
      break;
    case 'rise': play('equip'); break;
    case 'end':
      if (event.outcome === 'victory') play('coins', { delay: 150 });
      else if (event.outcome === 'dead') play('grave');
      break;
    default: break;
  }
}

/** How long each event stays on screen before the next. */
function pause(event: FightEventView): number {
  switch (event.type) {
    case 'initiative': return 700;
    case 'attack': return event.crit ? 1050 : 760;
    case 'burst': return 1000;
    case 'down': return 1100;
    case 'death-save': return 1100;
    case 'reroll': return 900;
    case 'rise': return 1000;
    case 'defeated': return 520;
    default: return 700;
  }
}

/** Monster names, numbered when several share one ("Goblin 1", "Goblin 2"). */
function displayNames(replay: FightReplay, text: ReturnType<typeof useText>): Record<string, string> {
  const names: Record<string, string> = { hero: text(replay.hero.name) };
  const count = new Map<string, number>();
  for (const m of replay.monsters) count.set(text(m.name), (count.get(text(m.name)) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const m of replay.monsters) {
    const base = text(m.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    names[m.key] = count.get(base)! > 1 ? `${base} ${n}` : base;
  }
  return names;
}

function describe(t: ReturnType<typeof useI18n>['t'], e: FightEventView, names: Record<string, string>): string | null {
  const n = (key: string) => names[key] ?? key;
  switch (e.type) {
    case 'initiative': return t('fight.initiative', { list: e.order.map(n).join(', ') });
    case 'attack':
      if (!e.hit) return t('fight.miss', { actor: n(e.actor), target: n(e.target), d: e.natural });
      if (e.crit) return t('fight.crit', { actor: n(e.actor), target: n(e.target), n: e.damage });
      return t(e.kind === 'spell' ? 'fight.spell' : 'fight.hit', { actor: n(e.actor), target: n(e.target), n: e.damage });
    case 'blocked': return t('fight.blocked', { actor: n(e.actor) });
    case 'burst': return t('fight.burst', { actor: n(e.actor), n: e.targets.reduce((s, x) => s + x.damage, 0) });
    case 'heal': return t(`fight.heal.${e.ability}`, { actor: n(e.actor), n: e.amount });
    case 'defeated': return t('fight.defeated', { name: n(e.key) });
    case 'down': return t('fight.down', { name: n('hero') });
    case 'death-save': return t('fight.deathSave', { d: e.natural, s: e.successes, f: e.failures });
    case 'rise': return t('fight.rise', { name: n('hero'), n: e.hp });
    case 'reroll': return t('fight.reroll', { name: n('hero'), d: e.natural });
    case 'end': return null;
  }
}
