import { useState } from 'react';
import type { AbilityId, ClassId, HeroDraft, LocalizedText, RaceId, TalentId } from '@dark/shared';
import { api } from '../../api';
import { useSheet } from '../../components/Sheet';
import { useAction } from '../../components/useAction';
import { useLoad } from '../../components/useLoad';
import { useI18n } from '../../i18n';
import { useSession } from '../../session';
import { play } from '../../sound';

/**
 * A Hero in one tap (docs/design.md → Creating a hero): a Class, a name, and the
 * rest chosen well for it. It rolls and keeps ability sets the way a Player may,
 * so the Hero is made by the same rules as one built step by step.
 */
const PICKS: Record<ClassId, { race: RaceId; talents: TalentId[]; banner: string; fallbackName: string }> = {
  fighter: { race: 'human', talents: ['tough', 'savage-attacker'], banner: '#9e2a2a', fallbackName: 'Garrick' },
  rogue: { race: 'halfling', talents: ['alert'], banner: '#3f7a4a', fallbackName: 'Pip' },
  wizard: { race: 'elf', talents: ['tough'], banner: '#3b5fa8', fallbackName: 'Ilyra' },
  cleric: { race: 'dwarf', talents: ['lucky-charm'], banner: '#b08a2e', fallbackName: 'Borin' },
  barbarian: { race: 'dwarf', talents: ['tough'], banner: '#c2682b', fallbackName: 'Hrolf' },
  ranger: { race: 'elf', talents: ['alert'], banner: '#2f7f86', fallbackName: 'Tamsin' },
};
const CLASSES: ClassId[] = ['fighter', 'rogue', 'wizard', 'cleric', 'barbarian', 'ranger'];
/** `wears`: the Class whose portraits it wears (a new Class borrows a painted one's until its own are in). */
const portraitOf = (cls: ClassId, wears: ClassId) => `${PICKS[cls].race}-${wears}-1`;

/** A Discord name made fit for a Hero ("nova_star.99" becomes "nova star 99"): letters, digits, spaces, hyphens and apostrophes, 2–20 of them. */
function heroName(from: string | undefined, cls: ClassId): string {
  const name = (from ?? '').replace(/[_.]+/g, ' ').replace(/[^\p{L}\p{N}' -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim();
  return name.length >= 2 ? name : PICKS[cls].fallbackName;
}

/** Uses every reroll, then the set best for the Class: its main ability first, then CON, then the total. */
async function bestSet(primary: AbilityId): Promise<number> {
  let { draft } = await api.startDraft();
  while (draft.rerollsLeft > 0) draft = (await api.rerollDraft()).draft;
  const score = (set: HeroDraft['sets'][number]) => set.scores[primary] * 10_000 + set.scores.con * 100 + set.total;
  return draft.sets.reduce((best, set, i) => (score(set) > score(draft.sets[best]!) ? i : best), 0);
}

/** Six Classes to pick from, each with its portrait and what it's good at. */
export function QuickStart({ onCreated, onCustom }: { onCreated: () => void; onCustom: () => void }) {
  const { t, locale } = useI18n();
  const text = (value: LocalizedText) => value[locale];
  const { openSheet, closeSheet } = useSheet();
  const options = useLoad(api.heroOptions);
  const classes = options.data?.classes ?? [];
  const choose = (cls: ClassId) => {
    play('page');
    const def = classes.find((c) => c.id === cls)!;
    openSheet({
      title: text(def.name),
      body: <Begin cls={cls} wears={def.wears} onCreated={() => { closeSheet(); onCreated(); }} onCustom={() => { closeSheet(); onCustom(); }} />,
    });
  };

  return (
    <section className="panel grid gap-3 p-3.5">
      <div className="grid gap-1">
        <span className="sub-heading">{t('quick.title')}</span>
        <p className="m-0 text-sm">{t('quick.body')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CLASSES.map((cls) => {
          const def = classes.find((c) => c.id === cls);
          return (
            <button
              key={cls}
              type="button"
              className="btn grid content-start justify-items-center gap-1 p-2 font-body font-normal normal-case"
              disabled={!def}
              onClick={() => choose(cls)}
            >
              {def ? (
                <img
                  src={`/art/portraits/${portraitOf(cls, def.wears)}.webp`}
                  alt=""
                  className="aspect-[4/5] w-full rounded-[2px] border object-cover object-[50%_30%]"
                  style={{ borderColor: PICKS[cls].banner }}
                />
              ) : (
                <span className="aspect-[4/5] w-full rounded-[2px] border" style={{ borderColor: PICKS[cls].banner }} />
              )}
              <span className="font-head text-base font-extrabold tracking-wide uppercase">{def ? text(def.name) : '…'}</span>
              <span className="text-xs leading-snug text-muted">{t(`quick.${cls}`)}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn btn-small justify-self-center" onClick={onCustom}>{t('quick.custom')}</button>
    </section>
  );
}

/** The last step: a name (the Player's own by default), then into the game. */
function Begin({ cls, wears, onCreated, onCustom }: { cls: ClassId; wears: ClassId; onCreated: () => void; onCustom: () => void }) {
  const { t } = useI18n();
  const { session } = useSession();
  const pick = PICKS[cls];
  const [name, setName] = useState(() => heroName(session.state === 'signedIn' ? session.player.name : undefined, cls));
  const { busy, error, run } = useAction();
  const primary: Record<ClassId, AbilityId> = { fighter: 'str', rogue: 'dex', wizard: 'int', cleric: 'wis', barbarian: 'str', ranger: 'dex' };
  const valid = /^[\p{L}\p{N}' -]{2,20}$/u.test(name.trim());

  const begin = async () => {
    const made = await run(async () => {
      const set = await bestSet(primary[cls]);
      return api.createHero({
        name: name.trim(), race: pick.race, class: cls, talents: pick.talents, portrait: portraitOf(cls, wears), banner: pick.banner, set,
      });
    });
    if (made) {
      play('equip');
      onCreated();
    }
  };

  return (
    <div className="grid gap-3">
      <img
        src={`/art/portraits/${portraitOf(cls, wears)}.webp`}
        alt=""
        className="mx-auto aspect-[4/5] w-40 rounded-[2px] border-2 object-cover object-[50%_30%]"
        style={{ borderColor: pick.banner }}
      />
      <p className="m-0 text-center text-sm">{t(`quick.${cls}`)}</p>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t('quick.name')}</span>
        <input className="field" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
      </label>
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
      <button type="button" className="btn btn-primary" disabled={busy || !valid} onClick={() => void begin()}>
        {busy ? t('quick.making') : t('quick.begin')}
      </button>
      <p className="m-0 text-center text-xs text-muted">{t('quick.note')}</p>
      <button type="button" className="btn btn-small justify-self-center" disabled={busy} onClick={onCustom}>{t('quick.custom')}</button>
    </div>
  );
}
