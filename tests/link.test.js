// Deep link (ADR 0010, Docs/deep-link.md) ed eventi polifonici (ADR 0010, punto 3).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const L = require('../js/link.js');
const E = require('../js/events.js');
const Tab = require('../js/tab/layout.js');
const Presets = require('../js/exercises/presets.js');

test('parse/build: andata e ritorno, versione, valori vuoti omessi', () => {
  const h = L.build({ scale: 'dorica', root: 'Bb', shift: null, pickup: '', bpm: 96 });
  assert.equal(h, '#v=1&scale=dorica&root=Bb&bpm=96');
  assert.deepEqual(L.parse(h), { v: 1, params: { scale: 'dorica', root: 'Bb', bpm: '96' } });
  assert.deepEqual(L.parse(''), { v: null, params: {} });
  assert.deepEqual(L.parse('#root=F%23').params, { root: 'F#' });
});

test('tema dal link', () => {
  assert.equal(L.themeOf(L.parse('#theme=dark').params), 'dark');
  assert.equal(L.themeOf(L.parse('#theme=blu').params), null);
});

test('slug delle scale: unici, stabili, leggibili', () => {
  const slugs = T.catalog().map((s) => L.slug(s.name));
  assert.equal(new Set(slugs).size, slugs.length);
  // Questi identificatori compaiono nei link del volume: non devono cambiare.
  for (const s of ['ionica', 'dorica', 'misolidia', 'minore-melodica', 'superlocria', 'lidia-dominante',
    'locria-s2', 'minore-armonica', 'frigia-dominante', 'esatonale', 'diminuita-semitono-tono']) {
    assert.ok(slugs.includes(s), s);
  }
});

test('note: lettura e scrittura', () => {
  assert.deepEqual(L.parseNote('Bb'), { letter: 6, accidental: -1 });
  assert.deepEqual(L.parseNote('f#'), { letter: 3, accidental: 1 });
  assert.deepEqual(L.parseNote('Ebb'), { letter: 2, accidental: -2 });
  assert.deepEqual(L.parseNote('Fx'), { letter: 3, accidental: 2 });
  assert.equal(L.parseNote('H'), null);
  assert.equal(L.parseNote(''), null);
  for (const n of ['C', 'Db', 'F#', 'Bbb', 'G##']) assert.equal(L.noteParam(L.parseNote(n)), n);
});

test('esercizio: codifica e decodifica conservano le impostazioni', () => {
  const s = {
    ...Presets.DEFAULTS, presetId: 'lin-updown', direction: 'up', extension: 'full', rhythmId: 'swing',
    accent: 3, accentOffset: 1, pickup: 2, profile: 'vertical', bpm: 120,
    scope: { ...Presets.DEFAULTS.scope, kind: 'strings', strings: [0, 1], fretFrom: 3, fretTo: 12, allowOpen: false },
  };
  const back = L.decodeExercise(L.parse(L.build(L.encodeExercise(s))).params);
  assert.deepEqual(back, {
    presetId: 'lin-updown', direction: 'up', extension: 'full', rhythmId: 'swing', accent: 3,
    accentOffset: 1, pickup: 2, profile: 'vertical', bpm: 120,
    scope: { kind: 'strings', fretFrom: 3, fretTo: 12, allowOpen: false, strings: [0, 1] },
  });
  // Corde da chitarrista: 6 = Mi grave.
  assert.equal(L.encodeExercise(s).strings, '65');
});

test('esercizio: diteggiatura 1-based, posizione, valori fuori intervallo scartati', () => {
  const pat = L.encodeExercise({ ...Presets.DEFAULTS, bpm: 80, scope: { ...Presets.DEFAULTS.scope, kind: 'pattern', index: 2 } });
  assert.equal(pat.pattern, 3);
  assert.equal(pat.profile, undefined);
  assert.deepEqual(L.decodeExercise({ scope: 'pattern', pattern: '3' }).scope, { kind: 'pattern', index: 2 });
  assert.deepEqual(L.decodeExercise({ ext: '9', from: '30', pattern: '0', bpm: 'x', strings: '79' }), {});
});

test('eventi: nota singola, accordo, pausa', () => {
  assert.deepEqual(E.notesOf({ string: 2, fret: 5, midi: 55 }), [{ string: 2, fret: 5, midi: 55 }]);
  const chord = { notes: [{ string: 0, fret: 3, midi: 43 }, { string: 1, fret: 2, midi: 47 }] };
  assert.equal(E.notesOf(chord), chord.notes);
  assert.deepEqual(E.notesOf({ rest: true, string: 1, fret: 0 }), []);
  assert.deepEqual(E.midisOf([chord, { string: 3, fret: 0, midi: 55 }]), [43, 47, 55]);
});

test('tablatura: le note simultanee si impilano sulla stessa colonna', () => {
  const events = [
    { i: 0, beat: 0, dur: 2, notes: [{ string: 0, fret: 3, midi: 43 }, { string: 2, fret: 2, midi: 52 }, { string: 3, fret: 0, midi: 55 }] },
    { i: 1, beat: 2, dur: 2, string: 4, fret: 10, midi: 69 },
  ];
  const ascii = Tab.toAscii(events, { meter: 4, lengthBeats: 4 }).split('\n');
  const col = (name) => ascii.find((l) => l.startsWith(name));
  assert.match(col('E'), /^E\|-3-/);
  assert.match(col('D'), /^D\|-2-/);
  assert.match(col('G'), /^G\|-0-/);
  assert.match(col('B'), /^B\|----10/);
  const items = Tab.layout(events, { width: 400, meter: 4, lengthBeats: 4 }).systems[0].bars[0].items;
  assert.equal(items[0].notes.length, 3);
  assert.equal(items[1].notes[0].fret, 10);
});
