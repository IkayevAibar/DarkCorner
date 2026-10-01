import { useTrustText } from '../labyrinth/trust/messages';
import { useState } from 'react';
import type { OathView } from '@dark/shared';
import { useI18n } from '../../i18n';
import { Token } from '../../components/Token';
import { CenterModal } from '../../components/CenterModal';
import { BlessingStatus } from '../../components/BlessingStatus';
import { Glyph } from '../../components/map/Glyph';
import { OathChoices } from '../labyrinth/Trust';
import { OathStone } from '../labyrinth/trust/OathScene';
import { OathReveal } from '../labyrinth/trust/OathReveal';
import { ChestScene } from '../labyrinth/trust/ChestScene';
import { CURSE, OATH_CASES, OATH_NOTICES, TRUST_VIEW, trustChest } from './trustFixtures';
import './TrustPreview.css';

const COPY = {
  en: { title: 'Trust and greed', kept: 'Both Share', taken: 'You Take', betrayed: 'Partner Takes', cracked: 'Both Take', reset: 'New Chest', partner: 'Partner picks', full: 'Full Bag', expired: 'Expired turn', silent: 'Alone', open: 'Open oath', spent: 'Spent stone', inspect: 'Approach the Oathstone', tray: 'Open Duo Chest', close: 'Close', done: 'Both Bags full' },
  ru: { title: 'Доверие и жадность', kept: 'Оба делятся', taken: 'Вы забираете', betrayed: 'Напарник забирает', cracked: 'Оба забирают', reset: 'Новый сундук', partner: 'Ход напарника', full: 'Полная сумка', expired: 'Время истекло', silent: 'Без напарника', open: 'Клятва', spent: 'Камень отдыхает', inspect: 'Подойти к камню клятв', tray: 'Открыть сундук дуэта', close: 'Закрыть', done: 'Обе сумки полны' },
};
export function TrustPreview() {
  const trustText = useTrustText();
  const { locale, t } = useI18n(), copy = COPY[locale];
  const [oath, setOath] = useState<OathView>(TRUST_VIEW.room!.oath!), [card, setCard] = useState<'oath' | 'chest' | null>(null);
  const [result, setResult] = useState<keyof typeof OATH_CASES | null>(null), [chest, setChest] = useState(trustChest), [key, setKey] = useState(0);
  const partner = oath.state === 'silent' ? null : TRUST_VIEW.duo, view = { ...TRUST_VIEW, duo: partner, room: { ...TRUST_VIEW.room!, oath } };
  const take = (index: number, side: 'me' | 'partner') => setChest(current => ({ ...current, items: current.items.map((entry, i) => i === index ? { ...entry, takenBy: side } : entry), turn: current.items.filter(entry => entry.takenBy === null).length === 1 ? null : side === 'me' ? 'partner' : 'me', deadline: new Date(Date.now() + 30000).toISOString() }));
  return <section className="trust-preview" data-trust-preview>
    <h2 className="sub-heading">{copy.title}</h2>
    <div className="trust-preview-controls">{(['open', 'silent', 'spent'] as const).map(state => <button className="btn btn-small" key={state} data-oath-state={state} aria-pressed={oath.state === state} onClick={() => setOath({ state, mine: null, partnerSwore: false, until: new Date(Date.now() + 604800000).toISOString() })}>{copy[state]}</button>)}</div>
    <div className="trust-preview-room"><img src="/art/rooms/crypt-3.webp" alt="" /><span>{t('room.oathstone')}</span><svg viewBox="-18 -18 36 36" aria-hidden="true"><Glyph type="oathstone" /></svg><div className="oath-room-prop"><OathStone active={oath.state === 'open'} /></div><div className="trust-preview-tokens"><Token art={view.hero.portraitUrl} label={view.hero.name} ring={view.hero.banner} size={60} />{partner && <Token art={partner.portraitUrl} label={partner.name} ring={partner.banner} size={60} />}</div></div>
    <button className="btn" data-open-oath onClick={() => setCard('oath')}>{copy.inspect}</button>
    <div className="trust-preview-controls">{(Object.keys(OATH_CASES) as Array<keyof typeof OATH_CASES>).map(value => <button className="btn btn-small" data-oath-reveal={value} key={value} onClick={() => setResult(value)}>{copy[value]}</button>)}</div>
    <div className="trust-preview-controls"><button className="btn" data-open-chest onClick={() => setCard('chest')}>{copy.tray}</button><button className="btn btn-small" data-reset-chest onClick={() => { setChest(trustChest()); setKey(value => value + 1); }}>{copy.reset}</button></div>
    <BlessingStatus blessing={CURSE} />
    {card === 'oath' && !result && <CenterModal label={t('room.oathstone')} head={<span className="sub-heading">{t('room.oathstone')}</span>} width={420} onClose={() => setCard(null)}><OathChoices view={view} busy={false} onSwear={choice => setOath(current => ({ ...current, mine: choice }))} /></CenterModal>}
    {card === 'chest' && <CenterModal label={trustText('chest.title')} head={<span className="sub-heading">{trustText('chest.title')}</span>} width={460} onClose={() => setCard(null)}><ChestScene key={key} chest={chest} hero={view.hero} partner={TRUST_VIEW.duo} busy={false} onPick={index => take(index, 'me')} /><div className="trust-preview-controls"><button className="btn btn-small" data-partner-pick disabled={chest.turn !== 'partner'} onClick={() => { const index = chest.items.findIndex(entry => !entry.takenBy); if (index >= 0) take(index, 'partner'); }}>{copy.partner}</button><button className="btn btn-small" data-chest-full onClick={() => setChest(current => ({ ...current, full: true, turn: 'partner' }))}>{copy.full}</button><button className="btn btn-small" data-chest-expired onClick={() => setChest(current => ({ ...current, deadline: new Date(Date.now() - 1000).toISOString() }))}>{copy.expired}</button><button className="btn btn-small" data-chest-done onClick={() => setChest(current => ({ ...current, full: true, turn: null }))}>{copy.done}</button></div></CenterModal>}
    {result && <OathReveal result={OATH_CASES[result]} hero={view.hero} partner={TRUST_VIEW.duo} notices={OATH_NOTICES[result]} onDone={() => setResult(null)} />}
  </section>;
}
