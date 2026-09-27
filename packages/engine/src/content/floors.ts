import { type Text, text } from './text.js';

export const FLOOR_COUNT = 10;

export type ThemeId = 'warrens' | 'crypts' | 'depths' | 'lair';

export interface ThemeDef {
  id: ThemeId;
  name: Text;
  /** Room map art in apps/web/public/art/rooms; picked per Room by the Labyrinth seed. */
  maps: string[];
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  warrens: { id: 'warrens', name: text('Goblin warrens', 'Гоблинские норы'), maps: ['goblins-1'] },
  crypts: { id: 'crypts', name: text('Undead crypts', 'Склепы нежити'), maps: ['crypt-1'] },
  depths: { id: 'depths', name: text('Demon-touched depths', 'Осквернённые демонами глубины'), maps: ['demons-1'] },
  lair: { id: 'lair', name: text('The Dragon’s lair', 'Логово дракона'), maps: ['demons-1'] },
};

/** Season 0 Floor themes (docs/design.md → The Labyrinth). */
export function themeOf(floor: number): ThemeId {
  if (floor <= 3) return 'warrens';
  if (floor <= 6) return 'crypts';
  if (floor <= 9) return 'depths';
  return 'lair';
}

/** Grid size: about 100 Rooms per Floor, a smaller lair at the bottom (v0). */
export function floorSize(floor: number): { width: number; height: number } {
  return floor >= FLOOR_COUNT ? { width: 6, height: 6 } : { width: 10, height: 10 };
}

export type RoomType =
  | 'landing' | 'stairs' | 'waypoint' | 'camp'
  | 'fight' | 'empty' | 'event' | 'treasure'
  | 'vault' | 'miniboss' | 'boss';

export const EVENT_KINDS = [
  'three-chests', 'shrine', 'gambler', 'merchant', 'trapped-corridor', 'cursed-altar', 'locked-cache', 'lockpicking',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * What a Door says about the Room behind it. Fight Clues depend on the theme;
 * the rest are shared. Several per type so the same Floor doesn't repeat itself.
 */
export const CLUES: Record<RoomType, Text[] | Record<ThemeId, Text[]>> = {
  landing: [text('Footprints of everyone who came down before you', 'Следы всех, кто спускался до вас')],
  stairs: [text('A cold draft rising from below', 'Снизу тянет холодом'), text('Steps worn smooth, going down', 'Стёртые ступени уходят вниз')],
  waypoint: [text('A faint hum of old magic', 'Слабый гул древней магии'), text('Stones that glow like embers', 'Камни тлеют, как угли')],
  camp: [text('Old ashes and a cold hearth', 'Старая зола и холодный очаг'), text('The smell of stale bread and pipe smoke', 'Пахнет чёрствым хлебом и трубочным дымом')],
  fight: {
    warrens: [text('Growling and the smell of smoke', 'Рычание и запах дыма'), text('Crude laughter and clanking pots', 'Грубый смех и звон котелков')],
    crypts: [text('The scrape of bone on stone', 'Скрежет кости о камень'), text('A cold draft and a dry rattle', 'Холодный сквозняк и сухой стук')],
    depths: [text('Heat and the stink of sulfur', 'Жар и вонь серы'), text('Chains rattling in the dark', 'Звон цепей в темноте')],
    lair: [text('Claws on rock and hissing', 'Когти по камню и шипение'), text('Scales scraping the walls', 'Чешуя трётся о стены')],
  },
  empty: [text('Silence', 'Тишина'), text('Dust and nothing else', 'Пыль, и больше ничего'), text('Dripping water', 'Капает вода')],
  event: [text('Someone humming a tune', 'Кто-то напевает мотив'), text('Candlelight flickering under the door', 'Под дверью мерцает свеча'), text('A strange sweet smell', 'Странный сладкий запах')],
  treasure: [text('A faint golden glow', 'Слабое золотое сияние'), text('The glint of metal', 'Блеск металла')],
  vault: [text('Iron bands and a great lock', 'Железные обручи и огромный замок')],
  miniboss: [text('Something big breathing behind the door', 'За дверью дышит что-то большое'), text('Heavy footsteps and the smell of blood', 'Тяжёлые шаги и запах крови')],
  boss: [text('The heat of a dragon’s breath', 'Жар драконьего дыхания')],
};

export function cluesFor(type: RoomType, theme: ThemeId): Text[] {
  const entry = CLUES[type];
  return Array.isArray(entry) ? entry : entry[theme];
}
