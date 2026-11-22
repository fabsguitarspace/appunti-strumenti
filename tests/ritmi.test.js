// Strumento Ritmi (ADR 0016): catalogo, realizzazione delle figure, esercizio, metronomo, link.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/theory.js');
const R = require('../js/rhythms.js');
const RL = require('../js/exercises/rhythmline.js');
const Scheduler = require('../js/audio/scheduler.js');
const Link = require('../js/link.js');

const C = T.note(0, 0);
const beats = (r) => r.attacks.map((a) => a.tick / R.TPB);
const close = (a, b) => assert.ok(a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9), `${a} ≠ ${b}`);

test('catalogo: famiglie, id unici e stabili (interfaccia pubblica dei link)', () => {
  const ids = R.catalog().map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(R.FAMILIES.map((f) => f.id),
    ['crome', 'terzine', 'semicrome', 'note-battuta', 'battuta', 'sovrapposizioni', 'marce', 'cambi']);
  for (const f of R.FAMILIES) assert.ok(R.catalog().some((r) => r.family === f.id), f.id);
  for (const id of ['crome-4', 'terzine-5', 'semicrome-7', 'note-3', 'charleston', 'ciclo-3a', 'ciclo-5a', 'ciclo-7a',
    'marcia-6', 'marcia-8', 'marcia-12', 'marcia-24', 'crome-terzine', 'semiminima3-crome']) {
    assert.ok(R.byId(id), id);
  }
});

test('ogni girone è coerente e non attraversa la stanghetta', () => {
  for (const item of R.catalog()) {
    const cycle = R.cycleOf(item, { start: 0, seed: 3 }, 4);
    for (const sp of cycle.spans) {
      assert.equal(sp.cells.length, sp.div, item.id);
      assert.match(sp.cells, /^[x.-]+$/, item.id);
    }
    const bars = R.cycleBars(cycle.cycleBeats);
    const r = R.realize(cycle, bars);
    for (const bar of r.bars) {
      const len = bar.spans.reduce((a, sp) => a + sp.beats, 0);
      assert.equal(len, R.METER, `${item.id}: battuta di ${len} pulsazioni`);
    }
    assert.ok(r.attacks.length > 0, item.id);
  }
});

test('crome consecutive: otto partenze, a cavallo della stanghetta la figura dura due battute', () => {
  const item = R.byId('crome-4');
  const one = R.cycleOf(item, { start: 0 });
  assert.equal(one.cycleBeats, 4);
  close(beats(R.realize(one, 1)), [0, 0.5, 1, 1.5]);
  const late = R.cycleOf(item, { start: 7 });  // «e» del 4
  assert.equal(late.cycleBeats, 8);
  close(beats(R.realize(late, 2)), [3.5, 4, 4.5, 5]);
  assert.equal(R.positionName(7, 2), '«e» del 4');
  assert.equal(R.positionName(4, 2), '3');
  // In sequenza: tutte le partenze una dopo l'altra.
  const seq = R.cycleOf(item, { start: 'seq' });
  const r = R.realize(seq, R.cycleBars(seq.cycleBeats));
  assert.equal(r.attacks.length, 8 * 4);
});

test('terzine consecutive: la griglia ha dodici celle', () => {
  const item = R.byId('terzine-4');
  const c = R.cycleOf(item, { start: 3 });  // sul 2
  close(beats(R.realize(c, 1)), [1, 4 / 3, 5 / 3, 2]);
  assert.equal(R.positionName(4, 3), '2ª nota di terzina del 2');
});

test('figure casuali: lo stesso seme dà la stessa figura', () => {
  const item = R.byId('crome-5');
  const a = R.cycleOf(item, { start: 'rand', seed: 42 }, 4);
  const b = R.cycleOf(item, { start: 'rand', seed: 42 }, 4);
  const c = R.cycleOf(item, { start: 'rand', seed: 43 }, 4);
  assert.deepEqual(a.spans, b.spans);
  assert.notDeepEqual(a.spans, c.spans);
  // Gruppi di cinque attacchi separati da pause.
  const r = R.realize(a, 4);
  const sizes = new Map();
  r.attacks.forEach((x) => sizes.set(x.group, (sizes.get(x.group) || 0) + 1));
  assert.ok([...sizes.values()].every((n) => n === 5));
});

test('note per battuta: esattamente N attacchi in ogni battuta', () => {
  for (let n = 1; n <= 7; n++) {
    const item = R.byId(`note-${n}`);
    const c = R.cycleOf(item, { seed: 7, vary: true }, 4);
    const r = R.realize(c, 4);
    for (let b = 0; b < 4; b++) assert.equal(r.attacks.filter((a) => a.bar === b).length, n, `note-${n} battuta ${b}`);
  }
});

test('cicli di 3, 5 e 7 pulsazioni: tornano sull\'uno dopo 3, 5 e 7 battute', () => {
  for (const [id, len] of [['ciclo-3a', 3], ['ciclo-5a', 5], ['ciclo-7a', 7]]) {
    const c = R.cycleOf(R.byId(id));
    assert.equal(c.cycleBeats, len);
    assert.equal(R.cycleBars(c.cycleBeats), len);
    const r = R.realize(c, len, { accent: 'cycle' });
    const starts = r.attacks.filter((a) => a.accent).map((a) => a.tick / R.TPB);
    close(starts, Array.from({ length: 4 }, (_, k) => k * len).filter((b) => b < len * 4));
  }
  assert.equal(R.describe(R.byId('ciclo-3a'), R.cycleOf(R.byId('ciclo-3a'))).length,
    '3 pulsazioni: torna sull\'uno dopo 3 battute di 4/4');
});

test('marce: note uniformi, anche su più pulsazioni', () => {
  close(beats(R.realize(R.cycleOf(R.byId('marcia-6')), 1)), [0, 2 / 3, 4 / 3, 2, 8 / 3, 10 / 3]);
  close(beats(R.realize(R.cycleOf(R.byId('marcia-5')), 1)), [0, 0.8, 1.6, 2.4, 3.2]);
  assert.equal(R.realize(R.cycleOf(R.byId('marcia-24')), 1).attacks.length, 24);
  assert.equal(R.realize(R.cycleOf(R.byId('marcia-14')), 1).attacks.length, 14);
  const shift = R.realize(R.cycleOf(R.byId('crome-terzine')), 2);
  assert.equal(shift.attacks.filter((a) => a.bar === 0).length, 8);
  assert.equal(shift.attacks.filter((a) => a.bar === 1).length, 12);
});

test('note tolte: mai il primo attacco del girone, riproducibili', () => {
  const item = R.byId('marcia-12');
  const c = R.cycleOf(item, { omit: 'one', seed: 5 });
  for (const sp of c.spans) {
    assert.equal(sp.cells[0], 'x');
    assert.equal([...sp.cells].filter((x) => x === 'x').length, 2);
  }
  assert.deepEqual(c.spans, R.cycleOf(item, { omit: 'one', seed: 5 }).spans);
});

test('durata dell\'esercizio: ciclo e base, con un tetto', () => {
  assert.deepEqual(R.lengthFor(12, 4), { bars: 12, restart: false });  // 3 battute × giro di 4
  assert.deepEqual(R.lengthFor(5, 4), { bars: 20, restart: false });
  assert.deepEqual(R.lengthFor(7, 12), { bars: 12, restart: true });   // 84 battute: riparte
  assert.deepEqual(R.lengthFor(4, 0), { bars: 1, restart: false });
});

test('conteggio: numero della pulsazione, «e», puntini', () => {
  const sp2 = { beats: 1, div: 2 };
  assert.equal(R.countLabel(sp2, 0, 2), '3');
  assert.equal(R.countLabel(sp2, 1, 2), 'e');
  const q3 = { beats: 2, div: 3 };
  assert.equal(R.countLabel(q3, 1, 0), '·');
  const five = { beats: 4, div: 5 };
  assert.equal(R.countLabel(five, 0, 0), '1');
  const sixteen = { beats: 1, div: 4 };
  assert.deepEqual([0, 1, 2, 3].map((c) => R.countLabel(sixteen, c, 0)), ['1', '·', 'e', '·']);
});

test('esercizio senza base: altezze sull\'accordo di tonica, nel registro', () => {
  const item = R.byId('marcia-8');
  for (const notes of ['perc', 'chord', 'scale', 'guide']) {
    const ex = RL.build(item, C, { base: 'none', notes });
    assert.equal(ex.error, null);
    assert.equal(ex.events.length, 8, notes);
    for (const e of ex.events) {
      assert.ok(e.midi >= RL.LOW - 2 && e.midi <= RL.HIGH + 2, `${notes}: ${e.midi}`);
      assert.equal(e.midi, [40, 45, 50, 55, 59, 64][e.string] + e.fret);
    }
  }
  const perc = RL.build(item, C, { base: 'none', notes: 'perc' });
  assert.ok(perc.events.every((e) => e.midi % 12 === 0));
  const chord = RL.build(item, C, { base: 'none', notes: 'chord' });
  assert.ok(chord.events.every((e) => [0, 4, 7, 11].includes(e.midi % 12)));
});

test('sequenza di scala: gruppi di quattro sulla scala dell\'accordo', () => {
  const ex = RL.build(R.byId('marcia-8'), C, { base: 'none', notes: 'scale' });
  // Do maggiore da Do4: 1-2-3-4, 2-3-4-5.
  assert.deepEqual(ex.events.map((e) => e.midi), [60, 62, 64, 65, 62, 64, 65, 67]);
});

test('esercizio con base: linea, accordi e basso; le note seguono gli accordi', () => {
  const ex = RL.build(R.byId('marcia-8'), T.note(0, 0), { base: 'ii-v-i', notes: 'chord' });
  assert.equal(ex.bars, 4);
  const line = RL.lineEvents(ex);
  assert.equal(line.length, 32);
  assert.ok(ex.events.some((e) => e.part === 'bass'));
  assert.ok(ex.events.some((e) => e.part === 'study' && e.backing));
  // Battuta 1 su Dm7, battuta 2 su G7.
  const pcs = (b) => new Set(line.filter((e) => e.beat >= b * 4 && e.beat < b * 4 + 4).map((e) => e.midi % 12));
  for (const pc of pcs(0)) assert.ok([2, 5, 9, 0].includes(pc), 'Dm7: ' + pc);
  for (const pc of pcs(1)) assert.ok([7, 11, 2, 5].includes(pc), 'G7: ' + pc);
  // Ciclo di 3 sulla base di quattro battute: dodici battute senza interruzioni.
  const cyc = RL.build(R.byId('ciclo-3a'), C, { base: 'ii-v-i' });
  assert.equal(cyc.bars, 12);
  assert.equal(cyc.restart, false);
});

test('swing: solo la seconda croma della pulsazione si sposta (2:1)', () => {
  const ex = RL.build(R.byId('marcia-8'), C, { base: 'none', feel: 'swing' });
  close(ex.events.slice(0, 4).map((e) => e.beat), [0, 2 / 3, 1, 5 / 3]);
  assert.ok(ex.events.every((e) => Math.abs(e.ndur - 0.5) < 1e-9));
  const triplets = RL.build(R.byId('marcia-12'), C, { base: 'none', feel: 'swing' });
  close(triplets.events.slice(0, 3).map((e) => e.beat), [0, 1 / 3, 2 / 3]);
});

test('tablatura: solo figure dentro la pulsazione, con le pause', () => {
  const ok = RL.build(R.byId('sincope'), C, { base: 'none' });
  assert.ok(RL.tabbable(ok));
  const tab = RL.tabEvents(ok);
  assert.ok(tab.some((e) => e.rest));
  const total = tab.reduce((a, e) => a + e.ndur, 0);
  assert.ok(Math.abs(total - 4) < 1e-9, 'la battuta somma quattro pulsazioni: ' + total);
  assert.equal(RL.tabbable(RL.build(R.byId('marcia-6'), C, { base: 'none' })), false);
  assert.equal(RL.tabbable(RL.build(R.byId('marcia-14'), C, { base: 'none' })), false);
});

test('scheduler: posizioni del click (2 e 4, solo 4, «e» del 2 e del 4)', () => {
  const run = (metroMode) => {
    let t = 0;
    const clicks = [];
    const s = Scheduler.create({
      now: () => t, setTimer: () => 1, clearTimer: () => {}, startDelay: 0, lookahead: 9,
      onNote: () => {}, onClick: (when) => clicks.push(when), onEnd: () => {},
    });
    s.start([{ beat: 0, dur: 1, midi: 60 }], { bpm: 60, countIn: true, metronome: true, metroMode, lengthBeats: 4 });
    s.stop();
    return clicks.map((w) => w - 4); // count-in di quattro battiti a 60 BPM
  };
  close(run('all'), [-4, -3, -2, -1, 0, 1, 2, 3]);
  close(run('two-four'), [-4, -3, -2, -1, 1, 3]);
  close(run('four'), [-4, -3, -2, -1, 3]);
  close(run('and-two-four'), [-4, -3, -2, -1, 1.5, 3.5]);
  close(run('downbeat'), [-4, -3, -2, -1, 0]);
  assert.ok(Scheduler.METRO['one-three']);
});

test('link: andata e ritorno dell\'esercizio sui ritmi', () => {
  const s = { start: 7, seed: 9, vary: false, omit: 'none', accent: 'auto', notes: 'scale', feel: 'swing',
    base: 'blues', bass: 'walk', comp: false, metroMode: 'two-four', bpm: 90 };
  const p = Link.encodeRhythmExercise(s);
  assert.equal(p.start, 8);
  assert.equal(p.seed, null);
  assert.equal(p.comp, 0);
  const back = Link.decodeRhythmExercise(Object.fromEntries(Object.entries(p).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])));
  assert.deepEqual(back, { start: 7, notes: 'scale', feel: 'swing', base: 'blues', bass: 'walk', comp: false, metroMode: 'two-four', bpm: 90 });
  const rand = Link.encodeRhythmExercise({ ...s, start: 'rand', seed: 1234 });
  assert.equal(rand.start, 'rand');
  assert.equal(rand.seed, 1234);
  assert.deepEqual(Link.decodeRhythmExercise({ start: 'seq', vary: '1', omit: 'one', seed: '5' }),
    { start: 'seq', vary: true, omit: 'one', seed: 5 });
  assert.deepEqual(Link.decodeRhythmExercise({ start: '0' }), {});
});
