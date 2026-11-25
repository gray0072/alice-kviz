'use strict';

// Консольный симулятор колонки: играйте в навык в терминале, набирая реплики текстом.
// Запуск: npm run play            — обычная игра
//         npm run play -- --tts   — показывать ещё и разметку tts
//         npm run play -- --seed 42 — воспроизводимый случайный порядок

const readline = require('node:readline');
const { processRequest } = require('../src/handler');
const { seeded } = require('../src/random');

const args = process.argv.slice(2);
const showTts = args.includes('--tts');
const seedIdx = args.indexOf('--seed');
const rng = seedIdx >= 0 ? seeded(Number(args[seedIdx + 1])) : Math.random;

let sessionState = {};
let appState = {};
let isNew = true;
let messageId = 0;

function send(text) {
  const req = {
    version: '1.0',
    session: { new: isNew, message_id: messageId++, session_id: 'local', skill_id: 'local', application: { application_id: 'console' } },
    request: { command: text.toLowerCase(), original_utterance: text, type: 'SimpleUtterance', nlu: { tokens: [], entities: [], intents: {} } },
    state: { session: sessionState, application: appState },
  };
  const res = processRequest(req, rng);
  isNew = false;
  sessionState = res.session_state || {};
  appState = res.application_state || appState;
  console.log('\nАлиса:', res.response.text);
  if (showTts) console.log('[tts]', res.response.tts);
  if (res.response.buttons && res.response.buttons.length) {
    console.log('[подсказки]', res.response.buttons.map((b) => b.title).join(' | '));
  }
  if (res.response.end_session) {
    console.log('\n— навык закрыт. Enter — запустить снова (можно сразу с уровнем: «сложный»), Ctrl+C — выход.');
    isNew = true;
    messageId = 0;
  }
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '\nВы: ' });
console.log('Симулятор навыка «Папин квест». Пустая строка = запуск навыка без слов.');
send('');
rl.prompt();
rl.on('line', (line) => {
  send(line.trim());
  rl.prompt();
});
