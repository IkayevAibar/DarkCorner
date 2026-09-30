import { type Text, text } from './text.js';

// First steps (docs/design.md → First steps): a new Hero's short list of goals,
// each with a small reward, that shows the way through the first hour. Every
// goal reads what the Hero has already done; a Player claims each reward once a
// Season. All rewards are v0.

/** What the goals look at: the living Hero, and the Player's Delves this Season. */
export interface StepFacts {
  /** Monsters defeated (the Deeds' kill counts). */
  kills: number;
  /** Gold brought home from the Labyrinth. */
  banked: number;
  chestsOpened: number;
  level: number;
  waypoints: number;
  path: boolean;
  bestFloor: number;
  delves: number;
}

export interface StepReward {
  gold?: number;
  /** Stackable Items, by base id. */
  items?: { base: string; quantity: number }[];
}

export interface StepDef {
  id: string;
  name: Text;
  /** How to do it, for a Player who doesn't know yet. */
  how: Text;
  reward: StepReward;
  done: (facts: StepFacts) => boolean;
}

const step = (id: string, name: Text, how: Text, reward: StepReward, done: StepDef['done']): StepDef => ({ id, name, how, reward, done });

/** In the order a first hour meets them; each reward helps with the next. */
export const STEPS: StepDef[] = [
  step('first-fight', text('Win a fight', 'Выиграйте бой'),
    text('Go through a Door into a Room with monsters, and Fight.', 'Войдите в комнату с монстрами и сражайтесь.'),
    { items: [{ base: 'potion', quantity: 2 }] }, (f) => f.kills >= 1),
  step('bank-gold', text('Bring gold home', 'Принесите золото домой'),
    text('Gold you carry is lost if your Hero falls. Leave through the gate on Floor 1, or a woken Waypoint, to keep it.',
      'Золото при себе пропадёт, если герой погибнет. Выйдите через врата на 1-м этаже или через пробуждённый путевой камень, чтобы его сохранить.'),
    { items: [{ base: 'chest-iron', quantity: 1 }, { base: 'key-iron', quantity: 1 }] }, (f) => f.banked >= 1),
  step('open-chest', text('Open a Chest', 'Откройте сундук'),
    text('A Chest opens with a Key of its grade: tap it in your Bag, on the Loot tab.', 'Сундук открывается ключом того же вида: нажмите на него в сумке, на вкладке «Добыча».'),
    { items: [{ base: 'scroll-identify', quantity: 2 }] }, (f) => f.chestsOpened >= 1),
  step('level-2', text('Reach level 2', 'Достигните 2-го уровня'),
    text('Fights and events give XP. When the bar fills, take the new level on the Heroes tab.', 'Опыт дают бои и события. Когда шкала заполнится, возьмите новый уровень на вкладке «Герои».'),
    { items: [{ base: 'scroll-portal', quantity: 1 }] }, (f) => f.level >= 2),
  step('waypoint', text('Wake a Waypoint', 'Пробудите путевой камень'),
    text('Every Floor has one near its middle. Once woken, you can enter the Labyrinth there, and leave from it.',
      'На каждом этаже он ближе к середине. Через пробуждённый камень можно и войти в лабиринт, и выйти из него.'),
    { gold: 150 }, (f) => f.waypoints >= 1),
  step('path', text('Choose your Path', 'Выберите путь'),
    text('At level 3, pick one of your Class’s two Paths on the Heroes tab.', 'На 3-м уровне выберите один из двух путей своего класса на вкладке «Герои».'),
    { gold: 200 }, (f) => f.path),
  step('floor-3', text('Reach Floor 3', 'Доберитесь до 3-го этажа'),
    text('Every Floor has stairs down somewhere; the Clues on the Doors help you find them.', 'На каждом этаже где-то есть лестница вниз; подсказки на дверях помогают её найти.'),
    { items: [{ base: 'chest-silver', quantity: 1 }, { base: 'key-silver', quantity: 1 }] }, (f) => f.bestFloor >= 3),
  step('delve', text('Go down the Well', 'Спуститесь в колодец'),
    text('The Daily Delve, at the Well in the City: six Rooms, the same for everyone, and nothing to lose.',
      'Спуск дня у колодца в городе: шесть комнат, одни на всех, и ничего не теряется.'),
    { gold: 100 }, (f) => f.delves >= 1),
];

export const stepById = (id: string): StepDef | undefined => STEPS.find((s) => s.id === id);
