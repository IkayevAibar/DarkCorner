import type { MessageKey } from './en';

/**
 * The solo build's own lines, laid over en and ru (docs/plan-solo-offline.md,
 * Phase 3). Offline the game passes a night at a time: durations come from
 * src/time.ts as "tomorrow" or "in 3 days", so the lines here read around them.
 * Only lines that read differently offline belong here.
 */
type Lines = Partial<Record<MessageKey, string>>;

export const soloEn: Lines = {
  // Days: Stamina, rest and sleep.
  'lab.gate.body': 'Ten Floors down, the Ancient Dragon waits. Each new Room costs 1 Stamina, and a night’s sleep fills it again. Walking back through known Rooms is free.',
  'lab.staminaNext': 'full again after a night’s sleep',
  'lab.recovering': 'Health comes back with a night’s sleep, a potion or a short rest.',
  'lab.portalCloses': 'It closes when you sleep.',
  'rest.backAt': 'Used ones come back after a night’s sleep.',
  'err.no_stamina': 'Out of Stamina. A night’s sleep fills it, and a short rest gives 10. Doors marked free still open.',
  'lodging.about': 'A bed upstairs: sleep, and the next Day begins with full Stamina and both short rests.',
  'lodging.take': 'Sleep',
  'lodging.rising': 'A night costs nothing. A Camp in the Labyrinth is a bed too.',
  'lodging.done': 'A new Day: Stamina is full again.',
  // Days: what comes back overnight.
  'lab.graveInfo': '{n} Items, {g} gold · gone {time}',
  'route.back.fight': 'Cleared · monsters return {time}',
  'route.back.treasure': 'Taken · fills again {time}',
  'route.back.event': 'Done · open again {time}',
  'route.back.twin': 'Beaten · the Wardens wake {time}',
  'route.back.oathstone': 'Sworn · it answers again {time}',
  'shop.stock': 'Today’s gear · new {time}',
  'delve.closes': 'Open until you sleep',
  'delve.tomorrow': 'The Well opens again tomorrow.',
  'err.delve_taken': 'One Delve a day. The Well opens again tomorrow.',
  'bounty.resets': 'New ones {time}',
  'hunt.ends': 'ends {time}',
  'tavern.gateIn': 'The Boss gate opens {time}.',
  'city.training.blurb': 'An ability +1 for gold, after a night.',
  'training.blurb': 'A drill-master works one ability at a time: +1 after a night’s sleep, three times a Season.',
  'training.under': 'Training {ability}: +1 {left}.',
  'training.note': 'The +1 lands overnight. Until then your Hero stays in the City: no Labyrinth and no Well.',
  // The Guide.
  'guide.moves.body': 'A Move into a Room you have never stood in costs 1 Stamina; walking back through Rooms you know is free, unless something new waits in one today. Stamina lasts the Day: sleep at the Tavern or in a Camp, and the next Day begins with it full. Each Run also has two short rests that give back half of it. The Clue on each Door hints at what is behind it, and sometimes lies. Your Map remembers every Room you have stood in.',
  'guide.alive.body': 'Damage carries over from Room to Room. Drink potions, take a short rest, or sleep: a night at the Tavern or in a Camp brings full health, and so does the City. A Town Portal scroll takes you home from anywhere, and stays open until you sleep, so you can step back through.',
  'guide.death.body': 'When a Hero dies, its gear and its Bag lie in a Grave for two nights. Go back for them: a Smoke bomb makes Sneaking past the monsters sure. Levels, abilities, Talents and your Path are never lost.',
};

export const soloRu: Lines = {
  'lab.gate.body': 'Десятью этажами ниже ждёт Древний дракон. Каждая новая комната стоит 1 единицу выносливости, а ночь сна восстанавливает её. По знакомым комнатам ходить бесплатно.',
  'lab.staminaNext': 'полная снова после ночи сна',
  'lab.recovering': 'Здоровье вернут ночь сна, зелье или короткий отдых.',
  'lab.portalCloses': 'Он закроется, когда вы ляжете спать.',
  'rest.backAt': 'Потраченные вернутся после ночи сна.',
  'err.no_stamina': 'Нет выносливости. Ночь сна восстановит её, а короткий отдых даёт 10. Двери с пометкой «бесплатно» по-прежнему открыты.',
  'lodging.about': 'Кровать наверху: выспитесь, и новый день начнётся с полной выносливостью и обоими короткими отдыхами.',
  'lodging.take': 'Лечь спать',
  'lodging.rising': 'Ночь ничего не стоит. Лагерь в лабиринте — тоже постель.',
  'lodging.done': 'Новый день: выносливость снова полная.',
  'lab.graveInfo': 'Предметов: {n}, золота: {g} · исчезнет {time}',
  'route.back.fight': 'Зачищено · монстры вернутся {time}',
  'route.back.treasure': 'Забрано · наполнится снова {time}',
  'route.back.event': 'Пройдено · снова откроется {time}',
  'route.back.twin': 'Побеждены · стражи проснутся {time}',
  'route.back.oathstone': 'Клятва дана · камень ответит снова {time}',
  'shop.stock': 'Снаряжение дня · обновится {time}',
  'delve.closes': 'Открыт, пока вы не ляжете спать',
  'delve.tomorrow': 'Колодец снова откроется завтра.',
  'err.delve_taken': 'Один спуск в день. Колодец снова откроется завтра.',
  'bounty.resets': 'Новые {time}',
  'hunt.ends': 'закончится {time}',
  'tavern.gateIn': 'Врата босса откроются {time}.',
  'city.training.blurb': 'Характеристика +1 за золото, после ночи.',
  'training.blurb': 'Наставник гоняет одну характеристику за раз: +1 после ночи сна, трижды за сезон.',
  'training.under': 'Тренировка {ability}: +1 {left}.',
  'training.note': '+1 засчитывается за ночь. А пока герой остаётся в городе: ни лабиринта, ни колодца.',
  'guide.moves.body': 'Ход в комнату, где вы ещё не были, стоит 1 единицу выносливости; по знакомым комнатам можно ходить бесплатно, если сегодня там не появилось ничего нового. Выносливости хватает на день: выспитесь в таверне или в лагере, и новый день начнётся с полной шкалой. На каждой вылазке есть ещё два коротких отдыха, каждый возвращает половину шкалы. Подсказка на двери говорит, что за ней, — но иногда лжёт. Карта помнит каждую комнату, где вы побывали.',
  'guide.alive.body': 'Урон переходит из комнаты в комнату. Пейте зелья, делайте короткий отдых или спите: ночь в таверне или в лагере возвращает всё здоровье, как и город. Свиток портала вернёт домой откуда угодно, и портал открыт, пока вы не ляжете спать, чтобы шагнуть обратно.',
  'guide.death.body': 'Когда герой гибнет, его снаряжение и сумка две ночи лежат в могиле. Вернитесь за ними: с дымовой бомбой прокрасться мимо монстров удастся наверняка. Уровни, характеристики, таланты и путь не теряются никогда.',
};
