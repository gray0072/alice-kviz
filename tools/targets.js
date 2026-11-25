'use strict';

// Цели наполнения банка для вехи 1 (около 600 вопросов), см. docs/09-content-plan.md.
// Нужны только каталогу и validate, в архив для Yandex Cloud не попадают.

const MILESTONE = { name: 'веха 1 «Покрытие»', total: 600 };

// Набор -> место -> сколько вопросов нужно. Сумма по набору — цель набора.
const PLACES = {
  school: {
    lesson: 22, class: 12, break: 14, homework: 10, canteen: 8, pe: 8, cloakroom: 6,
    concert: 6, sport: 10, music: 7, choir: 5, library: 5, excursion: 7,
  },
  home: {
    home: 28, nursery: 9, bathroom: 7, bedtime: 7, morning: 6, phone: 6, internet: 14,
    gadget: 7, guests: 9, birthday: 9, holiday: 6, dacha: 8, pet: 9, lift: 7,
  },
  friends: { friends: 30, class: 19, yard: 17, home: 12, break: 8, chat: 10, lesson: 0 },
  family: {
    home: 31, grandma: 14, nursery: 12, kitchen: 12, car: 8, holiday: 7, shop: 6, yard: 4, class: 2,
  },
  city: {
    shop: 11, street: 11, playground: 11, transport: 10, clinic: 8, cafe: 7, dentist: 5,
    barber: 4, rink: 4, pool: 4, cinema: 5, theatre: 5, museum: 5,
  },
  travel: {
    camp: 9, forest: 8, beach: 7, hotel: 6, plane: 6, train: 6, zoo: 6, hill: 5, park: 5,
    airport: 4, boat: 4,
  },
};

// Набор -> фокус -> сколько вопросов нужно.
const FOCUS = {
  home: { world: 48, people: 36, self: 48 },
  school: { world: 30, people: 54, self: 36 },
  friends: { world: 10, people: 62, self: 24 },
  family: { world: 10, people: 58, self: 28 },
  city: { world: 41, people: 31, self: 18 },
  travel: { world: 36, people: 13, self: 17 },
};

const MIN_PER_POLE = 5; // у каждого края
const MAX_PER_POLE = 12; // больше не добавляем, пока есть края меньше MIN_PER_POLE
const MIN_PER_SKILL = 2; // и хотя бы один уровня 1 и хотя бы один с fun ≥ 1

// Доли забавности во всём банке.
const FUN = { 0: 0.4, 1: 0.3, 2: 0.25 };

// Доля уровня 1: во всём банке и в каждом наборе, кроме перечисленных.
const LEVEL1 = { all: 0.45, sets: { school: 0.35, family: 0.35 } };

const MAX_TOPIC_SHARE = 0.15; // одна тема — не больше 15 % банка

module.exports = {
  MILESTONE, PLACES, FOCUS, MIN_PER_POLE, MAX_PER_POLE, MIN_PER_SKILL,
  FUN, LEVEL1, MAX_TOPIC_SHARE,
};
