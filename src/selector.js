'use strict';

const { QUESTIONS } = require('../data/questions');
const { shuffle } = require('./random');

const QUIZ_LENGTH = 5; // длина игры по умолчанию; ещё бывает 10 (COUNTS в matcher.js)
const HARD_SHARE_LEVEL2 = 0.6; // на сложном уровне не меньше 60 % вопросов уровня 2: 3 из 5, 6 из 10
const MAX_PER_PLACE = 1;
const TOPIC_SHARE = 0.4; // не больше 40 % вопросов на одну тему: 2 из 5, 4 из 10
const RECENT_LIMIT = 60; // сколько последних id помнить на устройстве
const MIN_FRESH = 20; // если свежих вопросов меньше — забываем старую половину истории
const MIN_FUN_POOL = 30; // с этого числа забавных (fun: 2) в пуле в каждой игре есть хотя бы один

function poolFor(level, bank = QUESTIONS) {
  return level === 1 ? bank.filter((q) => q.level === 1) : bank;
}

// Убирает недавние вопросы, но так, чтобы осталось из чего выбирать.
function freshPool(pool, recent) {
  let excluded = recent.slice();
  for (;;) {
    const set = new Set(excluded);
    const fresh = pool.filter((q) => !set.has(q.id));
    if (fresh.length >= MIN_FRESH || excluded.length === 0) return fresh;
    excluded = excluded.slice(Math.ceil(excluded.length / 2)); // оставляем самые новые
  }
}

function add(q, chosen, counters) {
  chosen.add(q.id);
  counters.place[q.place] = (counters.place[q.place] || 0) + 1;
  counters.topic[q.topic] = (counters.topic[q.topic] || 0) + 1;
}

// Жадный выбор с ограничениями на разнообразие; если не хватает — добираем без ограничений.
function take(candidates, count, chosen, counters, maxPerTopic) {
  const out = [];
  for (const q of candidates) {
    if (out.length >= count) break;
    if (chosen.has(q.id)) continue;
    if ((counters.place[q.place] || 0) >= MAX_PER_PLACE) continue;
    if ((counters.topic[q.topic] || 0) >= maxPerTopic) continue;
    out.push(q);
    add(q, chosen, counters);
  }
  for (const q of candidates) {
    if (out.length >= count) break;
    if (chosen.has(q.id)) continue;
    out.push(q);
    chosen.add(q.id);
  }
  return out;
}

/**
 * Выбирает вопросы на одну игру (или на её продолжение).
 * @param {1|2} level 1 — лёгкий (только вопросы уровня 1), 2 — сложный (все, из них 60 % уровня 2)
 * @param {number[]} recent id недавно заданных вопросов (от старых к новым)
 * @param {number} length сколько вопросов нужно
 * @param {number[]} exclude id, которые брать нельзя (уже есть в текущей игре)
 * @param {object[]} bank банк вопросов (для тестов)
 * @returns {number[]} id вопросов в порядке показа
 */
function pickQuestions(level, recent = [], rng = Math.random, length = QUIZ_LENGTH, exclude = [], bank = QUESTIONS) {
  const banned = new Set(exclude);
  const pool = poolFor(level, bank).filter((q) => !banned.has(q.id));
  const fresh = shuffle(freshPool(pool, recent), rng);
  const chosen = new Set();
  const counters = { place: {}, topic: {} };
  const maxPerTopic = Math.max(1, Math.ceil(length * TOPIC_SHARE));
  // Забавный вопрос берём первым, если их уже достаточно, чтобы они не приедались.
  const fun = [];
  if (length > 0 && pool.filter((q) => q.fun === 2).length >= MIN_FUN_POOL) {
    const q = fresh.find((c) => c.fun === 2);
    if (q) { fun.push(q); add(q, chosen, counters); }
  }
  let result;
  if (level === 1) {
    result = fun.concat(take(fresh, length - fun.length, chosen, counters, maxPerTopic));
    if (fun.length) result = shuffle(result, rng); // иначе забавный всегда был бы первым
  } else {
    const hardCount = Math.ceil(length * HARD_SHARE_LEVEL2) - fun.filter((q) => q.level === 2).length;
    const hard = take(fresh.filter((q) => q.level === 2), hardCount, chosen, counters, maxPerTopic);
    const rest = take(fresh, length - fun.length - hard.length, chosen, counters, maxPerTopic);
    result = shuffle(fun.concat(hard, rest), rng);
  }
  return result.map((q) => q.id);
}

function rememberRecent(recent = [], ids = []) {
  return recent.filter((id) => !ids.includes(id)).concat(ids).slice(-RECENT_LIMIT);
}

module.exports = { pickQuestions, rememberRecent, poolFor, QUIZ_LENGTH, RECENT_LIMIT, MIN_FUN_POOL };
