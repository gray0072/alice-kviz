'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { processRequest, handler } = require('../src/handler');
const { BY_ID } = require('../data/questions');
const { seeded } = require('../src/random');
const { QUIZ_LENGTH } = require('../src/selector');

// Мини-«колонка»: хранит состояния между репликами, как это делает Алиса.
function device(seed = 1) {
  const rng = seeded(seed);
  let session = {};
  let app = {};
  let isNew = true;
  return {
    say(text, extra = {}) {
      const res = processRequest({
        version: '1.0',
        session: { new: isNew },
        request: { command: text, original_utterance: text, type: 'SimpleUtterance', nlu: { entities: [], intents: {}, ...extra } },
        state: { session, application: app },
      }, rng);
      isNew = false;
      session = res.session_state;
      app = res.application_state;
      if (res.response.end_session) isNew = true;
      return res;
    },
    get session() { return session; },
    get app() { return app; },
  };
}

test('полная игра: 5 вопросов, итог с очками и званием, предложение сыграть ещё', () => {
  const d = device(5);
  let res = d.say('');
  assert.match(res.response.text, /Выбери уровень/);
  res = d.say('сложный');
  assert.match(res.response.text, /Первый вопрос/);
  assert.equal(QUIZ_LENGTH, 5);
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    assert.equal(d.session.st, 'q');
    // отвечаем всегда правильно
    const correct = d.session.ord.indexOf('r') + 1;
    res = d.say(String(correct));
    assert.ok(res.response.text.length <= 1024);
    assert.ok(res.response.tts.length <= 1024);
  }
  assert.equal(d.session.st, 'end');
  assert.match(res.response.text, /У тебя 5 очков из 5/);
  assert.match(res.response.text, /высший балл! Звание — /);
  assert.match(res.response.text, /Сыграем ещё/);
});

test('состояния укладываются в лимит размера', () => {
  const d = device(9);
  d.say('');
  d.say('лёгкий');
  assert.ok(JSON.stringify(d.session).length < 400);
  d.say('десять вопросов');
  for (let g = 0; g < 10; g++) {
    while (d.session.st === 'q') d.say(String(1 + (g % 3)));
    assert.ok(JSON.stringify(d.session).length < 500, `session_state: ${JSON.stringify(d.session).length}`);
    d.say('да');
    assert.ok(JSON.stringify(d.session).length < 500, `session_state: ${JSON.stringify(d.session).length}`);
  }
  assert.ok(JSON.stringify(d.app).length < 1024, `application_state: ${JSON.stringify(d.app).length}`);
});

test('правильный, с подвохом и вредный совет дают разные реакции и счёт', () => {
  const d = device(11);
  d.say('');
  d.say('лёгкий');
  const q = BY_ID.get(d.session.ids[0]);
  const silly = d.session.ord.indexOf('s') + 1;
  const res = d.say(String(silly));
  assert.match(res.response.text, new RegExp(`Правильный ответ: ${q.right.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal(d.session.sc, 0);
  assert.equal(d.session.sl, 1);
  assert.equal(d.session.i, 1);
});

test('уровень запоминается на устройстве: при следующем запуске игра начинается сразу, без вопросов', () => {
  const d = device(2);
  d.say('');
  d.say('лёгкий');
  let res = d.say('хватит');
  assert.equal(res.response.end_session, true);
  res = d.say('');
  assert.doesNotMatch(res.response.text, /Выбери уровень|Играем так же/);
  assert.match(res.response.text, /Уровень лёгкий, пять вопросов.*Первый вопрос/s);
  assert.equal(d.session.st, 'q');
  assert.equal(d.session.lv, 1);
});

test('подсказка, как поменять настройки, звучит только первые 3 запуска', () => {
  const d = device(3);
  d.say('');
  let res = d.say('лёгкий');
  assert.match(res.response.text, /Чтобы поменять, скажи «сложный уровень» или «десять вопросов»/);
  for (let k = 0; k < 2; k++) {
    d.say('хватит');
    res = d.say('');
    assert.match(res.response.text, /Чтобы поменять/);
  }
  d.say('хватит');
  res = d.say('');
  assert.doesNotMatch(res.response.text, /Чтобы поменять/);
});

test('посреди игры «десять вопросов» удлиняет игру, это запоминается на следующие игры', () => {
  const d = device(21);
  d.say('');
  d.say('лёгкий');
  d.say('один');
  const before = d.session.ids.slice();
  const res = d.say('десять вопросов');
  assert.match(res.response.text, /Теперь десять вопросов/);
  assert.match(res.response.text, /Второй вопрос/);
  assert.equal(d.session.i, 1);
  assert.equal(d.session.ids.length, 10);
  assert.equal(new Set(d.session.ids).size, 10);
  assert.deepEqual(d.session.ids.slice(0, 5), before);
  assert.equal(d.app.n, 10);
  for (let i = 1; i < 10; i++) d.say('два');
  assert.equal(d.session.st, 'end');
  // следующая игра и следующий запуск — снова 10 вопросов
  let next = d.say('да');
  assert.match(next.response.text, /десять вопросов/);
  assert.equal(d.session.ids.length, 10);
  d.say('хватит');
  next = d.say('');
  assert.equal(d.session.ids.length, 10);
});

test('«пять вопросов», когда ответов уже больше пяти, сразу подводит итоги', () => {
  const d = device(22);
  d.say('');
  d.say('сложный десять вопросов');
  assert.equal(d.session.ids.length, 10);
  for (let i = 0; i < 6; i++) d.say(String(d.session.ord.indexOf('r') + 1));
  const res = d.say('давай пять вопросов');
  assert.match(res.response.text, /эта игра уже закончилась.*У тебя 6 очков из 6/s);
  assert.equal(d.session.st, 'end');
  assert.equal(d.app.n, 5);
});

test('«пять вопросов» в начале игры из десяти укорачивает её', () => {
  const d = device(23);
  d.say('');
  d.say('лёгкий');
  d.say('10 вопросов');
  d.say('один');
  const res = d.say('пять вопросов');
  assert.match(res.response.text, /Теперь пять вопросов.*Второй вопрос/s);
  assert.equal(d.session.ids.length, 5);
});

test('смена уровня посреди игры: очки сохраняются, дальше вопросы нового уровня', () => {
  const d = device(24);
  d.say('');
  d.say('сложный');
  d.say(String(d.session.ord.indexOf('r') + 1));
  const first = d.session.ids[0];
  let res = d.say('давай полегче');
  assert.match(res.response.text, /Теперь лёгкий уровень/);
  assert.equal(d.session.lv, 1);
  assert.equal(d.session.sc, 1);
  assert.equal(d.session.i, 1);
  assert.equal(d.session.ids[0], first);
  for (const id of d.session.ids.slice(1)) assert.equal(BY_ID.get(id).level, 1);
  assert.equal(d.app.lv, 1);
  res = d.say('лёгкий уровень');
  assert.match(res.response.text, /У нас и так лёгкий уровень/);
  assert.equal(d.session.i, 1);
});

test('в конце игры можно сразу назвать новые настройки или сказать «поменять»', () => {
  const d = device(25);
  d.say('');
  d.say('лёгкий');
  for (let i = 0; i < 5; i++) d.say('один');
  let res = d.say('сложный уровень');
  assert.equal(d.session.st, 'q');
  assert.equal(d.session.lv, 2);
  for (let i = 0; i < 5; i++) d.say('один');
  res = d.say('поменять');
  assert.match(res.response.text, /Что поменяем/);
  // после «Что поменяем?» голое «десять» — это число вопросов, а не возраст
  res = d.say('десять');
  assert.match(res.response.text, /десять вопросов/);
  assert.doesNotMatch(res.response.text, /Чтобы поменять/);
  assert.equal(d.session.st, 'q');
  assert.equal(d.session.lv, 2);
  assert.equal(d.session.ids.length, 10);
});

test('реакции не повторяются в серии из трёх ответов, в том числе между играми', () => {
  const d = device(26);
  d.say('');
  d.say('лёгкий');
  d.say('десять вопросов');
  const { REACTIONS } = require('../src/reactions');
  const all = [...REACTIONS.right, ...REACTIONS.trick, ...REACTIONS.silly, ...REACTIONS.skipped];
  const seen = [];
  for (let g = 0; g < 4; g++) {
    while (d.session.st === 'q') {
      const res = d.say(String(1 + (seen.length % 3)));
      const r = all.find((x) => res.response.text.startsWith(x));
      assert.ok(r, `реакция не найдена: ${res.response.text.slice(0, 60)}`);
      seen.push(r);
    }
    d.say('да');
  }
  for (let k = 2; k < seen.length; k++) {
    assert.equal(new Set(seen.slice(k - 2, k + 1)).size, 3, `повтор: ${seen.slice(k - 2, k + 1).join(' | ')}`);
  }
});

test('ответ словами: «первый», «давай второй», «наверное третий вариант»', () => {
  const { handleTurn } = require('../src/game');
  const ids = pickIds();
  for (const [said, n] of [['первый', 1], ['давай второй', 2], ['наверное третий вариант', 3], ['я выбираю вторую', 2]]) {
    const out = handleTurn({ utterance: said, session: { st: 'q', lv: 1, ids, i: 0, sc: 0, sl: 0, ord: 'rts' }, app: {} }, seeded(1));
    assert.equal(out.session.i, 1, said);
    assert.equal(out.session.sc, n === 1 ? 1 : 0, said);
  }
});

test('повтори, не знаю, непонятный ответ', () => {
  const d = device(4);
  d.say('');
  d.say('сложный');
  let res = d.say('повтори');
  assert.match(res.response.text, /Первый вопрос/);
  assert.equal(d.session.i, 0);
  res = d.say('абракадабра');
  assert.match(res.response.text, /один, два или три/);
  assert.equal(d.session.i, 0);
  res = d.say('не знаю');
  assert.match(res.response.text, /Правильный ответ/);
  assert.equal(d.session.i, 1);
});

test('запуск сразу с уровнем: «запусти навык … сложный»', () => {
  const d = device(8);
  const res = d.say('сложный уровень');
  assert.equal(d.session.st, 'q');
  assert.match(res.response.text, /Первый вопрос/);
});

test('звание зависит от доли правильных ответов', () => {
  const { handleTurn } = require('../src/game');
  const { TIERS } = require('../src/titles');
  const ids = pickIds();
  // [очки до последнего ответа, итог, уровень звания]
  const cases = [[4, /У тебя 5 очков из 5/, 0], [3, /У тебя 4 очка из 5/, 1], [2, /У тебя 3 очка из 5/, 2], [0, /У тебя 1 очко из 5/, 3]];
  for (const [sc, re, tier] of cases) {
    const session = { st: 'q', lv: 1, ids, i: ids.length - 1, sc, sl: 0, ord: 'rts' };
    const out = handleTurn({ utterance: 'один', session, app: {} }, seeded(1));
    assert.equal(out.session.st, 'end');
    assert.match(out.text, re);
    const name = TIERS[tier].names.find((t) => out.text.includes(`Звание — ${t}!`));
    assert.ok(name, `звание уровня ${tier} в «${out.text}»`);
    assert.ok(out.text.includes(TIERS[tier].after));
    assert.match(out.text, /Сыграем ещё/);
  }
});

test('звания не повторяются подряд и запоминаются на колонке', () => {
  const { handleTurn } = require('../src/game');
  const { TIERS, RECENT_TITLES } = require('../src/titles');
  const ids = pickIds();
  const rng = seeded(3);
  let app = {};
  const heard = [];
  for (let game = 0; game < 30; game++) {
    const session = { st: 'q', lv: 1, ids, i: ids.length - 1, sc: ids.length - 1, sl: 0, ord: 'rts' };
    const out = handleTurn({ utterance: 'один', session, app }, rng);
    app = out.app;
    heard.push(TIERS[0].names.find((t) => out.text.includes(`Звание — ${t}!`)));
  }
  for (let i = 0; i < heard.length; i++) {
    const window = heard.slice(Math.max(0, i - RECENT_TITLES), i);
    assert.ok(!window.includes(heard[i]), `«${heard[i]}» повторилось раньше, чем через ${RECENT_TITLES} игр`);
  }
  assert.ok(new Set(heard).size >= 15);
  assert.ok(JSON.stringify(app).length < 1024);
});

function pickIds() {
  const { pickQuestions } = require('../src/selector');
  return pickQuestions(1, [], seeded(1));
}

test('ping и HTTP-обёртка', async () => {
  const pong = processRequest({ version: '1.0', request: { original_utterance: 'ping' }, session: { new: true } });
  assert.equal(pong.response.text, 'pong');
  const http = await handler({ body: JSON.stringify({ version: '1.0', session: { new: true }, request: { command: '' }, state: {} }) });
  assert.equal(http.statusCode, 200);
  assert.match(JSON.parse(http.body).response.text, /Привет/);
});

test('любой вариант из банка, сказанный целиком, засчитывается как ответ, а не команда', () => {
  const { QUESTIONS } = require('../data/questions');
  const { handleTurn } = require('../src/game');
  const FIELD = { r: 'right', t: 'trick', s: 'silly' };
  const failed = [];
  for (const q of QUESTIONS) {
    for (const kind of ['r', 't', 's']) {
      const session = { st: 'q', lv: 2, ids: [q.id, 101], i: 0, sc: 0, sl: 0, ord: 'rts' };
      const out = handleTurn({ utterance: q[FIELD[kind]].toLowerCase(), session, app: {} }, seeded(1));
      const ok = out.session.i === 1 && out.session.sc === (kind === 'r' ? 1 : 0) && out.session.sl === (kind === 's' ? 1 : 0);
      if (!ok) failed.push(`#${q.id} ${kind}: «${q[FIELD[kind]]}»`);
    }
  }
  assert.deepEqual(failed, []);
});
