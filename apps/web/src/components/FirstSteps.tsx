import { useState } from 'react';
import type { StepClaimResult, StepView } from '@dark/shared';
import { api } from '../api';
import { useI18n } from '../i18n';
import { play } from '../sound';
import { useAction } from './useAction';
import { useLoad } from './useLoad';

/**
 * First steps (docs/design.md → First steps): the next goal of a new Hero's first
 * hour with its reward, and the whole list on demand. Rewards that are ready come
 * first. Gone once every reward is claimed.
 */
export function FirstSteps() {
  const { t, locale } = useI18n();
  const text = (v: StepView['name']) => v[locale];
  const { data, setData } = useLoad(api.steps);
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<StepClaimResult | null>(null);
  if (!data) return null;
  const steps = data.steps;
  const claimedCount = steps.filter((s) => s.claimed).length;
  if (claimedCount === steps.length && !got) return null;
  const next = steps.find((s) => s.done && !s.claimed) ?? steps.find((s) => !s.done);

  const claim = (id: string) => void run(async () => {
    const result = await api.claimStep(id);
    setData(result.view);
    setGot(result);
    play('coins');
  });

  return (
    <section className="panel grid gap-2.5 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sub-heading">{t('steps.title')}</span>
        <span className="text-xs text-muted">{t('steps.progress', { n: claimedCount, of: steps.length })}</span>
      </div>
      {got && (
        <p className="m-0 text-sm text-gold">
          {t('steps.got', { reward: [...got.loot.map((i) => `${i.name[locale]}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`), ...(got.gold ? [t('steps.gold', { n: got.gold })] : [])].join(', ') })}
        </p>
      )}
      {next && (
        <div className="grid gap-1.5">
          <span className="font-head text-lg leading-tight font-extrabold">{text(next.name)}</span>
          {!next.done && <span className="text-sm text-muted">{text(next.how)}</span>}
          {next.done ? (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => claim(next.id)}>
              {t('steps.claim', { reward: text(next.reward) })}
            </button>
          ) : (
            <span className="text-sm">{t('steps.reward', { reward: text(next.reward) })}</span>
          )}
        </div>
      )}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      <button type="button" className="btn btn-small justify-self-start" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t('steps.hide') : t('steps.all', { n: data.ready })}
      </button>
      {open && (
        <ol className="m-0 grid list-none gap-1.5 p-0">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full border font-head text-xs font-extrabold ${
                  s.claimed ? 'border-tier-uncommon text-tier-uncommon' : s.done ? 'border-gold text-gold' : 'border-line text-muted'
                }`}
                aria-hidden="true"
              >
                {s.claimed ? '✓' : s.done ? '!' : ''}
              </span>
              <span className={`min-w-0 flex-1 ${s.claimed ? 'text-muted line-through' : ''}`}>
                {text(s.name)} <span className="text-xs text-muted">· {text(s.reward)}</span>
              </span>
              {s.done && !s.claimed && (
                <button type="button" className="btn btn-small btn-primary shrink-0" disabled={busy} onClick={() => claim(s.id)}>{t('steps.take')}</button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
