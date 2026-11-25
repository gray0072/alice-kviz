'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAnswer, parseLevel, parseSettings, detectCommands } = require('../src/matcher');

const OPTIONS = [
  'Подождать, пока он проснётся',
  'Взять его на руки, он же не против',
  'Спеть ему колыбельную задом наперёд, чтобы проснулся',
];

test('номер ответа словами и цифрами', () => {
  assert.equal(parseAnswer('один', OPTIONS), 1);
  assert.equal(parseAnswer('2', OPTIONS), 2);
  assert.equal(parseAnswer('третий', OPTIONS), 3);
  assert.equal(parseAnswer('вариант два', OPTIONS), 2);
  assert.equal(parseAnswer('я думаю ответ номер три', OPTIONS), 3);
  assert.equal(parseAnswer('первая', OPTIONS), 1);
});

test('номер из сущности YANDEX.NUMBER', () => {
  assert.equal(parseAnswer('номер', OPTIONS, [{ type: 'YANDEX.NUMBER', value: 3 }]), 3);
});

test('пересказ ответа своими словами', () => {
  assert.equal(parseAnswer('подождать', OPTIONS), 1);
  assert.equal(parseAnswer('взять на руки', OPTIONS), 2);
  assert.equal(parseAnswer('спеть колыбельную', OPTIONS), 3);
});

test('непонятная реплика — null', () => {
  assert.equal(parseAnswer('банан', OPTIONS), null);
  assert.equal(parseAnswer('', OPTIONS), null);
  assert.equal(parseAnswer('один или два', OPTIONS), null);
});

test('уровень', () => {
  assert.equal(parseLevel('лёгкий'), 1);
  assert.equal(parseLevel('для малышей'), 1);
  assert.equal(parseLevel('мне 6 лет'), 1);
  assert.equal(parseLevel('сложный уровень'), 2);
  assert.equal(parseLevel('мне десять'), 2);
  assert.equal(parseLevel('для школьников'), 2);
  assert.equal(parseLevel('привет'), null);
});

test('номер ответа в длинной фразе и пересказ части ответа', () => {
  assert.equal(parseAnswer('давай второй', OPTIONS), 2);
  assert.equal(parseAnswer('наверное третий', OPTIONS), 3);
  assert.equal(parseAnswer('я думаю что первый', OPTIONS), 1);
  assert.equal(parseAnswer('второй ответ', OPTIONS), 2);
  assert.equal(parseAnswer('колыбельную', OPTIONS), 3);
  assert.equal(parseAnswer('надо его взять', OPTIONS), 2);
});

test('настройки: уровень и число вопросов', () => {
  const p = (u, o) => {
    const r = parseSettings(u, o);
    return r && { lv: r.lv, n: r.n, bad: r.bad };
  };
  assert.deepEqual(p('десять вопросов'), { lv: null, n: 10, bad: false });
  assert.deepEqual(p('10 вопросов'), { lv: null, n: 10, bad: false });
  assert.deepEqual(p('давай по пять задач'), { lv: null, n: 5, bad: false });
  assert.deepEqual(p('сложный уровень десять вопросов'), { lv: 2, n: 10, bad: false });
  assert.deepEqual(p('семь вопросов'), { lv: null, n: null, bad: true });
  assert.deepEqual(p('покороче'), { lv: null, n: 5, bad: false });
  assert.deepEqual(p('больше вопросов'), { lv: null, n: 10, bad: false });
  // «мне десять» — возраст, а не число вопросов
  assert.deepEqual(p('мне десять'), { lv: 2, n: null, bad: false });
  assert.equal(parseLevel('десять вопросов'), null);
  // строгий режим (посреди вопроса): только реплики целиком про настройки
  assert.deepEqual(p('давай полегче', { strict: true }), { lv: 1, n: null, bad: false });
  assert.deepEqual(p('сложный уровень', { strict: true }), { lv: 2, n: null, bad: false });
  assert.deepEqual(p('десять вопросов', { strict: true }), { lv: null, n: 10, bad: false });
  assert.equal(p('сложить вещи', { strict: true }), null);
  assert.equal(p('это сложно', { strict: true }), null);
  assert.equal(p('просто подождать', { strict: true }), null);
  assert.equal(p('повтори вопрос', { strict: true }), null);
  assert.equal(p('следующий вопрос', { strict: true }), null);
  assert.equal(parseSettings('сложный', { strict: true }).marked, false);
  assert.equal(parseSettings('сложный уровень', { strict: true }).marked, true);
});

test('команды', () => {
  assert.ok(detectCommands('повтори').has('repeat'));
  assert.ok(detectCommands('хватит').has('stop'));
  assert.ok(detectCommands('не хочу играть').has('stop'));
  assert.ok(!detectCommands('не хочу играть').has('no'));
  assert.ok(detectCommands('давай').has('yes'));
  assert.ok(detectCommands('не знаю').has('skip'));
  assert.ok(detectCommands('', { 'YANDEX.HELP': {} }).has('help'));
  // длинная реплика — это ответ, а не команда
  assert.equal(detectCommands('подождать пока он сам проснётся и придёт').size, 0);
});

test('каждый вариант из банка узнаётся, если повторить его текст', () => {
  const { QUESTIONS } = require('../data/questions');
  const failed = [];
  for (const q of QUESTIONS) {
    const opts = [q.right, q.trick, q.silly];
    opts.forEach((o, i) => {
      if (parseAnswer(o, opts) !== i + 1) failed.push(`#${q.id}: «${o}»`);
    });
  }
  assert.deepEqual(failed, []);
});
