'use strict';

// Генератор с зерном — для воспроизводимых тестов. В бою используется Math.random.
function seeded(seed) {
  let a = seed >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Тасование Фишера — Йетса, возвращает новый массив.
function shuffle(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)];
}

module.exports = { seeded, shuffle, pick };
