import type { LocalizedText } from '@dark/shared';

/**
 * What's new: the game's patch notes, newest first. Each release adds an entry at
 * the top with a new id; the top bar marks it until the Player has seen it.
 * Every entry has its own literal id; point LATEST_NEWS_ID in newsState.ts at the newest
 * (news.test.ts checks). Nothing else changes when an entry is added, so two branches
 * that each add one meet as a plain conflict at the top, never a silent mix-up.
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
    id: '2026-10-10-lock-ink',
    date: '2026-10-10',
    title: t('Feel the lock give', 'Щелчок замка'),
    items: [t('Lockpicking now shows the lock’s three pins, the picks that snap, and the final turn before the Chest appears. The timing stays the same.',
      'При взломе видны три штифта, сломанные отмычки и поворот замка перед появлением сундука. Момент нажатия определяется по прежним правилам.')],
  },
  {
    id: '2026-10-10-boss-paths',
    date: '2026-10-10',
    title: t('Evokers and Wild Magic against the Dragon', 'Воплотители и дикая магия против дракона'),
    items: [
      t('From level 9, an Evoker’s attack spells and Bursts deal 50% more to the Boss, and a Wild Magic Sorcerer’s 75% more.',
        'С 9-го уровня боевые заклинания и взрывы воплотителя наносят боссу на 50% больше урона, а чародея дикой магии — на 75% больше.'),
      t('Both Paths almost never beat the Dragon; now they do about as often as the other Boss Paths. Every other fight stays as it was.',
        'Оба пути почти никогда не побеждали дракона, а теперь побеждают примерно так же часто, как другие пути против босса. Все остальные бои не изменились.'),
    ],
  },
  {
    id: '2026-10-10-action-surge',
    date: '2026-10-10',
    title: t('Action Surge for the Fighter', 'Всплеск действий для воина'),
    items: [
      t('From level 2, once a fight, a Fighter can make every attack again in the same turn; twice a fight from level 17. On Auto it surges as a hard fight starts; in a fight played by hand it has its own button.',
        'Со 2-го уровня воин раз за бой может повторить все атаки в тот же ход, а с 17-го — дважды за бой. В авто-бою всплеск приходит в начале тяжёлого боя, а в бою по ходам у него своя кнопка.'),
      t('The Fighter was the weakest Class against Mini-bosses. Now it sits in the middle.',
        'Воин был слабее всех против мини-боссов. Теперь он в середине.'),
    ],
  },
  {
    id: '2026-10-10-classes',
    date: '2026-10-10',
    title: t('Six new Classes', 'Шесть новых классов'),
    items: [
      t('The Paladin, Warlock, Monk, Druid, Bard and Sorcerer join the Labyrinth, each with two Paths. A new Player meets them in Quick start; a Hero Retired at the Temple can come back as one.',
        'В лабиринт приходят паладин, колдун, монах, друид, бард и чародей, у каждого по два пути. Новый игрок найдёт их в быстром старте, а героя, отправленного на покой в храме, можно заменить одним из них.'),
      t('The Paladin smites with holy fire and lays on hands. The Warlock blasts at will and Hexes the toughest foe. The Monk fights without armor, in a flurry of blows.',
        'Паладин карает святым огнём и исцеляет наложением рук. Колдун бьёт мистическими зарядами и наводит порчу на самого опасного врага. Монах сражается без доспехов, шквалом ударов.'),
      t('The Druid heals and takes a Wild shape. The Bard mocks foes off balance and turns rolls with Bardic inspiration. The Sorcerer spends sorcery points on Bursts of fire and Quickened spells.',
        'Друид лечит и принимает дикий облик. Бард насмешками выводит врагов из равновесия и меняет исход бросков вдохновением. Чародей тратит очки чародейства на огненные взрывы и ускоренные заклинания.'),
      t('In a fight played by hand, each power has its own button: Divine smite, Hex, Flurry of blows, Wild shape, Quickened spell, Lay on hands.',
        'В бою по ходам у каждой силы своя кнопка: божественная кара, порча, шквал ударов, дикий облик, ускоренное заклинание, наложение рук.'),
      t('They borrow other Classes’ portraits until their own are painted.', 'Пока их портреты не нарисованы, они носят портреты других классов.'),
    ],
  },
  {
    id: '2026-10-10-harder',
    date: '2026-10-10',
    title: t('Harder alone', 'Одному — тяжелее'),
    items: [
      t('From Floor 3 down, a Hero alone now meets tougher monsters: more health, harder blows, bigger groups and more elites. Expect more Risky and Dangerous Doors, and Mini-bosses that win about half the time. Floors 1 and 2 stay as they were.',
        'С 3-го этажа герой-одиночка теперь встречает монстров покрепче: больше здоровья, сильнее удары, группы побольше и чаще элита. Рискованных и опасных дверей станет больше, а мини-боссы побеждают примерно в половине боёв. Этажи 1 и 2 остались прежними.'),
      t('A Duo keeps the old numbers: going down together is now the easier road.',
        'Для дуэта всё осталось по-старому: вдвоём теперь идти легче.'),
    ],
  },
  {
    id: '2026-10-10-armory',
    date: '2026-10-10',
    title: t('A fuller armory', 'Арсенал пополнился'),
    items: [
      t('Twelve new kinds of gear drop now: flails, morningstars, halberds, the hand crossbow (a bow for one hand, so a shield fits beside it), tomes for Wizards, half plate, splint mail, circlets, bracers, greaves, talismans and signet rings.',
        'Теперь выпадают двенадцать новых видов снаряжения: цепы, моргенштерны, алебарды, ручной арбалет (лук для одной руки, так что рядом поместится щит), фолианты для волшебников, полулаты, наборный доспех, венцы, наручи, поножи, талисманы и перстни-печатки.'),
      t('Thirteen new named uniques: seven Legendaries, four Mythics and two Relics, among them the Quickdraw, Gravechain, Trollheart, Titanfall and Worldbreaker. Each has its own power; tap one to read it.',
        'Тринадцать новых именных предметов: семь легендарных, четыре мифических и две реликвии, среди них Скорострел, Цепь могильщика, Сердце тролля, Погибель титанов и Сокрушитель миров. У каждого своя сила — нажмите, чтобы прочитать.'),
      t('Every kind of gear is being painted, so the Bag will soon be pictures instead of symbols. Until then the new Items wear the old icons.',
        'Каждый вид снаряжения сейчас рисуется, так что скоро в сумке будут картины вместо значков. А пока новые предметы носят старые значки.'),
    ],
  },
  {
    id: '2026-10-10-bestiary',
    date: '2026-10-10',
    title: t('Twenty-two new monsters', 'Двадцать два новых монстра'),
    items: [
      t('The Labyrinth is fuller: 22 new monsters across every part of it, and the Dragon’s lair finally holds more than kobolds and drakes: wyrmlings, wyverns, salamanders, scale-sworn and kobold shieldbearers.',
        'В Лабиринте стало теснее: 22 новых монстра во всех его частях, а в логове дракона теперь не только кобольды и дрейки: дракончики, виверны, саламандры, чешуйчатые латники и кобольды-щитоносцы.'),
      t('Eight new powers, each with an answer. Bodyguards shield the others, so bring them down first; some heal every turn unless fire touches them; some crack your armor; some burn whoever strikes them with steel; some hold you still with a look. Tap a monster to read what it does.',
        'Восемь новых умений, и на каждое есть ответ. Телохранители прикрывают остальных, так что валите их первыми; одни лечатся каждый ход, пока их не коснётся огонь; другие раскалывают доспех; третьи обжигают того, кто бьёт их сталью; четвёртые приковывают взглядом. Нажмите на монстра — увидите, что он умеет.'),
      t('Every Floor from 1 to 9 now has its own Mini-boss: the Broodmother, the Bugbear, the Necromancer, the Vampire lord, the Hierophant and the Pit fiend join the three you know, each as hard as the old one was on its Floor. Their portraits are still being painted; until then they fight as lettered discs.',
        'Теперь на каждом этаже с 1-го по 9-й свой мини-босс: к трём знакомым добавились паучья матка, багбир, некромант, вампир-владыка, иерофант и исчадие бездны, каждый не сложнее прежнего на своём этаже. Их портреты ещё рисуются; пока они сражаются в виде дисков с буквой.'),
    ],
  },
  {
    id: '2026-10-07-rage',
    date: '2026-10-07',
    title: t('Barbarians, a little less unstoppable', 'Варвары уже не так несокрушимы'),
    items: [
      t('Rage is one point smaller: +1 damage on every hit and 1 less from every blow (2 from level 9, 3 from 16). A Berserker’s Frenzy now comes once it is below half health. Barbarians won nearly every Mini-boss fight; they stay the sturdiest Class, as the most health should make them, but a Mini-boss can win now.',
        'Ярость стала на единицу слабее: +1 к урону каждого удара и на 1 меньше от каждого удара по варвару (2 с 9-го уровня, 3 с 16-го). Бешенство берсерка теперь приходит, когда здоровья меньше половины. Варвары выигрывали почти любой бой с мини-боссом; они по-прежнему самые стойкие, как и положено при самом большом здоровье, но теперь мини-босс может и победить.'),
    ],
  },
  {
    id: '2026-10-07-uncanny',
    date: '2026-10-07',
    title: t('Rogues, a little less untouchable', 'Плуты чуть уязвимее'),
    items: [
      t('Uncanny dodge now halves the first hit on a Rogue in each fight, not in each round. It made Rogues all but unbeatable: they won nearly every Mini-boss fight, where the other Classes win from half to four in five. Sneak attack, the dagger in the off-hand and the Paths stay as they were.',
        'Невероятное уклонение теперь вдвое ослабляет первый удар по плуту в каждом бою, а не в каждом раунде. Из-за него плуты были почти неуязвимы: выигрывали почти любой бой с мини-боссом, тогда как другие классы — от половины до четырёх из пяти. Скрытая атака, кинжал во второй руке и пути остаются как были.'),
    ],
  },
  {
    id: '2026-10-07-routes',
    date: '2026-10-07',
    title: t('Routes on the Map', 'Маршруты на карте'),
    items: [
      t('You asked for it: the Map marks every Room you have cleared with a check until it fills again (tap it to see when), and a "!" where something waits again.',
        'Вы просили — сделано: карта отмечает галочкой каждую зачищенную комнату, пока она снова не наполнится (нажмите на неё — будет видно, когда), а «!» — там, где снова что-то ждёт.'),
      t('Tap any Room on the Map to plan a Route there: the cheapest known way, round monsters and locks when it can, drawn on the Map with the next Door glowing in the Room. "Walk there" walks it Door by Door and stops wherever something happens.',
        'Нажмите на любую комнату на карте — и маршрут туда готов: самый дешёвый известный путь, по возможности в обход монстров и замков. Он нарисован на карте, а следующая дверь светится в комнате. «Идти туда» проводит по нему дверь за дверью и останавливается, как только что-то случается.'),
    ],
  },
  {
    id: '2026-10-07-hands',
    date: '2026-10-07',
    title: t('A dagger in each hand', 'По кинжалу в каждую руку'),
    items: [
      t('You asked for it: a dagger now goes in either hand. In the off-hand, beside a weapon, it strikes once more each turn you attack. It is the weaker blow: no ability modifier, and never a Sneak attack. Rogues now start with a rapier and a dagger.',
        'Вы просили — сделано: кинжал теперь можно взять в любую руку. Во второй руке рядом с оружием он бьёт ещё раз за каждый ход атаки. Это слабый удар: без модификатора характеристики и никогда со скрытой атакой. Плуты теперь начинают с рапирой и кинжалом.'),
      t('Greatswords, greataxes, mauls and bows now fill both hands: no shield or focus beside them. In return their Bonus stats count twice, and their cards show them doubled. Bows hit a die harder. A shield held beside one is back in your Bag (or your Storage, if the Bag was full): choose your way to fight. Rangers now start with a longbow and scale mail instead of a shield.',
        'Двуручные мечи, секиры, молоты и луки теперь занимают обе руки: щит или фокус рядом не взять. Взамен их бонусы считаются дважды, и карточки показывают их удвоенными. Луки бьют на кость сильнее. Щит, который был рядом с таким оружием, вернулся в сумку (или в хранилище, если сумка была полна): выбирайте, как сражаться. Следопыты теперь начинают с длинным луком и чешуйчатым доспехом вместо щита.'),
    ],
  },
  {
    id: '2026-10-03-bulk',
    date: '2026-10-03',
    title: t('Clear the Bag in one go', 'Сумка за один раз'),
    items: [
      t('You asked for it: the Shops buy, and the Forge salvages, every Item in your Bag up to a Tier you choose, in one go. You see what goes first, and Unidentified, Upgraded and Radiant Items and Bond rings always stay.',
        'Вы просили — сделано: лавки покупают, а кузница разбирает все предметы из сумки до выбранного ранга за один раз. Сначала видно, что уйдёт, а неопознанные, улучшенные и сияющие предметы и кольца уз всегда остаются.'),
    ],
  },
  {
    id: '2026-10-02-academy',
    date: '2026-10-02',
    title: t('The Academy and the Training grounds', 'Академия и плац'),
    items: [
      t('From level 12, the masters of the new Academy teach one more Talent at a time for gold: 2,000, then 6,000, then 15,000, three in all. Fireproof before the Dragon, perhaps?',
        'С 12-го уровня мастера новой академии учат ещё одному таланту за раз за золото: 2000, затем 6000, затем 15 000, всего три. Может, огнеупорность перед встречей с драконом?'),
      t('And at the new Training grounds, any Hero can drill one ability for 8 hours, away from the Labyrinth, for +1: 1,000 gold, then 3,000, then 8,000. A Notification says when it lands.',
        'А на новом плацу любой герой может 8 часов гонять одну характеристику, не заходя в лабиринт, ради +1: 1000 золота, затем 3000, затем 8000. Когда +1 засчитается, придёт уведомление.'),
    ],
  },
  {
    id: '2026-10-01-dragon',
    date: '2026-10-01',
    title: t('The Dragon stirs', 'Дракон пробуждается'),
    items: [
      t('The Ancient Dragon has grown: twice the health, and harder blows. At full strength it is a gamble for even the mightiest Hero, until it starts to weaken on day 29 of the Season, a little more every week.',
        'Древний дракон окреп: вдвое больше здоровья и удары тяжелее. В полной силе он опасен даже для сильнейшего героя, пока с 29-го дня сезона не начнёт слабеть, понемногу каждую неделю.'),
      t('From Season 1, the Boss gate opens on day 28, so a Season runs about a month. This Season’s gate still opens on October 11.',
        'Начиная с 1-го сезона врата босса открываются на 28-й день, и сезон длится около месяца. В этом сезоне врата по-прежнему откроются 11 октября.'),
    ],
  },
  {
    id: '2026-10-01-cups',
    date: '2026-10-01',
    title: t('Keep your eye on the gem', 'Следите за камешком'),
    items: [
      t('The Goblin gambler now plays cups too: put your stake down, watch him shuffle, then pick the gem’s cup or call his cheat. A quarter of the time it’s up his sleeve, and only a Rogue sees it go.',
        'Гоблин-игрок теперь играет и в напёрстки: сделайте ставку, следите, как он тасует, и выберите напёрсток с камешком или уличите его в жульничестве. В четверти случаев камешек у него в рукаве, и заметит это только плут.'),
      t('Two new Deeds: Nimble fingers for 10 tricky locks picked, and Sharp-eyed for catching the goblin cheating 3 times.',
        'Два новых подвига: «Ловкие пальцы» за 10 вскрытых хитрых замков и «Зоркий глаз» за трижды пойманного на жульничестве гоблина.'),
    ],
  },
  {
    id: '2026-10-01-lockpicking',
    date: '2026-10-01',
    title: t('Pick it yourself', 'Вскройте сами'),
    items: [
      t('A tricky lock is now in your hands: tap to stop each pin’s marker in the lit spot. Three pins, two picks (three for a Rogue), and deeper locks are quicker.',
        'Хитрый замок теперь в ваших руках: нажмите, чтобы остановить метку каждого штифта в подсвеченном месте. Три штифта, две отмычки (у плута три), а замки поглубже быстрее.'),
    ],
  },
  {
    id: '2026-10-01-duo-deeds',
    date: '2026-10-01',
    title: t('Deeds for two', 'Подвиги на двоих'),
    items: [
      t('Four new Deeds for Duos: Guardian angel (stand your partner back up 5 times), Twin-breaker (defeat the Twin Wardens 3 times) and Oathkeeper (share at an Oathstone 5 times while your partner shares too).',
        'Четыре новых подвига для дуэтов: «Ангел-хранитель» (пять раз поставить напарника на ноги), «Сокрушитель близнецов» (трижды победить стражей-близнецов) и «Хранитель клятв» (пять раз поделиться у камня клятв, когда делится и напарник).'),
      t('And Oathbreaker, for taking at an Oathstone while your partner shares. Wear that Title with pride, or with shame.',
        'И «Клятвопреступник» — за дары, забранные у камня клятв, когда напарник делится. Носите этот титул с гордостью или со стыдом.'),
    ],
  },
  {
    id: '2026-10-01-duo-mini-boss',
    date: '2026-10-01',
    title: t('A Mini-boss for two', 'Мини-босс на двоих'),
    items: [
      t('A Mini-boss that meets a Duo now has more than twice the health and hits harder: two Heroes no longer brush it aside. A pair still dies about as often as a Hero alone.',
        'Мини-босс, встретивший дуэт, теперь больше чем вдвое крепче и бьёт сильнее: вдвоём его уже не смести походя. Погибают в дуэте по-прежнему не чаще, чем в одиночку.'),
      t('In a Duo fight, your 30 seconds now start once the moves before your turn have played out on screen.',
        'В бою дуэтом ваши 30 секунд теперь начинаются, когда ходы перед вашим уже показаны на экране.'),
    ],
  },
  {
    id: '2026-10-01-oaths',
    date: '2026-10-01',
    title: t('What the two hands reveal', 'Что откроют две руки'),
    items: [
      t('The Oathstone has two carved palms. When both oaths are sworn, the hands turn together: warm light for trust, a fracture for betrayal, darkness for two grasping hands.',
        'На камне клятв высечены две ладони. Когда обе клятвы скреплены, руки раскрываются вместе: тёплый свет за доверие, трещина за предательство и тьма за две жадные руки.'),
      t('Duo Chests open into a tray of Items. The portraits and timer show whose pick comes next; each claimed Item flies to its Hero. Curses have their own scarred mark in Loot and the Temple.',
        'Сундук дуэта раскрывает свои предметы. Портреты и таймер показывают, чей сейчас выбор; каждый предмет летит к своему герою. У проклятия теперь свой треснувший знак в добыче и храме.'),
    ],
  },
  {
    id: '2026-10-01-trust',
    date: '2026-10-01',
    title: t('Trust and greed', 'Доверие и жадность'),
    items: [
      t('Every Floor from 1 to 9 has an Oathstone. In a Duo, each of you swears by it in secret: share, or take. Both share: a fine gift each. One takes: both gifts, and everyone hears of it. Both take: the stone cracks and curses you both.',
        'На каждом этаже с 1-го по 9-й стоит Камень клятв. В дуэте каждый втайне клянётся им: поделиться или забрать. Оба делятся — каждому щедрый дар. Один забирает — ему оба дара, и об этом узнают все. Оба забирают — камень трескается и проклинает обоих.'),
      t('Treasure a Duo finds together, and the Twin Wardens’ hoard, now comes as a Duo Chest: you pick its Items in turns, half a minute a pick.',
        'Клад, найденный дуэтом, и сокровища стражей-близнецов теперь лежат в сундуке дуэта: предметы выбираете по очереди, по полминуты на выбор.'),
    ],
  },
  {
    id: '2026-10-01-twin-art',
    date: '2026-10-01',
    title: t('The Wardens’ bond', 'Узы стражей'),
    items: [
      t('At the round’s end, a thread of light reveals how one Twin Warden raises the other. The scene calls out the rule: fell both in the same round.',
        'В конце раунда световая нить показывает, как один страж-близнец поднимает другого. В сцене появляется напоминание: повергните обоих за один раунд.'),
      t('A split-ring mark connects Twin doors, the Wardens’ Room on the Map, Bond rings and the Tavern’s Feed. Joined Bond rings cast a warm light between the Duo’s portraits.',
        'Знак разомкнутого кольца объединяет парные двери, комнату стражей на карте, кольца уз и ленту таверны. Соединённые кольца уз зажигают тёплый свет между портретами дуэта.'),
    ],
  },
  {
    id: '2026-10-01-stats',
    date: '2026-10-01',
    title: t('Every stat pulls its weight', 'Каждый бонус в деле'),
    items: [
      t('Tap any line on an Item card to see what it does. The Character sheet now counts your gear in your ability scores and adds up what it gives you.',
        'Нажмите на любую строку карточки предмета, чтобы узнать, что она даёт. Лист героя теперь учитывает снаряжение в характеристиках и складывает всё, что оно даёт.'),
      t('Abilities on gear now count in every Check too: Shrines, traps, secret Doors, lying Clues. Charisma finally does something: better prices at the Shops and with the Wandering merchant.',
        'Характеристики со снаряжения теперь работают и в проверках: святилища, ловушки, потайные двери, лживые подсказки. А харизма наконец полезна: лучшие цены в лавках и у странствующего торговца.'),
      t('Forge Upgrades now help every Item: Bonus stats grow with each level, and at +5 and +10 abilities, armor and life steal gain +1. The Forge shows what the next level gives.',
        'Улучшения в кузнице теперь полезны любому предмету: бонусы растут с каждым уровнем, а на +5 и +10 характеристики, броня и вампиризм получают +1. Кузница показывает, что даст следующий уровень.'),
    ],
  },
  {
    id: '2026-10-01-twin-doors',
    date: '2026-10-01',
    title: t('Doors that open for two', 'Двери, что открываются двоим'),
    items: [
      t('Every Floor from 1 to 9 hides a Twin door with two stone hands. It opens only for a Duo.',
        'На каждом этаже с 1-го по 9-й есть парная дверь с двумя каменными ладонями. Она открывается только дуэту.'),
      t('Behind it wait the Twin Wardens. Strike one down alone and its twin raises it at the round’s end: plan together and fell both in the same round.',
        'За ней ждут стражи-близнецы. Сразите одного — и близнец поднимет его в конце раунда: договоритесь и повергните обоих за один раунд.'),
      t('Their prize: a hoard from deeper Floors and a pair of Bond rings, one for each of you. Wear both halves in a Duo and their Bonus stats count twice.',
        'Награда — клад с глубоких этажей и пара колец уз, по одному каждому. Носите оба кольца в дуэте, и их бонусы считаются дважды.'),
    ],
  },
  {
    id: '2026-09-30-tavern', date: '2026-09-30',
    title: t('A fire in the Tavern', 'Огонь в таверне'),
    items: [t('Faces around the hearth, news on the board, Bounties pinned up and Lodging upstairs. The Hall of Fame keeps each Season in stone.', 'Лица у очага, новости на доске, задания на листках и ночлег наверху. Зал славы хранит каждый сезон в камне.')],
  },
  {
    id: '2026-09-30-turns',
    date: '2026-09-30',
    title: t('Your next move, on the battle map', 'Ваш следующий ход — на карте боя'),
    items: [t('Manual fights now play on the Room map. Tap a monster to attack, choose your next action, and watch both Heroes fight, Guard and pull each other up in a Duo.', 'Бой по ходам теперь разыгрывается на карте комнаты. Нажмите на монстра для атаки, выберите действие и смотрите, как герои дуэта сражаются, прикрывают и поднимают друг друга.')],
  },
  {
    id: '2026-09-30-manual-fights',
    date: '2026-09-30',
    title: t('Fight your own way', 'Сражайтесь по-своему'),
    items: [
      t('Fights in Rooms are now played turn by turn. On your Hero’s turn, choose: tap a monster to attack it, cast Burst of fire or Cure wounds, drink a potion, Dodge, or try to escape. A Barbarian’s Rage and a Ranger’s Hunter’s mark come when you say.',
        'Бои в комнатах теперь идут по ходам. В ход героя выбирайте сами: нажмите на монстра, чтобы атаковать, используйте «Огненный взрыв» или «Лечение ран», выпейте зелье, уклоняйтесь или попробуйте бежать. Ярость варвара и метка охотника — когда скажете.'),
      t('In a hurry? Auto in the doorway fights the whole fight at once, as before, and Auto in a fight hands the rest to your Hero.',
        'Торопитесь? «Авто» у двери проводит весь бой сразу, как раньше, а «Авто» в бою отдаёт остаток боя герою.'),
    ],
  },
  {
    id: '2026-09-30-duos',
    date: '2026-09-30',
    title: t('Duos: the Labyrinth with a friend', 'Дуэты: лабиринт вдвоём'),
    items: [
      t('When a friend is online in the City, invite them from the Duo card in the City. Enter together, and either of you can lead: every Move, fight and Retreat takes you both.',
        'Когда друг в сети и в городе, позовите его с карточки «Дуэт» в городе. Входите вместе, и вести может любой из вас: каждый шаг, бой и отступление — на двоих.'),
      t('A Duo meets tougher, bigger groups and fights them side by side, each of you choosing for your own Hero. Help your partner to advantage, Guard them from blows, and pull them up when they fall.',
        'Дуэту попадаются группы больше и крепче, и вы бьётесь плечом к плечу, каждый выбирает за своего героя. Помогайте напарнику атаковать с преимуществом, прикрывайте его от ударов и поднимайте, если он упадёт.'),
      t('Each Hero pays its own Stamina and rolls its own gold and loot. A turn left for 30 seconds goes to the AI. The Dragon is still faced alone.',
        'Каждый герой платит своей выносливостью и получает свои золото и добычу. Ход, оставленный на 30 секунд, делает ИИ. С драконом по-прежнему бьются в одиночку.'),
    ],
  },
  {
    id: '2026-09-30-first-steps',
    date: '2026-09-30',
    title: t('First steps', 'Первые шаги'),
    items: [
      t('New to the Labyrinth? The City now shows your next goal and its reward: win a fight, bring gold home, open a Chest, and so on. Each reward helps with the next.',
        'Впервые в лабиринте? В городе теперь видна следующая цель и награда за неё: выиграть бой, принести золото домой, открыть сундук и так далее. Каждая награда помогает со следующей целью.'),
      t('Already further along? Open the list: the rewards for everything you have done are waiting.',
        'Уже продвинулись дальше? Откройте список: награды за всё сделанное ждут вас.'),
    ],
  },
  {
    id: '2026-09-30-map',
    date: '2026-09-30',
    title: t('Ink your way through the Labyrinth', 'Чернилами по лабиринту'),
    items: [
      t('Your Floor map now has inked Room symbols, locks, cracked walls and secret Doors. Revealed Rooms show what awaits, and a small legend explains every mark.', 'На карте этажа появились рисованные обозначения комнат, замки, треснувшие стены и тайные двери. Открытые на карте комнаты показывают, что ждёт впереди, а условные обозначения объясняют каждый знак.'),
      t('Tap an exit on the Map or use the larger Door buttons below it. Free Moves have a quiet marker.', 'Нажмите на выход на карте или на крупную кнопку двери под ней. Бесплатные шаги отмечены небольшим знаком.'),
      t('A small live map now sits in the corner of every Room, and your token walks it with you. Tap it to open the full Map.', 'В углу каждой комнаты теперь есть маленькая живая карта, и ваш знак шагает по ней вместе с вами. Нажмите на неё, чтобы открыть карту этажа.'),
    ],
  },
  {
    id: '2026-09-30-fury',
    date: '2026-09-30',
    title: t('Fury and focus', 'Ярость и меткость'),
    items: [
      t('The Barbarian’s Rage erupts in a roar of embers. Its aura surges with every swing, incoming blows feel lighter, and Relentless answers a lethal blow with a red flare.', 'Ярость варвара вспыхивает с рёвом и россыпью углей. Ореол разгорается при каждом взмахе, входящие удары ощущаются слабее, а неудержимость отвечает на смертельный удар красной вспышкой.'),
      t('The Ranger’s Hunter’s mark circles its quarry and flies to the next monster when the first one falls. Reduced motion keeps both the aura and the mark still.', 'Метка охотника кружит над добычей следопыта и перелетает к следующему монстру, когда первый падёт. При уменьшении движения ореол и метка остаются неподвижными.'),
    ],
  },
  {
    id: '2026-09-30-classes',
    date: '2026-09-30',
    title: t('Two new Classes: Barbarian and Ranger', 'Два новых класса: варвар и следопыт'),
    items: [
      t('The Barbarian has the most health of all. In a hard fight it Rages: harder hits, and every blow on it lands lighter. It smashes cracked walls and shrugs off half of every trap. Paths: Berserker and Bear-heart.',
        'У варвара больше всех здоровья. В тяжёлом бою варвар впадает в ярость: бьёт сильнее и меньше страдает от ударов. Проламывает треснувшие стены и получает от ловушек лишь половину урона. Пути: берсерк и медвежье сердце.'),
      t('The Ranger shoots true (+2 with a bow) and marks the toughest monster of a hard fight: every hit on it deals more. It always knows when a Clue lies. Paths: Hunter and Stalker.',
        'Следопыт метко стреляет (+2 из лука) и в тяжёлом бою помечает самого крепкого монстра: каждое попадание по нему сильнее. Всегда знает, когда подсказка лжёт. Пути: охотник и ловчий.'),
      t('Try one with a new Hero, or Retire yours to start over. Their own portraits are being painted; for now they borrow the Fighter’s and the Rogue’s.',
        'Попробуйте нового героя или отправьте своего на покой, чтобы начать заново. Собственные портреты для них ещё рисуются, пока они носят портреты воина и плута.'),
    ],
  },
  {
    id: '2026-09-30-delve',
    date: '2026-09-30',
    title: t('The Daily Delve', 'Спуск дня'),
    items: [
      t('The City’s old Well opens every day: six Rooms, the same for everyone, each deeper than the last. Your Hero goes down at full health, and nothing is lost down there.',
        'Старый колодец в городе открывается каждый день: шесть комнат, одни на всех, и каждая глубже прежней. Герой спускается с полным здоровьем, и внизу ничего не теряется.'),
      t('After each Room won, take one of two Boons. Stop whenever you like to bank your points; fall, and half of them stay.',
        'После каждой выигранной комнаты возьмите один из двух даров. Остановитесь, когда захотите, чтобы сохранить очки; при падении остаётся половина.'),
      t('The day’s first three win a Gold, a Silver and an Iron Chest at midnight UTC. The new Deed “Well-diver” waits for those who win all six Rooms.',
        'Трое лучших за день получают в полночь по UTC золотой, серебряный и железный сундук. А тех, кто пройдёт все шесть комнат, ждёт новый подвиг «Покоритель колодца».'),
    ],
  },
  {
    id: '2026-09-30-notifications',
    date: '2026-09-30',
    title: t('Notifications on your phone', 'Уведомления на телефон'),
    items: [
      t('Turn them on in the Account sheet (your avatar, top right) to hear when your Stamina is full, a Camp rest is done, something of yours sells on the Market, or the Boss gate opens.',
        'Включите их в меню аккаунта (аватар справа вверху). Придёт сигнал, когда выносливость восстановлена, отдых в лагере окончен, ваш предмет купили на рынке или открылись врата босса.'),
      t('Each kind can be switched off, and nothing arrives between 23:00 and 08:00 your time.',
        'Каждый вид можно отключить, а с 23:00 до 08:00 по вашему времени ничего не приходит.'),
      t('On an iPhone, put Dark Corner on your Home Screen first, open it from there, then turn notifications on.',
        'На iPhone сначала добавьте «Тёмный уголок» на экран «Домой», откройте его оттуда и тогда включите уведомления.'),
    ],
  },
  {
    id: '2026-09-30-juice',
    date: '2026-09-30',
    title: t('Feel every blow', 'Почувствуйте каждый удар'),
    items: [
      t('Swords slash, bows send arrows and claws rake. Critical hits land harder; undead crumble and demons scatter embers.', 'Мечи рубят, луки пускают стрелы, когти оставляют борозды. Критические удары ощутимее; нежить рассыпается, а демоны разлетаются искрами.'),
      t('Spells leave trails, the Dragon breathes a torrent of fire, and lasting effects move with each fighter. Low health brings a red heartbeat around the Room.', 'Заклинания оставляют следы, дракон извергает поток огня, а длительные эффекты оживают вокруг бойцов. При низком здоровье по краям комнаты пульсирует красный свет.'),
      t('Choose 1× or 2× speed, or pause with Fight log to read every event so far. Reduced motion keeps the effects calm.', 'Выберите скорость 1× или 2×, либо откройте журнал боя: повтор остановится, чтобы можно было прочитать уже случившееся. Уменьшение движения делает эффекты спокойнее.'),
    ],
  },
  {
    id: '2026-09-30-chest-spin',
    date: '2026-09-30',
    title: t('A little theatre for your loot', 'Маленькое представление для добычи'),
    items: [
      t('Chests spin to their prize, with light and sound that grow with its Tier. Skip shows your Item straight away.',
        'Сундуки прокручивают ленту до добычи: чем выше ранг, тем ярче свет и громче звук. «Пропустить» сразу показывает предмет.'),
      t('Identifying unveils the name, Quality, Bonus stats and power one line at a time. Radiant Items shimmer, and Mythic and Relic drops make an entrance.',
        'При опознании по очереди открываются название, качество, дополнительные характеристики и сила. Сияющие предметы переливаются, а мифические предметы и реликвии появляются с особым размахом.'),
      t('Reduced motion shows the result immediately, with a quiet glow instead of moving effects.',
        'При уменьшении движения результат виден сразу, со спокойным свечением вместо движущихся эффектов.'),
    ],
  },
  {
    id: '2026-09-30-camps',
    date: '2026-09-30',
    title: t('Camps give a full rest', 'Лагерь — это полный отдых'),
    items: [
      t(
        'Four hours in a Camp now bring back everything: health, abilities, full Stamina and both short rests.',
        'Четыре часа в лагере теперь возвращают всё: здоровье, способности, полную выносливость и оба коротких отдыха.',
      ),
      t(
        'Walking out of a Camp before the rest is done asks first, so a stray tap doesn’t cost you the rest.',
        'Если уйти из лагеря до конца отдыха, игра сначала переспросит, чтобы случайное нажатие не лишило вас отдыха.',
      ),
      t(
        'After any fight, the Fight log shows every blow, line by line.',
        'После любого боя журнал боя показывает каждый удар, строку за строкой.',
      ),
    ],
  },
  {
    id: '2026-09-29-fight-scene',
    date: '2026-09-29',
    title: t('Fights come alive', 'Бои оживают'),
    items: [
      t('Fights play out on the Room map: moving tokens, spell bolts, fire, healing and the Dragon’s breath.', 'Бои разворачиваются на карте комнаты: движение жетонов, заклинания, огонь, лечение и дыхание дракона.'),
      t('A large d20 marks death saves. Skip at any time, or use reduced motion for a calmer replay.', 'Спасброски от смерти показаны на большом d20. Бой можно пропустить в любой момент; настройка уменьшения движения делает повтор спокойнее.'),
    ],
  },
  {
    id: '2026-09-29-deeds',
    date: '2026-09-29',
    title: t('Deeds and Titles, and the Dragon’s lair stirs', 'Подвиги и титулы, а логово дракона оживает'),
    items: [
      t(
        'Deeds: 21 feats to work toward all Season, from defeating 100 goblins to slaying the Dragon. Each one pays gold the moment it’s done. See them on your Hero’s page.',
        'Подвиги: 21 свершение на весь сезон — от сотни побеждённых гоблинов до победы над драконом. За каждый сразу платят золотом. Они на странице вашего героя.',
      ),
      t(
        'Every Deed earns a Title to wear after your Hero’s name, for everyone to see in the Tavern and on the Rankings, where Deeds have a board of their own.',
        'Каждый подвиг даёт титул, который можно носить рядом с именем героя: его видят все в таверне и в рейтингах, где у подвигов теперь свой зачёт.',
      ),
      t(
        'Deeds count from today; the deepest Floor counts from your Hero’s own record.',
        'Подвиги считаются с сегодняшнего дня; самый глубокий этаж засчитывается по рекорду героя.',
      ),
      t(
        'Three new events in the Dragon’s lair (Floor 10): whispering skulls that can show the way to the Dragon, a spill of its hoard (how many handfuls do you dare?), and a fallen champion to rob or to bury.',
        'Три новых события в логове дракона (этаж 10): шепчущие черепа, что могут указать путь к дракону, рассыпанный клад (сколько горстей рискнёте взять?) и павший чемпион, которого можно обобрать или похоронить.',
      ),
      t(
        'Every monster now has its painted token, including the five new ones in the crypts and depths.',
        'У всех монстров теперь нарисованные жетоны, включая пятерых новых в склепах и глубинах.',
      ),
    ],
  },
  {
    id: '2026-09-29-depths',
    date: '2026-09-29',
    title: t('New faces deeper down, and a summary for every Run', 'Новые лица на глубине и итог каждой вылазки'),
    items: [
      t(
        'Two new monsters in the crypts (Floors 4–6): a mummy that won’t stay down and whose stare freezes the nerve, and rot grubs that blades barely scratch, with a poisonous bite.',
        'Двое новых в склепах (этажи 4–6): мумия, которая не желает лежать и сковывает волю взглядом, и трупные личинки с ядовитым укусом, которых клинки почти не берут.',
      ),
      t(
        'Three in the depths (Floors 7–9): a flame skull, fast and burning; a night hag that drinks life; and a chain devil that strikes twice and rages when hurt.',
        'Трое в глубинах (этажи 7–9): быстрый пылающий череп, ночная карга, что пьёт жизнь, и цепной дьявол, который бьёт дважды и свирепеет от ран.',
      ),
      t(
        'A new event in the crypts: a sealed sarcophagus full of grave goods. Fighters are best at prying the lid; grind it too loud and its mummy wakes.',
        'Новое событие в склепах: запечатанный саркофаг с погребальными дарами. Лучше всех крышку сдвигают воины; заскрежещет слишком громко — проснётся мумия.',
      ),
      t(
        'A new event in the depths: a devil’s bargain. Trade health for gold, or for an Item whose Tier it shows up front, or try to banish it (Clerics do it best).',
        'Новое событие в глубинах: сделка с дьяволом. Обменяйте здоровье на золото или на предмет, ранг которого он показывает заранее, или попробуйте изгнать его (лучше всех это удаётся жрецам).',
      ),
      t(
        'Every Run now ends with a summary: new Rooms, fights won, gold brought home, Items found, XP and the deepest Floor.',
        'Каждая вылазка теперь заканчивается итогом: новые комнаты, выигранные бои, принесённое золото, найденные предметы, опыт и самый глубокий этаж.',
      ),
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
