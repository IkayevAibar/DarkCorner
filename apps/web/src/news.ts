import type { LocalizedText } from '@dark/shared';

/**
 * What's new: the game's patch notes, newest first. Each release adds an entry at
 * the top with a new id; the top bar marks it until the Player has seen it.
 */
export interface NewsEntry {
  id: string;
  /** ISO date of the release. */
  date: string;
  title: LocalizedText;
  items: LocalizedText[];
}

const t = (en: string, ru: string): LocalizedText => ({ en, ru });

export const NEWS: NewsEntry[] = [
  {
    id: '2026-09-28-rests',
    date: '2026-09-28',
    title: t('A new Labyrinth screen, rests and Rankings', 'Новый экран Лабиринта, отдых и рейтинг'),
    items: [
      t(
        'Levels no longer rise on their own. When one is ready, a ✦ appears: open it to see what the level gives (health, new powers) and to make its choices, a Path or Talents.',
        'Уровни больше не растут сами. Когда новый уровень готов, появляется ✦: откройте его, чтобы увидеть, что он даёт (здоровье, новые умения), и сделать выбор — путь или таланты.',
      ),
      t(
        'A new Labyrinth screen: the Room fills the screen, the Map and the Bag sit at the top, and monsters, events and what just happened come up in the middle.',
        'Новый экран Лабиринта: комната на весь экран, карта и сумка сверху, а монстры, события и итоги действий появляются посередине.',
      ),
      t(
        'The belt: your Class’s abilities and your Potions, Bombs and scrolls along the bottom of the Room. Tap one to see what it does now, in numbers, and what it becomes later.',
        'Пояс: умения вашего класса, зелья, бомбы и свитки внизу комнаты. Нажмите на любое, чтобы увидеть, что оно даёт сейчас, в числах, и чем станет позже.',
      ),
      t(
        'Tap a monster to see its card: what it is, its health, Armor Class, attack and damage on this Floor, and its powers.',
        'Нажмите на монстра, чтобы открыть его карточку: кто это, его здоровье, класс брони, попадание и урон на этом этаже и его особенности.',
      ),
      t(
        'Short rests: two each Run, each giving back half of full health and half of full Stamina. They come back with a new Run, at most every 8 hours.',
        'Короткий отдых: два за вылазку, каждый возвращает половину здоровья и половину выносливости. Они возвращаются с новой вылазкой, но не чаще чем раз в 8 часов.',
      ),
      t(
        'Walking back through Rooms you know costs no Stamina, unless something new waits in one today. Free Doors say so.',
        'По знакомым комнатам можно ходить без выносливости, если сегодня там не появилось ничего нового. Бесплатные двери помечены.',
      ),
      t(
        'Lodging at the Tavern: once a day, a bed for the night fills Stamina and brings the short rests back, for gold. Each night costs more than the last.',
        'Ночлег в таверне: раз в сутки кровать на ночь заполняет выносливость и возвращает короткие отдыхи за золото. Каждая ночь дороже предыдущей.',
      ),
      t(
        'Rankings in the Tavern: nine boards (deepest, level, richest, victories, finest Item, Graves, Vaults, deaths and the Dragon), each with its podium.',
        'Рейтинг в таверне: девять досок (глубина, уровень, богатство, победы, лучший предмет, могилы, сокровищницы, смерти и дракон), у каждой свой пьедестал.',
      ),
      t('The Labyrinth tab looks the same at the gate as in the Rooms.', 'Вкладка Лабиринта выглядит одинаково и у врат, и в комнатах.'),
    ],
  },
  {
    id: '2026-09-28-items',
    date: '2026-09-28',
    title: t('Items explained, and 30 Room maps', 'Описания предметов и 30 карт комнат'),
    items: [
      t('Every Item says what it does, and how it compares with what you wear.', 'Каждый предмет объясняет, что он даёт и чем отличается от надетого.'),
      t('30 painted Room maps, and every Room turns its map its own way.', '30 нарисованных карт комнат, и каждая комната поворачивает свою карту по-своему.'),
      t(
        'The Discord channel hears when someone new waits at the gate, and retells the past day before each midnight Omen.',
        'Канал в Discord узнаёт, когда у врат ждёт новичок, и перед полуночным знамением пересказывает прошедший день.',
      ),
    ],
  },
  {
    id: '2026-09-27-season-0',
    date: '2026-09-27',
    title: t('Season 0 opens', 'Сезон 0 открыт'),
    items: [
      t('Season 0 has begun: ten Floors of Labyrinth, and the Dragon at the bottom.', 'Сезон 0 начался: десять этажей Лабиринта и дракон в самом низу.'),
      t('Painted Hero portraits and unique Items, and a token for every monster.', 'Нарисованные портреты героев и уникальные предметы, у каждого монстра свой жетон.'),
      t('The City is a map: tap its buildings.', 'Город стал картой: нажимайте на здания.'),
      t('The Hunt: a goal the whole server shares each week.', 'Охота: общая цель всего сервера на неделю.'),
      t('A Town Portal stays open for a day, to step back to where it was read.', 'Портал остаётся открытым сутки: через него можно вернуться туда, где его прочитали.'),
      t('A How to play guide, behind the ? at the top.', 'Руководство «Как играть» — за кнопкой «?» наверху.'),
    ],
  },
];

const SEEN_KEY = 'dc.news.seen';

/** Whether the newest entry is still unread on this device. */
export function newsUnread(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== NEWS[0]!.id;
  } catch {
    return false;
  }
}

export function markNewsRead(): void {
  try {
    localStorage.setItem(SEEN_KEY, NEWS[0]!.id);
  } catch {
    // Private windows can refuse storage; the dot just stays.
  }
}
