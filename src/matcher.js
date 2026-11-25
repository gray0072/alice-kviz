'use strict';

// Распознавание реплик ребёнка: номер ответа, текст ответа, уровень, команды.

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

const NUMBER_WORDS = {
  1: ['1', 'один', 'одна', 'одно', 'первый', 'первая', 'первое', 'первую', 'первого', 'раз', 'единица', 'адин'],
  2: ['2', 'два', 'две', 'второй', 'вторая', 'второе', 'вторую', 'второго', 'двойка'],
  3: ['3', 'три', 'третий', 'третья', 'третье', 'третью', 'третьего', 'тройка'],
};
const NUMBER_LOOKUP = new Map();
for (const [n, words] of Object.entries(NUMBER_WORDS)) for (const w of words) NUMBER_LOOKUP.set(w, Number(n));

const NUMBER_MARKERS = new Set(['вариант', 'варианта', 'ответ', 'номер', 'под', 'цифра', 'число']);

const STOP_WORDS = new Set(
  ('и а но в во на с со к ко у о об по за из от до не ни что чтобы как это то же ли бы ' +
    'он она оно они его ее их ему ей им мне меня мой моя твой твоя ты я вы мы все всем ' +
    'для если или только еще уже так там тут сам сама просто очень ведь даже потом сразу ' +
    'свой свою своим своей него нее ним ней нет да думаю наверное наверно может можно ' +
    'правильный правильно надо нужно буду будет хочу').split(' ')
);

function stem(word) {
  return word.length > 5 ? word.slice(0, 5) : word;
}

function contentStems(text) {
  return tokens(text)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !NUMBER_LOOKUP.has(w) && !NUMBER_MARKERS.has(w))
    .map(stem);
}

function numbersIn(words, entities) {
  const found = new Set();
  for (const w of words) if (NUMBER_LOOKUP.has(w)) found.add(NUMBER_LOOKUP.get(w));
  for (const e of entities || []) {
    if (e && e.type === 'YANDEX.NUMBER' && [1, 2, 3].includes(e.value)) found.add(e.value);
  }
  return found;
}

/**
 * Определяет выбранный вариант (1..3) или null.
 * @param {string} utterance реплика
 * @param {string[]} options тексты вариантов в порядке, в котором их прочитала Алиса
 * @param {object[]} entities request.nlu.entities
 */
function parseAnswer(utterance, options, entities) {
  const words = tokens(utterance);
  if (!words.length) return null;
  const nums = numbersIn(words, entities);
  const looksLikeNumber = words.length <= 3 || words.some((w) => NUMBER_MARKERS.has(w));
  if (looksLikeNumber && nums.size === 1) return [...nums][0];

  // Ребёнок пересказал ответ своими словами — ищем вариант с наибольшим пересечением слов.
  const said = new Set(contentStems(utterance));
  const scores = options.map((opt) => new Set(contentStems(opt)))
    .map((set) => [...set].filter((s) => said.has(s)).length);
  const best = Math.max(...scores);
  if (best >= 1 && scores.filter((s) => s === best).length === 1) return scores.indexOf(best) + 1;

  if (nums.size === 1) return [...nums][0];
  return null;
}

function hasAny(words, list) {
  return list.some((item) => {
    const parts = item.split(' ');
    if (parts.length === 1) return words.includes(item);
    return words.join(' ').includes(item);
  });
}

function startsAny(words, prefixes) {
  return words.some((w) => prefixes.some((p) => w.startsWith(p)));
}

const EASY_AGES = new Set(['3', '4', '5', '6', '7', 'три', 'четыре', 'пять', 'шесть', 'семь']);
const HARD_AGES = new Set(['8', '9', '10', '11', '12', '13', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать']);

function levelOf(words) {
  const easy = startsAny(words, ['легк', 'легч', 'прост', 'малыш', 'млад', 'маленьк', 'детск']) || words.some((w) => EASY_AGES.has(w));
  const hard = startsAny(words, ['слож', 'трудн', 'школьн', 'старш', 'больш', 'взросл']) || words.some((w) => HARD_AGES.has(w));
  if (easy && !hard) return 1;
  if (hard && !easy) return 2;
  return null;
}

/** Уровень из реплики: 1 — лёгкий, 2 — сложный, null — не понятно. */
function parseLevel(utterance) {
  return parseSettings(utterance).lv;
}

// --- Настройки игры: уровень и число вопросов ---

const COUNTS = [5, 10];
const COUNT_NOUNS = ['вопрос', 'задач', 'задан', 'загад'];
const COUNT_NUMBERS = { 5: ['5', 'пять'], 10: ['10', 'десять', 'десяток'] };
const OTHER_NUMBERS = new Set(['4', '6', '7', '8', '9', '11', '12', '15', '20', '30', '50', '100',
  'четыре', 'шесть', 'семь', 'восемь', 'девять', 'двадцать', 'сто', 'миллион']);
// Сравнительные слова про длину игры. «Больше/меньше» — только вместе с «вопросов».
const COUNT_UP_NOUN = ['больше', 'побольше'];
const COUNT_DOWN_NOUN = ['меньше', 'поменьше'];
const COUNT_UP = ['длиннее', 'подлиннее'];
const COUNT_DOWN = ['короче', 'покороче'];

// В строгом режиме (посреди вопроса) уровень узнаём только по точным формам слова:
// по корню «слож» под уровень попало бы «сложить», а «просто» и «легко» встречаются в ответах.
const STRICT_EASY = new Set(('легкий легкая легкое легкие легкую легком легкого легче полегче ' +
  'простой простая простом простого проще попроще малышей малышам маленьких младших').split(' '));
const STRICT_HARD = new Set(('сложный сложная сложное сложные сложную сложном сложного сложнее посложнее ' +
  'трудный трудная трудном трудного труднее потруднее школьников старших больших взрослых').split(' '));
// Слово-подсказка, после которого даже одно слово («полегче») — точно про настройки.
const STRICT_MARKED = new Set(['легче', 'полегче', 'проще', 'попроще', 'сложнее', 'посложнее', 'труднее', 'потруднее',
  'длиннее', 'подлиннее', 'короче', 'покороче']);
const SETTINGS_FILLER = new Set(('а и ну да давай давайте хочу хочется сделай сделать сделаем поставь поставить ' +
  'поменяй поменять поменяем включи включить переключи смени сменить измени изменить играть играем играю ' +
  'будем буду сыграем сыграть игра игру игры игре теперь пусть на по с в во для уровень уровня уровне ' +
  'режим режиме пожалуйста можно мне нам лучше штук алиса будет').split(' '));

function isCountNoun(w) {
  return COUNT_NOUNS.some((p) => w.startsWith(p));
}

/**
 * Настройки из реплики: { lv, n, bad, marked } или null.
 * lv — 1/2, n — 5/10, bad — названо неподдерживаемое число вопросов («семь вопросов»),
 * marked — реплика точно про настройки (в ней «уровень», «вопросов», «полегче»…), а не про ответ.
 * strict: реплика должна целиком состоять из слов про настройки (используется посреди вопроса).
 * bareCount: «пять» / «десять» без слова «вопросов» — тоже число вопросов (после «Что поменяем?»),
 * а не возраст («мне десять» — сложный уровень).
 */
function parseSettings(utterance, { strict = false, bareCount = false } = {}) {
  const words = tokens(utterance);
  if (!words.length) return strict ? null : { lv: null, n: null, bad: false, marked: false };
  const hasNoun = bareCount || words.some(isCountNoun);
  let n = null;
  let bad = false;
  const countWords = new Set();
  for (const w of words) {
    for (const [count, list] of Object.entries(COUNT_NUMBERS)) {
      if (list.includes(w) && hasNoun) { n = Number(count); countWords.add(w); }
    }
    if (hasNoun && OTHER_NUMBERS.has(w)) { bad = true; countWords.add(w); }
    if ((hasNoun && COUNT_UP_NOUN.includes(w)) || COUNT_UP.includes(w)) { n = 10; countWords.add(w); }
    if ((hasNoun && COUNT_DOWN_NOUN.includes(w)) || COUNT_DOWN.includes(w)) { n = 5; countWords.add(w); }
  }
  if (n) bad = false;
  const rest = words.filter((w) => !countWords.has(w) && !isCountNoun(w));

  let lv;
  if (strict) {
    const allKnown = words.every((w) => countWords.has(w) || isCountNoun(w) || SETTINGS_FILLER.has(w) || STRICT_EASY.has(w) || STRICT_HARD.has(w));
    if (!allKnown) return null;
    const easy = rest.some((w) => STRICT_EASY.has(w));
    const hard = rest.some((w) => STRICT_HARD.has(w));
    lv = easy && !hard ? 1 : hard && !easy ? 2 : null;
  } else {
    lv = levelOf(rest);
  }
  if (strict && !lv && !n && !bad) return null;
  const marked = words.length >= 2 || words.some((w) => STRICT_MARKED.has(w));
  return { lv, n, bad, marked };
}

const COMMANDS = {
  stop: ['хватит', 'стоп', 'выход', 'выйти', 'выключись', 'закончи', 'закончить', 'заканчивай', 'надоело', 'не хочу играть', 'конец'],
  repeat: ['повтори', 'повторить', 'повтори пожалуйста', 'еще раз', 'не расслышал', 'не расслышала', 'что', 'чего'],
  help: ['помощь', 'помоги', 'правила', 'что ты умеешь', 'как играть', 'не понимаю'],
  skip: ['не знаю', 'сдаюсь', 'пропусти', 'пропустить', 'дальше', 'следующий', 'следующий вопрос'],
  yes: ['да', 'давай', 'давайте', 'конечно', 'ага', 'угу', 'хочу', 'еще', 'играть', 'играем', 'начать', 'начинай', 'начнем', 'поехали', 'сыграем', 'согласен', 'согласна', 'ок', 'окей', 'так же', 'также'],
  no: ['нет', 'не хочу', 'не надо', 'неа'],
  change: ['поменять', 'поменяй', 'другой', 'другую', 'сменить', 'смени', 'изменить', 'другой уровень'],
};

const INTENT_MAP = {
  'YANDEX.REPEAT': 'repeat',
  'YANDEX.HELP': 'help',
  'YANDEX.WHAT_CAN_YOU_DO': 'help',
  'YANDEX.CONFIRM': 'yes',
  'YANDEX.REJECT': 'no',
};

/**
 * Определяет служебную команду. Команды ищем только в коротких репликах,
 * чтобы не перепутать с пересказом ответа («подождать, пока…»).
 * Порядок важен: «не хочу играть» — это stop, а не no.
 */
function detectCommands(utterance, intents) {
  const found = new Set();
  for (const [intent, cmd] of Object.entries(INTENT_MAP)) if (intents && intents[intent]) found.add(cmd);
  const words = tokens(utterance);
  if (words.length && words.length <= 4) {
    for (const [cmd, list] of Object.entries(COMMANDS)) if (hasAny(words, list)) found.add(cmd);
  }
  if (found.has('stop')) found.delete('no');
  if (found.has('repeat') && words.includes('еще')) found.delete('yes');
  return found;
}

/** Команда, если реплика целиком совпадает с командной фразой («повтори», «не знаю»), иначе null. */
function exactCommand(utterance, intents) {
  for (const [intent, cmd] of Object.entries(INTENT_MAP)) if (intents && intents[intent]) return cmd;
  const n = normalize(utterance);
  for (const [cmd, list] of Object.entries(COMMANDS)) if (list.includes(n)) return cmd;
  return null;
}

module.exports = { normalize, tokens, parseAnswer, parseLevel, parseSettings, detectCommands, exactCommand, COUNTS };
