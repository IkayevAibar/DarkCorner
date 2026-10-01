import type { ThemeId } from './floors.js';
import { type Text, text } from './text.js';

export type MonsterKin = 'beast' | 'goblinoid' | 'undead' | 'demon' | 'dragonkin' | 'humanoid';

/**
 * What makes a monster more than numbers: its signature in a fight
 * (docs/design.md → Monsters). Save DCs grow by 1 for every two Floors
 * deeper into a theme, as attacks and damage do.
 */
export type MonsterPower =
  /** Advantage on attacks while another monster of the group still stands. */
  | { id: 'pack' }
  /** Strikes early: +5 to initiative. */
  | { id: 'quick' }
  /** A hit snatches carried gold; it runs with it on its next turn unless it falls first. */
  | { id: 'thief' }
  /** Bones: blunt weapons deal half again as much, piercing ones a quarter less. */
  | { id: 'brittle' }
  /** A hit calls for a CON save; failing it, the Hero loses its next turn. */
  | { id: 'paralyze'; dc: number }
  /** The first blow that would drop it (not a critical hit) leaves it at 1 health half the time. */
  | { id: 'undying' }
  /** Heals itself for half the damage it deals. */
  | { id: 'drain' }
  /** Once per fight, instead of attacking, heals an ally below half health. */
  | { id: 'mend'; dice: [number, number] }
  /** A hit sets the Hero burning: `dice` damage at the start of its next `turns` turns. */
  | { id: 'burn'; turns: number; dice: [number, number] }
  /** Ready at the start and again on a 5–6 on a d6 each turn: a DEX save halves it. */
  | { id: 'breath'; dice: [number, number]; dc: number }
  /** Several attacks each turn. */
  | { id: 'multiattack'; attacks: number }
  /** As the fight starts: a WIS save, or disadvantage on attacks for `rounds` rounds. */
  | { id: 'frighten'; dc: number; rounds: number }
  /** Below half health, once: +2 AC, +1 to hit, and its breath (if any) is ready again. */
  | { id: 'enrage' }
  /** A hit calls for a CON save; failing it, `dice` poison damage at the start of the Hero's next `turns` turns. */
  | { id: 'poison'; dc: number; turns: number; dice: [number, number] }
  /** When it falls, its bomb goes off: `dice` damage to the Hero, a DEX save halves it. */
  | { id: 'explode'; dc: number; dice: [number, number] }
  /** A cloud of small bodies: weapon hits deal half damage, bursts and Fire bombs double. */
  | { id: 'swarm' }
  /** As the fight starts, a scream: `dice` damage to the Hero, a WIS save halves it. */
  | { id: 'wail'; dc: number; dice: [number, number] }
  /** Bound to its twin: fallen while the twin stands, it rises at the end of the round. Only both falling in one round ends them. */
  | { id: 'twin' };

export type MonsterPowerId = MonsterPower['id'];

export interface MonsterDef {
  id: string;
  name: Text;
  /** What it is, for the monster's card: a line or two. */
  about: Text;
  theme: ThemeId;
  kin: MonsterKin;
  /** Token art under apps/web/public/art/tokens; null until painted. */
  art: string | null;
  /** Wardens: the Twin Wardens behind a Twin door, faced only by a Duo. */
  role: 'minion' | 'brute' | 'miniboss' | 'boss' | 'warden';
  hp: number;
  ac: number;
  /** Attack bonus added to the d20. */
  attack: number;
  /** [dice, sides, bonus]. */
  damage: [number, number, number];
  dex: number;
  xp: number;
  /** How often it shows up in a fight Room of its theme. */
  weight: number;
  powers?: MonsterPower[];
  /** Mini-bosses: who fights at their side. */
  escort?: string[];
  /** Shows up on any Floor (a trap, not a Room's own monsters): it grows as if it lived there. */
  anywhere?: boolean;
}

const m = (d: MonsterDef) => d;

/** Season 0 bestiary. Stats are v0 and get tuned by the balance tests. */
export const MONSTERS: MonsterDef[] = [
  // Floors 1–3: goblin warrens and beasts
  m({ id: 'giant-rat', name: text('Giant rat', 'Гигантская крыса'), theme: 'warrens', kin: 'beast', art: '/art/tokens/giant-rat.webp', role: 'minion', hp: 4, ac: 11, attack: 3, damage: [1, 4, 1], dex: 14, xp: 6, weight: 3,
    about: text('Warren vermin grown fat on what the goblins leave. Weak alone, but they rarely come alone.', 'Подвальные твари, разжиревшие на объедках гоблинов. Поодиночке слабы, но поодиночке и не ходят.') }),
  m({ id: 'goblin', name: text('Goblin', 'Гоблин'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin.webp', role: 'minion', hp: 7, ac: 12, attack: 3, damage: [1, 6, 1], dex: 14, xp: 10, weight: 4,
    about: text('Small, spiteful and brave only in numbers. Cheap blades, cheaper tricks.', 'Мелкий, злобный и храбрый только в толпе. Дешёвые клинки и ещё более дешёвые уловки.') }),
  m({ id: 'goblin-archer', name: text('Goblin archer', 'Гоблин-лучник'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-archer.webp', role: 'minion', hp: 6, ac: 12, attack: 3, damage: [1, 6, 1], dex: 16, xp: 10, weight: 2,
    powers: [{ id: 'quick' }],
    about: text('Shoots first from the dark and runs when the arrows run out.', 'Стреляет первым из темноты и удирает, когда кончаются стрелы.') }),
  m({ id: 'goblin-cutpurse', name: text('Goblin cutpurse', 'Гоблин-карманник'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-cutpurse.webp', role: 'minion', hp: 6, ac: 13, attack: 4, damage: [1, 4, 1], dex: 16, xp: 12, weight: 2,
    powers: [{ id: 'thief' }],
    about: text('Aims for the purse, not the throat. Bring it down before it slips away with your gold.', 'Метит в кошелёк, а не в горло. Уложите его, пока он не сбежал с вашим золотом.') }),
  m({ id: 'wolf', name: text('Wolf', 'Волк'), theme: 'warrens', kin: 'beast', art: '/art/tokens/wolf.webp', role: 'brute', hp: 11, ac: 12, attack: 3, damage: [2, 4, 0], dex: 15, xp: 18, weight: 2,
    powers: [{ id: 'pack' }],
    about: text('Hunts in packs, and bites harder while the rest of the pack still stands.', 'Охотится стаей и кусает злее, пока остальная стая ещё на ногах.') }),
  m({ id: 'goblin-sapper', name: text('Goblin sapper', 'Гоблин-подрывник'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-sapper.webp', role: 'minion', hp: 5, ac: 11, attack: 3, damage: [1, 4, 1], dex: 13, xp: 12, weight: 2,
    powers: [{ id: 'explode', dc: 10, dice: [2, 4] }],
    about: text('Carries a lit bomb and no plan. When it falls, the bomb goes off.', 'Таскает зажжённую бомбу и никакого плана. Когда он падает, бомба взрывается.') }),
  m({ id: 'goblin-shaman', name: text('Goblin shaman', 'Гоблин-шаман'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-shaman.webp', role: 'minion', hp: 8, ac: 11, attack: 3, damage: [1, 6, 0], dex: 12, xp: 14, weight: 1,
    powers: [{ id: 'mend', dice: [1, 8] }],
    about: text('Bones in its hair and a charm for every wound: once a fight it patches up a badly hurt friend.', 'Кости в волосах и заговор на каждую рану: раз за бой латает тяжело раненого друга.') }),
  m({ id: 'bat-swarm', name: text('Bat swarm', 'Стая летучих мышей'), theme: 'warrens', kin: 'beast', art: '/art/tokens/bat-swarm.webp', role: 'minion', hp: 9, ac: 12, attack: 3, damage: [1, 4, 0], dex: 16, xp: 10, weight: 2,
    powers: [{ id: 'swarm' }, { id: 'quick' }],
    about: text('A hundred wings and teeth. Blades find little to cut; fire finds plenty.', 'Сотня крыльев и зубов. Клинку тут почти нечего рубить, а огню есть чем поживиться.') }),
  m({ id: 'giant-spider', name: text('Giant spider', 'Гигантский паук'), theme: 'warrens', kin: 'beast', art: '/art/tokens/giant-spider.webp', role: 'brute', hp: 12, ac: 12, attack: 3, damage: [1, 6, 1], dex: 15, xp: 20, weight: 2,
    powers: [{ id: 'poison', dc: 10, turns: 2, dice: [1, 4] }],
    about: text('Waits in the corners the torchlight misses. Its bite keeps burning long after.', 'Ждёт в углах, куда не достаёт свет факела. Его укус жжёт ещё долго.') }),
  m({ id: 'goblin-chieftain', name: text('Goblin chieftain', 'Вождь гоблинов'), theme: 'warrens', kin: 'goblinoid', art: '/art/tokens/goblin-chieftain.webp', role: 'miniboss', hp: 34, ac: 15, attack: 5, damage: [2, 6, 3], dex: 14, xp: 90, weight: 0,
    escort: ['goblin-archer'],
    about: text('The biggest goblin in the warrens, and the loudest. Never fights without archers at its back.', 'Самый крупный гоблин в норах и самый громкий. Без лучников за спиной в бой не идёт.') }),

  // Floors 4–6: undead crypts
  m({ id: 'skeleton', name: text('Skeleton', 'Скелет'), theme: 'crypts', kin: 'undead', art: '/art/tokens/skeleton.webp', role: 'minion', hp: 13, ac: 13, attack: 4, damage: [1, 6, 2], dex: 14, xp: 25, weight: 4,
    powers: [{ id: 'brittle' }],
    about: text('Old bones held together by old hate. Blunt weapons shatter it; arrows slip through.', 'Старые кости, скреплённые старой ненавистью. Дробящее оружие крошит их, а стрелы проходят насквозь.') }),
  m({ id: 'zombie', name: text('Zombie', 'Зомби'), theme: 'crypts', kin: 'undead', art: '/art/tokens/zombie.webp', role: 'minion', hp: 20, ac: 8, attack: 3, damage: [1, 6, 1], dex: 6, xp: 25, weight: 3,
    powers: [{ id: 'undying' }],
    about: text('Slow and stupid, and very hard to put down for good.', 'Медленный и тупой, и его очень трудно упокоить насовсем.') }),
  m({ id: 'ghoul', name: text('Ghoul', 'Упырь'), theme: 'crypts', kin: 'undead', art: '/art/tokens/ghoul.webp', role: 'brute', hp: 22, ac: 12, attack: 4, damage: [2, 6, 1], dex: 15, xp: 45, weight: 2,
    powers: [{ id: 'paralyze', dc: 10 }],
    about: text('Its claws numb the flesh: one bad scratch and a turn is lost.', 'Когти упыря парализуют: одна неудачная царапина, и ход потерян.') }),
  m({ id: 'wraith', name: text('Wraith', 'Призрак'), theme: 'crypts', kin: 'undead', art: '/art/tokens/wraith.webp', role: 'brute', hp: 28, ac: 13, attack: 5, damage: [2, 8, 1], dex: 16, xp: 90, weight: 1,
    powers: [{ id: 'drain' }],
    about: text('A cold shadow that drinks the life it takes, and heals on it.', 'Холодная тень, которая пьёт отнятую жизнь и ею же лечится.') }),
  m({ id: 'grave-robber', name: text('Grave robber', 'Расхититель могил'), theme: 'crypts', kin: 'humanoid', art: '/art/tokens/grave-robber.webp', role: 'minion', hp: 16, ac: 13, attack: 4, damage: [1, 6, 2], dex: 16, xp: 30, weight: 2,
    powers: [{ id: 'thief' }, { id: 'quick' }],
    about: text('Came for the dead and found you instead. Quick hands, quicker feet.', 'Пришёл за мертвецами, а нашёл вас. Быстрые руки и ещё более быстрые ноги.') }),
  m({ id: 'banshee', name: text('Banshee', 'Банши'), theme: 'crypts', kin: 'undead', art: '/art/tokens/banshee.webp', role: 'brute', hp: 24, ac: 12, attack: 4, damage: [1, 8, 1], dex: 14, xp: 60, weight: 1,
    powers: [{ id: 'wail', dc: 12, dice: [2, 6] }],
    about: text('Its scream opens the fight before any blade can. Steady nerves take half of it.', 'Её крик начинает бой раньше любого клинка. Крепкие нервы вдвое его ослабляют.') }),
  m({ id: 'mummy', name: text('Mummy', 'Мумия'), theme: 'crypts', kin: 'undead', art: '/art/tokens/mummy.webp', role: 'brute', hp: 30, ac: 11, attack: 5, damage: [2, 6, 2], dex: 8, xp: 80, weight: 1,
    powers: [{ id: 'undying' }, { id: 'frighten', dc: 11, rounds: 1 }],
    about: text('Wrapped in rotting linen and older curses. Its dead stare freezes the nerve, and it rarely stays down.', 'Завёрнута в гнилые бинты и ещё более древние проклятия. Её мёртвый взгляд сковывает волю, и лежать она не любит.') }),
  m({ id: 'rot-grubs', name: text('Rot grubs', 'Трупные личинки'), theme: 'crypts', kin: 'beast', art: '/art/tokens/rot-grubs.webp', role: 'minion', hp: 10, ac: 9, attack: 4, damage: [1, 4, 1], dex: 10, xp: 25, weight: 2,
    powers: [{ id: 'swarm' }, { id: 'poison', dc: 11, turns: 2, dice: [1, 6] }],
    about: text('A writhing heap of pale maggots that burrow into flesh. Blades are wasted on them; fire is not.', 'Копошащаяся куча бледных личинок, что вгрызаются в плоть. Клинки на них тратить бесполезно, а вот огонь — нет.') }),
  m({ id: 'bone-knight', name: text('Bone knight', 'Костяной рыцарь'), theme: 'crypts', kin: 'undead', art: '/art/tokens/bone-knight.webp', role: 'miniboss', hp: 70, ac: 17, attack: 6, damage: [2, 8, 5], dex: 12, xp: 250, weight: 0,
    powers: [{ id: 'undying' }], escort: ['skeleton'],
    about: text('Swore to guard these crypts forever, and keeps the oath. Skeletons march at its side.', 'Поклялся вечно стеречь эти склепы и держит клятву. Рядом с ним шагают скелеты.') }),

  // Floors 7–9: demon-touched depths
  m({ id: 'cultist', name: text('Cultist', 'Культист'), theme: 'depths', kin: 'humanoid', art: '/art/tokens/cultist.webp', role: 'minion', hp: 20, ac: 12, attack: 5, damage: [1, 8, 2], dex: 12, xp: 45, weight: 3,
    powers: [{ id: 'mend', dice: [2, 8] }],
    about: text('Sworn to what lives below. Patches up its allies with dark prayers.', 'Служит тому, что живёт внизу. Латает союзников тёмными молитвами.') }),
  m({ id: 'imp', name: text('Imp', 'Бес'), theme: 'depths', kin: 'demon', art: '/art/tokens/imp.webp', role: 'minion', hp: 16, ac: 13, attack: 5, damage: [1, 6, 2], dex: 17, xp: 50, weight: 4,
    powers: [{ id: 'burn', turns: 2, dice: [1, 4] }],
    about: text('A giggling spark of the pit. Its touch sets clothes and skin burning.', 'Хихикающая искра преисподней. От его касания загораются одежда и кожа.') }),
  m({ id: 'hellhound', name: text('Hellhound', 'Адская гончая'), theme: 'depths', kin: 'demon', art: '/art/tokens/hellhound.webp', role: 'brute', hp: 42, ac: 15, attack: 6, damage: [1, 8, 3], dex: 14, xp: 100, weight: 2,
    powers: [{ id: 'breath', dice: [3, 6], dc: 13 }],
    about: text('A hound of smoke and cinders. It opens with a breath of fire, and a quick dodge halves it.', 'Пёс из дыма и углей. Начинает с огненного дыхания, и ловкий уворот вдвое его ослабляет.') }),
  m({ id: 'demon-brute', name: text('Demon brute', 'Демон-громила'), theme: 'depths', kin: 'demon', art: '/art/tokens/demon-brute.webp', role: 'brute', hp: 60, ac: 14, attack: 7, damage: [1, 8, 3], dex: 10, xp: 160, weight: 1,
    powers: [{ id: 'multiattack', attacks: 2 }],
    about: text('All muscle and fury. It strikes twice every turn.', 'Сплошные мышцы и ярость. Бьёт дважды за ход.') }),
  m({ id: 'flame-skull', name: text('Flame skull', 'Пылающий череп'), theme: 'depths', kin: 'undead', art: '/art/tokens/flame-skull.webp', role: 'minion', hp: 18, ac: 14, attack: 6, damage: [1, 6, 3], dex: 16, xp: 55, weight: 2,
    powers: [{ id: 'burn', turns: 2, dice: [1, 6] }, { id: 'quick' }],
    about: text('A burning skull that darts through the dark. Its fire clings long after it strikes.', 'Пылающий череп, что носится во тьме. Его огонь цепляется ещё долго после удара.') }),
  m({ id: 'night-hag', name: text('Night hag', 'Ночная карга'), theme: 'depths', kin: 'demon', art: '/art/tokens/night-hag.webp', role: 'brute', hp: 40, ac: 14, attack: 6, damage: [2, 6, 2], dex: 14, xp: 110, weight: 1,
    powers: [{ id: 'drain' }, { id: 'frighten', dc: 13, rounds: 1 }],
    about: text('It feeds on fear, and on the life it steals. Don’t meet its eyes.', 'Питается страхом и отнятой жизнью. Не встречайтесь с ней взглядом.') }),
  m({ id: 'chain-devil', name: text('Chain devil', 'Цепной дьявол'), theme: 'depths', kin: 'demon', art: '/art/tokens/chain-devil.webp', role: 'brute', hp: 55, ac: 15, attack: 7, damage: [1, 8, 3], dex: 12, xp: 150, weight: 1,
    powers: [{ id: 'multiattack', attacks: 2 }, { id: 'enrage' }],
    about: text('Wrapped in hooked chains that lash twice a turn, and it only gets worse once it’s hurt.', 'Обмотан крючковатыми цепями, что хлещут дважды за ход, а раненый он становится только злее.') }),
  m({ id: 'horned-tyrant', name: text('Horned tyrant', 'Рогатый тиран'), theme: 'depths', kin: 'demon', art: '/art/tokens/horned-tyrant.webp', role: 'miniboss', hp: 85, ac: 16, attack: 8, damage: [1, 10, 3], dex: 12, xp: 500, weight: 0,
    powers: [{ id: 'multiattack', attacks: 2 }, { id: 'frighten', dc: 14, rounds: 2 }], escort: ['imp'],
    about: text('Lord of these depths. Its roar breaks the nerve, and imps fight at its side.', 'Владыка этих глубин. Его рёв лишает мужества, а рядом с ним сражаются бесы.') }),

  // Floor 10: the Dragon's lair
  m({ id: 'kobold', name: text('Kobold', 'Кобольд'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/kobold.webp', role: 'minion', hp: 24, ac: 14, attack: 7, damage: [1, 8, 3], dex: 15, xp: 60, weight: 3,
    powers: [{ id: 'pack' }],
    about: text('The Dragon’s little servants: fierce in a pack and fanatically loyal.', 'Маленькие слуги дракона: свирепы в стае и фанатично преданы.') }),
  m({ id: 'drake', name: text('Drake', 'Дрейк'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/drake.webp', role: 'brute', hp: 90, ac: 17, attack: 9, damage: [2, 8, 4], dex: 12, xp: 250, weight: 2,
    powers: [{ id: 'breath', dice: [7, 6], dc: 15 }],
    about: text('A young cousin of the Dragon with a hot temper and a scorching breath.', 'Молодой родич дракона с горячим нравом и обжигающим дыханием.') }),
  m({ id: 'ancient-dragon', name: text('The Ancient Dragon', 'Древний дракон'), theme: 'lair', kin: 'dragonkin', art: '/art/tokens/dragon.webp', role: 'boss', hp: 700, ac: 20, attack: 13, damage: [2, 10, 6], dex: 10, xp: 5000, weight: 0,
    powers: [{ id: 'multiattack', attacks: 2 }, { id: 'breath', dice: [12, 6], dc: 17 }, { id: 'frighten', dc: 15, rounds: 2 }, { id: 'enrage' }],
    about: text('The Season’s Boss. Two attacks a turn, fire that fills the lair, a roar that breaks courage, and fury when wounded.', 'Босс сезона. Две атаки за ход, пламя на всё логово, рёв, ломающий мужество, и ярость, когда ранен.') }),

  // Behind a Twin door on Floors 1–9, for a Duo: the Twin Wardens. Their numbers are WARDENS', for the Floor's theme.
  m({ id: 'dawn-warden', name: text('Dawn Warden', 'Страж рассвета'), theme: 'warrens', kin: 'humanoid', art: null, role: 'warden', hp: 30, ac: 14, attack: 5, damage: [1, 10, 3], dex: 10, xp: 80, weight: 0,
    powers: [{ id: 'twin' }, { id: 'mend', dice: [2, 8] }],
    about: text('A stone guardian lit from within like the morning. It mends its twin once, and rises again while its twin stands.', 'Каменный страж, светящийся изнутри, как утро. Один раз лечит своего близнеца и встаёт снова, пока тот на ногах.') }),
  m({ id: 'dusk-warden', name: text('Dusk Warden', 'Страж заката'), theme: 'warrens', kin: 'humanoid', art: null, role: 'warden', hp: 30, ac: 14, attack: 5, damage: [1, 10, 3], dex: 10, xp: 80, weight: 0,
    powers: [{ id: 'twin' }, { id: 'drain' }],
    about: text('Its twin’s shadow, cut from the same stone. It drinks the life it strikes, and rises again while its twin stands.', 'Тень своего близнеца из того же камня. Пьёт жизнь тех, кого бьёт, и встаёт снова, пока близнец на ногах.') }),

  // Anywhere: the prisoner who isn't one (Prisoner).
  m({ id: 'doppelganger', name: text('Doppelganger', 'Двойник'), theme: 'warrens', kin: 'humanoid', art: '/art/tokens/doppelganger.webp', role: 'brute', hp: 20, ac: 13, attack: 5, damage: [1, 8, 2], dex: 16, xp: 45, weight: 0,
    powers: [{ id: 'quick' }], anywhere: true,
    about: text('It wore a prisoner’s face. It strikes before anyone sees what it is.', 'Оно носило лицо пленника и бьёт раньше, чем кто-то поймёт, что это.') }),

  // Anywhere: the chest that bites (Three chests).
  m({ id: 'mimic', name: text('Mimic', 'Мимик'), theme: 'warrens', kin: 'beast', art: '/art/tokens/mimic.webp', role: 'brute', hp: 16, ac: 12, attack: 4, damage: [1, 8, 2], dex: 12, xp: 40, weight: 0, anywhere: true,
    about: text('A chest with teeth. It was waiting for someone greedy.', 'Сундук с зубами. Он ждал кого-нибудь пожаднее.') }),
];

const BY_ID = new Map(MONSTERS.map((d) => [d.id, d]));

/** The Twin Wardens, in their keys' order. */
export const TWIN_WARDENS = ['dawn-warden', 'dusk-warden'] as const;

/**
 * The Twin Wardens' numbers on each theme's Floors (v0), before each Floor's own growth:
 * set to be a fight for a Duo, so no Duo toughening goes on top.
 */
export const WARDENS: Record<Exclude<ThemeId, 'lair'>, Pick<MonsterDef, 'hp' | 'ac' | 'attack' | 'damage' | 'xp'>> = {
  warrens: { hp: 26, ac: 14, attack: 5, damage: [1, 10, 2], xp: 80 },
  crypts: { hp: 62, ac: 16, attack: 7, damage: [2, 6, 4], xp: 220 },
  depths: { hp: 105, ac: 17, attack: 9, damage: [2, 8, 5], xp: 420 },
};

export function monsterById(id: string): MonsterDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown monster "${id}"`);
  return def;
}

// ─── Elite packs ──────────────────────────────────────────────────────────

export const ELITES = ['gilded', 'frenzied', 'armored', 'vampiric', 'swift'] as const;
export type EliteId = (typeof ELITES)[number];

/**
 * From Floor 2 down, a group sometimes follows an elite: its strongest monster
 * gets one of these (v0). Every elite has more health and is worth double XP and
 * one more Item. Gilded ones are what Players hope for: triple gold.
 */
export const ELITE_CHANCE: Record<ThemeId, number> = { warrens: 0.1, crypts: 0.15, depths: 0.2, lair: 0.25 };
export const ELITE_HP = 1.25;
export const GILDED_HP = 1.5;
export const GILDED_GOLD = 3;
