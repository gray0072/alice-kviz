'use strict';

// Проверка банка вопросов: структура, уникальность, длины, баланс уровней.
// Запуск: npm run validate

const { QUESTIONS } = require('../data/questions');
const { PLACES, TOPICS } = require('../data/places');
const { tokens } = require('../src/matcher');
const { handleTurn } = require('../src/game');
const { poolFor, QUIZ_LENGTH } = require('../src/selector');
const { REACTIONS, RECENT } = require('../src/reactions');
const { TIERS, RECENT_TITLES } = require('../src/titles');

const LIMITS = { q: 170, option: 80, why: 200, reaction: 80, response: 1024 };
const MIN_REACTIONS = { right: 50, trick: 30, silly: 30 };
const MIN_TITLES = 20;
const NUMBER_WORDS = new Set(['один', 'одна', 'два', 'две', 'три', 'первый', 'второй', 'третий']);

const errors = [];
const warnings = [];
const ids = new Set();

for (const q of QUESTIONS) {
  const where = `#${q.id}`;
  for (const f of ['id', 'place', 'level', 'topic', 'q', 'right', 'trick', 'silly', 'why']) {
    if (q[f] === undefined || q[f] === '') errors.push(`${where}: нет поля ${f}`);
  }
  if (ids.has(q.id)) errors.push(`${where}: повторяющийся id`);
  ids.add(q.id);
  if (!PLACES[q.place]) errors.push(`${where}: неизвестное место «${q.place}»`);
  if (!TOPICS[q.topic]) errors.push(`${where}: неизвестная тема «${q.topic}»`);
  if (![1, 2].includes(q.level)) errors.push(`${where}: level должен быть 1 или 2`);
  if (q.q.length > LIMITS.q) warnings.push(`${where}: длинный вопрос (${q.q.length} > ${LIMITS.q})`);
  if (q.why.length > LIMITS.why) warnings.push(`${where}: длинное объяснение (${q.why.length} > ${LIMITS.why})`);
  const opts = [q.right, q.trick, q.silly];
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 3) errors.push(`${where}: варианты ответа совпадают`);
  for (const o of opts) {
    if (o.length > LIMITS.option) warnings.push(`${where}: длинный вариант (${o.length} > ${LIMITS.option}): ${o}`);
    if (/[.]$/.test(o)) warnings.push(`${where}: точка в конце варианта не нужна: ${o}`);
    const nums = tokens(o).filter((w) => NUMBER_WORDS.has(w));
    if (nums.length) warnings.push(`${where}: в варианте есть числительное «${nums[0]}» — ребёнок может спутать с номером ответа`);
  }
}

// Реакции: сколько их, длина, повторы, обращение без рода.
for (const [kind, list] of Object.entries(REACTIONS)) {
  if (MIN_REACTIONS[kind] && list.length < MIN_REACTIONS[kind]) errors.push(`реакций ${kind}: ${list.length}, нужно от ${MIN_REACTIONS[kind]}`);
  if (list.length <= RECENT[kind]) errors.push(`реакций ${kind}: ${list.length}, а не повторять нужно ${RECENT[kind]} последних`);
  const seen = new Set();
  for (const r of list) {
    if (seen.has(r)) errors.push(`реакция ${kind} повторяется: ${r}`);
    seen.add(r);
    if (r.length > LIMITS.reaction) warnings.push(`длинная реакция ${kind} (${r.length} > ${LIMITS.reaction}): ${r}`);
    // Границы слова — через «не буква»: стандартная граница слова в JS кириллицу не понимает.
    if (/(^|[^а-яё])(угадал|выбрал|ответил|попался|попалась|готов|шутник|шутница|умник)([^а-яё]|$)/i.test(r)) {
      warnings.push(`реакция ${kind} указывает род ребёнка: ${r}`);
    }
  }
}

// Звания: по MIN_TITLES на уровень, без повторов во всей игре, без рода ребёнка.
const allTitles = new Set();
TIERS.forEach((tier, i) => {
  if (tier.names.length < MIN_TITLES) errors.push(`званий уровня ${i}: ${tier.names.length}, нужно от ${MIN_TITLES}`);
  if (tier.names.length <= RECENT_TITLES) errors.push(`званий уровня ${i}: ${tier.names.length}, а не повторять нужно ${RECENT_TITLES} последних`);
  for (const t of tier.names) {
    if (allTitles.has(t.toLowerCase())) errors.push(`звание повторяется: ${t}`);
    allTitles.add(t.toLowerCase());
    if (/(^|[^а-яё])(умник|умница|король|королева|принц|принцесса|шутник|шутница)([^а-яё]|$)/i.test(t)) {
      warnings.push(`звание указывает род ребёнка: ${t}`);
    }
  }
});

// Худший случай по длине: реакция на ответ + объяснение + следующий вопрос.
// Прогоняем каждую пару (вопрос, следующий вопрос) через настоящую логику.
const sorted = QUESTIONS.slice().sort((a, b) => (b.why.length + b.right.length) - (a.why.length + a.right.length));
const longestAfter = sorted[0];
const longestNext = QUESTIONS.slice().sort((a, b) =>
  (b.q.length + b.right.length + b.trick.length + b.silly.length) - (a.q.length + a.right.length + a.trick.length + a.silly.length))[0];
const session = { st: 'q', lv: 2, ids: [longestAfter.id, longestNext.id], i: 0, sc: 0, sl: 0, ord: 'srt' };
const turn = handleTurn({ utterance: 'один', session, app: {} }, () => 0);
// rng = 0 берёт первую реакцию; добавляем запас до самой длинной реакции на подвох или вредный совет.
const reactionSlack = Math.max(...REACTIONS.trick.concat(REACTIONS.silly).map((r) => r.length)) - REACTIONS.silly[0].length;
const worst = { text: turn.text.length + reactionSlack, tts: turn.tts.length + reactionSlack };
for (const [field, value] of Object.entries(worst)) {
  if (value > LIMITS.response) errors.push(`самый длинный ответ (${field}) — ${value} символов, лимит Алисы ${LIMITS.response}`);
}

const l1 = poolFor(1).length;
const l2 = QUESTIONS.filter((q) => q.level === 2).length;
if (l1 < QUIZ_LENGTH * 3) warnings.push(`мало вопросов уровня 1: ${l1}, желательно от ${QUIZ_LENGTH * 3}`);

for (const w of warnings) console.log('ПРЕДУПРЕЖДЕНИЕ', w);
for (const e of errors) console.log('ОШИБКА', e);
console.log(`Вопросов: ${QUESTIONS.length} (уровень 1: ${l1}, уровень 2: ${l2}). ` +
  `Мест: ${new Set(QUESTIONS.map((q) => q.place)).size}, тем: ${new Set(QUESTIONS.map((q) => q.topic)).size}. ` +
  `Реакций: ${REACTIONS.right.length} на правильный, ${REACTIONS.trick.length} на подвох, ${REACTIONS.silly.length} на вредный совет. ` +
  `Самый длинный ответ: ${worst.text} символов текста, ${worst.tts} tts.`);
if (errors.length) {
  console.log(`Найдено ошибок: ${errors.length}`);
  process.exit(1);
}
console.log('Ошибок нет.');
