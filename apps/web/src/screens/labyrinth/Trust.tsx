import { useEffect, useRef } from 'react';
import type { DuoChestView, LabyrinthResult, LabyrinthView, OathChoice } from '@dark/shared';
import { api } from '../../api';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { OathScene } from './trust/OathScene';
import { ChestScene } from './trust/ChestScene';
import { useTrustText } from './trust/messages';

type Act = (call: () => Promise<LabyrinthResult>) => Promise<void>;

/** The existing API callbacks stay here; scenes receive only visible server state. */
export function OathPanel({ view, busy, act }: { view: LabyrinthView; busy: boolean; act: Act }) {
  return <OathChoices view={view} busy={busy} onSwear={choice => void act(async () => {
    const result = await api.swear(choice);
    play('latch', { rate: .8 });
    return result;
  })} />;
}

export function OathChoices({ view, busy, onSwear }: { view: LabyrinthView; busy: boolean; onSwear: (choice: OathChoice) => void }) {
  const { locale } = useI18n(), t = useTrustText();
  const oath = view.room!.oath!, partner = view.duo?.name ?? '';
  const pending = useRef(false);
  useEffect(() => { if (!busy) pending.current = false; }, [busy, oath]);
  const swear = (choice: OathChoice) => {
    if (busy || pending.current || oath.state !== 'open' || oath.mine !== null) return;
    pending.current = true;
    onSwear(choice);
  };
  return <div className="oath-panel">
    <OathScene hero={view.hero} partner={view.duo} oath={oath} />
    {oath.state === 'silent' && <p>{t('oath.silent')}</p>}
    {oath.state === 'spent' && <p>{t('oath.spent', { date: new Date(oath.until!).toLocaleDateString(locale) })}</p>}
    {oath.state === 'open' && oath.mine && <p className="oath-choice-status" role="status">{t(oath.mine === 'share' ? 'oath.sworeShare' : 'oath.sworeTake', { name: partner })}</p>}
    {oath.state === 'open' && !oath.mine && <>
      {oath.partnerSwore && <p className="oath-choice-status">{t('oath.partnerSwore', { name: partner })}</p>}
      <div className="oath-choices">{(['share', 'take'] as const).map(choice => <button key={choice} type="button" className={`btn ${choice === 'share' ? 'btn-primary' : ''}`} disabled={busy} onClick={() => swear(choice)}><span>{t(`oath.${choice}`)}</span><small>{t(`oath.${choice}Hint`)}</small></button>)}</div>
      <p>{t('oath.secret', { name: partner })}</p>
    </>}
    <details className="oath-rules"><summary>{t('oath.rules')}</summary><ul><li>{t('oath.both')}</li><li>{t('oath.one')}</li><li>{t('oath.none')}</li></ul></details>
  </div>;
}

export function ChestPanel({ chest, view, busy, act }: { chest: DuoChestView; view: LabyrinthView; busy: boolean; act: Act }) {
  return <ChestScene chest={chest} hero={view.hero} partner={view.duo} busy={busy} onPick={index => void act(async () => {
    const result = await api.pickFromChest(index);
    // Ownership on the tray is the receipt; automatic picks still retain their report.
    return { ...result, loot: [] };
  })} />;
}
