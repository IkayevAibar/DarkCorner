import { type ReactNode, useState } from 'react';
import {
  ABILITY_IDS, type AbilitySetView, type ClassId, type CreationOptions, type HeroDraft, type RaceId, type TalentId,
} from '@dark/shared';
import { api, ApiRequestError } from '../../api';
import { useText } from '../../components/items/ItemChip';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n/en';

const STEPS = ['race', 'class', 'abilities', 'talents', 'look', 'confirm'] as const;
type Step = (typeof STEPS)[number];

const modifier = (score: number) => {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : String(m);
};

/**
 * Hero creation, one step at a time so each fits a phone screen. Ability sets
 * are rolled by the server (the draft); this screen only chooses among them.
 * Codex polishes the pickers and adds the dice animation (docs/tasks).
 */
export function CreateHero({ options, initialDraft, onCreated }: {
  options: CreationOptions;
  initialDraft: HeroDraft | null;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const text = useText();
  const [step, setStep] = useState(0);
  const [race, setRace] = useState<RaceId | null>(null);
  const [cls, setCls] = useState<ClassId | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [setIndex, setSetIndex] = useState(initialDraft ? initialDraft.sets.length - 1 : 0);
  const [talents, setTalents] = useState<TalentId[]>([]);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [banner, setBanner] = useState(options.banners[0] ?? '#9e2a2a');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const picks = options.races.find((r) => r.id === race)?.talentPicks ?? 1;
  const portraits = options.portraits.filter(
    (p) => (p.race === race && p.class === cls) || (p.race === null && p.class === null),
  );
  const current: Step = STEPS[step]!;
  const ready: Record<Step, boolean> = {
    race: race !== null,
    class: cls !== null,
    abilities: draft !== null,
    talents: talents.length === picks,
    look: portrait !== null && portraits.some((p) => p.id === portrait) && name.trim().length >= 2,
    confirm: true,
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const reason = e instanceof ApiRequestError ? (e.body?.error ?? String(e.status)) : String(e);
      setError(t('create.failed', { reason }));
    } finally {
      setBusy(false);
    }
  };

  const roll = () => run(async () => {
    const { draft: next } = draft ? await api.rerollDraft() : await api.startDraft();
    setDraft(next);
    setSetIndex(next.sets.length - 1);
  });

  const submit = () => run(async () => {
    await api.createHero({ name: name.trim(), race: race!, class: cls!, talents, portrait: portrait!, banner, set: setIndex });
    onCreated();
  });

  const chooseRace = (id: RaceId) => {
    setRace(id);
    const allowed = options.races.find((r) => r.id === id)?.talentPicks ?? 1;
    setTalents((prev) => prev.slice(0, allowed));
  };

  const toggleTalent = (id: TalentId) =>
    setTalents((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < picks ? [...prev, id] : prev));

  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <h1 className="m-0 font-head text-2xl font-extrabold text-[#e8cf9a]">{t('create.title')}</h1>
        <ol className="m-0 flex list-none gap-1 p-0">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brass' : i === step ? 'bg-gold' : 'bg-line'}`}
              title={t(`create.step.${s}` as MessageKey)}
            />
          ))}
        </ol>
        <span className="sub-heading">{t(`create.step.${current}` as MessageKey)}</span>
      </header>

      {current === 'race' && (
        <div className="grid gap-2">
          {options.races.map((r) => (
            <Choice key={r.id} selected={race === r.id} onClick={() => chooseRace(r.id)} title={text(r.name)} body={text(r.trait)} />
          ))}
        </div>
      )}

      {current === 'class' && (
        <div className="grid gap-2">
          {options.classes.map((c) => (
            <Choice
              key={c.id}
              selected={cls === c.id}
              onClick={() => setCls(c.id)}
              title={text(c.name)}
              aside={t('create.hitDie', { n: c.hitDie })}
              body={
                <>
                  <span className="block"><b>{t('create.inFights')}:</b> {text(c.fights)}</span>
                  <span className="block"><b>{t('create.inLabyrinth')}:</b> {text(c.trick)}</span>
                </>
              }
            />
          ))}
        </div>
      )}

      {current === 'abilities' && (
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted">{t('create.rollHint')}</p>
          {draft?.sets.map((set, i) => (
            <AbilitySetCard key={i} set={set} selected={i === setIndex} onClick={() => setSetIndex(i)} />
          ))}
          <button type="button" className={`btn ${draft ? '' : 'btn-primary'}`} disabled={busy || (draft !== null && draft.rerollsLeft === 0)} onClick={() => void roll()}>
            {!draft ? t('create.roll') : draft.rerollsLeft > 0 ? t('create.reroll', { n: draft.rerollsLeft }) : t('create.noRerolls')}
          </button>
        </div>
      )}

      {current === 'talents' && (
        <div className="grid gap-2">
          <span className="text-sm text-muted">{t('create.pickTalents', { n: picks })}</span>
          {options.talents.map((tal) => (
            <Choice
              key={tal.id}
              selected={talents.includes(tal.id)}
              onClick={() => toggleTalent(tal.id)}
              title={text(tal.name)}
              body={text(tal.description)}
            />
          ))}
        </div>
      )}

      {current === 'look' && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <span className="text-sm text-muted">{t('create.portrait')}</span>
            <div className="flex flex-wrap gap-3">
              {portraits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPortrait(p.id)}
                  className={`size-[84px] overflow-hidden rounded-full border-[3px] bg-[#0c0a08] p-0 transition-transform ${portrait === p.id ? 'scale-105' : 'opacity-70'}`}
                  style={{ borderColor: portrait === p.id ? banner : '#3a3026', boxShadow: portrait === p.id ? `0 0 18px ${banner}` : undefined }}
                >
                  <img src={p.url} alt="" className="size-full scale-125 object-cover object-[50%_42%]" />
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">{t('create.name')}</span>
            <input className="field" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid gap-2">
            <span className="text-sm text-muted">{t('create.banner')}</span>
            <div className="flex flex-wrap gap-2">
              {options.banners.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => setBanner(color)}
                  className={`size-9 rounded-full border-2 p-0 ${banner === color ? 'border-bone' : 'border-transparent'}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {current === 'confirm' && draft && race && cls && (
        <div className="panel grid gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="size-[72px] shrink-0 overflow-hidden rounded-full border-[3px] bg-[#0c0a08]" style={{ borderColor: banner }}>
              <img src={portraits.find((p) => p.id === portrait)?.url} alt="" className="size-full scale-125 object-cover object-[50%_42%]" />
            </span>
            <div className="grid">
              <span className="font-head text-2xl font-extrabold">{name.trim()}</span>
              <span className="text-sm text-muted">
                {text(options.races.find((r) => r.id === race)!.name)} · {text(options.classes.find((c) => c.id === cls)!.name)}
              </span>
            </div>
          </div>
          <AbilitySetCard set={draft.sets[setIndex]!} selected />
          <span className="text-sm">
            {talents.map((id) => text(options.talents.find((x) => x.id === id)!.name)).join(' · ')}
          </span>
        </div>
      )}

      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}

      <footer className="flex gap-2">
        <button type="button" className="btn flex-1" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
          {t('create.back')}
        </button>
        {current === 'confirm' ? (
          <button type="button" className="btn btn-primary flex-[2]" disabled={busy} onClick={() => void submit()}>
            {t('create.submit')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary flex-[2]" disabled={!ready[current] || busy} onClick={() => setStep((s) => s + 1)}>
            {t('create.next')}
          </button>
        )}
      </footer>
    </section>
  );
}

function Choice({ selected, onClick, title, body, aside }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: ReactNode;
  aside?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid gap-1 rounded-[2px] border p-3 text-left transition-colors ${
        selected ? 'border-gold bg-[#241c12] shadow-[0_0_14px_rgb(224_184_106/0.25)]' : 'border-line bg-panel'
      }`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-head text-lg font-extrabold">{title}</span>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </span>
      <span className="text-sm text-muted">{body}</span>
    </button>
  );
}

function AbilitySetCard({ set, selected, onClick }: { set: AbilitySetView; selected: boolean; onClick?: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`grid gap-2 rounded-[2px] border p-2.5 text-left disabled:cursor-default ${selected ? 'border-gold bg-[#241c12]' : 'border-line bg-panel'}`}
    >
      <div className="grid grid-cols-6 gap-1">
        {ABILITY_IDS.map((a) => {
          const roll = set.rolls[a];
          return (
            <div key={a} className="grid justify-items-center gap-0.5 rounded-[2px] border border-line/70 py-1">
              <span className="text-[11px] font-bold tracking-wide text-muted">{t(`ability.${a}`)}</span>
              <span className="font-head text-xl leading-none font-extrabold">{set.scores[a]}</span>
              <span className="text-[11px] text-muted">{modifier(set.scores[a])}</span>
              <span className="flex gap-px">
                {roll.dice.map((d, i) => (
                  <span key={i} className={`grid size-3 place-items-center rounded-[2px] bg-[#1b1611] text-[8px] font-extrabold ${i === roll.dropped ? 'opacity-30 line-through' : ''}`}>
                    {d}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <span className="text-right text-xs text-muted">{t('create.total', { n: set.total })}</span>
    </button>
  );
}
