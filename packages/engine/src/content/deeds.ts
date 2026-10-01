import type { MonsterKin } from './monsters.js';
import { type Text, text } from './text.js';

// Deeds and Titles (docs/design.md → Deeds and Titles). A Deed is a feat a Hero
// works toward all Season; finishing it banks some gold and earns a Title the
// Player can wear after the Hero's name. All numbers are v0.

/** What a Deed counts. `depth` is the deepest Floor reached; every other one adds up over the Season. */
export type DeedMetric =
  | 'kills-goblinoid' | 'kills-beast' | 'kills-undead' | 'kills-demon'
  | 'minibosses' | 'elites' | 'dragon' | 'deadly'
  | 'saved' | 'rose'
  | 'depth' | 'rooms' | 'hidden' | 'events' | 'riddles' | 'bargains' | 'sarcophagi' | 'locks' | 'cheats'
  | 'banked' | 'chests' | 'legendary' | 'bounties' | 'delves'
  | 'raised' | 'twins' | 'oaths-kept' | 'oaths-broken';

export interface DeedDef {
  id: string;
  metric: DeedMetric;
  target: number;
  /** What the Hero may wear once it's done. */
  title: Text;
  /** How to earn it. */
  about: Text;
  /** Gold banked the moment it's done. */
  gold: number;
}

const deed = (id: string, metric: DeedMetric, target: number, gold: number, title: Text, about: Text): DeedDef =>
  ({ id, metric, target, gold, title, about });

export const DEEDS: DeedDef[] = [
  deed('goblin-bane', 'kills-goblinoid', 100, 300, text('Goblin-bane', 'Гроза гоблинов'), text('Defeat 100 goblins.', 'Победите 100 гоблинов.')),
  deed('beast-hunter', 'kills-beast', 100, 300, text('Beast-hunter', 'Зверолов'), text('Defeat 100 beasts.', 'Победите 100 зверей.')),
  deed('grave-warden', 'kills-undead', 150, 500, text('Grave warden', 'Страж могил'), text('Put 150 undead to rest.', 'Упокойте 150 мертвецов.')),
  deed('demon-slayer', 'kills-demon', 100, 800, text('Demon-slayer', 'Истребитель демонов'), text('Defeat 100 demons.', 'Победите 100 демонов.')),
  deed('warlord-bane', 'minibosses', 10, 800, text('Bane of warlords', 'Гроза вожаков'), text('Defeat 10 Mini-bosses.', 'Победите 10 мини-боссов.')),
  deed('elite-hunter', 'elites', 25, 500, text('Elite hunter', 'Охотник на элиту'), text('Defeat 25 elite monsters.', 'Победите 25 элитных монстров.')),
  deed('dragonslayer', 'dragon', 1, 2500, text('Dragonslayer', 'Драконоборец'), text('Defeat the Ancient Dragon.', 'Победите Древнего дракона.')),
  deed('against-all-odds', 'deadly', 1, 300, text('Against all odds', 'Вопреки всему'), text('Win a fight the Door called Deadly.', 'Выиграйте бой, который дверь назвала смертельным.')),
  deed('too-tough-to-die', 'saved', 5, 300, text('Too tough to die', 'Не по зубам смерти'), text('Go down in 5 fights, and live through each.', 'Пять раз упадите в бою и выживите.')),
  deed('fortunes-favourite', 'rose', 1, 200, text('Fortune’s favourite', 'Баловень судьбы'), text('Stand back up on a natural 20 death save.', 'Поднимитесь на ноги, выбросив 20 на спасброске от смерти.')),
  deed('deep-delver', 'depth', 10, 1000, text('Deep delver', 'Покоритель глубин'), text('Reach Floor 10.', 'Доберитесь до 10-го этажа.')),
  deed('pathfinder', 'rooms', 500, 500, text('Pathfinder', 'Первопроходец'), text('Walk into 500 Rooms for the first time.', 'Войдите в 500 новых комнат.')),
  deed('keeper-of-secrets', 'hidden', 5, 300, text('Keeper of secrets', 'Хранитель тайн'), text('Plunder 5 hidden rooms.', 'Разграбьте 5 потайных комнат.')),
  deed('curious-soul', 'events', 50, 300, text('Curious soul', 'Любопытная душа'), text('See 50 Event rooms through.', 'Пройдите 50 комнат с событиями.')),
  deed('riddle-master', 'riddles', 10, 300, text('Riddle master', 'Знаток загадок'), text('Answer 10 riddles right.', 'Отгадайте 10 загадок.')),
  deed('blood-trader', 'bargains', 5, 300, text('Blood-trader', 'Торговец кровью'), text('Strike 5 devil’s bargains.', 'Заключите 5 сделок с дьяволом.')),
  deed('tomb-robber', 'sarcophagi', 5, 300, text('Tomb robber', 'Расхититель гробниц'), text('Open 5 sarcophagi.', 'Вскройте 5 саркофагов.')),
  deed('nimble-fingers', 'locks', 10, 300, text('Nimble fingers', 'Ловкие пальцы'), text('Pick 10 tricky locks.', 'Вскройте 10 хитрых замков.')),
  deed('sharp-eyed', 'cheats', 3, 300, text('Sharp-eyed', 'Зоркий глаз'), text('Catch the goblin palming his gem 3 times.', 'Трижды поймайте гоблина, когда он прячет камешек.')),
  deed('moneybags', 'banked', 10_000, 500, text('Moneybags', 'Толстосум'), text('Bring 10,000 gold home from the Labyrinth.', 'Принесите из лабиринта 10 000 золота.')),
  deed('chest-cracker', 'chests', 25, 500, text('Chest-cracker', 'Взломщик сундуков'), text('Open 25 Chests.', 'Откройте 25 сундуков.')),
  deed('legend-seeker', 'legendary', 1, 300, text('Legend-seeker', 'Искатель легенд'), text('Find a Legendary Item.', 'Найдите легендарный предмет.')),
  deed('sellsword', 'bounties', 20, 500, text('Sellsword', 'Наёмник'), text('Finish 20 Bounties.', 'Выполните 20 заданий.')),
  deed('well-diver', 'delves', 3, 500, text('Well-diver', 'Покоритель колодца'), text('Win all six Rooms of the Daily Delve three times.', 'Трижды пройдите все шесть комнат спуска дня.')),
  // Done in a Duo.
  deed('guardian-angel', 'raised', 5, 300, text('Guardian angel', 'Ангел-хранитель'), text('Stand your partner back up in a fight 5 times.', 'Пять раз поставьте напарника на ноги в бою.')),
  deed('twin-breaker', 'twins', 3, 500, text('Twin-breaker', 'Сокрушитель близнецов'), text('Defeat the Twin Wardens 3 times.', 'Трижды победите стражей-близнецов.')),
  deed('oathkeeper', 'oaths-kept', 5, 300, text('Oathkeeper', 'Хранитель клятв'), text('Share at an Oathstone 5 times while your partner shares too.', 'Пять раз поделитесь у камня клятв, когда делится и напарник.')),
  deed('oathbreaker', 'oaths-broken', 1, 100, text('Oathbreaker', 'Клятвопреступник'), text('Take at an Oathstone while your partner shares.', 'Заберите дары у камня клятв, пока напарник делится.')),
];

export const deedById = (id: string): DeedDef | undefined => DEEDS.find((d) => d.id === id);

/** The Deed counts a kill of each kin adds to (the Dragon's own kin counts through `dragon`). */
export const KILL_METRIC: Partial<Record<MonsterKin, DeedMetric>> = {
  goblinoid: 'kills-goblinoid', beast: 'kills-beast', undead: 'kills-undead', demon: 'kills-demon',
};

export type DeedCounts = Partial<Record<DeedMetric, number>>;

/** Adds `add` to the counts and raises `max` ones; returns new counts. */
export function tallyDeeds(counts: DeedCounts, add: DeedCounts, max: DeedCounts = {}): DeedCounts {
  const next: DeedCounts = { ...counts };
  for (const [metric, n] of Object.entries(add) as [DeedMetric, number][]) if (n) next[metric] = (next[metric] ?? 0) + n;
  for (const [metric, n] of Object.entries(max) as [DeedMetric, number][]) next[metric] = Math.max(next[metric] ?? 0, n);
  return next;
}

/** The Deeds these counts reach that aren't earned yet, in list order. */
export function newlyEarned(counts: DeedCounts, earned: readonly string[]): DeedDef[] {
  const done = new Set(earned);
  return DEEDS.filter((d) => !done.has(d.id) && (counts[d.metric] ?? 0) >= d.target);
}
