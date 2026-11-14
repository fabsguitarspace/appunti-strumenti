// Strumento Accordi (ADR 0012): voicing, conduzione delle voci, esercizi, deep link.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const C = require('../js/chords.js');
const G = require('../js/guitar.js');
const V = require('../js/voicings.js');
const VL = require('../js/voiceleading.js');
const X = require('../js/exercises/comping.js');
const L = require('../js/link.js');

const q = (id) => C.catalog().find((x) => x.id === id);
const frets = (v) => v.notes.map((n) => n.fret).join('.');
const find = (vs, fam, set, bass) => vs.filter((v) => v.family === fam && v.label === set && (bass === undefined || v.bass === bass));

test('voicing: note giuste, una per corda, entro cinque tasti, niente vuoti né tensioni al basso', () => {
  let count = 0;
  for (const quality of C.catalog()) {
    const semis = C.semitones(quality);
    for (let pc = 0; pc < 12; pc++) {
      for (const v of V.voicings(quality, pc)) {
        const tag = `${quality.id} ${pc} ${v.family} ${v.label} ${frets(v)}`;
        count++;
        assert.deepEqual(v.notes.map((n) => n.string), v.strings, tag);
        assert.ok(v.maxFret - v.minFret <= 4 && v.minFret >= 1, tag);
        for (const n of v.notes) {
          assert.equal(n.midi, G.TUNING[n.string] + n.fret, tag);
          assert.equal(n.midi % 12, (pc + semis[n.tone]) % 12, tag);
        }
        for (let i = 1; i < v.notes.length; i++) assert.ok(v.notes[i].midi > v.notes[i - 1].midi, tag);
        assert.equal(new Set(v.notes.map((n) => n.tone)).size, v.notes.length, tag + ' (note ripetute)');
        assert.ok(quality.tones[v.bass].number <= 7, tag + ' (tensione al basso)');
      }
    }
  }
  assert.ok(count > 3000, String(count));
});

test('famiglie per qualità: drop 2 e drop 3 in quattro rivolti per ogni accordo di settima', () => {
  for (const id of ['6', '7', 'maj7', 'm6', 'm7', 'mmaj7', 'm7b5', '7s5', 'dim7']) {
    for (let pc = 0; pc < 12; pc++) {
      const vs = V.voicings(q(id), pc);
      for (const [fam, set] of [['drop2', '4321'], ['drop2', '5432'], ['drop3', '6432'], ['drop3', '5321']]) {
        const list = find(vs, fam, set);
        assert.equal(list.length, 4, `${id} ${pc} ${fam} ${set}`);
        assert.equal(new Set(list.map((v) => v.top)).size, 4, `${id} ${pc} ${fam} ${set}: una nota al canto per rivolto`);
      }
    }
  }
  assert.deepEqual(V.familiesFor(q('maj')), ['triad']);
  assert.deepEqual(V.familiesFor(q('dim7')), ['drop2', 'drop3']);
  assert.deepEqual(V.familiesFor(q('9')), ['drop2', 'drop3']);
});

test('shell di Cmaj7 come nel capitolo 6', () => {
  const vs = V.voicings(q('maj7'), 0, ['shell']);
  assert.equal(frets(find(vs, 'shell', '643', 0)[0]), '8.9.9');  // R–7–3, Do all'VIII tasto
  assert.equal(frets(find(vs, 'shell', '543', 0)[0]), '3.2.4');  // R–3–7, Do al III tasto
  assert.equal(frets(find(vs, 'shell', '543', 1)[0]), '7.9.5');  // Cmaj7/E
  assert.equal(frets(find(vs, 'shell', '643', 2)[0]), '3.2.4');  // Cmaj7/G sulla 6ª corda
  assert.equal(frets(find(vs, 'shell', '543', 2)[0]), '10.9.9'); // Cmaj7/G sulla 5ª corda
  // Cm7♭5 con la quinta al basso, senza fondamentale: ♭5–♭3–♭7 (la quinta diminuita resta esplicita).
  const hd = find(V.voicings(q('m7b5'), 0, ['shell']), 'shell', '643', 2)[0];
  assert.deepEqual(hd.notes.map((n) => C.toneToString(q('m7b5').tones[n.tone])), ['b5', 'b3', 'b7']);
});

test('drop 2 e drop 3: disposizione delle voci', () => {
  // Drop 2 di Cmaj7 con la settima al canto, corde 4–3–2–1: Sol Do Mi Si.
  const d2 = find(V.voicings(q('maj7'), 0), 'drop2', '4321').find((v) => v.top === 3);
  assert.deepEqual(d2.notes.map((n) => n.tone), [2, 0, 1, 3]);
  // Drop 3 con la fondamentale al basso: la quinta al canto (capitolo 6).
  const d3 = find(V.voicings(q('maj7'), 0), 'drop3', '6432', 0)[0];
  assert.equal(d3.top, 2);
  // Nona: la nona sostituisce la fondamentale e non va mai al basso.
  for (const v of V.voicings(q('9'), 0)) {
    assert.ok(!v.notes.some((n) => n.tone === 0));
    assert.notEqual(v.bass, 4);
  }
  // Triadi strette: tre rivolti per insieme di corde.
  assert.equal(find(V.voicings(q('maj'), 7), 'triad', '321').length, 3);
});

test('conduzione delle voci: II–V–I con gli shell come nel capitolo 6', () => {
  const r = X.build(q('maj7'), L.parseNote('C'), { exId: 'ii-v-i', family: 'shell', set: 'all', fretFrom: 1, fretTo: 10 });
  assert.deepEqual(r.chords.map((c) => c.symbol), ['Dm7', 'G7', 'Cmaj7']);
  assert.deepEqual(r.chords.map((c) => c.voicing.label), ['543', '643', '543']);
  const upper = (k) => r.chords.map((c) => c.voicing.notes[k].midi % 12);
  // Voci superiori: Fa–Fa–Mi e Do–Si–Si (classi di altezza 5 5 4 e 0 11 11).
  const voices = [upper(1), upper(2)].map((v) => v.join(' ')).sort();
  assert.deepEqual(voices, ['0 11 11', '5 5 4'].sort());
  // Minore: Dm7♭5 – G7 – Cm6.
  const m = X.build(q('m6'), L.parseNote('C'), { exId: 'ii-v-i', family: 'shell', set: 'all', fretFrom: 1, fretTo: 10 });
  assert.deepEqual(m.chords.map((c) => c.symbol), ['Dm7♭5', 'G7', 'Cm6']);
});

test('conduzione delle voci: movimento minimo e zona', () => {
  const a = { notes: [{ midi: 50 }, { midi: 53 }, { midi: 60 }], minFret: 5, maxFret: 5 };
  const b = { notes: [{ midi: 43 }, { midi: 53 }, { midi: 59 }], minFret: 3, maxFret: 4 };
  assert.equal(VL.movement(a, b), 0.25 * 7 + 0 + 1);
  assert.equal(VL.lead([[a], []]), null);
  // Ciclo delle quarte in drop 2: nessuna voce superiore salta più di una terza minore.
  const r = X.build(q('7'), L.parseNote('C'), { exId: 'cycle', family: 'drop2', set: '4321', fretFrom: 3, fretTo: 10 });
  assert.equal(r.chords.length, 12);
  assert.deepEqual(r.chords.slice(0, 4).map((c) => c.symbol), ['C7', 'F7', 'B♭7', 'E♭7']);
  for (let k = 1; k < 12; k++) {
    const x = r.chords[k - 1].voicing.notes;
    const y = r.chords[k].voicing.notes;
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(x[i].midi - y[i].midi) <= 3, `${r.chords[k].symbol} voce ${i}`);
  }
  // Ciclo completo: dopo dodici quarte si torna alla tonalità di partenza.
  assert.equal(T.pitchClass(r.chords[11].root), 7);
});

test('esercizi: rivolti nella zona, ritmi, arpeggiato, eventi polifonici', () => {
  const inv = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', family: 'drop2', set: '4321', fretFrom: 1, fretTo: 15 });
  assert.deepEqual(inv.chords.map((c) => frets(c.voicing)), ['2.4.1.3', '5.5.5.7', '9.9.8.8', '10.12.12.12']);
  const down = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', family: 'drop2', set: '4321', direction: 'down' });
  assert.equal(frets(down.chords[0].voicing), '10.12.12.12');
  const ud = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', family: 'drop2', set: '4321', direction: 'updown' });
  assert.equal(ud.chords.length, 7);
  // Minime, una battuta per accordo: due colpi per accordo, battute intere.
  assert.equal(inv.events.length, 8);
  assert.equal(inv.lengthBeats, 16);
  assert.equal(inv.events[0].notes.length, 4);
  assert.ok(inv.events[0].strum > 0);
  const block = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', attack: 'block', rhythmId: 'charleston', bars: 2 });
  assert.equal(block.events[0].strum, 0);
  assert.deepEqual(block.events.slice(0, 4).map((e) => e.beat), [0, 1.5, 4, 5.5]);
  const arp = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', rhythmId: 'arp' });
  assert.equal(arp.events.filter((e) => e.chord === 0).length, 8);
  // Dal basso all'acuto e ritorno: voci 1 2 3 4 3 2 1 2.
  const v0 = arp.chords[0].voicing.notes;
  assert.deepEqual(arp.events.slice(0, 8).map((e) => v0.indexOf(e.notes[0])), [0, 1, 2, 3, 2, 1, 0, 1]);
  // Zona senza voicing: errore leggibile.
  const none = X.build(q('maj7'), L.parseNote('C'), { exId: 'inv', fretFrom: 1, fretTo: 2 });
  assert.ok(none.error);
  // Tutti gli esercizi × qualità × famiglie × toniche: eventi coerenti.
  for (const quality of C.catalog()) {
    for (const fam of V.familiesFor(quality)) {
      for (const root of ['C', 'F#', 'Bb']) {
        for (const ex of X.EXERCISES) {
          const r = X.build(quality, L.parseNote(root), { exId: ex.id, family: fam, set: 'all', fretFrom: 1, fretTo: 15 });
          assert.ok(!r.error, `${quality.id} ${fam} ${root} ${ex.id}`);
          assert.equal(r.lengthBeats % 4, 0);
          for (const e of r.events) assert.ok(e.notes.length >= 1 && e.chord >= 0 && e.chord < r.chords.length);
        }
      }
    }
  }
});

test('deep link degli accordi: andata e ritorno, valori non validi scartati', () => {
  const s = { ...X.DEFAULTS, exId: 'cycle', family: 'shell', set: 'all', fretFrom: 3, fretTo: 10, rhythmId: 'charleston', bars: 2, attack: 'block', bpm: 96 };
  const p = L.encodeChordExercise(s);
  assert.equal(p.dir, null);
  assert.deepEqual(L.decodeChordExercise(L.parse(L.build(p)).params), {
    exId: 'cycle', family: 'shell', set: 'all', fretFrom: 3, fretTo: 10, rhythmId: 'charleston', bars: 2, attack: 'block', bpm: 96,
  });
  assert.equal(L.encodeChordExercise({ ...X.DEFAULTS, bpm: 80 }).dir, 'up');
  assert.deepEqual(L.decodeChordExercise({ set: '78', from: '0', bars: '3' }), {});
  // Gli id usati nei link non cambiano.
  assert.deepEqual(X.EXERCISES.map((e) => e.id), ['inv', 'cycle', 'ii-v-i']);
  assert.deepEqual(X.RHYTHMS.map((r) => r.id), ['whole', 'half', 'quarters', 'two-four', 'charleston', 'arp']);
  assert.deepEqual(V.FAMILIES.map((f) => f.id), ['shell', 'drop2', 'drop3', 'triad']);
});
