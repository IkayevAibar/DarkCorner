import type { LocalizedText } from '@dark/shared';
import { LATEST_NEWS_ID } from './newsState';

/**
 * What's new: the game's patch notes, newest first. Each release adds an entry at
 * the top with a new id; the top bar marks it until the Player has seen it.
 * Update LATEST_NEWS_ID in newsState.ts and give the previous entry its literal id.
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
    id: LATEST_NEWS_ID,
    date: '2026-09-29',
    title: t('Fights come alive', 'Бои оживают'),
    items: [
      t('Fights play out on the Room map: moving tokens, spell bolts, fire, healing and the Dragon’s breath.', 'Бои разворачиваются на карте комнаты: движение жетонов, заклинания, огонь, лечение и дыхание дракона.'),
      t('A large d20 marks death saves. Skip at any time, or use reduced motion for a calmer replay.', 'Спасброски от смерти показаны на большом d20. Бой можно пропустить в любой момент; настройка уменьшения движения делает повтор спокойнее.'),
    ],
  },
  {
    id: '2026-09-28-warrens',
    date: '2026-09-28',
    title: t('New monsters and events, and the game on your home screen', 'Новые монстры и события, и игра на главном экране'),
    items: [
      t(
        'Four new monsters in the goblin warrens (Floors 1–3): a goblin sapper whose bomb goes off when it falls, a goblin shaman who mends its friends, a bat swarm that blades barely scratch (fire works twice as well), and a giant spider with a poisonous bite.',
        'Четыре новых монстра в гоблинских норах (этажи 1–3): гоблин-подрывник, чья бомба взрывается, когда он падает; гоблин-шаман, который латает друзей; стая летучих мышей, которую клинки почти не берут (зато огонь бьёт вдвое); и гигантский паук с ядовитым укусом.',
      ),
      t(
        'Two new ones in the crypts (Floors 4–6): a grave robber after your gold, and a banshee whose wail hits before the first blow.',
        'Двое новых в склепах (этажи 4–6): расхититель могил, охотник за вашим золотом, и банши, чей вопль бьёт ещё до первого удара.',
      ),
      t(
        'Two new events in the warrens: a goblin cookpot (a hot meal, or not quite meat) and a webbed body with a purse still on it (and maybe its owner nearby).',
        'Два новых события в норах: гоблинский котёл (горячий обед или не совсем мясо) и тело в паутине, с кошелём на поясе (и, может быть, с хозяином паутины неподалёку).',
      ),
      t('Fire and Smoke bombs have their own icons.', 'У огненной и дымовой бомб появились свои иконки.'),
      t(
        'Put Dark Corner on your phone’s home screen: it opens full-screen, like an app. The City shows how, and so does your profile.',
        'Добавьте Тёмный уголок на главный экран телефона: он откроется на весь экран, как приложение. Как это сделать, подскажет город и ваш профиль.',
      ),
    ],
  },
  {
    id: '2026-09-28-lodging-daily',
    date: '2026-09-28',
    title: t('Lodging once a day', 'Ночлег раз в сутки'),
    items: [
      t(
        'Lodging at the Tavern is now one night a day; the day turns at midnight UTC (05:00 in Astana). Each night still costs more than the last.',
        'Ночлег в таверне теперь раз в сутки; сутки сменяются в полночь по UTC (в 05:00 по Астане). Каждая ночь по-прежнему дороже предыдущей.',
      ),
    ],
  },
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
        'Lodging at the Tavern: a bed for the night fills Stamina and brings the short rests back, for gold. Each night costs more than the last.',
        'Ночлег в таверне: кровать на ночь заполняет выносливость и возвращает короткие отдыхи за золото. Каждая ночь дороже предыдущей.',
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
