import { type Text, text } from './text.js';

export interface RiddleDef {
  question: Text;
  answer: Text;
}

/**
 * The Riddling statue's riddles (v0): old folk riddles whose answers hold in both
 * languages without a pun. Wrong answers are drawn from the other riddles'.
 */
export const RIDDLES: RiddleDef[] = [
  {
    question: text('The more you take from me, the bigger I grow.', 'Чем больше из меня берёшь, тем больше я становлюсь.'),
    answer: text('A hole', 'Яма'),
  },
  {
    question: text('What grows wetter the more it dries?', 'Что становится мокрее, чем больше сушит?'),
    answer: text('A towel', 'Полотенце'),
  },
  {
    question: text('I answer every voice, and I have no mouth.', 'Отвечаю на любой голос, а рта у меня нет.'),
    answer: text('An echo', 'Эхо'),
  },
  {
    question: text('Tall when young, short when old, and I weep while I burn.', 'В юности высока, к старости низка, и плачу, пока горю.'),
    answer: text('A candle', 'Свеча'),
  },
  {
    question: text('I follow you in the light and leave you in the dark.', 'Хожу за тобой при свете и покидаю во тьме.'),
    answer: text('A shadow', 'Тень'),
  },
  {
    question: text('Say my name, and I am gone.', 'Назови меня, и меня не станет.'),
    answer: text('Silence', 'Тишина'),
  },
  {
    question: text('I have cities without houses, forests without trees and rivers without water.', 'У меня есть города без домов, леса без деревьев и реки без воды.'),
    answer: text('A map', 'Карта'),
  },
  {
    question: text('Its maker sells it, its buyer never uses it, and its user never knows.', 'Кто делает — продаёт, кто покупает — не пользуется, а кто пользуется — не знает об этом.'),
    answer: text('A coffin', 'Гроб'),
  },
  {
    question: text('It has a neck but no head, and wears a cork for a hat.', 'Есть горлышко, да нет головы, а вместо шапки — пробка.'),
    answer: text('A bottle', 'Бутылка'),
  },
  {
    question: text('The more of it there is, the less you see.', 'Чем её больше, тем меньше видно.'),
    answer: text('Darkness', 'Темнота'),
  },
  {
    question: text('It fills a whole room and takes up no space.', 'Заполняет всю комнату, а места не занимает.'),
    answer: text('Light', 'Свет'),
  },
  {
    question: text('It has teeth, and it never bites.', 'Есть зубы, а никогда не кусается.'),
    answer: text('A comb', 'Расчёска'),
  },
  {
    question: text('Always ahead of you, and never seen.', 'Всегда впереди, и никто его не видел.'),
    answer: text('The future', 'Будущее'),
  },
  {
    question: text('It goes up and never comes down.', 'Растёт, а назад не убывает.'),
    answer: text('Age', 'Возраст'),
  },
];
