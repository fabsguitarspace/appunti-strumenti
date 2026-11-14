/**
 * Esercizi sugli accordi (ADR 0012): sequenza di accordi (rivolti di un accordo, ciclo delle
 * quarte, II–V–I) × voicing scelti con la conduzione delle voci × ritmo d'accompagnamento.
 * Produce eventi polifonici (`notes[]`, ADR 0010 punto 3) per scheduler, tastiera e tablatura.
 * Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('../theory.js') : root.Theory;
  const Chords = isNode ? require('../chords.js') : root.Chords;
  const Voicings = isNode ? require('../voicings.js') : root.Voicings;
  const VoiceLeading = isNode ? require('../voiceleading.js') : root.VoiceLeading;

  const mod = (a, n) => ((a % n) + n) % n;

  /** Esercizi (asse «Cosa»). Gli id compaiono nei deep link (`ex`): non si rinominano. */
  const EXERCISES = [
    { id: 'inv', label: 'Tutti i rivolti sullo stesso gruppo di corde' },
    { id: 'cycle', label: 'Ciclo delle quarte (stessa qualità, 12 tonalità)' },
    { id: 'ii-v-i', label: 'II–V–I verso l\'accordo (maggiore o minore)' },
  ];

  /**
   * Ritmi d'accompagnamento (asse «Come»), su una battuta di 4/4: colpi { beat, dur }.
   * `arp`: l'accordo arpeggiato in ottavi, dal basso all'acuto e ritorno.
   */
  const RHYTHMS = [
    { id: 'whole', label: 'Semibreve (un colpo)', hits: [{ beat: 0, dur: 4 }] },
    { id: 'half', label: 'Minime', hits: [{ beat: 0, dur: 2 }, { beat: 2, dur: 2 }] },
    { id: 'quarters', label: 'Semiminime (quattro)', hits: [0, 1, 2, 3].map((b) => ({ beat: b, dur: 1 })) },
    { id: 'two-four', label: 'Sul 2 e sul 4', hits: [{ beat: 1, dur: 1 }, { beat: 3, dur: 1 }] },
    { id: 'charleston', label: 'Charleston (1 e «e» del 2)', hits: [{ beat: 0, dur: 1.5 }, { beat: 1.5, dur: 2.5 }] },
    { id: 'arp', label: 'Arpeggiato in ottavi', arp: true },
  ];

  const ATTACKS = [['strum', 'Pennata'], ['block', 'Simultanea']];
  const STRUM = 0.018; // secondi fra una corda e la successiva nella pennata

  const exercise = (id) => EXERCISES.find((e) => e.id === id) || EXERCISES[0];
  const rhythmDef = (id) => RHYTHMS.find((r) => r.id === id) || RHYTHMS[0];

  const DEFAULTS = {
    exId: 'inv', direction: 'up', family: 'drop2', set: '4321', fretFrom: 1, fretTo: 15,
    rhythmId: 'half', bars: 1, attack: 'strum',
  };

  const MINOR = new Set(['m', 'dim', 'm6', 'm7', 'mmaj7', 'm7b5', 'dim7', 'm69', 'm9', 'mmaj9']);

  /**
   * Accordi dell'esercizio: [{ quality, root (nota scritta), symbol }].
   * II–V–I: l'accordo corrente è il I; maggiore se la qualità è maggiore o dominante, altrimenti
   * minore (IIø – V7 – Im6). Con le triadi: II m, V, I (o II°, V, Im).
   */
  function progression(exId, q, rootNote, catalog, family) {
    const byId = (id) => catalog.find((x) => x.id === id);
    const triad = family === 'triad';
    if (exId === 'ii-v-i') {
      const minor = MINOR.has(q.id);
      const ids = triad ? (minor ? ['dim', 'maj', 'm'] : ['m', 'maj', 'maj'])
        : (minor ? ['m7b5', '7', 'm6'] : ['m7', '7', 'maj7']);
      const roots = [Chords.transpose(rootNote, 1, 2), Chords.transpose(rootNote, 4, 7), rootNote];
      return ids.map((id, k) => ({ quality: byId(id), root: roots[k] }));
    }
    if (exId === 'cycle') {
      const out = [];
      let n = rootNote;
      for (let k = 0; k < 12; k++) {
        out.push({ quality: q, root: n });
        // Quarta giusta sopra; oltre i sei bemolli si riscrive (G♭ → F♯ → B …).
        n = Chords.transpose(n, 3, 5);
        if (n.accidental < -1 || (n.accidental === -1 && n.letter === 0)) {
          const pc = Theory.pitchClass(n);
          n = Theory.rootCandidates(pc).find((r) => r.accidental >= 0) || n;
        }
      }
      return out;
    }
    return [{ quality: q, root: rootNote }];
  }

  /**
   * Voicing della famiglia e dell'insieme di corde (`'all'`: tutti gli insiemi della famiglia),
   * in tutte le ottave dentro il manico.
   */
  function candidatesFor(quality, rootPc, family, set) {
    const want = set === 'all' ? null : Voicings.setFrom(set);
    return Voicings.voicings(quality, rootPc, [family])
      .filter((v) => !want || Voicings.sameSet(v.strings, want))
      .flatMap(Voicings.octaves);
  }

  /** Eventi di un accordo per `bars` battute a partire dal battito `start`. */
  function hitsFor(v, r, bars, start, chordIndex, attack, firstI) {
    const out = [];
    let i = firstI;
    for (let b = 0; b < bars; b++) {
      const t0 = start + 4 * b;
      if (r.arp) {
        const n = v.notes.length;
        const order = [];
        for (let k = 0; order.length < 8; k++) {
          const cyc = 2 * (n - 1);
          const x = mod(k, cyc);
          order.push(x < n ? x : cyc - x);
        }
        order.forEach((k, j) => {
          const note = v.notes[k];
          out.push({
            i: i++, beat: t0 + j / 2, dur: 0.5, ndur: 0.5, notes: [note],
            string: note.string, fret: note.fret, midi: note.midi,
            accent: j === 0, chord: chordIndex, rest: false,
          });
        });
      } else {
        r.hits.forEach((hit, j) => out.push({
          i: i++, beat: t0 + hit.beat, dur: hit.dur, ndur: hit.dur, notes: v.notes,
          accent: j === 0 && b === 0, chord: chordIndex, rest: false,
          strum: attack === 'strum' ? STRUM : 0,
        }));
      }
    }
    return out;
  }

  /**
   * Pipeline completa.
   * @param q        qualità (Chords.catalog) dell'accordo corrente
   * @param rootNote fondamentale scritta
   * @param settings vedi DEFAULTS
   * @returns { chords: [{quality, root, symbol, voicing}], events, lengthBeats, pickupBeats, error? }
   */
  function build(q, rootNote, settings, catalog = Chords.catalog()) {
    const s = { ...DEFAULTS, ...settings };
    const r = rhythmDef(s.rhythmId);
    const bars = s.bars === 2 ? 2 : 1;
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const prog = progression(s.exId, q, rootNote, catalog, s.family);
    let chosen;
    if (s.exId === 'inv') {
      // Rivolti dello stesso accordo dal basso verso l'alto, dentro la zona (estremi inclusi).
      let list = candidatesFor(q, Theory.pitchClass(rootNote), s.family, s.set)
        .filter((v) => v.minFret >= lo && v.maxFret <= hi)
        .sort((a, b) => a.notes[0].midi - b.notes[0].midi || a.minFret - b.minFret);
      if (s.direction === 'down') list = list.reverse();
      else if (s.direction === 'updown' && list.length > 1) list = list.concat(list.slice(0, -1).reverse());
      chosen = list;
      prog.length = 0;
      list.forEach(() => prog.push({ quality: q, root: rootNote }));
    } else {
      const cands = prog.map((c) => candidatesFor(c.quality, Theory.pitchClass(c.root), s.family, s.set));
      // Negli shell il basso di fondamentale è la disposizione di riferimento (capitolo 6):
      // terza e quinta al basso si scelgono solo se fanno risparmiare movimento.
      const cost = (v) => (s.family === 'shell' && v.bass !== 0 ? 4 : 0);
      chosen = VoiceLeading.lead(cands, { zone: [lo, hi], cost }) || [];
    }
    const chords = chosen.map((v, k) => ({ ...prog[k], symbol: Chords.symbol(prog[k].quality, prog[k].root), voicing: v }));
    if (!chords.length) {
      return { chords, events: [], lengthBeats: 0, pickupBeats: 0, error: 'Nessun voicing di questa famiglia sulle corde e nella zona scelte: allarga la zona o cambia corde.' };
    }
    const events = [];
    chords.forEach((c, k) => events.push(...hitsFor(c.voicing, r, bars, 4 * bars * k, k, s.attack, events.length)));
    return { chords, events, lengthBeats: 4 * bars * chords.length, pickupBeats: 0 };
  }

  const Comping = { EXERCISES, RHYTHMS, ATTACKS, DEFAULTS, STRUM, exercise, rhythmDef, progression, candidatesFor, build };

  if (isNode) module.exports = Comping;
  else root.Comping = Comping;
})(globalThis);
