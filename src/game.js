'use strict';

// Логика диалога. Чистая функция: вход — реплика и состояние, выход — ответ и новое состояние.

const { BY_ID } = require('../data/questions');
const { PLACES } = require('../data/places');
const { P, SOUNDS, ORDINALS, OPTION_WORDS, otherLevel, otherCount } = require('./phrases');
const { parseAnswer, parseSettings, detectCommands, exactCommand, COUNTS } = require('./matcher');
const { pickQuestions, rememberRecent, QUIZ_LENGTH } = require('./selector');
const { pickReaction } = require('./reactions');
const { pickTitle } = require('./titles');
const { shuffle, pick } = require('./random');

// Состояния сессии (session.st)
const ST = { LEVEL: 'level', QUESTION: 'q', END: 'end' };
const KINDS = ['r', 't', 's']; // right, trick, silly
const FIELD = { r: 'right', t: 'trick', s: 'silly' };
const REACTION_KIND = { r: 'right', t: 'trick', s: 'silly' };
const HINT_TIMES = 3; // сколько запусков подсказывать, как поменять уровень и число вопросов

function soundsOn() {
  return process.env.SOUNDS === '1';
}

function plural(n, forms) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

// Небольшой конструктор ответа: текст для экрана и tts для голоса собираются параллельно.
class Reply {
  constructor() { this.text = []; this.tts = []; }
  say(text, tts = text) { this.text.push(text); this.tts.push(tts); return this; }
  pause(ms) { this.tts.push(`sil <[${ms}]>`); return this; }
  sound(tag) { if (soundsOn()) this.tts.push(tag); return this; }
  build() { return { text: this.text.join(' ').replace(/ \n/g, '\n').trim(), tts: this.tts.join(' ') }; }
}

// Точка в конце фразы, если там ещё нет знака препинания.
function dot(s) {
  return /[.!?…»"]$/.test(s) ? s : `${s}.`;
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function optionsOf(q, ord) {
  return ord.split('').map((k) => q[FIELD[k]]);
}

function sayQuestion(reply, session) {
  const q = BY_ID.get(session.ids[session.i]);
  const n = session.i + 1;
  const total = session.ids.length;
  const opts = optionsOf(q, session.ord);
  const header = n === total ? P.lastQuestion : `${ORDINALS[n - 1] || `Вопрос ${n}`} вопрос.`;
  reply.say(`\n${header} ${PLACES[q.place]}.`, `${header} ${PLACES[q.place]}.`).pause(300);
  reply.say(`\n${q.q}`, q.q).pause(500);
  opts.forEach((opt, idx) => {
    reply.say(`\n${idx + 1}. ${dot(opt)}`, `${OPTION_WORDS[idx]}: ${dot(opt)}`).pause(400);
  });
  return reply;
}

function newOrder(rng) {
  return shuffle(KINDS, rng).join('');
}

// Сохранённое на колонке число вопросов (5 по умолчанию).
function savedCount(app) {
  return COUNTS.includes(app.n) ? app.n : QUIZ_LENGTH;
}

// Убрать из истории вопросы, которые так и не прозвучали.
function forget(recent, ids) {
  return (recent || []).filter((id) => !ids.includes(id));
}

/**
 * Новая игра. Уровень и число вопросов запоминаются на колонке (application_state).
 * hint — сказать, как поменять настройки (при запуске навыка, первые HINT_TIMES раз).
 * rx — память реакций, переносится между играми одной сессии.
 */
function startGame(reply, { lv, n }, app, rng, { hint = false, rx } = {}) {
  const ids = pickQuestions(lv, app.rc || [], rng, n);
  const session = { st: ST.QUESTION, lv, ids, i: 0, sc: 0, sl: 0, ord: newOrder(rng) };
  if (rx) session.rx = rx;
  const nextApp = { ...app, lv, n: ids.length, rc: rememberRecent(app.rc || [], ids) };
  reply.say(P.start(lv, ids.length));
  if (hint && (app.hn || 0) < HINT_TIMES) {
    reply.say(P.settingsHint(lv, ids.length));
    nextApp.hn = (app.hn || 0) + 1;
  }
  reply.pause(500);
  sayQuestion(reply, session);
  return { session, app: nextApp };
}

// Итог игры. Звание выбирается без повторов недавних, память званий — на колонке (app.tt).
function finish(reply, session, app, rng) {
  const total = session.ids.length;
  reply.say(P.finished(session.sc, total, plural(session.sc, P.pointWords)));
  const title = pickTitle(session.sc, total, app.tt, rng);
  reply.say(title.text);
  if (session.sl > 0) reply.say(P.sillyCount(session.sl, plural(session.sl, P.sillyWords)));
  reply.pause(500).say(P.playAgain);
  const end = { st: ST.END, lv: session.lv, n: total };
  if (session.rx) end.rx = session.rx;
  return { session: end, app: { ...app, tt: title.memory } };
}

function answer(reply, session, app, choice, rng) {
  const q = BY_ID.get(session.ids[session.i]);
  const kind = choice ? session.ord[choice - 1] : null;
  const s = { ...session };
  const reaction = pickReaction(kind ? REACTION_KIND[kind] : 'skipped', s.rx, rng);
  s.rx = reaction.memory;
  if (kind === 'r') {
    s.sc += 1;
    reply.sound(SOUNDS.right).say(reaction.text);
  } else {
    if (kind === 't') reply.sound(SOUNDS.wrong);
    if (kind === 's') s.sl += 1;
    reply.say(reaction.text).say(P.correctIs(dot(q.right)));
  }
  reply.say(q.why).pause(700);
  s.i += 1;
  if (s.i >= s.ids.length) return finish(reply, s, app, rng);
  s.ord = newOrder(rng);
  sayQuestion(reply, s);
  return { session: s, app };
}

/**
 * Смена уровня или числа вопросов посреди игры. Действует сразу и запоминается на колонке:
 * - новый уровень: текущий и оставшиеся вопросы заменяются вопросами нового уровня, очки сохраняются;
 * - 5 → 10: к игре добавляются ещё 5 вопросов;
 * - 10 → 5: игра укорачивается, а если ответов уже 5 или больше, сразу подводятся итоги.
 */
function changeInGame(reply, session, app, set, rng) {
  const s = { ...session };
  const a = { ...app };
  if (set.bad && !set.lv) {
    reply.say(P.countOptions).pause(300);
    sayQuestion(reply, s);
    return { session: s, app: a };
  }
  const newLv = set.lv && set.lv !== s.lv ? set.lv : null;
  const newN = set.n && set.n !== s.ids.length ? set.n : null;
  if (!newLv && !newN) {
    reply.say(P.settingsSame(set.lv, set.n)).pause(300);
    sayQuestion(reply, s);
    return { session: s, app: a };
  }
  reply.say(P.settingsChanged(newLv, newN)).pause(400);
  if (newLv) {
    const asked = s.ids.slice(0, s.i);
    const dropped = s.ids.slice(s.i);
    const recent = forget(a.rc, dropped);
    const fresh = pickQuestions(newLv, recent, rng, dropped.length, asked);
    s.ids = asked.concat(fresh);
    s.lv = newLv;
    s.ord = newOrder(rng);
    a.rc = rememberRecent(recent, fresh);
    a.lv = newLv;
  }
  if (newN) {
    a.n = newN;
    if (newN > s.ids.length) {
      const extra = pickQuestions(s.lv, a.rc || [], rng, newN - s.ids.length, s.ids);
      s.ids = s.ids.concat(extra);
      a.rc = rememberRecent(a.rc || [], extra);
    } else {
      const keep = Math.max(newN, s.i);
      a.rc = forget(a.rc, s.ids.slice(keep));
      s.ids = s.ids.slice(0, keep);
      if (s.i >= s.ids.length) {
        // Ответов уже столько, сколько теперь вопросов в игре: подводим итоги.
        reply.say(P.gameShortened);
        return finish(reply, s, a, rng);
      }
    }
  }
  sayQuestion(reply, s);
  return { session: s, app: a };
}

/**
 * Один ход диалога.
 * @param {object} input { utterance, intents, entities, isNew, session, app }
 * @returns {{ text, tts, endSession, session, app, buttons }}
 */
function handleTurn(input, rng = Math.random) {
  const { utterance = '', intents = {}, entities = [], isNew = false } = input;
  let session = isNew ? {} : { ...(input.session || {}) };
  let app = { ...(input.app || {}) };
  const reply = new Reply();
  const cmds = detectCommands(utterance, intents);
  let endSession = false;

  if (!session.st) {
    // Начало: «Алиса, запусти навык Папин квест» или «…сложный уровень, десять вопросов».
    // Если уровень уже выбирали, игра начинается сразу с сохранёнными настройками, без вопросов.
    const set = parseSettings(utterance);
    const lv = set.lv || app.lv;
    const n = set.n || savedCount(app);
    reply.say(app.lv ? P.welcomeBack : P.welcome).pause(500);
    if (lv) {
      ({ session, app } = startGame(reply, { lv, n }, app, rng, { hint: true }));
    } else {
      if (set.n) app.n = set.n;
      reply.say(P.askLevel);
      session = { st: ST.LEVEL };
    }
  } else if (cmds.has('stop')) {
    if (session.st === ST.QUESTION && session.i > 0) reply.say(P.stoppedEarly(session.sc, session.i, plural(session.sc, P.pointWords)));
    reply.say(P.bye);
    endSession = true;
    session = {};
  } else if (session.st === ST.LEVEL) {
    // Выбор уровня: при первом запуске или после «поменять» в конце игры (session.ch).
    const set = parseSettings(utterance, { bareCount: Boolean(session.ch) });
    const n = set.n || savedCount(app);
    const lv = set.lv || ((set.n || cmds.has('yes')) && app.lv);
    if (lv) ({ session, app } = startGame(reply, { lv, n }, app, rng, { hint: !session.ch, rx: session.rx }));
    else if (set.n) { app.n = set.n; reply.say(P.countOnlyStored(set.n)).say(P.askLevel); }
    else if (set.bad) reply.say(P.countOptions).say(P.askLevelShort);
    else if (cmds.has('help')) reply.say(P.rules).pause(400).say(P.askLevel);
    else reply.say(P.askLevelShort);
  } else if (session.st === ST.QUESTION) {
    // Порядок разбора описан в docs/03-dialog-flow.md: целиком командная реплика («повтори»),
    // настройки («сложный уровень»), ответ, командное слово в короткой реплике.
    // Вариант «Подождать следующий лифт» — это ответ, а не «следующий».
    const q = BY_ID.get(session.ids[session.i]);
    const exact = exactCommand(utterance, intents);
    const choice = exact ? null : parseAnswer(utterance, optionsOf(q, session.ord), entities);
    const set = exact ? null : parseSettings(utterance, { strict: true });
    if (set && (set.marked || !choice)) {
      ({ session, app } = changeInGame(reply, session, app, set, rng));
    } else if (choice) {
      ({ session, app } = answer(reply, session, app, choice, rng));
    } else if (cmds.has('help')) {
      reply.say(P.rules).pause(500);
      sayQuestion(reply, session);
    } else if (cmds.has('repeat')) {
      sayQuestion(reply, session);
    } else if (cmds.has('skip')) {
      ({ session, app } = answer(reply, session, app, null, rng));
    } else if (cmds.has('change')) {
      reply.say(P.changeHint(session.lv, session.ids.length)).pause(300);
      sayQuestion(reply, session);
    } else {
      reply.say(pick(P.notUnderstood, rng)).say(P.sayNumber).pause(300);
      sayQuestion(reply, session);
    }
  } else if (session.st === ST.END) {
    const set = parseSettings(utterance);
    const lv = set.lv || session.lv || app.lv || 1;
    const n = set.n || session.n || savedCount(app);
    if (set.lv || set.n) ({ session, app } = startGame(reply, { lv, n }, app, rng, { rx: session.rx }));
    else if (set.bad) reply.say(P.countOptions).say(P.playAgain);
    else if (cmds.has('change')) { reply.say(P.askChange); session = { st: ST.LEVEL, ch: 1, rx: session.rx }; }
    else if (cmds.has('yes') || cmds.has('repeat')) ({ session, app } = startGame(reply, { lv, n }, app, rng, { rx: session.rx }));
    else if (cmds.has('no')) { reply.say(P.bye); endSession = true; session = {}; }
    else if (cmds.has('help')) reply.say(P.rules).pause(400).say(P.playAgain);
    else reply.say(P.playAgain);
  } else if (app.lv) {
    // Неизвестное состояние (например, «confirm» из прошлой версии навыка) — играем с сохранёнными настройками.
    ({ session, app } = startGame(reply, { lv: app.lv, n: savedCount(app) }, app, rng));
  } else {
    reply.say(P.askLevel);
    session = { st: ST.LEVEL };
  }

  return { ...reply.build(), endSession, session, app, buttons: buttonsFor(session, endSession) };
}

function buttonsFor(session, endSession) {
  if (endSession) return [];
  switch (session.st) {
    case ST.LEVEL: return ['Лёгкий', 'Сложный', 'Пять вопросов', 'Десять вопросов'];
    case ST.QUESTION: return ['1', '2', '3', 'Повтори', 'Не знаю'];
    case ST.END: return ['Да', `${cap(otherLevel(session.lv || 1))} уровень`, `${cap(otherCount(session.n))} вопросов`, 'Хватит'];
    default: return [];
  }
}

module.exports = { handleTurn, ST, QUIZ_LENGTH, plural };
