// Strumento Arpeggi (ADR 0011): catalogo delle qualità, ortografia, diteggiature in posizione,
// pool con partenza da un'altra nota e arpeggi estesi, preset.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const C = require('../js/chords.js');
const G = require('../js/guitar.js');
const L = require('../js/link.js');
const Pool = require('../js/exercises/pool.js');
const Presets = require('../js/exercises/presets.js');

const A = Presets.ARPEGGI;
const q = (id) => C.catalog().find((x) => x.id === id);
const spelled = (id, root) => C.spell(q(id), L.parseNote(root)).map((n) => T.noteToString(n)).join(' ');
const ctxOf = (quality, pc) => {
  const semis = C.semitones(quality);
  return Pool.context(semis, pc, G.positionPatterns(semis, pc), { rootOnce: quality.rootOnce });
};
const names = (pool) => pool.map((p) => p.midi);

test('catalogo: 19 qualità, id unici e stabili', () => {
  const ids = C.catalog().map((x) => x.id);
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, ids.length);
  // Compaiono nei deep link: non devono cambiare.
  assert.deepEqual(ids, ['maj', 'm', 'dim', 'aug', '6', '7', 'maj7', 'm6', 'm7', 'mmaj7', 'm7b5', '7s5', 'dim7',
    '69', '9', 'maj9', 'm69', 'm9', 'mmaj9']);
  assert.ok(C.catalog().every((x) => C.family(x.family)));
});

test('formule e altezze', () => {
  assert.equal(C.formula(q('m7b5')), '1 b3 b5 b7');
  assert.equal(C.formula(q('dim7')), '1 b3 b5 °7');
  assert.equal(C.formula(q('m69')), '1 b3 5 6 9');
  assert.deepEqual(C.semitones(q('maj7')), [0, 4, 7, 11]);
  assert.deepEqual(C.semitones(q('7s5')), [0, 4, 8, 10]);
  assert.deepEqual(C.semitones(q('dim7')), [0, 3, 6, 9]);
  assert.deepEqual(C.semitones(q('9')), [0, 4, 7, 10, 2]);
  assert.deepEqual(C.steps(q('9')), [4, 3, 3, 4]);
});

test('ortografia: come negli esempi del volume', () => {
  assert.equal(spelled('7', 'Bb'), 'Bb D F Ab'); // non G#
  assert.equal(spelled('maj7', 'C'), 'C E G B');
  assert.equal(spelled('m7b5', 'C'), 'C Eb Gb Bb');
  assert.equal(spelled('7s5', 'C'), 'C E G# Bb');
  assert.equal(spelled('dim7', 'C'), 'C Eb Gb A');
  assert.equal(spelled('69', 'C'), 'C E G A D');
  assert.equal(spelled('mmaj9', 'F'), 'F Ab C E G');
  assert.equal(spelled('m6', 'F#'), 'F# A C# D#');
});

test('fondamentale: si sceglie il nome più leggibile, doppie alterazioni solo se inevitabili', () => {
  const root = (id, pc) => C.bestRoots(q(id), pc).map((n) => T.noteToString(n)).join('/');
  assert.equal(root('7', 10), 'Bb');
  assert.equal(root('maj7', 1), 'Db');
  assert.equal(root('m7', 6), 'F#');
  assert.equal(root('dim7', 6), 'F#');
  for (const quality of C.catalog()) {
    for (let pc = 0; pc < 12; pc++) {
      const roots = C.bestRoots(quality, pc);
      for (const r of roots) {
        const notes = C.spell(quality, r);
        notes.forEach((n, i) => {
          assert.equal(T.pitchClass(n), (pc + C.semitones(quality)[i]) % 12, `${quality.id} ${pc}`);
          // Con una tonica naturale non c'è alternativa (B+ = B D# Fx).
          assert.ok(Math.abs(n.accidental) <= 1 || r.accidental === 0, `${quality.id} ${T.noteToString(r)}: ${T.noteToString(n)}`);
        });
      }
    }
  }
});

test('diteggiature: una per nota di partenza, entro 5 tasti, ogni altezza una volta', () => {
  for (const quality of C.catalog()) {
    const semis = C.semitones(quality);
    for (let pc = 0; pc < 12; pc++) {
      const pats = G.positionPatterns(semis, pc);
      assert.equal(pats.length, semis.length);
      pats.forEach((p, i) => {
        const tag = `${quality.id} ${pc} #${i + 1}`;
        assert.ok(p.minFret >= 1 && p.maxFret - p.minFret <= 4, tag);
        assert.equal(p.startDegree, i, tag);
        const midis = p.positions.map((x) => G.TUNING[x.string] + x.fret);
        assert.equal(new Set(midis).size, midis.length, tag);
        // La nota più grave è quella di partenza, sulla 6ª corda.
        const low = p.positions.find((x) => G.TUNING[x.string] + x.fret === Math.min(...midis));
        assert.equal(low.string, 0, tag);
        assert.equal(low.degree, i, tag);
        for (const x of p.positions) assert.equal((G.TUNING[x.string] + x.fret) % 12, (pc + semis[x.degree]) % 12, tag);
        // Nessuna nota dell'arpeggio saltata fra la più grave e la più acuta.
        const sorted = [...midis].sort((a, b) => a - b);
        for (let m = sorted[0]; m <= sorted[sorted.length - 1]; m++) {
          if (semis.includes(((m - pc) % 12 + 12) % 12)) assert.ok(midis.includes(m), tag + ' manca ' + m);
        }
        const perString = semis.length > 4 ? 4 : 3;
        for (let s = 0; s < 6; s++) assert.ok(p.positions.filter((x) => x.string === s).length <= perString, tag);
      });
    }
  }
});

test('diteggiatura 1 di Cmaj7: dalla fondamentale all\'VIII tasto, due ottave', () => {
  const p = G.positionPatterns(C.semitones(q('maj7')), 0)[0];
  assert.deepEqual(p.positions[0], { string: 0, fret: 8, degree: 0 });
  assert.ok(p.minFret >= 7 && p.maxFret <= 12);
  assert.ok(p.positions.some((x) => x.string === 5 && x.fret === 8)); // Do due ottave sopra
});

test('pool: partenza dalla terza, dalla quinta, dalla settima (rivolti)', () => {
  const ctx = ctxOf(q('maj7'), 0);
  const neck = { kind: 'neck', fretFrom: 0, fretTo: 24 };
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1)), [48, 52, 55, 59, 60]);
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1, 1)), [40, 43, 47, 48, 52]);
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1, 3)), [47, 48, 52, 55, 59]);
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1, 9)), [48, 52, 55, 59, 60]); // indice non valido → tonica
});

test('pool: negli arpeggi estesi la nona sta sopra la settima e sostituisce la fondamentale', () => {
  const ctx = ctxOf(q('9'), 0);
  const neck = { kind: 'neck', fretFrom: 0, fretTo: 24 };
  // C E G Bb D, come arpeggio-c9 del volume.
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1)), [48, 52, 55, 58, 62]);
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 2)), [48, 52, 55, 58, 62, 64, 67, 70, 74]);
  // Dalla terza: 3 5 b7 9, senza fondamentale.
  assert.deepEqual(names(Pool.pitchPool(neck, ctx, 1, 1)), [40, 43, 46, 50, 52]);
  // Tutta l'estensione: una sola fondamentale, la più grave.
  const full = Pool.pitchPool(neck, ctx, 'full');
  assert.deepEqual(full.filter((p) => p.degree === 0).map((p) => p.midi), [48]);
  assert.ok(!names(full).includes(50));
  // Le scale e gli arpeggi a 4 note non cambiano.
  assert.equal(Pool.context([0, 4, 7, 11], 0, []).rootOnce, false);
});

test('tutti i preset × tutte le qualità × toniche: eventi coerenti in ogni ambito', () => {
  const scopes = [
    { kind: 'pattern', index: 0 }, { kind: 'pattern', index: 2 }, { kind: 'position', fret: 5 },
    { kind: 'neck', fretFrom: 0, fretTo: 12 }, { kind: 'strings', strings: [2, 3, 4], fretFrom: 0, fretTo: 15 }, { kind: 'chain' },
  ];
  let built = 0;
  for (const quality of C.catalog()) {
    const semis = C.semitones(quality);
    for (const pc of [0, 5, 10]) {
      const ctx = ctxOf(quality, pc);
      for (const p of A.PRESETS) {
        for (const scope of scopes) {
          const r = A.build(ctx, { ...A.presetDefaults(p.id), scope, extension: 'full' });
          if (r.error) continue;
          built++;
          for (const e of r.events) {
            if (e.rest) continue;
            assert.equal((G.TUNING[e.string] + e.fret) % 12, (pc + semis[e.degree]) % 12, `${quality.id} ${p.id} ${scope.kind}`);
          }
          assert.equal(r.lengthBeats % 4, 0);
        }
      }
    }
  }
  assert.ok(built > 5000, String(built));
});

test('preset: catalogo degli arpeggi separato da quello delle scale', () => {
  assert.equal(A.DEFAULTS.scope.kind, 'pattern');
  assert.equal(Presets.DEFAULTS.scope.kind, 'neck');
  assert.ok(A.PRESETS.every((p) => A.CATEGORIES.some((c) => c.id === p.category)));
  assert.equal(new Set(A.PRESETS.map((p) => p.id)).size, A.PRESETS.length);
  assert.ok(!Presets.PRESETS.some((p) => p.id === 'grp-4'));
  // Cmaj7, diteggiatura 1, lineare su due ottave: 1 3 5 7 … e ritorno, senza uscire dalla posizione.
  const r = A.build(ctxOf(q('maj7'), 0), { ...A.presetDefaults('lin-updown'), extension: 2 });
  assert.deepEqual(r.events.slice(0, 9).map((e) => e.midi), [48, 52, 55, 59, 60, 64, 67, 71, 72]);
  assert.ok(Math.max(...r.events.map((e) => e.fret)) - Math.min(...r.events.map((e) => e.fret)) <= 4);
  // Rivolti in sequenza: 1-3-5-7, 3-5-7-8.
  const g = A.build(ctxOf(q('maj7'), 0), { ...A.presetDefaults('grp-4'), direction: 'up', extension: 2 });
  assert.deepEqual(g.events.slice(0, 8).map((e) => e.degree), [0, 1, 2, 3, 1, 2, 3, 0]);
});

test('deep link: nota di partenza (start) 1-based, omessa dalla fondamentale', () => {
  const s = { ...A.DEFAULTS, bpm: 80, startDegree: 2 };
  const p = L.encodeExercise(s);
  assert.equal(p.start, 3);
  assert.equal(L.decodeExercise(L.parse(L.build(p)).params).startDegree, 2);
  assert.equal(L.encodeExercise({ ...A.DEFAULTS, bpm: 80 }).start, null);
  assert.equal(L.decodeExercise({ start: '0' }).startDegree, undefined);
  assert.equal(L.decodeExercise({ start: '1' }).startDegree, 0);
});
