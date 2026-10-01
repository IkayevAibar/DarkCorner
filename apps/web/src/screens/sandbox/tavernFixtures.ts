import { RANKINGS, type BountiesView, type HallEntry, type LodgingView, type RankingsView, type TavernView } from '@dark/shared';
import { REVEALS } from './lootFixtures';
const t = (en: string, ru: string) => ({ en, ru });
const FEED = [
  ['oath-kept', 'Garrick and Ilyra keep faith at the Oathstone.', 'Garrick и Ilyra держат слово у камня клятв.', null],
  ['oath-broken', 'Mira takes both gifts. Nox keeps the oath.', 'Mira забирает оба дара. Nox держит слово.', null],
  ['oath-cracked', 'Borin and Ash both take. The Oathstone cracks.', 'Borin и Ash тянутся забрать. Камень клятв трескается.', null],
  ['twin', 'Garrick and Ilyra break the Twin Wardens on Floor 2.', 'Garrick и Ilyra побеждают стражей-близнецов на 2-м этаже.', null],
  ['announcement', 'The Boss gate opens tonight. Leave a light for the next Hero.', 'Врата босса откроются сегодня. Оставьте огонь для следующего героя.', null],
  ['relic', 'Ilyra brings the Eye of the Deep out of the Vault.', 'Ilyra выносит Око глубин из сокровищницы.', 'relic'],
  ['drop', 'Garrick finds the Crown of Ash in the depths.', 'Garrick находит Корону пепла в глубинах.', 'mythic'],
  ['death', 'The Labyrinth claims Borin. A Grave waits on Floor 7.', 'Лабиринт забирает Borin. Могила ждёт на 7-м этаже.', null],
  ['chest', 'Mira opens a gilded Chest: a moonstone amulet.', 'Mira открывает позолоченный сундук: амулет лунного камня.', 'rare'],
  ['identify', 'Nox identifies a blade of night.', 'Nox опознаёт клинок ночи.', 'epic'],
  ['upgrade10', 'Garrick raises a sword to +10.', 'Garrick улучшает меч до +10.', 'legendary'],
  ['hidden', 'Mira finds a Hidden room on Floor 3.', 'Mira находит потайную комнату на 3-м этаже.', null],
  ['vault', 'Nox opens a Vault on Floor 6.', 'Nox открывает сокровищницу на 6-м этаже.', null],
  ['grave-looted', 'Borin recovers the Bag from a Grave.', 'Borin забирает сумку из могилы.', null],
  ['market-sale', 'A silver ring changes hands at the Market for 240 gold.', 'Серебряное кольцо на рынке обретает хозяина за 240 золота.', 'uncommon'],
  ['depth', 'Ilyra reaches Floor 9.', 'Ilyra достигает 9-го этажа.', null],
  ['boss-attempt', 'Garrick steps through the Boss gate.', 'Garrick проходит через врата босса.', null],
  ['boss-kill', 'The Dragon falls. Mira takes the second place.', 'Дракон падает. Второе место занимает Mira.', null],
  ['gate-open', 'The Boss gate is open.', 'Врата босса открыты.', null],
  ['weaken', 'The Dragon weakens by another 5%.', 'Дракон слабеет ещё на 5%.', null],
  ['vault-announced', 'A Vault will open on Floor 5 in one hour.', 'Сокровищница откроется на 5-м этаже через час.', null],
  ['omen', 'Today’s Omen: still air in the Labyrinth.', 'Сегодняшнее знамение: затишье в Лабиринте.', null],
  ['bounty', 'Garrick completes a Bounty: 80 gold in Storage.', 'Garrick выполняет задание: 80 золота в хранилище.', null],
  ['hunt', 'The Hunt begins: the undead of the lower Floors.', 'Начинается охота на нежить нижних этажей.', null],
  ['hunt-done', 'The Hunt is complete. Rewards wait in Storage.', 'Охота завершена. Награды ждут в хранилище.', null],
  ['deed', 'Mira earns a Deed: ten Vaults opened.', 'Mira совершает подвиг: открыто десять сокровищниц.', null],
  ['delve-cleared', 'Nox clears the Daily Delve: 840 points.', 'Nox завершает ежедневный спуск: 840 очков.', null],
  ['delve-podium', 'Borin leads the Daily Delve with 960 points.', 'Borin возглавляет ежедневный спуск с 960 очками.', null],
] as const;
export const TAVERN_STATES = ['quiet', 'busy', 'finale', 'hall'] as const;
export type TavernState = typeof TAVERN_STATES[number];
export function tavernFixtures(state: TavernState, now = Date.now()) {
  const at = (offset: number) => new Date(now + offset).toISOString();
  const online: TavernView['online'] = [
    { name: 'Ash', hero: 'Garrick', portraitUrl: '/art/portraits/human-fighter-1.webp', banner: '#9e2a2a', level: 14, title: t('The Unbroken', 'Несокрушимость'), where: t('Floor 8', 'Этаж 8') },
    { name: 'Moon', hero: 'Ilyra', portraitUrl: '/art/portraits/elf-wizard-1.webp', banner: '#365b93', level: 16, title: t('Keeper of secrets', 'Хранитель тайн'), where: t('Floor 9', 'Этаж 9') },
    { name: 'Stone', hero: 'Borin', portraitUrl: '/art/portraits/dwarf-cleric-1.webp', banner: '#ac8336', level: 11, title: null, where: t('In the City', 'В городе') },
    { name: 'Wren', hero: 'Mira', portraitUrl: '/art/portraits/human-cleric-2.webp', banner: '#63814c', level: 13, title: t('Grave keeper', 'Память могил'), where: t('Floor 7', 'Этаж 7') },
    { name: 'Crow', hero: 'Nox', portraitUrl: '/art/portraits/halfling-rogue-1.webp', banner: '#705381', level: 12, title: null, where: t('In the City', 'В городе') },
    { name: 'Newcomer', hero: null, portraitUrl: null, banner: null, level: null, title: null, where: t('In the City', 'В городе') },
  ];
  const view: TavernView = { online: state === 'quiet' ? [] : online, entries: state === 'quiet' ? [] : FEED.map(([kind,en,ru,tier],i) => ({ id: `feed-${i}`, kind, text: t(en,ru), tier, at: at(-i*420000) })),
    season: { number: 3, status: state === 'quiet' ? 'planned' : state === 'finale' ? 'finale' : 'active', startsAt: state === 'quiet' ? null : at(-864000000),
      bossGateAt: state === 'quiet' ? null : at(state === 'finale' ? -86400000 : 5400000), wipeAt: state === 'finale' ? at(95820000) : null,
      weakening: state === 'finale' ? .3 : 0, relicsLeft: state === 'quiet' ? 10 : state === 'finale' ? 2 : 7,
      podium: state === 'finale' ? ['Garrick','Mira','Ilyra'].map((hero,i) => ({ place:i+1,hero,player:['Ash','Wren','Moon'][i]!,at:at(-86400000+i*1200000) })) : [],
      omen: state === 'quiet' ? null : { id: 'still-air', name: t('Still air', 'Затишье'), description: t('The Labyrinth is quiet. Sneaking is easier today.', 'В Лабиринте тихо. Сегодня легче прокрасться.') } } };
  const lodging: LodgingView = { price: 50, nights: 0, gold: 620, stamina: 7, staminaMax: 20, shortRests:{left:0,of:2}, inCity:true, availableAt:null };
  const bounties: BountiesView = {
    daily: [
      { id:'rooms',title:t('Walk through 8 new Rooms','Пройти 8 новых комнат'),progress:5,target:8,done:false,canSwap:false,reward:{gold:80,item:null} },
      { id:'kills',title:t('Win 5 fights','Победить в 5 боях'),progress:5,target:5,done:true,canSwap:false,reward:{gold:120,item:REVEALS.rare} },
      { id:'sneak',title:t('Sneak past a group of monsters','Прокрасться мимо монстров'),progress:0,target:1,done:false,canSwap:true,reward:{gold:60,item:null} },
    ],
    weekly:{id:'weekly',title:t('Return from 10 Runs','Вернуться из 10 вылазок'),progress:6,target:10,done:false,canSwap:false,reward:{gold:600,item:null}},
    hunt:{title:t('Silence the undead','Упокоить нежить'),target:300,total:214,mine:19,min:10,top:[{hero:'Ilyra',count:64},{hero:'Mira',count:48},{hero:'Garrick',count:31}],done:false,endsAt:at(172800000)},
  };
  const hall: HallEntry[] = [1,2].flatMap(season => [
    { kind:'champion' as const,hero:season===2?'Garrick':'Ilyra',player:season===2?'Ash':'Moon',detail:t('The Dragon falls. The Season is remembered.','Дракон падает. Сезон остаётся в памяти.') },
    { kind:'second' as const,hero:'Mira',player:'Wren',detail:null },
    { kind:'third' as const,hero:'Borin',player:'Stone',detail:null },
    { kind:'relic' as const,hero:'Nox',player:'Crow',detail:t('Eye of the Deep','Око глубин') },
    { kind:'best-drop' as const,hero:'Mira',player:'Wren',detail:t('Crown of Ash · Mythic','Корона пепла · мифический ранг') },
    { kind:'deepest' as const,hero:'Garrick',player:'Ash',detail:t('Floor 10','Этаж 10') },
    { kind:'highest-level' as const,hero:'Ilyra',player:'Moon',detail:t('Level 20','Уровень 20') },
  ].map(e => ({...e,season,at:at(-season*864000000)})));
  const rankings: RankingsView = { boards:RANKINGS.map(kind => ({ kind, rows:online.slice(0,kind==='dragon'?3:5).map((o,i) => ({
    rank:i+1,hero:o.hero!,player:o.name,title:o.title,portraitUrl:o.portraitUrl,banner:o.banner,me:i===3,
    value:kind==='dragon'?i+1:kind==='deepest'?10-i:kind==='level'?20-i:kind==='richest'?9600-i*940:56-i*7,
    item:kind==='finest'?{name:t('Crown of Ash','Корона пепла'),tier:'mythic' as const}:null,
  })),me:null })) };
  return {view,lodging,bounties,hall:state==='quiet'?[]:hall,rankings};
}
