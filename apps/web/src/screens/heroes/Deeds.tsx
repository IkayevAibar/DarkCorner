import type { DeedView, HeroView } from '@dark/shared';
import { api } from '../../api';
import { useText } from '../../components/items/text';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useI18n } from '../../i18n';
import { play } from '../../sound';

const share = (d: DeedView) => d.progress / d.target;

/** Deeds and Titles on the character sheet: how many are done, the Title worn, and the closest ones (docs/design.md → Deeds and Titles). */
export function DeedsPanel({ hero, onChanged }: { hero: HeroView; onChanged: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const done = hero.deeds.filter((d) => d.doneAt);
  const worn = hero.deeds.find((d) => d.id === hero.title) ?? null;
  const next = hero.deeds.filter((d) => !d.doneAt).sort((a, b) => share(b) - share(a)).slice(0, 3);
  const openAll = () => openSheet({
    title: t('deeds.title'),
    body: <DeedList hero={hero} onChanged={() => { closeSheet(); onChanged(); }} />,
  });

  return (
    <section className="panel grid gap-2.5 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sub-heading">{t('deeds.title')}</span>
        <span className="text-sm text-muted">{t('deeds.count', { n: done.length, m: hero.deeds.length })}</span>
      </div>
      <p className="m-0 text-sm">
        {worn ? t('deeds.wearing', { title: text(worn.title) }) : done.length > 0 ? t('deeds.choose') : t('deeds.none')}
      </p>
      <div className="grid gap-2">
        {next.map((d) => <DeedRow key={d.id} deed={d} />)}
      </div>
      <button type="button" className="btn" onClick={openAll}>{t('deeds.all')}</button>
    </section>
  );
}

/** Every Deed: the done ones first, with their Titles to wear, then the rest by how close they are. */
function DeedList({ hero, onChanged }: { hero: HeroView; onChanged: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const wear = async (deed: string | null) => {
    if (await run(() => api.setTitle(deed))) {
      play('equip');
      onChanged();
    }
  };
  const done = hero.deeds.filter((d) => d.doneAt);
  const open = hero.deeds.filter((d) => !d.doneAt).sort((a, b) => share(b) - share(a));

  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm text-muted">{t('deeds.intro')}</p>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      {hero.title && (
        <button type="button" className="btn" disabled={busy} onClick={() => void wear(null)}>{t('deeds.takeOff')}</button>
      )}
      {done.map((d) => (
        <DeedRow
          key={d.id}
          deed={d}
          action={d.id === hero.title
            ? <span className="chip border-gold text-gold">{t('deeds.worn')}</span>
            : <button type="button" className="btn btn-small" disabled={busy} onClick={() => void wear(d.id)}>{t('deeds.wear')}</button>}
        />
      ))}
      {open.map((d) => <DeedRow key={d.id} deed={d} />)}
    </div>
  );
}

function DeedRow({ deed, action }: { deed: DeedView; action?: React.ReactNode }) {
  const { t } = useI18n();
  const text = useText();
  const percent = Math.round(100 * share(deed));
  return (
    <div className={`grid gap-1 rounded-[2px] border p-2.5 ${deed.doneAt ? 'border-gold/50 bg-[rgb(224_184_106/0.06)]' : 'border-bone/15'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-head text-[15px] font-bold ${deed.doneAt ? 'text-gold' : ''}`}>{text(deed.title)}</span>
        {action ?? <span className="text-xs text-[#f1c75b]">{t('hero.gold', { n: deed.gold })}</span>}
      </div>
      <span className="text-sm text-muted">{text(deed.about)}</span>
      {!deed.doneAt && (
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
          <span className="h-1.5 overflow-hidden rounded bg-black/35">
            <span className="block h-full bg-[linear-gradient(90deg,#6d5a2a,#e2b23a)]" style={{ width: `${percent}%` }} />
          </span>
          <span className="font-head font-bold">{deed.progress.toLocaleString()}/{deed.target.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
