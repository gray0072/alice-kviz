'use strict';

// Разрезы банка вопросов: фокус, оси с двумя краями и навыки.
// Описание и примеры — docs/09-content-plan.md. Поля вопроса:
//   focus: ключ из FOCUSES (обязательное),
//   pole: '<ось>-' (недостаток) или '<ось>+' (избыток), необязательное,
//   skill: ключ из SKILLS, необязательное,
//   fun: 0 | 1 | 2 — насколько смешной весь вопрос (нет поля — 0).
// Могут пригодиться игре для тематических игр («про жадность», «про гигиену»).

const FOCUSES = {
  world: 'Мир вокруг',
  people: 'Люди рядом',
  self: 'Внутри себя',
};

// Ось: название, группа, край «−» (недостаток), край «+» (избыток).
const AXES = {
  // Чувства и характер
  brave: { title: 'Смелость', group: 'character', minus: 'боится пробовать', plus: 'рискует, где опасно' },
  emotions: { title: 'Чувства', group: 'character', minus: 'держит в себе', plus: 'взрывается' },
  confidence: { title: 'Вера в себя', group: 'character', minus: '«у меня не получится»', plus: 'хвастается' },
  winning: { title: 'Победа и проигрыш', group: 'character', minus: 'не играет, чтобы не проиграть', plus: 'победа любой ценой' },
  patience: { title: 'Терпение', group: 'character', minus: 'хочет сейчас', plus: 'терпит молча' },
  effort: { title: 'Старание', group: 'character', minus: '«и так сойдёт»', plus: 'переделывает без конца' },
  curious: { title: 'Любопытство', group: 'character', minus: 'ничего не интересно', plus: 'трогает всё, суёт нос' },
  // Тело и привычки
  food: { title: 'Еда', group: 'body', minus: 'привередничает', plus: 'переедает' },
  clean: { title: 'Чистота', group: 'body', minus: 'не моется', plus: 'боится испачкаться' },
  rest: { title: 'Отдых и сон', group: 'body', minus: 'не отдыхает', plus: 'валяется весь день' },
  screen: { title: 'Экраны', group: 'body', minus: 'без гаджета, когда у всех есть', plus: 'весь день в планшете' },
  health: { title: 'Здоровье', group: 'body', minus: 'скрывает боль', plus: 'боится лечиться' },
  busy: { title: 'Занятость', group: 'body', minus: 'скучно без развлечений', plus: 'кружки каждый день' },
  hobby: { title: 'Увлечения', group: 'body', minus: 'только книги и экран', plus: 'только спорт' },
  // Общение
  talk: { title: 'Разговор', group: 'talk', minus: '«нормально», молчит', plus: 'говорит без остановки' },
  listen: { title: 'Слушать', group: 'talk', minus: 'перебивает', plus: 'слушает всех без конца' },
  contact: { title: 'Связь', group: 'talk', minus: 'не звонит', plus: 'названивает' },
  tone: { title: 'Настрой', group: 'talk', minus: 'ноет', plus: '«всё супер»' },
  openness: { title: 'О себе', group: 'talk', minus: 'скрытный', plus: 'рассказывает всё всем' },
  request: { title: 'Просить', group: 'talk', minus: 'требует', plus: 'не решается попросить' },
  borrow: { title: 'Чужая вещь', group: 'talk', minus: 'берёт и не возвращает', plus: 'боится взять' },
  sorry: { title: 'Извиняться', group: 'talk', minus: 'не извиняется', plus: 'извиняется за всё' },
  feedback: { title: 'Замечания', group: 'talk', minus: 'обижается', plus: 'ругает себя' },
  promise: { title: 'Обещания', group: 'talk', minus: 'не держит слово', plus: 'обещает всем всё' },
  empathy: { title: 'Сочувствие', group: 'talk', minus: 'не замечает', plus: 'расклеивается сам' },
  humor: { title: 'Шутки', group: 'talk', minus: 'обижается на шутки', plus: 'обидные шутки' },
  manners: { title: 'Вежливость', group: 'talk', minus: 'грубит', plus: 'молчит о своём' },
  // Дружба и отношения
  attention: { title: 'Внимание к себе', group: 'friends', minus: 'не замечают', plus: 'всё время в центре' },
  share: { title: 'Делиться', group: 'friends', minus: 'жадничает', plus: 'отдаёт всё' },
  honesty: { title: 'Честность', group: 'friends', minus: 'врёт', plus: 'правда, которая обижает' },
  agree: { title: 'Своё мнение', group: 'friends', minus: 'всё критикует', plus: 'делает как все' },
  lead: { title: 'Кто главный', group: 'friends', minus: 'ничего не предлагает', plus: 'командует' },
  help: { title: 'Помощь', group: 'friends', minus: 'ждёт просьбы', plus: 'делает за другого' },
  ask: { title: 'Просить о помощи', group: 'friends', minus: 'стесняется спросить', plus: 'зовёт по мелочи' },
  tell: { title: 'Рассказать взрослым', group: 'friends', minus: 'молчит о плохом', plus: 'ябедничает' },
  secret: { title: 'Секреты', group: 'friends', minus: 'разбалтывает', plus: 'хранит опасный' },
  trust: { title: 'Доверие', group: 'friends', minus: 'никому не верит', plus: 'верит всем' },
  boundaries: { title: 'Границы', group: 'friends', minus: 'не может сказать «нет»', plus: 'не замечает чужих' },
  conflict: { title: 'Конфликт', group: 'friends', minus: 'даёт себя обижать', plus: 'даёт сдачи' },
  approach: { title: 'Знакомство', group: 'friends', minus: 'боится подойти', plus: 'навязывается' },
  friendship: { title: 'Дружба', group: 'friends', minus: 'не бережёт друга', plus: '«дружи только со мной»' },
  pride: { title: 'Как смотришь на других', group: 'friends', minus: 'ставит себя ниже', plus: 'высокомерие' },
  // Семья
  parents: { title: 'Родители', group: 'family', minus: 'заняты, строгие', plus: 'гиперопека' },
  grandparents: { title: 'Бабушки и дедушки', group: 'family', minus: 'редкие встречи', plus: 'балуют' },
  siblings: { title: 'Братья и сёстры', group: 'family', minus: 'младший: не берут', plus: 'старший: всё на нём' },
  rules: { title: 'Правила', group: 'family', minus: '«пока никто не видит»', plus: 'не отступит от правила' },
  independence: { title: 'Самостоятельность', group: 'family', minus: 'ничего сам', plus: 'всё сам, даже опасное' },
  // Вещи, деньги, мир
  money: { title: 'Деньги', group: 'world', minus: 'жалеет', plus: 'тратит всё сразу' },
  stuff: { title: 'Вещи и игрушки', group: 'world', minus: 'мало, завидует', plus: 'много, не ценит' },
  things: { title: 'Бережность к своему', group: 'world', minus: 'ломает, теряет', plus: 'трясётся над вещами' },
  order: { title: 'Порядок', group: 'world', minus: 'бардак', plus: 'не даёт ничего сдвинуть' },
  time: { title: 'Время', group: 'world', minus: 'опаздывает', plus: 'торопит всех' },
  nature: { title: 'Природа и животные', group: 'world', minus: 'мусорит, пугает', plus: 'тискает, забирает домой' },
};

const AXIS_GROUPS = {
  character: 'Чувства и характер',
  body: 'Тело и привычки',
  talk: 'Общение',
  friends: 'Дружба и отношения',
  family: 'Семья',
  world: 'Вещи, деньги, мир',
};

// Навыки: конкретные умения, которые нужно просто знать.
const SKILLS = {
  // Гигиена
  teeth: { title: 'Зубы утром и вечером', group: 'hygiene' },
  hands: { title: 'Мыть руки', group: 'hygiene' },
  clothes: { title: 'Свежие трусы и носки', group: 'hygiene' },
  nails: { title: 'Ногти стричь, не грызть', group: 'hygiene' },
  hair: { title: 'Мыть голову и расчёсываться', group: 'hygiene' },
  shower: { title: 'Душ после тренировки и жары', group: 'hygiene' },
  personal: { title: 'Своё полотенце и щётка', group: 'hygiene' },
  sneeze: { title: 'Чихать в локоть', group: 'hygiene' },
  ears: { title: 'Уши и нос без пальцев', group: 'hygiene' },
  street: { title: 'Уличное — не на кровать', group: 'hygiene' },
  // Вещи между людьми
  ask_item: { title: 'Попросить вежливо', group: 'items' },
  when_back: { title: 'Сказать, когда вернёшь', group: 'items' },
  give_back: { title: 'Вернуть вовремя и целым', group: 'items' },
  broke: { title: 'Сломал чужое — сказать', group: 'items' },
  hand_over: { title: 'Дать в руки, нож ручкой', group: 'items' },
  take: { title: 'Брать бережно', group: 'items' },
  not_pass: { title: 'Чужое не передавать', group: 'items' },
  refuse_item: { title: 'Вежливо не дать своё', group: 'items' },
  shared: { title: 'Общее — по очереди и на место', group: 'items' },
  // Телефон и переписка
  greet_call: { title: 'Поздороваться в трубку', group: 'phone' },
  call_time: { title: 'Не звонить рано и поздно', group: 'phone' },
  wait_reply: { title: 'Подождать ответа', group: 'phone' },
  parents_call: { title: 'Ответить родителям', group: 'phone' },
  just_call: { title: 'Позвонить просто так', group: 'phone' },
  voice: { title: 'Голосовые коротко, в транспорте тихо', group: 'phone' },
  forward: { title: 'Чужое не пересылать', group: 'phone' },
  unknown: { title: 'Незнакомый номер — родителям', group: 'phone' },
};

const SKILL_GROUPS = {
  hygiene: 'Гигиена',
  items: 'Вещи между людьми',
  phone: 'Телефон и переписка',
};

// Все края: 'brave-', 'brave+', …
const POLES = Object.keys(AXES).flatMap((a) => [`${a}-`, `${a}+`]);

module.exports = { FOCUSES, AXES, AXIS_GROUPS, SKILLS, SKILL_GROUPS, POLES };
