'use strict';

// Адаптер протокола Яндекс Диалогов (Алиса) <-> логика игры.
// Работает и как «Функция в Яндекс Облаке» (event — это сам запрос Алисы),
// и как HTTP-вебхук (event.body — строка с JSON).

const { handleTurn } = require('./game');
const { P } = require('./phrases');

const TEXT_LIMIT = 1024;

function clip(s) {
  return s.length > TEXT_LIMIT ? s.slice(0, TEXT_LIMIT - 1) + '…' : s;
}

function processRequest(req, rng = Math.random) {
  const r = (req && req.request) || {};
  const version = (req && req.version) || '1.0';
  const original = r.original_utterance || '';

  // Служебная проверка доступности от Диалогов.
  if (original === 'ping') {
    return { version, response: { text: P.pong, end_session: true } };
  }

  const state = (req && req.state) || {};
  const nlu = r.nlu || {};
  const utterance = r.command || original || (r.payload && r.payload.text) || '';

  const out = handleTurn({
    utterance,
    intents: nlu.intents || {},
    entities: nlu.entities || [],
    isNew: Boolean(req && req.session && req.session.new),
    session: state.session || {},
    app: state.application || {},
  }, rng);

  return {
    version,
    response: {
      text: clip(out.text),
      tts: clip(out.tts),
      end_session: out.endSession,
      buttons: out.buttons.map((title) => ({ title, hide: true })),
    },
    session_state: out.session,
    application_state: out.app,
  };
}

async function handler(event) {
  if (event && typeof event.body === 'string') {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    const res = processRequest(JSON.parse(raw));
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(res) };
  }
  return processRequest(event);
}

module.exports = { handler, processRequest };
