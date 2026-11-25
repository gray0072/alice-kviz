'use strict';

// Собирает все наборы вопросов в один банк.
// Новый набор: создайте файл рядом и добавьте его в список ниже.

const SETS = {
  school: require('./school'),
  home: require('./home'),
  city: require('./city'),
  travel: require('./travel'),
  friends: require('./friends'),
  family: require('./family'),
};

const QUESTIONS = Object.entries(SETS).flatMap(([set, list]) =>
  list.map((q) => Object.freeze({ ...q, set }))
);

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

module.exports = { QUESTIONS, BY_ID, SETS };
