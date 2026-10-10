import { useState } from 'react';
import { ABILITY_IDS, type AbilityId, type GrowRequest, type HeroView, type PathIdView, type PathView, type TalentView } from '@dark/shared';
import { api } from '../../api';
import { useText } from '../../components/items/text';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useI18n } from '../../i18n';
import { play } from '../../sound';

const CAP = 20;

/** The Path chosen at level 3, or the two on offer; and any growth waiting to be chosen. */
export function Growth({ hero, onChanged }: { hero: HeroView; onChanged: () => void }) {
  return (
    <>
      {hero.pathChoices && <ChoosePath paths={hero.pathChoices} onChanged={onChanged} />}
      {hero.pendingGrowth.length > 0 && hero.talentOffer && <Grow hero={hero} level={hero.pendingGrowth[0]!} onChanged={onChanged} />}
      {hero.path && <PathPanel path={hero.path} />}
    </>
  );
}

function Features({ path }: { path: PathView }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {path.features.map((f) => (
        <li key={f.level} className={`text-sm leading-snug ${f.unlocked ? '' : 'opacity-60'}`}>
          <strong className="font-head">{text(f.name)}</strong>
          <span className="text-muted"> · {f.unlocked ? t('path.level', { n: f.level }) : t('path.locked', { n: f.level })}</span>
          <span className="block">{text(f.text)}</span>
        </li>
      ))}
    </ul>
  );
}

function PathPanel({ path }: { path: PathView }) {
  const { t } = useI18n();
  const text = useText();
  return (
    <section className="panel grid gap-2 p-3.5">
      <span className="sub-heading">{t('path.title')}</span>
      <div className="grid gap-0.5">
        <span className="font-head text-xl font-extrabold text-gold">{text(path.name)}</span>
        <span className="text-sm text-muted italic">{text(path.blurb)}</span>
      </div>
      <Features path={path} />
    </section>
  );
}

function ChoosePath({ paths, onChanged }: { paths: PathView[]; onChanged: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { openSheet, closeSheet } = useSheet();
  const confirm = (path: PathView) =>
    openSheet({
      title: t('path.confirmTitle', { name: text(path.name) }),
      body: <ConfirmPath path={path} onDone={() => { closeSheet(); onChanged(); }} />,
    });
  return (
    <section className="panel grid gap-3 border-gold p-3.5">
      <div className="grid gap-1">
        <span className="font-head text-xl font-extrabold text-gold">{t('path.choose')}</span>
        <p className="m-0 text-sm text-muted">{t('path.chooseHint')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {paths.map((path) => (
          <article key={path.id} className="grid content-start gap-2 rounded-[2px] border border-bone/25 p-3">
            <div className="grid gap-0.5">
              <span className="font-head text-lg font-extrabold">{text(path.name)}</span>
              <span className="text-sm text-muted italic">{text(path.blurb)}</span>
            </div>
            <Features path={path} />
            <button type="button" className="btn btn-primary" onClick={() => confirm(path)}>
              {t('path.take', { name: text(path.name) })}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfirmPath({ path, onDone }: { path: PathView; onDone: () => void }) {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  return (
    <div className="grid gap-4">
      <p className="m-0 text-muted">{t('path.confirmBody')}</p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => {
        await api.choosePath(path.id);
        play('reveal', { rate: 0.8 });
        play('chips', { delay: 250 });
        onDone();
      })}>
        {t('path.confirmYes')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

type GrowChoice = GrowRequest['choice'];

/** One growth level: +2 to one ability, +1 to two, or one of three Talents, chosen then confirmed. */
function Grow({ hero, level, onChanged }: { hero: HeroView; level: number; onChanged: () => void }) {
  const { t } = useI18n();
  const text = useText();
  const { busy, error, run } = useAction();
  const [choice, setChoice] = useState<GrowChoice | null>(null);
  const summary = growSummary(t, text, choice, hero.talentOffer ?? []);

  return (
    <section className="panel grid gap-3 border-gold p-3.5">
      <div className="grid gap-1">
        <span className="font-head text-xl font-extrabold text-gold">{t('grow.title', { n: level })}</span>
        <p className="m-0 text-sm text-muted">{t('grow.hint')}</p>
      </div>
      <GrowPicker abilities={hero.abilities} talents={hero.talentOffer!} value={choice} onChange={setChoice} disabled={busy} />
      <button type="button" className="btn btn-primary" disabled={busy || !choice} onClick={() => void run(async () => {
        await api.grow({ level, choice: choice! });
        play('chips');
        setChoice(null);
        onChanged();
      })}>
        {summary ? t('grow.applyWith', { choice: summary }) : t('grow.apply')}
      </button>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </section>
  );
}

/** "+2 STR", "+1 DEX and CON", or the Talent's name. */
export function growSummary(
  t: ReturnType<typeof useI18n>['t'], text: ReturnType<typeof useText>, choice: GrowChoice | null, talents: TalentView[],
): string | null {
  if (!choice) return null;
  if (choice.kind === 'ability') return t('grow.summaryOne', { ability: t(`ability.${choice.ability}`) });
  if (choice.kind === 'abilities') return t('grow.summaryTwo', { a: t(`ability.${choice.abilities[0]}`), b: t(`ability.${choice.abilities[1]}`) });
  const talent = talents.find((x) => x.id === choice.talent);
  return talent ? text(talent.name) : null;
}

/** The three ways to grow, as one selectable picker: +2 to one ability, +1 to two, or an offered Talent. */
export function GrowPicker({ abilities, talents, value, onChange, disabled }: {
  abilities: HeroView['abilities'];
  talents: TalentView[];
  value: GrowChoice | null;
  onChange: (choice: GrowChoice | null) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const text = useText();
  const [pair, setPair] = useState<AbilityId[]>([]);
  const score = (a: AbilityId) => abilities[a];
  const choice = value;
  const setChoice = onChange;
  const busy = disabled;

  const pickPair = (a: AbilityId) => {
    const next = pair.includes(a) ? pair.filter((x) => x !== a) : [...pair, a].slice(-2);
    setPair(next);
    setChoice(next.length === 2 ? { kind: 'abilities', abilities: [next[0]!, next[1]!] } : null);
  };

  const selected = (kind: string, key: string) =>
    choice?.kind === kind && ((choice.kind === 'ability' && choice.ability === key) || (choice.kind === 'talent' && choice.talent === key));

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="sub-heading">{t('grow.plusTwo')}</span>
        <div className="grid grid-cols-6 gap-1.5">
          {ABILITY_IDS.map((a) => (
            <button
              key={a}
              type="button"
              className={`btn btn-small grid gap-0 px-0 ${selected('ability', a) ? 'btn-primary' : ''}`}
              disabled={busy || score(a) + 2 > CAP}
              onClick={() => { setPair([]); setChoice({ kind: 'ability', ability: a }); }}
            >
              <span className="text-[11px]">{t(`ability.${a}`)}</span>
              <span>{score(a)}→{Math.min(CAP, score(a) + 2)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="sub-heading">{t('grow.plusOne')}</span>
        <div className="grid grid-cols-6 gap-1.5">
          {ABILITY_IDS.map((a) => (
            <button
              key={a}
              type="button"
              className={`btn btn-small grid gap-0 px-0 ${pair.includes(a) ? 'btn-primary' : ''}`}
              disabled={busy || score(a) + 1 > CAP}
              aria-pressed={pair.includes(a)}
              onClick={() => pickPair(a)}
            >
              <span className="text-[11px]">{t(`ability.${a}`)}</span>
              <span>{score(a)}→{Math.min(CAP, score(a) + 1)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="sub-heading">{t('grow.talent')}</span>
        {talents.map((talent) => (
          <button
            key={talent.id}
            type="button"
            className={`btn grid justify-items-start gap-0.5 text-left ${selected('talent', talent.id) ? 'btn-primary' : ''}`}
            disabled={busy}
            onClick={() => { setPair([]); setChoice({ kind: 'talent', talent: talent.id }); }}
          >
            <span>{text(talent.name)}</span>
            <span className="text-xs font-normal normal-case text-muted">{text(talent.description)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The Class's two Paths side by side, one to select. */
export function PathPicker({ paths, value, onChange }: { paths: PathView[]; value: PathIdView | null; onChange: (path: PathIdView) => void }) {
  const text = useText();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {paths.map((path) => (
        <button
          key={path.id}
          type="button"
          aria-pressed={value === path.id}
          onClick={() => onChange(path.id)}
          className={`grid content-start gap-2 rounded-[2px] border p-3 text-left ${value === path.id ? 'border-gold bg-[#241c12] shadow-[0_0_14px_rgb(224_184_106/0.25)]' : 'border-bone/25 bg-transparent'}`}
        >
          <div className="grid gap-0.5">
            <span className="font-head text-lg font-extrabold">{text(path.name)}</span>
            <span className="text-sm text-muted italic">{text(path.blurb)}</span>
          </div>
          <Features path={path} />
        </button>
      ))}
    </div>
  );
}
