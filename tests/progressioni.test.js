// Strumento Progressioni, passo 4.1 (ADR 0013): sigle, ritmo armonico, trasposizione, catalogo.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const C = require('../js/chords.js');
const P = require('../js/progression.js');
const PS = require('../js/progressions.js');

const prog = (id) => PS.catalog().find((p) => p.id === id);
const symbols = (r) => r.timeline.map((e) => e.chord.symbol);
const romans = (r) => r.timeline.map((e) => e.chord.roman);

test('qualità aggiuntive: 7♭9 fuori dal catalogo di Arpeggi e Accordi', () => {
  assert.equal(C.catalog().length, 19);
  const q = C.extra().find((x) => x.id === '7b9');
  assert.equal(C.formula(q, true), '1 3 5 ♭7 ♭9');
  assert.deepEqual(C.spell(q, T.note(4, 0)).map((n) => T.noteToString(n, true)), ['G', 'B', 'D', 'F', 'A♭']);
  assert.equal(C.all().length, 20);
});

test('sigle: qualità, alterazioni, basso, grafie ASCII', () => {
  const s = P.parseSymbol('Em7/D');
  assert.equal(T.noteToString(s.root), 'E');
  assert.equal(s.quality.id, 'm7');
  assert.equal(T.noteToString(s.bass), 'D');
  assert.equal(P.parseSymbol('C6/9').quality.id, '69');
  assert.equal(P.parseSymbol('C6/9').bass, null);
  assert.equal(P.parseSymbol('Bbmaj7').root.accidental, -1);
  assert.equal(P.parseSymbol('F#°7').quality.id, 'dim7');
  assert.equal(P.parseSymbol('G7b9').quality.id, '7b9');
  assert.equal(P.parseSymbol('Dm7b5').quality.id, 'm7b5');
  assert.equal(P.parseSymbol('Dø7').quality.id, 'm7b5');
  assert.equal(P.parseSymbol('C').quality.id, 'maj');
  assert.equal(P.symbolOf(P.parseSymbol('Bb7')), 'B♭7');
  assert.throws(() => P.parseSymbol('Csus4'), /qualità sconosciuta/);
  assert.throws(() => P.parseSymbol('H7'), /sigla non valida/);
});

test('catalogo: quattordici griglie, id dell\'ADR, ogni sigla si legge', () => {
  const ids = PS.catalog().map((p) => p.id);
  assert.deepEqual(ids, [
    'ii-v-i', 'ii-v-i-minore', 'due-centri',
    'turnaround', 'dominanti-secondarie', 'tritono', 'backdoor', 'diminuito',
    'blues', 'blues-jazz', 'blues-minore',
    'vamp-modale', 'aaba', 'rhythm-changes',
  ]);
  for (const p of PS.catalog()) {
    assert.ok(PS.family(p.family), p.id);
    for (const id of p.form.concat(p.fullForm || [])) assert.ok(p.sections[id], p.id + ' ' + id);
    const r = P.realize(p, { full: true, ending: true });
    assert.ok(r.timeline.length > 0, p.id);
    if (p.romans) {
      for (const id of Object.keys(p.romans)) {
        const n = P.parseGrid(p.sections[id]).flat().length;
        assert.equal(p.romans[id].length, n, p.id + ': gradi a mano per ogni sigla');
      }
    }
  }
});

test('numero di battute: II–V–I 4, blues 12, AABA 32 con la forma intera, rhythm changes 16', () => {
  const bars = (id, opts) => P.realize(prog(id), opts).bars.length;
  assert.equal(bars('ii-v-i'), 4);
  assert.equal(bars('blues'), 12);
  assert.equal(bars('blues-jazz'), 12);
  assert.equal(bars('aaba', { full: true }), 32);
  assert.equal(bars('rhythm-changes'), 16);
  assert.equal(bars('rhythm-changes', { full: true }), 32);
  const r = P.realize(prog('aaba'), { full: true });
  assert.deepEqual([...new Set(r.bars.map((b) => b.label))], ['A1', 'A2', 'B', 'A3']);
  assert.equal(r.bars[16].label, 'B', 'il bridge comincia alla battuta 17');
  assert.equal(r.beats, 128);
});

test('ritmo armonico: un accordo 4 pulsazioni, due accordi 2 + 2', () => {
  const r = P.realize(prog('blues-jazz'));
  const bar11 = r.timeline.filter((e) => e.bar === 10);
  assert.deepEqual(bar11.map((e) => [e.beat, e.dur, e.chord.symbol]), [[40, 2, 'C7'], [42, 2, 'A7']]);
  assert.deepEqual(r.timeline.filter((e) => e.bar === 0).map((e) => [e.beat, e.dur]), [[0, 4]]);
  // Il tempo è continuo: ogni evento comincia dove finisce il precedente.
  for (let i = 1; i < r.timeline.length; i++) {
    const a = r.timeline[i - 1];
    assert.equal(r.timeline[i].beat, a.beat + a.dur);
  }
  assert.equal(r.beats, 48);
  assert.throws(() => P.parseGrid('| C D E |'), /3 accordi/);
});

test('finale chiuso dell\'AABA: battute 31–32 Dm7 G7 | Cmaj7', () => {
  const r = P.realize(prog('aaba'), { full: true, ending: true });
  assert.equal(r.bars.length, 32);
  assert.deepEqual(r.bars[30].chords.map((c) => c.symbol), ['Dm7', 'G7']);
  assert.deepEqual(r.bars[31].chords.map((c) => c.symbol), ['Cmaj7']);
  const loop = P.realize(prog('aaba'), { full: true });
  assert.deepEqual(loop.bars[31].chords.map((c) => c.symbol), ['G7']);
});

test('esempi del capitolo trasportati', () => {
  assert.deepEqual(symbols(P.realize(prog('ii-v-i'), { key: 'F' })), ['Gm7', 'C7', 'Fmaj7', 'Fmaj7']);
  assert.deepEqual(symbols(P.realize(prog('ii-v-i-minore'), { key: 'F' })), ['Gm7♭5', 'C7♭9', 'Fm6', 'Fm(maj7)']);
  assert.deepEqual(symbols(P.realize(prog('tritono'))).slice(4, 7), ['Dm7', 'D♭7', 'Cmaj7']);
  // In La il ♭II resta un ♭II: B♭7, non A♯7.
  assert.equal(symbols(P.realize(prog('tritono'), { key: 'A' }))[5], 'B♭7');
  const vamp = P.realize(prog('vamp-modale'));
  assert.equal(T.noteToString(vamp.timeline[1].chord.bass), 'D');
  assert.equal(vamp.timeline[1].chord.symbol, 'Em7/D');
  assert.equal(P.realize(prog('vamp-modale'), { key: 'G' }).timeline[1].chord.symbol, 'Am7/G');
  assert.deepEqual(symbols(P.realize(prog('due-centri'), { key: 'G' })).slice(4, 7), ['Gm7', 'C7', 'Fmaj7']);
});

test('trasposizione in 12 tonalità senza doppie alterazioni, tonalità leggibile', () => {
  for (const p of PS.catalog()) {
    const names = [];
    for (let pc = 0; pc < 12; pc++) {
      const r = P.realize(p, { key: pc, full: true, ending: true });
      assert.equal(T.pitchClass(r.key), pc, p.id);
      names.push(T.noteToString(r.key));
      for (const e of r.timeline) {
        assert.ok(Math.abs(e.chord.root.accidental) < 2, `${p.id} ${pc} ${e.chord.symbol}`);
        if (e.chord.bass) assert.ok(Math.abs(e.chord.bass.accidental) < 2, `${p.id} ${pc} ${e.chord.symbol}`);
      }
      // Le sigle sono quelle di riferimento spostate dello stesso intervallo, nota per nota.
      const ref = P.realize(p, { full: true, ending: true });
      const semis = (pc - T.pitchClass(ref.key) + 12) % 12;
      ref.timeline.forEach((e, i) => {
        assert.equal(T.pitchClass(r.timeline[i].chord.root), (T.pitchClass(e.chord.root) + semis) % 12);
        assert.equal(r.timeline[i].chord.quality.id, e.chord.quality.id);
      });
    }
    if (['ii-v-i', 'turnaround', 'blues-jazz', 'aaba', 'rhythm-changes'].includes(p.id)) {
      assert.deepEqual(names, ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'], p.id);
    }
  }
  // Il nome si sceglie sull'intera griglia: il backdoor in Re♭ chiederebbe G♭m7 (con B♭♭) e C♭7,
  // in Do♯ si legge F♯m7–B7.
  const bd = P.realize(prog('backdoor'), { key: 1 });
  assert.equal(T.noteToString(bd.key), 'C#');
  assert.deepEqual(symbols(bd), ['C♯maj7', 'F♯m7', 'B7', 'C♯maj7']);
  // Blues di base in Fa♯, non in Sol♭ (che chiederebbe C♭7); in Re♭ resta Re♭.
  assert.equal(T.noteToString(P.realize(prog('blues'), { key: 6 }).key), 'F#');
  assert.equal(T.noteToString(P.realize(prog('blues'), { key: 1 }).key), 'Db');
  // Tonalità minori come nel repertorio: Do♯, Fa♯, Sol♯ minore.
  const minor = [1, 6, 8].map((pc) => T.noteToString(P.realize(prog('blues-minore'), { key: pc }).key));
  assert.deepEqual(minor, ['C#', 'F#', 'G#']);
  // Nome scelto dal chiamante: viene rispettato.
  assert.equal(T.noteToString(P.realize(prog('blues'), { key: 'F#' }).key), 'F#');
});

test('gradi romani: calcolati dal centro, a mano dove il calcolo non basta', () => {
  assert.deepEqual(romans(P.realize(prog('ii-v-i'), { key: 'B♭' })), ['ii7', 'V7', 'Imaj7', 'Imaj7']);
  assert.deepEqual(romans(P.realize(prog('ii-v-i-minore'))), ['iiø7', 'V7♭9', 'i6', 'i(maj7)']);
  assert.deepEqual(romans(P.realize(prog('backdoor'))), ['Imaj7', 'iv7', '♭VII7', 'Imaj7']);
  assert.deepEqual(romans(P.realize(prog('diminuito'))), ['Imaj7', '♯i°7', 'ii7', 'V7']);
  assert.equal(romans(P.realize(prog('tritono')))[5], '♭II7');
  assert.deepEqual(romans(P.realize(prog('dominanti-secondarie'), { key: 'E' })).slice(1, 4), ['V7/vi', 'vi7', 'V7/ii']);
  // Due centri: le ultime quattro battute si leggono rispetto a B♭ (in Do).
  const dc = P.realize(prog('due-centri'));
  assert.deepEqual(romans(dc), ['ii7', 'V7', 'Imaj7', 'Imaj7', 'ii7', 'V7', 'Imaj7', 'Imaj7']);
  assert.equal(T.noteToString(dc.timeline[4].chord.center, true), 'B♭');
  assert.equal(romans(P.realize(prog('vamp-modale')))[1], 'ii7/1');
});
