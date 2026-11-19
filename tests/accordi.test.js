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
    // Indici `tone` nelle note della qualità più i colori dei senza fondamentale (ADR 0015).
    const tones = V.toneList(quality);
    const semis = tones.map((t) => C.toneSemitones(t) % 12);
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
        assert.ok(tones[v.bass].number <= 7, tag + ' (tensione al basso)');
      }
    }
  }
  assert.ok(count > 3000, String(count));
});

test('famiglie per qualità: drop 2 e drop 3 in quattro rivolti per ogni accordo di settima', () => {
  for (const id of ['6', '7', 'maj7', 'm6', 'm7', 'mmaj7', 'm7b5', '7s5', 'dim7']) {
    for (let pc = 0; pc < 12; pc++) {
      const vs = V.voicings(q(id), pc);
      for (const [fam, set] of [['drop2', '4321'], ['drop2', '5432'], ['drop2', '6543'], ['drop3', '6432'], ['drop3', '5321'], ['drop24', '6532'], ['drop24', '5421']]) {
        const list = find(vs, fam, set);
        assert.equal(list.length, 4, `${id} ${pc} ${fam} ${set}`);
        assert.equal(new Set(list.map((v) => v.top)).size, 4, `${id} ${pc} ${fam} ${set}: una nota al canto per rivolto`);
      }
    }
  }
  assert.deepEqual(V.familiesFor(q('maj')), ['triad', 'spread']);
  assert.deepEqual(V.familiesFor(q('dim7')), ['drop2', 'drop3', 'drop24']);
  assert.deepEqual(V.familiesFor(q('9')), ['drop2', 'drop3', 'drop24', 'rootless', 'ust', 'quartal', 'cluster']);
  assert.deepEqual(V.familiesFor(q('7')), ['shell', 'drop2', 'drop3', 'drop24', 'rootless', 'ust', 'quartal', 'cluster']);
  assert.deepEqual(V.familiesFor(q('m7b5')), ['shell', 'drop2', 'drop3', 'drop24', 'rootless', 'quartal', 'cluster']);
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
  // Drop 2 e 4 (ADR 0015): da Do Mi Sol Si scendono Sol e Do → Do Sol Mi Si, corde 6–5–3–2.
  const d24 = find(V.voicings(q('maj7'), 0), 'drop24', '6532', 0)[0];
  assert.deepEqual(d24.notes.map((n) => n.tone), [0, 2, 1, 3]);
  assert.equal(frets(d24), '8.10.9.12');
  // Drop 2 sulle corde 6–5–4–3: stessa disposizione di 4–3–2–1, due corde più in basso.
  const low = find(V.voicings(q('maj7'), 0), 'drop2', '6543', 0)[0];
  assert.deepEqual(low.notes.map((n) => n.tone), [0, 2, 3, 1]);
  // Nona: la nona sostituisce la fondamentale e non va mai al basso.
  for (const v of V.voicings(q('9'), 0, ['drop2', 'drop3', 'drop24'])) {
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
  assert.deepEqual(V.FAMILIES.map((f) => f.id), ['shell', 'triad', 'spread', 'drop2', 'drop3', 'drop24', 'rootless', 'ust', 'quartal', 'cluster']);
  // Tensioni alterate (ADR 0015): alt=1 nel link, andata e ritorno.
  assert.equal(L.encodeChordExercise({ ...X.DEFAULTS, alt: true }).alt, 1);
  assert.equal(L.encodeChordExercise({ ...X.DEFAULTS }).alt, null);
  assert.equal(L.decodeChordExercise({ alt: '1' }).alt, true);
  assert.equal(L.decodeChordExercise({ set: '54321' }).set, '54321');
});

// ADR 0013, punto 5: ritmo d'attacco sulla linea del tempo.
const crypto = require('node:crypto');
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));

test('comping: il passaggio alla linea del tempo non cambia gli esercizi di Accordi', () => {
  // Impronta calcolata con l'implementazione per accordo precedente (14 novembre 2026), identica
  // anche sull'intera matrice di qualità, toniche, famiglie, corde, esercizi, ritmi e attacchi.
  // Aggiornata il 19 novembre 2026 (ADR 0015): con drop 2 su 6–5–4–3 e la famiglia drop 2 e 4
  // cambiano soltanto `set=all` di drop 2 e le famiglie nuove; sugli insiemi di corde esistenti
  // gli esercizi sono identici a quelli del commit 51a8930 (verificato confrontando le impronte).
  // Fase 2 (stesso giorno): si aggiungono triadi late e senza fondamentale; sulle famiglie della
  // fase 1 gli esercizi restano identici (impronta delle sole famiglie precedenti invariata).
  // Fase 3: strutture superiori, quarte e cluster; famiglie precedenti di nuovo invariate.
  const h = crypto.createHash('sha256');
  for (const id of ['maj', 'm7', '7', 'm7b5', 'dim7', 'maj9']) {
    for (const pc of [0, 10]) {
      const root = C.bestRoots(q(id), pc)[0];
      for (const family of V.familiesFor(q(id))) {
        for (const exId of ['inv', 'cycle', 'ii-v-i']) {
          for (const r of X.RHYTHMS) {
            for (const bars of [1, 2]) {
              const out = X.build(q(id), root, { exId, family, set: 'all', rhythmId: r.id, bars, attack: 'strum', fretFrom: 3, fretTo: 12 });
              h.update(stable([out.events, out.chords.map((c) => [c.symbol, c.voicing.notes]), out.lengthBeats, out.error || '']));
            }
          }
        }
      }
    }
  }
  assert.equal(h.digest('hex'), '660eb7361e29ecdb65ea2a79e3724e482b5711bbc6e03c4f8e994b765132bd01');
});

test('comping: due accordi nella battuta, colpi troncati al cambio e accento per accordo', () => {
  const vs = V.voicings(q('maj7'), 0, ['drop2']);
  const [a, b] = [vs[0], vs[1]];
  const timeline = [{ start: 0, dur: 2, voicing: a }, { start: 2, dur: 2, voicing: b }, { start: 4, dur: 4, voicing: a }];
  const whole = X.comp(timeline, X.rhythmDef('whole'), { attack: 'block' });
  // La semibreve colpisce solo sull'1: il secondo accordo della prima battuta non ha colpi.
  assert.deepEqual(whole.map((e) => [e.beat, e.dur, e.chord]), [[0, 2, 0], [4, 4, 2]]);
  const charleston = X.comp(timeline, X.rhythmDef('charleston'), { attack: 'block', part: 'comp' });
  assert.deepEqual(charleston.map((e) => [e.beat, e.dur, e.chord, e.accent]),
    [[0, 1.5, 0, true], [1.5, 0.5, 0, false], [4, 1.5, 2, true], [5.5, 2.5, 2, false]]);
  assert.ok(charleston.every((e) => e.part === 'comp' && e.strum === 0));
  const arp = X.comp(timeline, X.rhythmDef('arp'), {});
  assert.equal(arp.length, 16);
  assert.deepEqual(arp.filter((e) => e.accent).map((e) => e.beat), [0, 2, 4]);
});

// ADR 0015, fase 2: triadi late e voicing senza fondamentale.
test('triadi late: la voce centrale della triade stretta scende di un\'ottava', () => {
  const tl = (v) => v.notes.map((n) => n.tone);
  for (const id of ['maj', 'm', 'dim', 'aug']) {
    for (let pc = 0; pc < 12; pc++) {
      for (const v of V.voicings(q(id), pc, ['spread'])) {
        const m = v.notes.map((n) => n.midi);
        // Un'ottava sopra il basso la triade torna stretta: dentro l'ottava, voci distinte.
        const close = [m[1], m[0] + 12, m[2]].sort((a, b) => a - b);
        assert.ok(close[2] - close[0] < 12, `${id} ${pc} ${v.label}`);
        assert.ok(m[1] - m[0] > 5, `${id} ${pc} ${v.label}: voci gravi distanti`);
        assert.equal(new Set(tl(v)).size, 3);
      }
      // Su 6–4–3 e 4–2–1 tutti e tre i rivolti.
      for (const set of ['643', '421']) assert.equal(find(V.voicings(q(id), pc, ['spread']), 'spread', set).length, 3, `${id} ${pc} ${set}`);
    }
  }
  // Do maggiore sulle corde 4–2–1: Mi Do Sol, come «C-G-E» del capitolo 3 nel rivolto di terza.
  assert.equal(frets(find(V.voicings(q('maj'), 0, ['spread']), 'spread', '421', 1)[0]), '2.1.3');
});

test('senza fondamentale: note guida al basso, niente fondamentale, due forme per gruppo di corde', () => {
  for (const id of Object.keys(V.ROOTLESS).filter((x) => C.catalog().some((c) => c.id === x))) {
    const list = V.toneList(q(id));
    for (let pc = 0; pc < 12; pc++) {
      const vs = V.voicings(q(id), pc, ['rootless']);
      for (const set of ['4321', '5432']) assert.equal(find(vs, 'rootless', set).length, 2, `${id} ${pc} ${set}`);
      for (const v of vs) {
        const nums = v.notes.map((n) => list[n.tone].number);
        assert.ok(!nums.includes(1), `${id} ${pc}: niente fondamentale`);
        assert.ok([3, 6, 7].includes(nums[0]), `${id} ${pc}: nota guida al basso`);
        assert.ok(nums.includes(3), `${id} ${pc}: la terza c'è sempre`);
        // Drop 2: alzando di un'ottava la voce grave l'accordo sta dentro l'ottava.
        const m = v.notes.map((n) => n.midi);
        const close = [m[1], m[2], m[3], m[0] + 12].sort((a, b) => a - b);
        assert.ok(close[3] - close[0] < 12, `${id} ${pc} ${v.label}`);
      }
    }
  }
  // C7 senza fondamentale: 3–♭7–9–13 e ♭7–3–13–9 (la tredicesima al posto della quinta).
  const lab = (v) => v.notes.map((n) => C.toneToString(V.toneList(q('7'))[n.tone])).join(' ');
  assert.deepEqual(find(V.voicings(q('7'), 0, ['rootless']), 'rootless', '5432').map(lab).sort(), ['3 b7 9 13', 'b7 3 13 9']);
  assert.equal(V.familiesFor(q('dim7')).includes('rootless'), false);
  // I primi indici di toneList coincidono con le note della qualità.
  assert.deepEqual(V.toneList(q('maj7')).slice(0, 4), q('maj7').tones);
});

// ADR 0015, fase 3: strutture superiori, voicing per quarte, cluster.
const pcsOf = (v) => v.notes.map((n) => n.midi % 12);
const labelsOf = (quality, v) => v.notes.map((n) => C.toneToString(V.toneList(quality)[n.tone]));

test('strutture superiori: nota guida al basso e triade maggiore stretta sopra; alterate solo con alt', () => {
  for (const id of ['maj7', '6', 'm7', '7', 'maj9', 'm9', '9', '69']) {
    for (let pc = 0; pc < 12; pc++) {
      const plain = V.voicings(q(id), pc, ['ust']);
      const all = V.voicings(q(id), pc, ['ust'], { alt: true });
      assert.ok(plain.length > 0, `${id} ${pc}`);
      assert.ok(plain.every((v) => !v.alt));
      assert.equal(all.length > plain.length, ['7', '9'].includes(id), `${id}: alterate solo sui dominanti`);
      for (const v of all) {
        const nums = labelsOf(q(id), v);
        assert.ok(['3', 'b3', 'b7', '7', '6'].includes(nums[0]), `${id} ${pc}: ${nums}`);
        const m = v.notes.map((n) => n.midi);
        const tri = m.slice(1).map((x) => (x - m[1]) % 12).sort((a, b) => a - b);
        assert.ok([[0, 4, 7], [0, 3, 8], [0, 5, 9]].some((t) => t.join() === tri.join()), `${id} ${pc}: triade maggiore`);
        assert.ok(m[3] - m[1] < 12, 'triade stretta');
      }
    }
  }
  assert.deepEqual(V.familiesFor(q('m7b5')).includes('ust'), false);
  // C7: Si♭ sotto la triade di Re (♭7 9 ♯11 13); alterata ♭VI, tutte al I tasto sulle corde 5–4–3–2.
  const c7 = V.voicings(q('7'), 0, ['ust'], { alt: true });
  assert.ok(c7.some((v) => v.label === '4321' && labelsOf(q('7'), v).join(' ') === 'b7 9 #11 13'));
  const b6 = c7.find((v) => v.upper === '♭VI' && v.label === '5432' && frets(v) === '1.1.1.1');
  assert.deepEqual(labelsOf(q('7'), b6), ['b7', '#9', 'b13', '1']);
});

test('voicing per quarte: solo quarte giuste (e la terza della forma So What), basso nota dell\'accordo', () => {
  for (const quality of C.catalog()) {
    for (let pc = 0; pc < 12; pc++) {
      for (const v of V.voicings(quality, pc, ['quartal'])) {
        const m = v.notes.map((n) => n.midi);
        const steps = m.slice(1).map((x, i) => x - m[i]);
        const want = steps.length === 4 ? [5, 5, 5, 4] : steps.map(() => 5);
        assert.deepEqual(steps, want, `${quality.id} ${pc} ${v.label}`);
        assert.ok(V.toneList(quality)[v.bass].number <= 7);
        assert.ok(!v.notes.some((n) => (quality.altered || []).some((t) => C.toneSemitones(t) % 12 === (n.midi - pc + 120) % 12 && !quality.tones.concat(quality.tensions).some((x) => C.toneSemitones(x) % 12 === C.toneSemitones(t) % 12))), 'niente alterate');
      }
    }
  }
  // Cm7 «So What»: Do Fa Si♭ Mi♭ Sol al III tasto sulle corde 5–4–3–2–1.
  const sw = find(V.voicings(q('m7'), 0, ['quartal']), 'quartal', '54321', 0)[0];
  assert.equal(frets(sw), '3.3.3.4.3');
  assert.deepEqual(labelsOf(q('m7'), sw), ['1', '11', 'b7', 'b3', '5']);
});

test('cluster: almeno una seconda, note guida presenti, al più quattro per gruppo di corde', () => {
  for (const quality of C.catalog()) {
    for (let pc = 0; pc < 12; pc++) {
      const vs = V.voicings(quality, pc, ['cluster']);
      for (const set of ['4321', '5432']) assert.ok(find(vs, 'cluster', set).length <= 4);
      for (const v of vs) {
        const m = v.notes.map((n) => n.midi);
        const steps = m.slice(1).map((x, i) => x - m[i]);
        assert.ok(steps.some((d) => d <= 2), `${quality.id} ${pc} ${frets(v)}`);
        assert.ok(steps.filter((d) => d === 1).length <= 1);
        const nums = labelsOf(quality, v);
        assert.ok(nums.some((x) => x === '3' || x === 'b3'), `${quality.id}: terza`);
        assert.ok(V.toneList(quality)[v.bass].number <= 7);
      }
    }
  }
  assert.equal(V.voicings(q('maj'), 0, ['cluster']).length, 0);
  assert.equal(V.voicings(q('dim7'), 0, ['cluster']).length, 0);
});

test('esercizi con le famiglie di colore: II–V–I minore senza errori grazie al ripiego', () => {
  for (const fam of ['ust', 'quartal', 'cluster']) {
    for (const id of ['m6', 'm7', '7', 'maj7']) {
      const r = X.build(q(id), L.parseNote('C'), { exId: 'ii-v-i', family: fam, set: 'all', fretFrom: 1, fretTo: 12, alt: true });
      assert.ok(!r.error, `${fam} ${id}`);
      assert.equal(r.chords.length, 3);
    }
  }
});
