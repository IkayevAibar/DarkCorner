import type { DuoChestView, HeroView, LabyrinthView, LocalizedText } from '@dark/shared';
import type { SettledOath } from '../labyrinth/trust/OathScene';
import { REVEALS } from './lootFixtures';

const t = (en: string, ru: string) => ({ en, ru });
export const TRUST_VIEW: LabyrinthView = {
  location: 'labyrinth', hero: { name: 'Garrick', portraitUrl: '/art/portraits/human-fighter-1.webp', banner: '#9e2a2a', hp: 45, maxHp: 60, level: 5, xp: 20, xpNext: 100,
    stamina: 18, staminaMax: 20, staminaNextAt: null, carriedGold: 40, spells: 0, heals: 0, potions: 0, portalScrolls: 0, stance: 'steady', bombs: { fire: 0, smoke: 0 }, features: [], kit: [], shortRests: { left: 2, of: 2, backAt: null } },
  duo: { heroId: 'preview-partner', name: 'Ilyra', portraitUrl: '/art/portraits/elf-wizard-1.webp', banner: '#3b5fa8', class: 'wizard', level: 5, hp: 42, maxHp: 42, stamina: 18, online: true, seenAt: null, waypoints: [1], bonded: false },
  season: { status: 'active', bossGateAt: null, omen: null }, waypoints: [1], portal: null, bestFloor: 3,
  floor: { number: 3, name: t('The crypts', 'Склепы'), theme: 'crypt', width: 5, height: 5 },
  room: { id: 12, type: 'oathstone', event: null, map: 'crypt-3', cleared: false, restedAt: null, eventView: null, vault: null, facing: null, oath: { state: 'open', mine: null, partnerSwore: false, until: null } },
  exits: [], map: { rooms: [{ id: 12, x: 2, y: 2, type: 'oathstone', visited: true, cleared: false }], doors: [] }, graves: [], fight: null, chest: null,
};

export function trustChest(now = Date.now()): DuoChestView {
  return { items: [REVEALS.rare, { ...REVEALS.rare, id: 'preview-epic', base: 'sword', icon: 'sword', tier: 'epic' as const, name: t('Blade of the vow', 'Клинок обета') }, REVEALS.radiant, { ...REVEALS.rare, id: 'preview-fourth', base: 'helm', icon: 'helm', tier: 'uncommon' as const, name: t('Sentinel’s helm', 'Шлем дозора') }].map(item => ({ item, takenBy: null })), turn: 'me', full: false, deadline: new Date(now + 30000).toISOString() };
}

export const OATH_CASES = { kept: { mine: 'share', partner: 'share' }, taken: { mine: 'take', partner: 'share' }, betrayed: { mine: 'share', partner: 'take' }, cracked: { mine: 'take', partner: 'take' } } satisfies Record<string, SettledOath>;
export const OATH_NOTICES: Record<keyof typeof OATH_CASES, LocalizedText[]> = {
  kept: [t('You both shared. The stone keeps faith with you and Ilyra: a gift for each.', 'Вы оба делитесь. Камень верен вам и герою Ilyra: каждому по дару.')],
  taken: [t('You took. Ilyra kept the oath, and both gifts are yours. Everyone will hear of it.', 'Вы забираете. Ilyra держит слово, и оба дара достаются вам. Об этом услышат все.')],
  betrayed: [t('Ilyra took both gifts. You kept your oath, and the stone gives you nothing.', 'Ilyra забирает оба дара. Вы держите слово, а камень не даёт вам ничего.')],
  cracked: [t('You and Ilyra both reached to take. The Oathstone cracks, and its curse falls on you both: half the gold and dimmer luck for 3 hours.', 'Вы и Ilyra оба тянетесь забрать. Камень клятв трескается, и проклятие падает на обоих: вдвое меньше золота и меньше удачи на 3 часа.')],
};
export const CURSE: NonNullable<HeroView['luck']['blessing']> = { id: 'oathbroken', curse: true, name: t('Oathbreaker’s curse', 'Проклятие клятвопреступника'), description: t('Half the gold and −25% Magic find.', 'Вдвое меньше золота и −25% к поиску магии.'), until: new Date(Date.now() + 10800000).toISOString() };
