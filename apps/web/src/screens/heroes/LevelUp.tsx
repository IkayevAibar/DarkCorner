import { useState } from 'react';
import type { GrowRequest, HeroView, LevelUpResponse, PathIdView } from '@dark/shared';
import { api } from '../../api';
import { useText } from '../../components/items/text';
import { useAction } from '../../components/useAction';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { GrowPicker, PathPicker, growSummary } from './Growth';

/**
 * The next level, as in Baldur's Gate 3: what it gives, its choice, and a button
 * to take it; then what the dice gave. Levels are taken one at a time, so a Hero
 * with XP for more goes straight on to the next (docs/design.md → Levels).
 */
export function LevelUp({ hero: start, onChanged, onClose }: { hero: HeroView; onChanged: () => void; onClose: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { busy, error, run } = useAction();
  const [hero, setHero] = useState(start);
  const [path, setPath] = useState<PathIdView | null>(null);
  const [grow, setGrow] = useState<GrowRequest['choice'] | null>(null);
  const [done, setDone] = useState<LevelUpResponse | null>(null);

  if (done) {
    const next = done.hero.levelUp;
    // A low roll counts as the die's average: say so, or "+9 from a 1" reads wrong.
    const average = done.health.die / 2 + 1;
    return (
      <div className="grid gap-4 text-center">
        <span className="font-head text-4xl font-extrabold text-gold">{t('levelUp.done', { n: done.hero.level })}</span>
        <p className="m-0 text-[15px]">
          {done.health.roll < average
            ? t('levelUp.healthFloor', { gain: done.health.gain, die: done.health.die, roll: done.health.roll, avg: average })
            : t('levelUp.health', { gain: done.health.gain, die: done.health.die, roll: done.health.roll })}
        </p>
        <p className="m-0 text-sm text-muted">{t('levelUp.nowHealth', { hp: done.hero.hp, max: done.hero.maxHp })}</p>
        {next ? (
          <button type="button" className="btn btn-primary" onClick={() => { setHero(done.hero); setDone(null); setPath(null); setGrow(null); }}>
            {t('levelUp.next', { n: next.level })}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onClose}>{t('levelUp.close')}</button>
        )}
      </div>
    );
  }

  const offer = hero.levelUp;
  if (!offer) return null;
  const ready = offer.choice === 'path' ? path !== null : offer.choice === 'growth' ? grow !== null : true;
  const chosen = offer.choice === 'path'
    ? (offer.paths?.find((p) => p.id === path) ? text(offer.paths.find((p) => p.id === path)!.name) : null)
    : growSummary(t, text, grow, offer.talents ?? []);

  return (
    <div className="grid gap-4">
      <span className="font-head text-3xl font-extrabold text-gold">{t('levelUp.title', { n: offer.level })}</span>
      <section className="grid gap-1.5">
        <span className="sub-heading">{t('levelUp.gains')}</span>
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {offer.gains.map((gain) => (
            <li key={gain.en} className="text-[15px] leading-snug">
              <span className="text-gold">✦ </span>
              {text(gain)}
            </li>
          ))}
        </ul>
      </section>

      {offer.choice === 'path' && offer.paths && (
        <section className="grid gap-2">
          <span className="sub-heading">{t('levelUp.choosePath')}</span>
          <p className="m-0 text-sm text-muted">{t('path.chooseHint')}</p>
          <PathPicker paths={offer.paths} value={path} onChange={setPath} />
        </section>
      )}
      {offer.choice === 'growth' && offer.talents && (
        <section className="grid gap-2">
          <span className="sub-heading">{t('levelUp.chooseGrowth')}</span>
          <GrowPicker abilities={hero.abilities} talents={offer.talents} value={grow} onChange={setGrow} disabled={busy} />
        </section>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !ready}
        onClick={() => void run(async () => {
          const result = await api.levelUp({ ...(path ? { path } : {}), ...(grow ? { grow } : {}) });
          play('reveal', { rate: 0.8 });
          play('chips', { delay: 250 });
          setDone(result);
          onChanged();
        })}
      >
        {chosen ? t('levelUp.takeWith', { n: offer.level, choice: chosen }) : ready ? t('levelUp.take', { n: offer.level }) : t('levelUp.chooseFirst')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}
