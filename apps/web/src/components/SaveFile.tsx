import { useRef, useState } from 'react';
import type { SaveSummary } from '@dark/solo';
import { api } from '../api';
import { useI18n } from '../i18n';
import { inApp } from '../install';
import { useAction } from './useAction';

/**
 * Solo: the Save as a file (docs/plan-solo-offline.md, Phase 4). A copy in a file
 * outlives a lost phone or a new one; loading a file puts its game in place of this
 * one, once the player has seen both side by side.
 */
export function SaveFile() {
  const { t } = useI18n();
  const { busy, error, run } = useAction();
  const [note, setNote] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<{ text: string; file: SaveSummary; device: SaveSummary } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const line = (s: SaveSummary) =>
    `${t('tavern.season', { n: s.chapter })}, ${t('saveFile.day', { n: s.day })} · ${
      s.hero ? `${s.hero.name}, ${t('duo.partnerLine', { level: s.hero.level, cls: t(`class.${s.hero.class}`) })}` : t('saveFile.noHero')
    }`;

  const saveOut = () =>
    void run(async () => {
      setNote(null);
      const file = await api.exportSave();
      if (await writeFile(file.name, file.text)) setNote(t('saveFile.saved'));
    });

  const pick = (chosen: File | undefined) => {
    // The same file can be picked again after a change of mind.
    if (picker.current) picker.current.value = '';
    if (!chosen) return;
    void run(async () => {
      setNote(null);
      const text = await chosen.text();
      const [checked, current] = await Promise.all([api.checkSave(text), api.exportSave()]);
      setIncoming({ text, file: checked.summary, device: current.summary });
    });
  };

  const load = () =>
    void run(async () => {
      await api.importSave(incoming!.text);
      // A fresh start, on the Save just loaded.
      window.location.assign('/');
    });

  return (
    <div className="grid gap-2">
      <span className="sub-heading">{t('saveFile.title')}</span>
      <p className="m-0 text-xs text-muted">{t('saveFile.about')}</p>
      {!incoming && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-small" disabled={busy} onClick={saveOut}>{t('saveFile.out')}</button>
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => picker.current?.click()}>{t('saveFile.in')}</button>
          {/* Android's picker can't tell a .json from a download's guess of its type: the game checks the file itself. */}
          <input ref={picker} type="file" hidden accept={inApp() ? undefined : '.json,application/json'} onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {incoming && (
        <div className="grid gap-2 rounded-sm border border-bone/15 bg-black/20 p-3" role="group" aria-label={t('saveFile.confirm')}>
          <strong className="font-head">{t('saveFile.confirm')}</strong>
          <p className="m-0 text-sm"><span className="text-muted">{t('saveFile.inFile')}:</span> {line(incoming.file)}</p>
          <p className="m-0 text-sm"><span className="text-muted">{t('saveFile.onDevice')}:</span> {line(incoming.device)}</p>
          <p className="m-0 text-xs text-muted">{t('saveFile.replace')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={load}>{t('saveFile.load')}</button>
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => setIncoming(null)}>{t('saveFile.keep')}</button>
          </div>
        </div>
      )}
      {note && <p className="m-0 text-sm" role="status">{note}</p>}
      {error && <p className="m-0 text-sm text-tier-mythic">{error}</p>}
    </div>
  );
}

/** Writes the file where the player picks: Android's own "Save to" screen in the app, a download in a browser. */
async function writeFile(name: string, text: string): Promise<boolean> {
  if (inApp()) return (await import('../native')).saveFile(name, text);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
