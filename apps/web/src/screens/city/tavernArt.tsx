import { useI18n } from '../../i18n';
import { TWIN_MARK } from '../../components/TwinMark';

const COPY = {
  en: { hearth: 'A fire. A story. A place to return.', upstairs: 'Rooms upstairs', board: 'From the Labyrinth', wanted: 'The week’s Hunt', stone: 'What the Wipe cannot take', hall: 'Names cut into stone. Glory kept from Season to Season.', notice: 'Notice', chronicle: 'Chronicle', making: 'A Hero takes shape', quiet: 'The hearth is still warm.' },
  ru: { hearth: 'Огонь. Истории. Место, куда возвращаются.', upstairs: 'Комнаты наверху', board: 'Из Лабиринта', wanted: 'Охота недели', stone: 'То, что не заберёт вайп', hall: 'Имена высечены в камне. Слава остаётся от сезона к сезону.', notice: 'Объявление', chronicle: 'Летопись', making: 'Создание героя', quiet: 'В очаге ещё тепло.' },
};
/** Solo: Chapters instead of Seasons, and nothing is wiped. */
const SOLO_COPY = {
  en: { ...COPY.en, stone: 'What the years cannot take', hall: 'Names cut into stone. Glory kept from Chapter to Chapter.' },
  ru: { ...COPY.ru, stone: 'То, что не отнимут годы', hall: 'Имена высечены в камне. Слава остаётся от главы к главе.' },
};
export const useTavernCopy = () => (__SOLO__ ? SOLO_COPY : COPY)[useI18n().locale];
const PATHS = {
  fire: 'M12 2C14 8 20 8 20 15a8 8 0 0 1-16 0c0-3 2-5 4-7 0 4 2 5 3 5 2-3 0-6 1-11ZM12 15c-3 3-3 6 0 7 3-1 3-4 0-7Z',
  stairs: 'M2 21h20M3 20v-5h5v-5h5V5h6V2M3 7l17-5M20 2v19',
  notice: 'M6 3h12l2 3v16H4V6l2-3ZM8 2v4m8-4v4M8 10h8m-8 4h8m-8 4h5',
  crown: 'M3 7l5 4 4-8 4 8 5-4-2 12H5L3 7ZM5 22h14',
  stone: 'M3 22V6l4-4h10l4 4v16H3ZM7 7h10M8 11h8m-8 4h8m-8 4h8',
  skull: 'M6 19v-4C0 9 4 2 12 2s12 7 6 13v4H6Zm3 0v3m6-3v3M7 10h2m6 0h2m-6 4h2',
  hunt: 'M12 2v5m0 10v5M2 12h5m10 0h5M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM9 12h6m-3-3v6',
  gem: 'M7 3h10l5 7-10 12L2 10l5-7ZM2 10h20M7 3l5 19 5-19',
  twin: TWIN_MARK,
  'oath-kept': 'M3 19V8l4-5h10l4 5v11ZM6 12l4 4 8-8M1 22h22',
  'oath-broken': 'M3 20V8l4-5h10l4 5v12M13 3l-3 7 5 3-5 8M1 23h22',
  'oath-cracked': 'M2 18V8l5-5h4l-3 7 4 3-4 8ZM22 18V8l-5-5h-2l-2 6 4 4-4 8h7ZM5 23h3m8 0h3',
};
export type TavernSymbol = keyof typeof PATHS;
export function TavernMark({ kind }: { kind: TavernSymbol }) {
  return <svg className="tavern-mark" viewBox="0 0 24 24" fill={kind === 'twin' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={kind === 'twin' ? 0 : 1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[kind]} /></svg>;
}
export function feedSymbol(kind: string): TavernSymbol {
  if (kind === 'oath-kept' || kind === 'oath-broken' || kind === 'oath-cracked') return kind;
  if (kind === 'twin') return 'twin';
  if (kind === 'death' || kind === 'grave-looted') return 'skull';
  if (['relic', 'drop', 'chest', 'identify', 'upgrade10', 'vault', 'hidden', 'market-sale'].includes(kind)) return 'gem';
  if (['boss-kill', 'deed', 'delve-podium'].includes(kind)) return 'crown';
  if (['hunt', 'hunt-done', 'bounty'].includes(kind)) return 'hunt';
  return 'notice';
}
