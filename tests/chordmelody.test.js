// Strumento Chord melody, rilascio 1a (ADR 0018, punto 12): nota al canto, tre voci, melodie
// generate, armonizzazione, esercizi sull'accordo, link.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/chords.js');
const V = require('../js/voicings.js');
const P = require('../js/progression.js');
const PS = require('../js/progressions.js');
const M = require('../js/melodies.js');
const H = require('../js/exercises/harmonize.js');
const L = require('../js/link.js');

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + Math.floor(m / 12 - 1);
const q = (id) => C.catalog().find((x) => x.id === id);
const prog = (id) => PS.catalog().find((p) => p.id === id);
const pitches = (v) => v.notes.map((n) => nm(n.midi)).join(' ');
/** Forma da chitarrista: «corda,tasto» dalla più grave. */
const shape = (v) => v.notes.map((n) => `${6 - n.string},${n.fret}`).join(' ');
const C_NOTE = P.parseNote('C');

test('tre voci: le forme di cm-tre-voci e di cm-arrangiamento escono dal generatore', () => {
  const has = (id, root, s, opts) => V.voicings(q(id), root, ['trio'], opts).flatMap(V.octaves).some((v) => shape(v) === s);
  // In Accordi (senza opzioni): le quattro forme di cm-tre-voci.
  assert.ok(has('m7', 2, '5,5 3,5 2,6'), 'Dm7');
  assert.ok(has('7', 7, '6,3 3,4 2,6'), 'G7');
  assert.ok(has('maj7', 0, '5,3 3,4 2,5'), 'Cmaj7, Mi al canto');
  assert.ok(has('maj7', 0, '5,3 3,4 1,3'), 'Cmaj7, Sol al canto');
  // A7 su 6–5–1 con la settima al canto (cm-arrangiamento).
  assert.ok(has('7', 9, '6,5 5,4 1,3'), 'A7');
});

test('tre voci: fondamentale al basso, nota guida nel mezzo, canto sulla 2ª o 1ª; regole di Accordi', () => {
  for (const id of ['6', '7', 'maj7', 'm6', 'm7', 'mmaj7', 'm7b5', 'dim7', '9', 'maj9', 'm9']) {
    const quality = q(id);
    const tones = V.toneList(quality);
    for (let pc = 0; pc < 12; pc++) {
      for (const opts of [{}, { melody: true }]) {
        const vs = V.voicings(quality, pc, ['trio'], opts);
        assert.ok(vs.length > 0, `${id} ${pc}`);
        for (const v of vs) {
          assert.equal(v.bass, 0, `${id} basso`);
          assert.ok([0, 1].includes(v.notes[0].string), 'basso sulla 6ª o 5ª');
          assert.ok([4, 5].includes(v.notes[2].string), 'canto sulla 2ª o 1ª');
          assert.ok([3, 6, 7].includes(tones[v.notes[1].tone].number), `${id} guida`);
          if (!opts.melody) {
            assert.ok(v.top !== 0 && v.top < quality.tones.length, `${id}: in Accordi niente raddoppi né tensioni al canto`);
          }
        }
      }
    }
  }
  assert.deepEqual(V.familiesFor(q('maj')).includes('trio'), false);
});

test('nota al canto: filtro per classe di altezza e per altezza, con le ottave', () => {
  const byPc = V.voicings(q('maj7'), 0, ['drop2'], { top: 11 });
  assert.ok(byPc.length > 0 && byPc.every((v) => V.topOf(v).midi % 12 === 11));
  const byMidi = V.voicings(q('maj7'), 0, ['drop2'], { top: 71 });
  assert.ok(byMidi.length > 0 && byMidi.every((v) => V.topOf(v).midi === 71));
});

test('note al canto in salita: Cmaj7 in drop 2 sulle corde 4–3–2–1 come cm-drop2-maj7', () => {
  const r = H.tops(q('maj7'), C_NOTE, { family: 'drop2', string: '1' });
  assert.deepEqual(r.items.map((it) => pitches(it.voicing)), [
    'E3 B3 C4 G4', 'G3 C4 E4 B4', 'B3 E4 G4 C5', 'C4 G4 B4 E5',
  ]);
  assert.ok(r.items.every((it) => it.voicing.label === '4321'));
});

test('stessa nota al canto: la fondamentale su maj7, 6, 7, m7, m7♭5; cambiano una o due voci', () => {
  const r = H.sameTop(C_NOTE, { family: 'drop2', string: '1' });
  assert.deepEqual(r.items.map((it) => it.chord.symbol), ['Cmaj7', 'C6', 'C7', 'Cm7', 'Cm7♭5']);
  assert.ok(r.items.every((it) => V.topOf(it.voicing).midi === V.topOf(r.items[0].voicing).midi));
  for (let i = 1; i < r.items.length; i++) {
    const a = r.items[i - 1].voicing.notes.map((n) => n.midi);
    const b = r.items[i].voicing.notes.map((n) => n.midi);
    const moved = a.filter((m, k) => m !== b[k]).length;
    assert.ok(moved >= 1 && moved <= 2, `${r.items[i].chord.symbol}: ${moved} voci`);
  }
});

test('quiz: ogni soluzione ha la nota al canto chiesta, sulla corda scelta', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = H.quiz(q('7'), C_NOTE, { family: 'drop2', string: '2', seed });
    assert.ok(r.solutions.length > 0);
    assert.ok(r.solutions.every((v) => v.top === r.tone && V.topOf(v).string === 4));
    assert.equal(r.events.filter((e) => e.part === 'melody').length, 1);
  }
});

test('II–V–I in drop 2: la melodia guida, le voci interne si muovono al più di un tono', () => {
  const r = H.build(P.realize(prog('ii-v-i')), { family: 'drop2', string: '1', line: 'guide' });
  assert.deepEqual(r.items.map((it) => nm(it.midi)), ['C5', 'B4', 'B4', 'B4']);
  for (let i = 1; i < r.items.length; i++) {
    const a = r.items[i - 1].voicing.notes;
    const b = r.items[i].voicing.notes;
    a.slice(0, -1).forEach((n, k) => assert.ok(Math.abs(n.midi - b[k].midi) <= 2, `voce ${k}`));
  }
});

test('tre voci sul II–V–I: melodia Fa–Fa–Mi, nota guida interna Do–Si–Si come cm-tre-voci', () => {
  const r = H.build(P.realize(prog('ii-v-i')), { ex: 'trio', string: '2', line: 'guide' });
  assert.deepEqual(r.items.slice(0, 3).map((it) => nm(it.midi)), ['F4', 'F4', 'E4']);
  assert.deepEqual(r.items.slice(0, 3).map((it) => NAMES[it.voicing.notes[1].midi % 12]), ['C', 'B', 'B']);
  assert.ok(r.items.every((it) => it.voicing.family === 'trio'));
});

test('melodie: nessuna nota d\'accordo senza forma su 14 griglie × 12 tonalità', () => {
  for (const p of PS.catalog()) {
    for (let key = 0; key < 12; key++) {
      const real = P.realize(p, { key });
      for (const line of ['common', 'guide', 'tones']) {
        for (const [family, string] of [['drop2', '1'], ['drop3', '12'], ['trio', '2']]) {
          const r = H.build(real, { family, string, line, fretFrom: 1, fretTo: 20 });
          const tag = `${p.id} ${key} ${line} ${family} ${string}`;
          assert.ok(!r.error, tag);
          assert.deepEqual(r.unharmonized, [], tag);
          for (const it of r.items) {
            const [lo, hi] = M.range(string);
            assert.ok(it.midi >= lo && it.midi <= hi, tag + ' registro');
          }
        }
      }
    }
  }
});

test('melodie: ritmo a celle, nessuna nota attraversa il cambio d\'accordo, seme deterministico', () => {
  const real = P.realize(prog('blues-jazz'), { key: 'F' });
  for (const cell of ['whole', 'halves', 'dotted', 'half-quarters', 'charleston', 'quarters', 'vary']) {
    const notes = M.build(real, { line: 'tones', cell, seed: 7 });
    assert.equal(notes.reduce((a, n) => a + n.dur, 0), real.beats, cell);
    for (const n of notes) {
      const seg = real.timeline[n.seg];
      assert.ok(n.beat >= seg.beat - 1e-9 && n.beat + n.dur <= seg.beat + seg.dur + 1e-9, cell);
    }
  }
  const a = JSON.stringify(H.build(real, { cell: 'vary', seed: 11 }).events);
  assert.equal(JSON.stringify(H.build(real, { cell: 'vary', seed: 11 }).events), a);
  assert.notEqual(JSON.stringify(H.build(real, { cell: 'vary', seed: 12 }).events), a);
});

test('eventi: la melodia è una parte propria, le voci sotto non la contengono; studio e attacco', () => {
  const real = P.realize(prog('ii-v-i'));
  const full = H.build(real, { cell: 'half-quarters' });
  const mel = full.events.filter((e) => e.part === 'melody');
  const comp = full.events.filter((e) => e.part === 'comp');
  assert.equal(mel.length, full.items.length);
  // Accordo sui tempi forti (1 e 3), nota sola sul 4.
  assert.ok(full.items.some((it) => !it.voicing) && full.items.filter((it) => it.voicing).every((it) => it.beat % 2 === 0));
  for (const e of comp) {
    const m = mel.find((x) => x.n === e.n);
    assert.ok(e.notes.every((n) => n.string !== m.notes[0].string && n.midi < m.midi));
  }
  assert.ok(H.build(real, { study: 'melody' }).events.every((e) => e.part === 'melody'));
  const bass = H.build(real, { study: 'bass' }).events.filter((e) => e.part === 'comp');
  assert.ok(bass.every((e) => e.notes.length === 1));
  const play = H.build(real, { study: 'play' }).events;
  assert.ok(play.length > 0 && play.every((e) => e.part === 'comp' && e.notes.length === 1));
  const first = H.build(real, { attack: 'melody' }).events;
  assert.equal(first.find((e) => e.part === 'comp').beat, 0.5);
});

test('link del chord melody: andata e ritorno, valori non validi scartati, id stabili', () => {
  const s = {
    material: 'prog', ex: 'trio', line: 'tones', cell: 'vary', seed: 42, family: 'trio', string: '2',
    fretFrom: 3, fretTo: 10, attack: 'melody', study: 'bass', bpm: 72,
  };
  const p = L.encodeChordMelodyExercise(s);
  assert.deepEqual(L.decodeChordMelodyExercise(L.parse(L.build({ prog: 'ii-v-i', key: 'F', ...p })).params), {
    ex: 'trio', line: 'tones', cell: 'vary', seed: 42, family: 'trio', string: '2',
    fretFrom: 3, fretTo: 10, attack: 'melody', study: 'bass', bpm: 72,
  });
  const c = L.encodeChordMelodyExercise({ ...s, material: 'chord', cex: 'quiz-top', seed: 5 });
  assert.equal(c.ex, 'quiz-top');
  assert.equal(c.line, null);
  assert.equal(c.seed, 5);
  assert.equal(L.encodeChordMelodyExercise({ ...s, cell: 'whole' }).seed, null);
  assert.deepEqual(L.decodeChordMelodyExercise({ ex: 'nope', string: '3', from: '0' }), {});
  assert.deepEqual(H.EXERCISES.map((e) => e.id), ['line', 'trio', 'tops', 'same-top', 'quiz-top']);
  assert.deepEqual(M.LINES.map((l) => l.id), ['common', 'guide', 'tones']);
  assert.deepEqual(M.CELLS.map((x) => x.id), ['whole', 'halves', 'dotted', 'half-quarters', 'charleston', 'quarters']);
});
