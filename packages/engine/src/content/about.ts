import { fireBomb } from '../combat.js';
import { CHEST_GRADES, CHEST_ODDS, type ChestGrade, RECIPES, REFORGE_COST, upgradeCost } from '../economy.js';
import { baseById } from './bases.js';
import { TIERS, TIER_TEXT, type Tier } from './loot.js';
import { type Text, text } from './text.js';

// What using a stackable Item does, for its card (docs/design.md → Items). The
// numbers come from the rules themselves, so the text can't drift from them.

const ruNumber = (n: number) => String(n).replace('.', ',');
/** "a, b and c" / "a, b и c". */
const list = (items: string[], and: string) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1)}`);
const withArticle = (name: string) => `${/^[AEIOU]/i.test(name) ? 'an' : 'a'} ${name}`;

const KEY_WITH: Record<ChestGrade, Text> = {
  iron: text('an Iron key', 'железным ключом'),
  silver: text('a Silver key', 'серебряным ключом'),
  gold: text('a Gold key', 'золотым ключом'),
};

function chestAbout(grade: ChestGrade): Text {
  const odds = CHEST_ODDS[grade];
  return text(
    `Open it with ${KEY_WITH[grade].en}: ${odds.map(([tier, p]) => `${TIER_TEXT[tier].en} ${p}%`).join(' · ')}.`,
    `Откройте ${KEY_WITH[grade].ru}: ${odds.map(([tier, p]) => `${TIER_TEXT[tier].ru} ${ruNumber(p)}%`).join(' · ')}.`,
  );
}

const KEYS: Record<ChestGrade, Text> = {
  iron: text('Opens an Iron chest, a Locked cache, or a Prisoner’s chains.', 'Открывает железный сундук, запертый тайник или цепи пленника.'),
  silver: text('Opens a Silver chest.', 'Открывает серебряный сундук.'),
  gold: text('Opens a Gold chest.', 'Открывает золотой сундук.'),
};

/** A Forge Material: the Upgrade levels, Reforges and crafts it pays for. */
function materialAbout(material: string): Text {
  const levels = Array.from({ length: 10 }, (_, i) => i + 1).filter((to) => upgradeCost('common', to).materials.some((m) => m.base === material));
  const reforged = TIERS.filter((tier: Tier) => REFORGE_COST[tier]?.materials.some((m) => m.base === material));
  const crafts = RECIPES.flatMap((r) => r.materials.filter((m) => m.base === material).map((m) => ({ makes: baseById(r.makes).name, quantity: m.quantity })));
  const en = ['A Forge Material.'];
  const ru = ['Материал для кузницы.'];
  if (levels.length > 0) {
    en.push(`Upgrades +${levels[0]} to +${levels.at(-1)}.`);
    ru.push(`Улучшения с +${levels[0]} до +${levels.at(-1)}.`);
  }
  if (reforged.length > 0) {
    en.push(`Reforging ${list(reforged.map((tier) => TIER_TEXT[tier].en), 'and')} Items.`);
    ru.push(`Перековка: ${list(reforged.map((tier) => `«${TIER_TEXT[tier].ru}»`), 'и')}.`);
  }
  if (crafts.length > 0) {
    en.push(`Crafts ${list(crafts.map((c) => `${withArticle(c.makes.en)} from ${c.quantity}`), 'and')}.`);
    ru.push(`Создание: ${list(crafts.map((c) => `${c.makes.ru.toLowerCase()} (нужно ${c.quantity})`), 'и')}.`);
  }
  return text(en.join(' '), ru.join(' '));
}

const bomb = fireBomb(1);

const ABOUT: Record<string, Text> = {
  potion: text(
    'Heals 2d4 + 2 plus a tenth of full health. Drink it from the Bag; in a fight the Hero drinks one below 30% health, at most 3 a fight.',
    'Лечит 2d4 + 2 и ещё десятую часть полного здоровья. Выпейте из сумки; в бою герой пьёт зелье сам, когда здоровья меньше 30%, — не больше 3 за бой.',
  ),
  'scroll-identify': text(
    'Reveals an Unidentified Item’s Quality, Bonus stats and power. Wizards identify for free.',
    'Раскрывает качество, бонусы и силу неопознанного предмета. Волшебники опознают без свитков.',
  ),
  'scroll-portal': text(
    'Read it anywhere outside a fight to go home to the City. The Town Portal stays open for a day, to step back through once.',
    'Прочтите где угодно вне боя, чтобы вернуться в город. Портал открыт ещё сутки, чтобы один раз шагнуть обратно.',
  ),
  'scroll-protection': text(
    'At the Forge, an Upgrade that would destroy the Item drops it one level instead. It burns only when it saves the Item.',
    'В кузнице улучшение, которое уничтожило бы предмет, лишь снижает его на один уровень. Сгорает, только когда спасает предмет.',
  ),
  'bomb-fire': text(
    `Thrown before a fight’s first round: ${bomb.dice}d${bomb.sides} + ${bomb.bonus} per Floor number damage to every monster.`,
    `Бросается перед первым раундом боя: ${bomb.dice}d${bomb.sides} + ${bomb.bonus} за номер этажа урона каждому монстру.`,
  ),
  'bomb-smoke': text(
    'Makes a Sneak past monsters certain, with no roll. Mini-bosses and the Boss still can’t be snuck past.',
    'С ней прокрасться мимо монстров удаётся наверняка, без броска. Мимо мини-боссов и босса — всё равно нельзя.',
  ),
  scrap: materialAbout('scrap'),
  essence: materialAbout('essence'),
  soulstone: materialAbout('soulstone'),
  ...Object.fromEntries(CHEST_GRADES.map((grade) => [`key-${grade}`, KEYS[grade]])),
  ...Object.fromEntries(CHEST_GRADES.map((grade) => [`chest-${grade}`, chestAbout(grade)])),
};

/** What using one of these does, or null for gear (its card shows its fight numbers instead). */
export const itemAbout = (base: string): Text | null => ABOUT[base] ?? null;
