'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BY_ID } = require('../data/questions');
const { pickQuestions, rememberRecent, poolFor, RECENT_LIMIT } = require('../src/selector');
const { seeded } = require('../src/random');

test('лёгкий уровень: 5 разных вопросов только уровня 1', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ids = pickQuestions(1, [], seeded(seed));
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    for (const id of ids) assert.equal(BY_ID.get(id).level, 1);
  }
});

test('сложный уровень: минимум 3 вопроса уровня 2', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const ids = pickQuestions(2, [], seeded(seed));
    assert.equal(new Set(ids).size, 5);
    assert.ok(ids.filter((id) => BY_ID.get(id).level === 2).length >= 3);
  }
});

test('все места в игре разные и не больше 2 вопросов на одну тему', () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (const lv of [1, 2]) {
      const qs = pickQuestions(lv, [], seeded(seed)).map((id) => BY_ID.get(id));
      const byPlace = {};
      const byTopic = {};
      for (const q of qs) {
        byPlace[q.place] = (byPlace[q.place] || 0) + 1;
        byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
      }
      assert.ok(Math.max(...Object.values(byPlace)) <= 1, `seed ${seed}: место повторяется`);
      assert.ok(Math.max(...Object.values(byTopic)) <= 2, `seed ${seed}: тема повторяется`);
    }
  }
});

test('недавние вопросы не повторяются в следующей игре', () => {
  const rng = seeded(7);
  let recent = [];
  const first = pickQuestions(1, recent, rng);
  recent = rememberRecent(recent, first);
  const second = pickQuestions(1, recent, rng);
  assert.equal(second.filter((id) => first.includes(id)).length, 0);
});

test('история ограничена и игра не ломается, когда всё уже было', () => {
  const rng = seeded(3);
  let recent = [];
  for (let i = 0; i < 30; i++) {
    const ids = pickQuestions(1, recent, rng);
    assert.equal(ids.length, 5);
    recent = rememberRecent(recent, ids);
    assert.ok(recent.length <= RECENT_LIMIT);
  }
  assert.ok(poolFor(1).length >= 30);
});

test('когда забавных (fun: 2) хотя бы MIN_FUN_POOL, в каждой игре есть забавный', () => {
  const { QUESTIONS } = require('../data/questions');
  const { MIN_FUN_POOL } = require('../src/selector');
  // Банк, где забавный примерно каждый второй вопрос уровня 1 и несколько уровня 2.
  let l1 = 0;
  let l2 = 0;
  const bank = QUESTIONS.map((q) => {
    const fun = q.level === 1 ? l1++ % 2 === 0 && l1 <= MIN_FUN_POOL * 2 : l2++ < 10;
    return fun ? { ...q, fun: 2 } : q;
  });
  const byId = new Map(bank.map((q) => [q.id, q]));
  assert.ok(bank.filter((q) => q.level === 1 && q.fun === 2).length >= MIN_FUN_POOL);
  for (let seed = 1; seed <= 50; seed++) {
    for (const lv of [1, 2]) {
      for (const length of [5, 10]) {
        const qs = pickQuestions(lv, [], seeded(seed), length, [], bank).map((id) => byId.get(id));
        assert.equal(new Set(qs.map((q) => q.id)).size, length);
        assert.ok(qs.some((q) => q.fun === 2), `seed ${seed}, уровень ${lv}: нет забавного`);
        assert.equal(new Set(qs.map((q) => q.place)).size, length, `seed ${seed}: место повторяется`);
        if (lv === 1) assert.ok(qs.every((q) => q.level === 1));
        else assert.ok(qs.filter((q) => q.level === 2).length >= Math.ceil(length * 0.6));
      }
    }
  }
  // Пока забавных мало, подбор их не навязывает: в банке их нет — и игра собирается как раньше.
  assert.equal(QUESTIONS.filter((q) => q.fun === 2).length < MIN_FUN_POOL, true);
});

test('application_state влезает в лимит и с четырёхзначными id', () => {
  const { RECENT_TITLES, TIERS } = require('../src/titles');
  const app = {
    lv: 2, n: 10, hn: 3,
    rc: Array.from({ length: RECENT_LIMIT }, (_, i) => 6000 + i),
    tt: TIERS.map((t) => Array.from({ length: RECENT_TITLES }, (_, i) => t.names.length - 1 - i)),
  };
  const size = JSON.stringify(app).length;
  assert.ok(size < 1024, `application_state: ${size} байт`);
});
