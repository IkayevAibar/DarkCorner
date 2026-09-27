import type { MessageKey } from './en';

export const ru: Record<MessageKey, string> = {
  brand: 'Тёмный уголок',
  tagline: 'Тёмный лабиринт, сезон за сезоном.',
  loading: 'Зажигаем факелы…',
  error: 'Что-то пошло не так. Попробуйте чуть позже.',
  retry: 'Ещё раз',
  close: 'Закрыть',

  'tab.city': 'Город',
  'tab.labyrinth': 'Лабиринт',
  'tab.loot': 'Добыча',
  'tab.heroes': 'Герои',

  'signin.title': 'Войти в Тёмный уголок',
  'signin.sso': 'Войти через Discord',
  'signin.devTitle': 'Вход для разработки',
  'signin.devHint': 'Только на вашем компьютере: войти под любым именем без Discord.',
  'signin.devName': 'Имя',
  'signin.devAdmin': 'Сделать игрока админом',
  'signin.devSubmit': 'Войти',

  'pending.title': 'Ожидание у ворот',
  'pending.body': 'Админ должен впустить вас, прежде чем вы создадите героя. Спросите в своём Discord.',
  'banned.title': 'Ворота закрыты',
  'banned.body': 'Админ закрыл ворота для этого аккаунта.',
  signOut: 'Выйти',

  'account.title': 'Аккаунт',
  'account.language': 'Язык',
  'account.admin': 'Админ: игроки',

  'city.soon': 'Скоро здесь откроются Таверна, Лавки, Кузница, Рынок и Храм.',
  'labyrinth.soon': 'Десятью этажами ниже ждёт древний дракон. Лабиринт откроется на 3-й неделе.',
  'loot.soon': 'Сундуки, опознание и Кузница появятся на 4-й неделе.',
  'heroes.soon': 'Создание героя появится на 2-й неделе.',

  'admin.title': 'Игроки',
  'admin.empty': 'Игроков пока нет.',
  'admin.approve': 'Впустить',
  'admin.ban': 'Забанить',
  'admin.reset': 'Сбросить',
  'admin.you': 'вы',
  'status.pending': 'Ожидает',
  'status.approved': 'Впущен',
  'status.banned': 'Забанен',

  'sandbox.title': 'Песочница',
  'sandbox.body': 'Визуальные компоненты на тестовых данных (здесь работает Codex).',
};
