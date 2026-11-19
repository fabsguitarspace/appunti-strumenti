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

  /**
   * Ritmi in più per Progressioni (ADR 0013, punto 5), fuori dall'elenco di Accordi, che non cambia.
   * `length`: battiti del ciclo (la bossa ne ha otto); `families`: famiglie di voicing adatte.
   */
  const PROG_RHYTHMS = RHYTHMS.concat([
    // Capitolo 7, «Accompagnare: attacchi e silenzi»: un ottavo sul levare dell'1, un quarto sul 3.
    { id: 'offbeat', label: 'Levare dell\'1 e sul 3', hits: [{ beat: 0.5, dur: 0.5 }, { beat: 2, dur: 1 }] },
    {
      id: 'bossa', label: 'Bossa (due battute)', length: 8,
      hits: [{ beat: 0, dur: 1.5 }, { beat: 1.5, dur: 1.5 }, { beat: 3, dur: 1.5 }, { beat: 4.5, dur: 1.5 }, { beat: 6, dur: 2 }],
    },
    {
      id: 'green', label: 'Freddie Green (quattro colpi brevi)', families: ['shell', 'triad'],
      hits: [0, 1, 2, 3].map((b) => ({ beat: b, dur: 0.5 })),
    },
  ]);

  const ATTACKS = [['strum', 'Pennata'], ['block', 'Simultanea']];
  const STRUM = 0.018; // secondi fra una corda e la successiva nella pennata

  const exercise = (id) => EXERCISES.find((e) => e.id === id) || EXERCISES[0];
  const rhythmDef = (id) => RHYTHMS.find((r) => r.id === id) || RHYTHMS[0];

  const DEFAULTS = {
    exId: 'inv', direction: 'up', family: 'drop2', set: '4321', fretFrom: 1, fretTo: 15,
    rhythmId: 'half', bars: 1, attack: 'strum',
    alt: false, // tensioni alterate nelle strutture superiori (ADR 0015)
  };

  const MINOR = new Set(['m', 'dim', 'm6', 'm7', 'mmaj7', 'm7b5', 'dim7', 'm69', 'm9', 'mmaj9']);

  /**
   * Accordi dell'esercizio: [{ quality, root (nota scritta), symbol }].
   * II–V–I: l'accordo corrente è il I; maggiore se la qualità è maggiore o dominante, altrimenti
   * minore (IIø – V7 – Im6). Con le triadi: II m, V, I (o II°, V, Im).
   */
  function progression(exId, q, rootNote, catalog, family) {
    const byId = (id) => catalog.find((x) => x.id === id);
    const triad = family === 'triad' || family === 'spread';
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
  function candidatesFor(quality, rootPc, family, set, alt = false) {
    const want = set === 'all' ? null : Voicings.setFrom(set);
    return Voicings.voicings(quality, rootPc, [family], { alt })
      .filter((v) => !want || Voicings.sameSet(v.strings, want))
      .flatMap(Voicings.octaves);
  }

  /**
   * Candidati di un accordo della sequenza (ciclo, II–V–I): se la famiglia non ha voicing per
   * quella qualità (es. strutture superiori sul semidiminuito), senza fondamentale e poi drop 2.
   */
  function sequenceCandidates(quality, rootPc, s) {
    const own = candidatesFor(quality, rootPc, s.family, s.set, s.alt);
    if (own.length || !['ust', 'quartal', 'cluster'].includes(s.family)) return own;
    for (const fam of ['rootless', 'drop2']) {
      const list = candidatesFor(quality, rootPc, fam, s.set === 'all' ? 'all' : s.set, false);
      if (list.length) return list;
      const any = candidatesFor(quality, rootPc, fam, 'all', false);
      if (any.length) return any;
    }
    return own;
  }

  /**
   * Accompagnamento sulla linea del tempo (ADR 0013, punto 5): il ritmo d'attacco scorre per
   * tutta la sequenza, indipendente dal ritmo armonico. Ogni colpo suona l'accordo in vigore al
   * suo battito e si tronca al cambio d'accordo; il primo colpo di ogni accordo è accentato.
   * L'arpeggiato riparte a ogni battuta e a ogni cambio d'accordo, in ottavi dal basso all'acuto.
   * @param timeline  [{ start, dur, voicing }] in battiti, consecutivi dal battito 0
   * @param r         ritmo (RHYTHMS): { hits, length = 4 } oppure { arp: true }
   * @param opts      { attack: 'strum' | 'block', part: parte audio facoltativa (ADR 0013, punto 7) }
   * @returns         eventi polifonici, in ordine di tempo, con `chord` = indice nella timeline
   */
  function comp(timeline, r, opts = {}) {
    const out = [];
    const extra = opts.part ? { part: opts.part } : {};
    const strum = opts.attack === 'strum' ? STRUM : 0;
    const EPS = 1e-9;
    timeline.forEach((seg, k) => {
      const end = seg.start + seg.dur;
      const v = seg.voicing;
      if (r.arp) {
        // Pezzi: l'accordo spezzato alle stanghette.
        for (let t0 = seg.start; t0 < end - EPS;) {
          const t1 = Math.min(end, (Math.floor(t0 / 4 + EPS) + 1) * 4);
          const n = v.notes.length;
          const cyc = 2 * (n - 1);
          const count = Math.round((t1 - t0) * 2);
          for (let j = 0; j < count; j++) {
            const x = cyc > 0 ? mod(j, cyc) : 0;
            const note = v.notes[x < n ? x : cyc - x];
            out.push({
              i: out.length, beat: t0 + j / 2, dur: 0.5, ndur: 0.5, notes: [note],
              string: note.string, fret: note.fret, midi: note.midi,
              accent: j === 0, chord: k, rest: false, ...extra,
            });
          }
          t0 = t1;
        }
        return;
      }
      const len = r.length || 4;
      let first = true;
      for (let p = Math.floor(seg.start / len + EPS) * len; p < end - EPS; p += len) {
        for (const hit of r.hits) {
          const b = p + hit.beat;
          if (b < seg.start - EPS || b >= end - EPS) continue;
          const dur = Math.min(hit.dur, end - b);
          out.push({
            i: out.length, beat: b, dur, ndur: dur, notes: v.notes,
            accent: first, chord: k, rest: false, strum, ...extra,
          });
          first = false;
        }
      }
    });
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
      let list = candidatesFor(q, Theory.pitchClass(rootNote), s.family, s.set, s.alt)
        .filter((v) => v.minFret >= lo && v.maxFret <= hi)
        .sort((a, b) => a.notes[0].midi - b.notes[0].midi || a.minFret - b.minFret);
      if (s.direction === 'down') list = list.reverse();
      else if (s.direction === 'updown' && list.length > 1) list = list.concat(list.slice(0, -1).reverse());
      chosen = list;
      prog.length = 0;
      list.forEach(() => prog.push({ quality: q, root: rootNote }));
    } else {
      const cands = prog.map((c) => sequenceCandidates(c.quality, Theory.pitchClass(c.root), s));
      // Negli shell il basso di fondamentale è la disposizione di riferimento (capitolo 6):
      // terza e quinta al basso si scelgono solo se fanno risparmiare movimento.
      const cost = (v) => (s.family === 'shell' && v.bass !== 0 ? 4 : 0);
      chosen = VoiceLeading.lead(cands, { zone: [lo, hi], cost }) || [];
    }
    const chords = chosen.map((v, k) => ({ ...prog[k], symbol: Chords.symbol(prog[k].quality, prog[k].root), voicing: v }));
    if (!chords.length) {
      return { chords, events: [], lengthBeats: 0, pickupBeats: 0, error: 'Nessun voicing di questa famiglia sulle corde e nella zona scelte: allarga la zona o cambia corde.' };
    }
    const timeline = chords.map((c, k) => ({ start: 4 * bars * k, dur: 4 * bars, voicing: c.voicing }));
    const events = comp(timeline, r, { attack: s.attack });
    return { chords, events, lengthBeats: 4 * bars * chords.length, pickupBeats: 0 };
  }

  const progRhythmDef = (id) => PROG_RHYTHMS.find((r) => r.id === id) || PROG_RHYTHMS[1];

  const Comping = { EXERCISES, RHYTHMS, PROG_RHYTHMS, progRhythmDef, ATTACKS, DEFAULTS, STRUM, exercise, rhythmDef, progression, candidatesFor, comp, build };

  if (isNode) module.exports = Comping;
  else root.Comping = Comping;
})(globalThis);
