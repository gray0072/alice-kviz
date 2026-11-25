'use strict';

// Генерирует docs/05-content-catalog.md из банка вопросов.
// Запуск: npm run catalog (после любого изменения вопросов)

const fs = require('node:fs');
const path = require('node:path');
const { QUESTIONS, SETS } = require('../data/questions');
const { PLACES, TOPICS } = require('../data/places');

const SET_TITLES = {
  school: 'Школа и кружки',
  home: 'Дом, гости, праздники',
  city: 'Город',
  travel: 'Отпуск и путешествия',
  friends: 'Друзья и чувства',
  family: 'Семья и отношения',
};

const esc = (s) => String(s).replace(/\|/g, '\\|');
const count = (list, key) => list.reduce((m, q) => ((m[q[key]] = (m[q[key]] || 0) + 1), m), {});

const lines = [];
lines.push('# 05. Каталог вопросов');
lines.push('');
lines.push('> Файл создаётся автоматически командой `npm run catalog`. Не редактируйте вручную —');
lines.push('> правьте вопросы в `data/questions/*.js`.');
lines.push('');
const l1 = QUESTIONS.filter((q) => q.level === 1).length;
lines.push(`Всего вопросов: **${QUESTIONS.length}**. Уровень 1 (для всех, с 6 лет): **${l1}**. ` +
  `Уровень 2 (для старших, с 9–10 лет): **${QUESTIONS.length - l1}**.`);
lines.push('');

lines.push('## По наборам и местам');
lines.push('');
lines.push('| Набор | Место | Ур. 1 | Ур. 2 | Всего |');
lines.push('|---|---|---:|---:|---:|');
for (const [set, list] of Object.entries(SETS)) {
  const places = [...new Set(list.map((q) => q.place))];
  for (const p of places) {
    const qs = list.filter((q) => q.place === p);
    const a = qs.filter((q) => q.level === 1).length;
    lines.push(`| ${SET_TITLES[set] || set} | ${PLACES[p]} | ${a} | ${qs.length - a} | ${qs.length} |`);
  }
}
lines.push('');

lines.push('## По темам');
lines.push('');
lines.push('| Тема | Вопросов |');
lines.push('|---|---:|');
const byTopic = count(QUESTIONS, 'topic');
for (const [key, title] of Object.entries(TOPICS)) lines.push(`| ${title} | ${byTopic[key] || 0} |`);
lines.push('');

for (const [set, list] of Object.entries(SETS)) {
  lines.push(`## ${SET_TITLES[set] || set} (\`data/questions/${set}.js\`)`);
  lines.push('');
  lines.push('| id | Ур. | Место | Тема | Ситуация | Правильный | С подвохом | Вредный совет |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const q of list) {
    lines.push(`| ${q.id} | ${q.level} | ${PLACES[q.place]} | ${TOPICS[q.topic]} | ${esc(q.q)} | ${esc(q.right)} | ${esc(q.trick)} | ${esc(q.silly)} |`);
  }
  lines.push('');
}

const out = path.join(__dirname, '..', 'docs', '05-content-catalog.md');
fs.writeFileSync(out, lines.join('\n'));
console.log(`Записано: docs/05-content-catalog.md (${QUESTIONS.length} вопросов)`);
