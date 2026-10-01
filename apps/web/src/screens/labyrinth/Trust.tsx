import { useState } from 'react';
import type { DuoChestView, LabyrinthResult, LabyrinthView, OathChoice } from '@dark/shared';
import { api } from '../../api';
import { ItemChip, ItemDetails } from '../../components/items/ItemChip';
import { useI18n } from '../../i18n';
import { play } from '../../sound';
import { useNow } from '../../time';

type Act = (call: () => Promise<LabyrinthResult>) => Promise<void>;

/**
 * The Oathstone (docs/design.md → Trust and greed): each Player of a Duo swears in secret
 * to share or to take, and the stone answers once both have.
 */
export function OathPanel({ view, busy, act }: { view: LabyrinthView; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const oath = view.room!.oath!;
  const partner = view.duo?.name ?? '';
  const swear = (choice: OathChoice) => void act(async () => {
    play(choice === 'share' ? 'reveal' : 'coins', { rate: 0.8 });
    return api.swear(choice);
  });
  return (
    <div className="grid gap-3">
      <p className="m-0 text-[15px]">{t('oath.rules')}</p>
      <ul className="m-0 grid list-none gap-1 p-0 text-sm text-muted">
        <li>{t('oath.both')}</li>
        <li>{t('oath.one')}</li>
        <li>{t('oath.none')}</li>
      </ul>
      {oath.state === 'silent' && <p className="m-0 text-sm text-muted italic">{t('oath.silent')}</p>}
      {oath.state === 'spent' && (
        <p className="m-0 text-sm text-muted italic">{t('oath.spent', { date: new Date(oath.until!).toLocaleDateString() })}</p>
      )}
      {oath.state === 'open' && oath.mine && (
        <p className="m-0 text-sm">{t(oath.mine === 'share' ? 'oath.sworeShare' : 'oath.sworeTake', { name: partner })}</p>
      )}
      {oath.state === 'open' && !oath.mine && (
        <>
          {oath.partnerSwore && <p className="m-0 text-sm text-gold">{t('oath.partnerSwore', { name: partner })}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-primary grid gap-0.5" disabled={busy} onClick={() => swear('share')}>
              <span>{t('oath.share')}</span>
              <span className="text-xs font-normal opacity-80">{t('oath.shareHint')}</span>
            </button>
            <button type="button" className="btn grid gap-0.5" disabled={busy} onClick={() => swear('take')}>
              <span>{t('oath.take')}</span>
              <span className="text-xs font-normal opacity-80">{t('oath.takeHint')}</span>
            </button>
          </div>
          <p className="m-0 text-xs text-muted">{t('oath.secret', { name: partner })}</p>
        </>
      )}
    </div>
  );
}

/** A Duo Chest: the Items, who took which, and whose pick it is, against the clock. */
export function ChestPanel({ chest, view, busy, act }: { chest: DuoChestView; view: LabyrinthView; busy: boolean; act: Act }) {
  const { t } = useI18n();
  const now = useNow(1000);
  const [selected, setSelected] = useState<number | null>(null);
  const partner = view.duo?.name ?? '';
  const seconds = Math.max(0, Math.ceil((new Date(chest.deadline).getTime() - now) / 1000));
  const open = selected !== null && chest.items[selected]?.takenBy === null ? selected : null;
  const take = (index: number) => void act(async () => {
    play('coins', { rate: 1.1 });
    setSelected(null);
    // The card marks the Item as yours: no report for it (one picked for you when time runs out still has one).
    const result = await api.pickFromChest(index);
    return { ...result, loot: [] };
  });
  return (
    <div className="grid gap-3">
      <p className={`m-0 font-head text-[15px] font-bold ${chest.turn === 'me' ? 'text-gold' : 'text-muted'}`}>
        {chest.turn === 'me' ? t('chest.yourPick', { s: seconds }) : chest.turn === 'partner' ? t('chest.theirPick', { name: partner, s: seconds }) : t('chest.full')}
      </p>
      {chest.full && chest.turn !== null && <p className="m-0 text-sm text-[#ff9a8a]">{t('chest.bagFull')}</p>}
      <div className="flex flex-wrap gap-2">
        {chest.items.map(({ item, takenBy }, i) => (
          <div key={item.id} className={`grid justify-items-center gap-0.5 ${takenBy ? 'opacity-45' : ''}`}>
            <ItemChip item={item} size={58} onClick={() => setSelected(i)} />
            <span className={`text-[11px] ${open === i ? 'text-gold' : 'text-muted'}`}>
              {takenBy === 'me' ? t('chest.mine') : takenBy === 'partner' ? partner : open === i ? t('chest.looking') : ' '}
            </span>
          </div>
        ))}
      </div>
      {open !== null && (
        <div className="grid gap-2 border-t border-line pt-2">
          <ItemDetails item={chest.items[open]!.item} />
          <button type="button" className="btn btn-primary" disabled={busy || chest.turn !== 'me'} onClick={() => take(open)}>
            {chest.turn === 'me' ? t('chest.take') : t('chest.wait', { name: partner })}
          </button>
        </div>
      )}
      {open === null && <p className="m-0 text-xs text-muted">{t('chest.hint')}</p>}
    </div>
  );
}
