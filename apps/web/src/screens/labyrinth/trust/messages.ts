import { useI18n } from '../../../i18n';

// These lines load with the Labyrinth, keeping the City's first load small.
const en = {
  'oath.rules': 'Each of you swears by the stone in secret: share, or take. Neither sees the other’s oath until both have sworn.',
  'oath.both': 'Both share: a good gift for each of you, Rare or better.',
  'oath.one': 'One takes: the taker gets both gifts, the other nothing, and everyone hears of it.',
  'oath.none': 'Both take: the stone cracks and curses you both, with half the gold and dimmer luck for 3 hours.',
  'oath.silent': 'Alone, the stone is silent: it answers only a Duo.',
  'oath.spent': 'You two have sworn here this week. The stone answers you again on {date}.',
  'oath.sworeShare': 'You swore to share. Waiting for {name}…',
  'oath.sworeTake': 'You swore to take. Waiting for {name}…',
  'oath.partnerSwore': '{name}’s oath is on the stone. Your turn.',
  'oath.share': 'Share',
  'oath.shareHint': 'Keep faith',
  'oath.take': 'Take',
  'oath.takeHint': 'Both gifts, or a curse',
  'oath.secret': '{name} won’t see your oath until both of you have sworn.',
  'chest.title': 'Duo Chest',
  'chest.yourPick': 'Your pick · {s} s',
  'chest.theirPick': '{name} is picking · {s} s',
  'chest.full': 'Neither of you can carry more.',
  'chest.bagFull': 'Your Bag is full: your turns pass to your partner until you drop something.',
  'chest.mine': 'Yours',
  'chest.looking': 'Looking',
  'chest.take': 'Take it',
  'chest.wait': 'Wait for {name}’s pick',
  'chest.hint': 'Tap an Item to look at it. You take turns; a pick left half a minute takes the best Item left.',
};
const ru: Record<keyof typeof en, string> = {
  'oath.rules': 'Каждый из вас втайне клянётся камнем: поделиться или забрать. Никто не видит чужой клятвы, пока не поклянутся оба.',
  'oath.both': 'Оба делятся: каждому хороший дар, редкий или лучше.',
  'oath.one': 'Один забирает: ему оба дара, другому ничего, и об этом узнают все.',
  'oath.none': 'Оба забирают: камень трескается и проклинает обоих — вдвое меньше золота и меньше удачи на 3 часа.',
  'oath.silent': 'В одиночку камень молчит: он отвечает только дуэту.',
  'oath.spent': 'Вы уже клялись здесь на этой неделе. Камень снова ответит вам {date}.',
  'oath.sworeShare': 'Вы поклялись поделиться. Ждём героя {name}…',
  'oath.sworeTake': 'Вы поклялись забрать. Ждём героя {name}…',
  'oath.partnerSwore': 'Клятва героя {name} уже на камне. Ваш черёд.',
  'oath.share': 'Поделиться',
  'oath.shareHint': 'Держать слово',
  'oath.take': 'Забрать',
  'oath.takeHint': 'Оба дара — или проклятие',
  'oath.secret': 'Герой {name} не увидит вашей клятвы, пока не поклянутся оба.',
  'chest.title': 'Сундук дуэта',
  'chest.yourPick': 'Ваш выбор · {s} с',
  'chest.theirPick': 'Выбирает {name} · {s} с',
  'chest.full': 'Никто из вас больше не унесёт.',
  'chest.bagFull': 'Ваша сумка полна: ваши ходы переходят напарнику, пока вы что-нибудь не выбросите.',
  'chest.mine': 'Ваше',
  'chest.looking': 'Смотрите',
  'chest.take': 'Забрать',
  'chest.wait': 'Ждите выбора героя {name}',
  'chest.hint': 'Нажмите на предмет, чтобы рассмотреть его. Выбираете по очереди; если ход затянется на полминуты, берётся лучший оставшийся предмет.',
};
export function useTrustText() {
  const { locale } = useI18n();
  const dictionary = locale === 'ru' ? ru : en;
  return (key: keyof typeof en, vars?: Record<string, string | number>) => {
    const line = dictionary[key];
    return vars ? line.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : line;
  };
}
