// Strumento Progressioni, passo 4.2 (ADR 0013): accompagnamento, eccezioni, basso, note guida, tempo.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/progression.js');
const PS = require('../js/progressions.js');
const X = require('../js/exercises/comping.js');
const B = require('../js/exercises/bass.js');
const PC = require('../js/exercises/progcomp.js');
const Scheduler = require('../js/audio/scheduler.js');
const T = require('../js/theory.js');

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m) => NAMES[m % 12] + Math.floor(m / 12 - 1);
const prog = (id) => PS.catalog().find((p) => p.id === id);
const build = (id, settings = {}, opts = {}) => {
  const p = prog(id);
  return PC.build(P.realize(p, opts), { fourVoices: p.fourVoices, ...settings });
};
const pitches = (v) => v.notes.map((n) => nm(n.midi)).join(' ');
const part = (r, name) => r.events.filter((e) => e.part === name);

test('shell: il II–V–I in Do riproduce il capitolo, con le note guida Fa–Fa–Mi e Do–Si–Si', () => {
  const r = build('ii-v-i');
  assert.deepEqual(r.segments.map((s) => [s.voicing.label, pitches(s.voicing)]), [
    ['543', 'D3 F3 C4'], ['643', 'G2 F3 B3'], ['543', 'C3 E3 B3'], ['543', 'C3 E3 B3'],
  ]);
  // Voci superiori dei voicing e linee di note guida: le stesse due linee del capitolo.
  const lines = (get) => [0, 1].map((v) => r.segments.slice(0, 3).map((s) => NAMES[get(s)[v] % 12]).join('–')).sort();
  assert.deepEqual(lines((s) => s.voicing.notes.slice(1).map((n) => n.midi)), ['C–B–B', 'F–F–E']);
  assert.deepEqual(lines((s) => [s.guide.low, s.guide.high]), ['C–B–B', 'F–F–E']);
});

test('eccezioni del capitolo: quattro voci per m7♭5, 7♭9, °7 e vamp; G7♭9 senza fondamentale', () => {
  const m = build('ii-v-i-minore');
  assert.deepEqual(m.segments.slice(0, 2).map((s) => [s.voicing.label, pitches(s.voicing)]), [
    ['5432', 'D3 Ab3 C4 F4'], ['5432', 'B2 F3 Ab3 D4'],
  ]);
  assert.ok(m.segments[1].voicing.notes.every((n) => n.midi % 12 !== 7), 'nessun Sol in G7♭9');
  const d = build('diminuito').segments[1];
  assert.equal(d.voicing.notes.length, 4);
  assert.equal(d.voicing.bass, 0, 'C♯°7 con la fondamentale al basso');
  const v = build('vamp-modale').segments;
  assert.deepEqual([v[0], v[1]].map((s) => pitches(s.voicing)), ['D3 A3 C4 F4', 'D3 G3 B3 E4']);
  // In tutte le tonalità e famiglie: la sigla con barra ha il basso giusto, le eccezioni quattro voci.
  for (let pc = 0; pc < 12; pc++) {
    for (const fam of ['shell', 'drop2', 'drop3', 'triad']) {
      for (const p of PS.catalog()) {
        const r = PC.build(P.realize(p, { key: pc, full: true }), { fourVoices: p.fourVoices, family: fam, set: 'all' });
        assert.ok(!r.error, `${p.id} ${pc} ${fam}`);
        for (const s of r.segments) {
          const tag = `${p.id} ${pc} ${fam} ${s.chord.symbol}`;
          if (s.chord.bass) assert.equal(s.voicing.notes[0].midi % 12, T.pitchClass(s.chord.bass), tag);
          if (fam === 'shell' && PC.FOUR_VOICES.has(s.chord.quality.id)) assert.equal(s.voicing.notes.length, 4, tag);
        }
      }
    }
  }
});

test('ogni colpo suona l\'accordo in vigore e non supera il cambio d\'accordo', () => {
  for (const p of PS.catalog()) {
    for (const r of X.PROG_RHYTHMS) {
      const out = PC.build(P.realize(p, { full: true }), { fourVoices: p.fourVoices, rhythmId: r.id, bass: 'off' });
      const comp = part(out, 'comp');
      assert.ok(comp.length > 0, `${p.id} ${r.id}`);
      for (const e of comp) {
        const seg = out.segments[e.chord];
        assert.ok(e.beat >= seg.beat - 1e-9 && e.beat + e.dur <= seg.beat + seg.dur + 1e-9, `${p.id} ${r.id} ${e.beat}`);
        const want = seg.voicing.notes.map((n) => n.midi);
        for (const n of e.notes) assert.ok(want.includes(n.midi), `${p.id} ${r.id} ${e.beat}`);
      }
    }
  }
  // Due accordi in una battuta con le minime: un colpo ciascuno (blues jazz, battuta 11).
  const bj = build('blues-jazz', { rhythmId: 'half', bass: 'off' });
  assert.deepEqual(part(bj, 'comp').filter((e) => e.beat >= 40 && e.beat < 44).map((e) => [e.beat, bj.segments[e.chord].chord.symbol]),
    [[40, 'C7'], [42, 'A7']]);
});

test('ritmi di Progressioni: Accordi invariato, bossa di due battute, levare dell\'1 e 3', () => {
  assert.deepEqual(X.RHYTHMS.map((r) => r.id), ['whole', 'half', 'quarters', 'two-four', 'charleston', 'arp']);
  assert.deepEqual(X.PROG_RHYTHMS.slice(6).map((r) => r.id), ['offbeat', 'bossa', 'green']);
  const beats = (id) => part(build('ii-v-i', { rhythmId: id, bass: 'off' }), 'comp').map((e) => e.beat);
  assert.deepEqual(beats('bossa'), [0, 1.5, 3, 4.5, 6, 8, 9.5, 11, 12.5, 14]);
  assert.deepEqual(beats('offbeat'), [0.5, 2, 4.5, 6, 8.5, 10, 12.5, 14]);
  assert.deepEqual(beats('green').length, 16);
});

test('basso: fondamentale sull\'1, avvicinamento sul 4, registro 28–48, deterministico', () => {
  for (const p of PS.catalog()) {
    for (let pc = 0; pc < 12; pc++) {
      const real = P.realize(p, { key: pc, full: true });
      const tl = real.timeline;
      for (const mode of ['roots', 'walk']) {
        const ev = B.build(tl, mode, { loop: true });
        const tag = `${p.id} ${pc} ${mode}`;
        assert.deepEqual(ev, B.build(tl, mode, { loop: true }), tag + ' (deterministico)');
        for (const e of ev) assert.ok(e.midi >= 28 && e.midi <= 48, `${tag} ${e.midi}`);
        // Ogni accordo comincia con la sua nota di basso (dopo la barra, se c'è).
        for (const seg of tl) {
          const first = ev.find((e) => Math.abs(e.beat - seg.beat) < 1e-9);
          const want = T.pitchClass(seg.chord.bass || seg.chord.root);
          assert.equal(first.midi % 12, want, `${tag} battito ${seg.beat}`);
        }
        if (mode === 'walk') {
          // Il 4 di ogni battuta si avvicina di un semitono o di un tono alla nota seguente.
          for (let i = 0; i < ev.length; i++) {
            if (Math.abs(ev[i].beat % 4 - 3) > 1e-9) continue;
            const next = ev[(i + 1) % ev.length];
            const d = Math.abs(next.midi - ev[i].midi);
            assert.ok(d === 1 || d === 2, `${tag} battito ${ev[i].beat}: ${ev[i].midi} → ${next.midi}`);
          }
        }
      }
    }
  }
  const ii = build('ii-v-i', { bass: 'walk', rhythmId: 'half' });
  assert.deepEqual(part(ii, 'bass').map((e) => nm(e.midi)).join(' '),
    'D2 F2 A2 Ab2 G2 F2 D2 C#2 C2 E2 G2 B2 C3 B2 G2 Eb2');
  // Vamp: il basso mantiene Re sotto Em7/D.
  const vamp = part(build('vamp-modale', { bass: 'roots' }), 'bass');
  assert.ok(vamp.every((e) => e.midi % 12 === 2 || e.midi % 12 === 9), 'Re (o La, quinta di Dm7)');
  assert.ok(vamp.filter((e) => e.beat % 8 >= 4).every((e) => e.midi % 12 === 2), 'sotto Em7/D solo Re');
});

test('parti: «suona tu» toglie l\'accompagnamento, le note guida suonano piano come «study»', () => {
  const r = build('blues', { comp: false, bass: 'walk', guide: true });
  assert.equal(part(r, 'comp').length, 0);
  assert.equal(part(r, 'bass').length, 48);
  assert.equal(part(r, 'study').length, 12);
  for (const e of part(r, 'study')) assert.equal(e.notes.length, 2);
  r.events.forEach((e, i) => {
    assert.equal(e.i, i);
    if (i) assert.ok(e.beat >= r.events[i - 1].beat);
  });
});

test('loop: il ritorno al primo accordo è collegato come gli altri cambi', () => {
  const VL = require('../js/voiceleading.js');
  // Movimento dell'intero ciclo, ritorno compreso.
  const cycle = (s) => s.reduce((sum, x, i) => sum + VL.movement(x.voicing, s[(i + 1) % s.length].voicing), 0);
  let loop = 0;
  let open = 0;
  for (const p of PS.catalog()) {
    for (const family of ['shell', 'drop2', 'drop3', 'triad']) {
      const a = cycle(build(p.id, { family }, { full: true }).segments);
      const b = cycle(build(p.id, { family, loop: false }, { full: true }).segments);
      assert.ok(a <= b + 1e-9, `${p.id} ${family}: ${a} > ${b}`);
      loop += a;
      open += b;
    }
  }
  assert.ok(loop < open, `${loop} ${open}`);
});

test('tempo: nessuna deriva su 10 minuti di loop del blues a 200 BPM (scarto massimo 1 ms)', () => {
  const r = build('blues', { rhythmId: 'quarters', bass: 'walk' });
  let t = 0;
  const timers = [];
  const clk = {
    now: () => t,
    setTimer: (fn, ms) => { timers.push({ fn, at: t + ms / 1000 }); return timers.length; },
    clearTimer: () => { timers.length = 0; },
  };
  const hits = [];
  const s = Scheduler.create({ ...clk, startDelay: 0, onNote: (e, when) => hits.push([e, when]) });
  s.start(r.events, { bpm: 200, countIn: false, metronome: true, loop: true, lengthBeats: r.lengthBeats });
  while (timers.length && t <= 600) { const n = timers.shift(); t = n.at; n.fn(); }
  s.stop();
  const spb = 60 / 200;
  const n = r.events.length;
  assert.ok(hits.length > 0.95 * (600 / spb / r.lengthBeats) * n, String(hits.length));
  let worst = 0;
  hits.forEach(([e, when], k) => {
    const iter = Math.floor(k / n);
    worst = Math.max(worst, Math.abs(when - (iter * r.lengthBeats + e.beat) * spb));
  });
  assert.ok(worst < 0.001, `scarto ${worst}`);
});
