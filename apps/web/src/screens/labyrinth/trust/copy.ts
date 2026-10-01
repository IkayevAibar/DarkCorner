import { useI18n } from '../../../i18n';

const COPY = {
  en: { you: 'You', partner: 'Partner', secret: 'Hidden oath', share: 'Share', take: 'Take', kept: 'An oath kept', broken: 'An oath broken', cracked: 'Two hands. No trust.', waiting: 'The stone is listening.', turn: 'Your pick', theirs: 'Their pick', resolving: 'Waiting for the stone…', picking: 'Waiting for the pick…', inspect: 'Inspect', claimed: 'Taken', leftBehind: 'Left behind', empty: 'The Chest is empty.', closed: 'The Chest is closed.', silent: 'Two hands are needed.', spent: 'The stone rests.', curse: 'Oathbreaker’s curse', continue: 'Continue', sealed: 'Oath sealed', yours: 'Your oath', chest: 'Duo Chest' },
  ru: { you: 'Вы', partner: 'Напарник', secret: 'Тайная клятва', share: 'Поделиться', take: 'Забрать', kept: 'Верность клятве', broken: 'Нарушенная клятва', cracked: 'Две руки. Ни капли доверия.', waiting: 'Камень слушает.', turn: 'Ваш выбор', theirs: 'Выбор напарника', resolving: 'Ждём ответа камня…', picking: 'Ждём выбора…', inspect: 'Осмотреть', claimed: 'Получено', leftBehind: 'Остаётся здесь', empty: 'Сундук опустел.', closed: 'Сундук закрыт.', silent: 'Нужны две руки.', spent: 'Камень отдыхает.', curse: 'Проклятие клятвопреступника', continue: 'Дальше', sealed: 'Клятва скреплена', yours: 'Ваша клятва', chest: 'Сундук дуэта' },
};
export const useTrustCopy = () => COPY[useI18n().locale];
