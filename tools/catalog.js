'use strict';

// Генерирует docs/05-content-catalog.md из банка вопросов.
// Запуск: npm run catalog (после любого изменения вопросов)

const fs = require('node:fs');
const path = require('node:path');
const { QUESTIONS, SETS } = require('../data/questions');
const { PLACES, TOPICS } = require('../data/places');
const { FOCUSES, AXES, AXIS_GROUPS, SKILLS, SKILL_GROUPS } = require('../data/axes');
const T = require('./targets');

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
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const gap = (have, need) => Math.max(0, need - have);
const bold0 = (n) => (n ? String(n) : '**0**');
const funOf = (q) => q.fun || 0;
const bySet = (set) => QUESTIONS.filter((q) => q.set === set);
const FOCUS_SHORT = { world: 'мир', people: 'люди', self: 'я' };
const FUN_TITLES = { 0: 'Обычный', 1: 'С улыбкой', 2: 'Забавный' };
const poleTitle = (pole) => {
  const a = AXES[pole.slice(0, -1)];
  return pole.endsWith('-') ? `${a.title} «−»: ${a.minus}` : `${a.title} «+»: ${a.plus}`;
};

const poleCount = count(QUESTIONS.filter((q) => q.pole), 'pole');
const funCount = count(QUESTIONS.map((q) => ({ fun: funOf(q) })), 'fun');
const skillStat = (key) => {
  const qs = QUESTIONS.filter((q) => q.skill === key);
  return { all: qs.length, l1: qs.filter((q) => q.level === 1).length, fun: qs.filter((q) => funOf(q) >= 1).length };
};

// Пробелы по разрезам: { text, have, need }. Внутри разреза сначала самые пустые, потом самые большие.
const gaps = { place: [], pole: [], focus: [], skill: [], fun: [] };
for (const [set, places] of Object.entries(T.PLACES)) {
  for (const [p, need] of Object.entries(places)) {
    const have = bySet(set).filter((q) => q.place === p).length;
    if (have < need) gaps.place.push({ text: `Место: ${SET_TITLES[set]} → ${PLACES[p]} (\`${p}\`)`, have, need });
  }
}
for (const axis of Object.keys(AXES)) {
  for (const sign of ['-', '+']) {
    const have = poleCount[axis + sign] || 0;
    if (have < T.MIN_PER_POLE) gaps.pole.push({ text: `Край \`${axis}${sign}\` ${poleTitle(axis + sign)}`, have, need: T.MIN_PER_POLE });
  }
}
for (const [set, focus] of Object.entries(T.FOCUS)) {
  for (const [f, need] of Object.entries(focus)) {
    const have = bySet(set).filter((q) => q.focus === f).length;
    if (have < need) gaps.focus.push({ text: `Фокус: ${SET_TITLES[set]} → ${FOCUSES[f]} (\`${f}\`)`, have, need });
  }
}
for (const key of Object.keys(SKILLS)) {
  const st = skillStat(key);
  const lacks = [];
  if (!st.l1) lacks.push('нужен уровня 1');
  if (!st.fun) lacks.push('нужен забавный');
  if (st.all < T.MIN_PER_SKILL || lacks.length) {
    const text = `Навык \`${key}\` ${SKILLS[key].title}${lacks.length ? ` (${lacks.join(', ')})` : ''}`;
    gaps.skill.push({ text, have: st.all, need: T.MIN_PER_SKILL });
  }
}
const funNeed = Math.round(T.FUN[2] * T.MILESTONE.total);
if ((funCount[2] || 0) < funNeed) gaps.fun.push({ text: 'Забавные вопросы (`fun: 2`)', have: funCount[2] || 0, need: funNeed });
const byFill = (a, b) => a.have / a.need - b.have / b.need || (b.need - b.have) - (a.need - a.have);
for (const list of Object.values(gaps)) list.sort(byFill);

// Десять пунктов по очереди из разных разрезов, чтобы в списке были и места, и края, и навыки.
const top = [];
const queues = Object.values(gaps).map((l) => l.slice());
while (top.length < 10 && queues.some((q) => q.length)) {
  for (const q of queues) if (q.length && top.length < 10) top.push(q.shift());
}

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

// ---------- План и факт ----------
lines.push('## План и факт');
lines.push('');
lines.push(`Цели — ${T.MILESTONE.name}, около ${T.MILESTONE.total} вопросов (\`tools/targets.js\`). ` +
  'Что значат разрезы и как выбирать следующий вопрос, описано в [09-content-plan.md](09-content-plan.md).');
lines.push('');
lines.push('### Куда добавлять в первую очередь');
lines.push('');
lines.push('По очереди самый пустой пункт каждого разреза: место, край, фокус, навык, забавность.');
lines.push('');
lines.push('| # | Что | Есть | Цель |');
lines.push('|---:|---|---:|---:|');
top.forEach((g, i) => lines.push(`| ${i + 1} | ${esc(g.text)} | ${g.have} | ${g.need} |`));
lines.push('');
const emptyPoles = gaps.pole.filter((g) => !g.have).length;
lines.push(`Всего пробелов: мест ${gaps.place.length}, краёв ${gaps.pole.length} ` +
  `(из них пустых ${emptyPoles} из ${Object.keys(AXES).length * 2}), фокусов ${gaps.focus.length}, навыков ${gaps.skill.length}.`);
lines.push('');

lines.push('### Наборы');
lines.push('');
lines.push('| Набор | Есть | Цель | Не хватает | Уровень 1 | Цель ур. 1 |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (const [set, places] of Object.entries(T.PLACES)) {
  const qs = bySet(set);
  const need = Object.values(places).reduce((a, b) => a + b, 0);
  const l1share = T.LEVEL1.sets[set] ?? T.LEVEL1.all;
  const l1set = qs.filter((q) => q.level === 1).length;
  lines.push(`| ${SET_TITLES[set]} | ${qs.length} | ${need} | ${gap(qs.length, need)} | ${pct(l1set, qs.length)} | от ${pct(l1share, 1)} |`);
}
lines.push(`| **Всего** | **${QUESTIONS.length}** | **${T.MILESTONE.total}** | **${gap(QUESTIONS.length, T.MILESTONE.total)}** | ` +
  `**${pct(l1, QUESTIONS.length)}** | **от ${pct(T.LEVEL1.all, 1)}** |`);
lines.push('');

lines.push('### Места');
lines.push('');
lines.push('| Набор | Место | Есть | Цель | Не хватает |');
lines.push('|---|---|---:|---:|---:|');
for (const [set, places] of Object.entries(T.PLACES)) {
  const extra = [...new Set(bySet(set).map((q) => q.place))].filter((p) => !(p in places));
  for (const p of [...Object.keys(places), ...extra]) {
    const have = bySet(set).filter((q) => q.place === p).length;
    const need = places[p] || 0;
    lines.push(`| ${SET_TITLES[set]} | ${PLACES[p]} (\`${p}\`) | ${bold0(have)} | ${need} | ${gap(have, need) || ''} |`);
  }
}
lines.push('');

lines.push('### Фокус: мир, люди, я');
lines.push('');
lines.push('Есть / цель.');
lines.push('');
lines.push(`| Набор | ${Object.values(FOCUSES).join(' | ')} |`);
lines.push(`|---|${Object.keys(FOCUSES).map(() => '---:').join('|')}|`);
const focusTotal = { have: {}, need: {} };
for (const [set, focus] of Object.entries(T.FOCUS)) {
  const cells = Object.keys(FOCUSES).map((f) => {
    const have = bySet(set).filter((q) => q.focus === f).length;
    focusTotal.have[f] = (focusTotal.have[f] || 0) + have;
    focusTotal.need[f] = (focusTotal.need[f] || 0) + focus[f];
    return `${have} / ${focus[f]}`;
  });
  lines.push(`| ${SET_TITLES[set]} | ${cells.join(' | ')} |`);
}
lines.push(`| **Всего** | ${Object.keys(FOCUSES).map((f) =>
  `**${focusTotal.have[f]} / ${focusTotal.need[f]}** (${pct(focusTotal.have[f], QUESTIONS.length)})`).join(' | ')} |`);
lines.push('');

lines.push('### Края');
lines.push('');
lines.push(`Сколько вопросов у края «−» и у края «+». Цель — не меньше ${T.MIN_PER_POLE} у каждого; ` +
  `где уже ${T.MAX_PER_POLE}, новые не добавляем, пока есть края меньше ${T.MIN_PER_POLE}. ` +
  `Без края: ${QUESTIONS.filter((q) => !q.pole).map((q) => q.id).join(', ') || 'нет'}.`);
lines.push('');
for (const [group, title] of Object.entries(AXIS_GROUPS)) {
  lines.push(`**${title}**`);
  lines.push('');
  lines.push('| Ось | «−» недостаток | Есть | «+» избыток | Есть |');
  lines.push('|---|---|---:|---|---:|');
  for (const [key, a] of Object.entries(AXES).filter(([, ax]) => ax.group === group)) {
    lines.push(`| \`${key}\` ${a.title} | ${esc(a.minus)} | ${bold0(poleCount[`${key}-`] || 0)} | ` +
      `${esc(a.plus)} | ${bold0(poleCount[`${key}+`] || 0)} |`);
  }
  lines.push('');
}

lines.push('### Навыки');
lines.push('');
lines.push(`Цель — не меньше ${T.MIN_PER_SKILL} вопросов на навык, из них хотя бы один уровня 1 ` +
  'и хотя бы один забавный (`fun` ≥ 1).');
lines.push('');
lines.push('| Группа | Навык | Есть | Ур. 1 | Забавных |');
lines.push('|---|---|---:|---:|---:|');
for (const [key, sk] of Object.entries(SKILLS)) {
  const st = skillStat(key);
  lines.push(`| ${SKILL_GROUPS[sk.group]} | \`${key}\` ${sk.title} | ${bold0(st.all)} | ${st.l1} | ${st.fun} |`);
}
lines.push('');

lines.push('### Забавность');
lines.push('');
lines.push('| `fun` | Какой | Есть | Доля | Цель доли | На вехе |');
lines.push('|---:|---|---:|---:|---:|---:|');
for (const f of [0, 1, 2]) {
  const have = funCount[f] || 0;
  lines.push(`| ${f} | ${FUN_TITLES[f]} | ${bold0(have)} | ${pct(have, QUESTIONS.length)} | ` +
    `${pct(T.FUN[f], 1)} | ${Math.round(T.FUN[f] * T.MILESTONE.total)} |`);
}
lines.push('');
lines.push(`Загадок (\`kind: 'guess'\`): ${QUESTIONS.filter((q) => q.kind === 'guess').length}.`);
lines.push('');

// ---------- Факт по банку ----------
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
lines.push(`Одна тема — не больше ${pct(T.MAX_TOPIC_SHARE, 1)} банка.`);
lines.push('');
lines.push('| Тема | Вопросов | Доля |');
lines.push('|---|---:|---:|');
const byTopic = count(QUESTIONS, 'topic');
for (const [key, title] of Object.entries(TOPICS)) {
  const n = byTopic[key] || 0;
  const share = pct(n, QUESTIONS.length);
  lines.push(`| ${title} (\`${key}\`) | ${n} | ${n / QUESTIONS.length > T.MAX_TOPIC_SHARE ? `**${share}**` : share} |`);
}
lines.push('');

for (const [set, list] of Object.entries(SETS)) {
  lines.push(`## ${SET_TITLES[set] || set} (\`data/questions/${set}.js\`)`);
  lines.push('');
  lines.push('| id | Ур. | Место | Тема | Разметка | Ситуация | Правильный | С подвохом | Вредный совет |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const q of list) {
    const tags = [FOCUS_SHORT[q.focus], q.pole && `\`${q.pole}\``, q.skill && `навык \`${q.skill}\``,
      funOf(q) && `fun ${funOf(q)}`, q.kind && `\`${q.kind}\``].filter(Boolean).join(' · ');
    lines.push(`| ${q.id} | ${q.level} | ${PLACES[q.place]} | ${TOPICS[q.topic]} | ${tags} | ` +
      `${esc(q.q)} | ${esc(q.right)} | ${esc(q.trick)} | ${esc(q.silly)} |`);
  }
  lines.push('');
}

const out = path.join(__dirname, '..', 'docs', '05-content-catalog.md');
fs.writeFileSync(out, lines.join('\n'));
console.log(`Записано: docs/05-content-catalog.md (${QUESTIONS.length} вопросов)`);
