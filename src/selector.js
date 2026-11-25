'use strict';

const { QUESTIONS } = require('../data/questions');
const { shuffle } = require('./random');

const QUIZ_LENGTH = 5; // длина игры по умолчанию; ещё бывает 10 (COUNTS в matcher.js)
const HARD_SHARE_LEVEL2 = 0.6; // на сложном уровне не меньше 60 % вопросов уровня 2: 3 из 5, 6 из 10
const MAX_PER_PLACE = 1;
const TOPIC_SHARE = 0.4; // не больше 40 % вопросов на одну тему: 2 из 5, 4 из 10
const RECENT_LIMIT = 60; // сколько последних id помнить на устройстве
const MIN_FRESH = 20; // если свежих вопросов меньше — забываем старую половину истории

function poolFor(level) {
  return level === 1 ? QUESTIONS.filter((q) => q.level === 1) : QUESTIONS;
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

// Жадный выбор с ограничениями на разнообразие; если не хватает — добираем без ограничений.
function take(candidates, count, chosen, counters, maxPerTopic) {
  const out = [];
  for (const q of candidates) {
    if (out.length >= count) break;
    if (chosen.has(q.id)) continue;
    if ((counters.place[q.place] || 0) >= MAX_PER_PLACE) continue;
    if ((counters.topic[q.topic] || 0) >= maxPerTopic) continue;
    out.push(q);
    chosen.add(q.id);
    counters.place[q.place] = (counters.place[q.place] || 0) + 1;
    counters.topic[q.topic] = (counters.topic[q.topic] || 0) + 1;
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
 * @returns {number[]} id вопросов в порядке показа
 */
function pickQuestions(level, recent = [], rng = Math.random, length = QUIZ_LENGTH, exclude = []) {
  const banned = new Set(exclude);
  const pool = poolFor(level).filter((q) => !banned.has(q.id));
  const fresh = shuffle(freshPool(pool, recent), rng);
  const chosen = new Set();
  const counters = { place: {}, topic: {} };
  const maxPerTopic = Math.max(1, Math.ceil(length * TOPIC_SHARE));
  let result;
  if (level === 1) {
    result = take(fresh, length, chosen, counters, maxPerTopic);
  } else {
    const hardCount = Math.ceil(length * HARD_SHARE_LEVEL2);
    const hard = take(fresh.filter((q) => q.level === 2), hardCount, chosen, counters, maxPerTopic);
    const rest = take(fresh, length - hard.length, chosen, counters, maxPerTopic);
    result = shuffle(hard.concat(rest), rng);
  }
  return result.map((q) => q.id);
}

function rememberRecent(recent = [], ids = []) {
  return recent.filter((id) => !ids.includes(id)).concat(ids).slice(-RECENT_LIMIT);
}

module.exports = { pickQuestions, rememberRecent, poolFor, QUIZ_LENGTH, RECENT_LIMIT };
