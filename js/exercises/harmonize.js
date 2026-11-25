/**
 * Armonizzazione del chord melody (ADR 0018, punti 6 e 7): la nota della melodia è un vincolo,
 * le voci sotto si scelgono con la conduzione delle voci (Viterbi, js/voiceleading.js). Accordo
 * sulle note dell'accordo che cadono sui tempi forti o durano almeno due pulsazioni, nota sola
 * altrove. Eventi su due parti: `melody` (la nota al canto) e `comp` (le voci sotto).
 * Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('../theory.js') : root.Theory;
  const Chords = isNode ? require('../chords.js') : root.Chords;
  const Guitar = isNode ? require('../guitar.js') : root.Guitar;
  const Voicings = isNode ? require('../voicings.js') : root.Voicings;
  const VoiceLeading = isNode ? require('../voiceleading.js') : root.VoiceLeading;
  const Melodies = isNode ? require('../melodies.js') : root.Melodies;

  const { TUNING } = Guitar;
  const mod = (a, n) => ((a % n) + n) % n;
  const EPS = 1e-9;
  const STRUM = 0.018; // come Comping.STRUM

  /** Famiglie del chord melody (rilascio 1a; `mix` arriva con il rilascio 1b). */
  const FAMILIES = ['drop2', 'drop3', 'trio'];
  /** Esercizi (id pubblici, link `ex`): sulla griglia e sull'accordo. */
  const EXERCISES = [
    { id: 'line', label: 'Melodia sulla griglia', on: 'prog' },
    { id: 'trio', label: 'Tre voci sulla griglia', on: 'prog' },
    { id: 'tops', label: 'Note al canto in salita', on: 'chord' },
    { id: 'same-top', label: 'Stessa nota al canto, cinque qualità', on: 'chord' },
    { id: 'quiz-top', label: 'Quiz: trova la forma', on: 'chord' },
  ];
  const ATTACKS = [['strum', 'Pennata'], ['block', 'Simultanea'], ['melody', 'Prima la melodia']];
  const STUDY = [['full', 'Completo'], ['melody', 'Solo melodia'], ['bass', 'Melodia e basso'], ['play', 'Suona tu']];
  const SAME_TOP = ['maj7', '6', '7', 'm7', 'm7b5'];

  const DEFAULTS = {
    family: 'drop2', string: '1', fretFrom: 1, fretTo: 12,
    line: 'guide', cell: 'whole', seed: 1,
    attack: 'strum', study: 'full', loop: true,
  };

  const exercise = (id) => EXERCISES.find((e) => e.id === id);

  /** Corde della melodia: indici 0 = 6ª … 5 = 1ª. */
  const melodyStrings = (s) => Melodies.STRINGS[s] || Melodies.STRINGS[1];

  /**
   * Voicing con la nota al canto `midi` sulla corda della melodia. Le triadi, che non hanno drop né
   * tre voci, usano le triadi strette e late.
   */
  function candidates(chord, midi, s) {
    const q = chord.quality;
    const pc = Theory.pitchClass(chord.root);
    const strings = melodyStrings(s.string);
    const pick = (fams) => Voicings.voicings(q, pc, fams, { melody: true, top: midi })
      .filter((v) => strings.includes(Voicings.topOf(v).string));
    let list = pick([s.family]);
    if (!list.length && q.tones.length === 3) list = pick(['triad', 'spread']);
    return list;
  }

  /** Accordo o nota sola (ADR 0018, punto 7): tempi forti e note lunghe prendono l'accordo. */
  function wantsChord(note) {
    return mod(note.beat, 2) < EPS || note.dur >= 2 - EPS;
  }

  /** Corda e tasto di una nota sola, sulla corda della melodia, vicino al tasto precedente. */
  function placeSingle(midi, s, near) {
    let best = null;
    for (const st of melodyStrings(s.string)) {
      const f = midi - TUNING[st];
      if (f < 1 || f > 20) continue;
      const score = Math.abs(f - near);
      if (!best || score < best.score) best = { string: st, fret: f, midi, score };
    }
    if (!best) {
      for (const st of [5, 4, 3]) {
        const f = midi - TUNING[st];
        if (f >= 1 && f <= 20) return { string: st, fret: f, midi };
      }
      return { string: 5, fret: Math.max(1, midi - TUNING[5]), midi };
    }
    return { string: best.string, fret: best.fret, midi };
  }

  /** Viterbi con zona; nel loop il primo voicing è anche l'ultimo (come ProgComp). */
  function lead(layers, s) {
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const opts = { zone: [lo, hi] };
    let chosen = VoiceLeading.lead(layers, opts);
    if (chosen && s.loop && layers.length > 1) {
      let best = null;
      for (const v0 of layers[0]) {
        const path = VoiceLeading.lead([[v0]].concat(layers.slice(1), [[v0]]), opts);
        if (path && (!best || path.cost < best.cost - EPS)) best = path;
      }
      if (best) chosen = best.slice(0, -1);
    }
    return chosen;
  }

  const sameShape = (a, b) => !!a && !!b && a.notes.length === b.notes.length &&
    a.notes.every((n, i) => n.string === b.notes[i].string && n.fret === b.notes[i].fret);

  /**
   * Eventi da una sequenza di note armonizzate.
   * @param items [{ beat, dur, midi, chord, seg, voicing | null, single: {string, fret, midi} | null }]
   * @returns { events, cards }: `cards` i voicing in ordine, uno per cambio di forma (vista a diagrammi)
   */
  function toEvents(items, s) {
    const events = [];
    const cards = [];
    items.forEach((it, n) => {
      let k = -1;
      if (it.voicing) {
        const prev = cards[cards.length - 1];
        if (!prev || !sameShape(prev.voicing, it.voicing) || prev.chord.symbol !== it.chord.symbol) {
          cards.push({ voicing: it.voicing, chord: it.chord, melody: it.midi, beat: it.beat });
        }
        k = cards.length - 1;
      }
      const top = it.voicing ? Voicings.topOf(it.voicing) : it.single;
      const base = { seg: it.seg, n, k, chord: it.seg, rest: false };
      if (s.study !== 'play') {
        events.push({
          ...base, beat: it.beat, dur: it.dur, ndur: it.dur, accent: true, part: 'melody',
          notes: [{ string: top.string, fret: top.fret, midi: top.midi }],
          string: top.string, fret: top.fret, midi: top.midi,
        });
      }
      if (!it.voicing || s.study === 'melody') return;
      let lower = it.voicing.notes.slice(0, -1);
      if (s.study === 'bass' || s.study === 'play') lower = lower.slice(0, 1);
      const delay = s.attack === 'melody' && s.study !== 'play' ? Math.min(0.5, it.dur / 2) : 0;
      events.push({
        ...base, beat: it.beat + delay, dur: it.dur - delay, ndur: it.dur - delay, accent: false, part: 'comp',
        notes: lower.map((x) => ({ string: x.string, fret: x.fret, midi: x.midi })),
        strum: s.attack === 'strum' && lower.length > 1 ? STRUM : 0,
      });
    });
    events.sort((a, b) => a.beat - b.beat || (a.part === 'comp' ? -1 : 1) - (b.part === 'comp' ? -1 : 1));
    events.forEach((e, i) => { e.i = i; });
    return { events, cards };
  }

  /**
   * Melodia sulla griglia armonizzata (esercizi `line` e `trio`).
   * @param real      risultato di Progression.realize
   * @param settings  vedi DEFAULTS; `ex: 'trio'` impone la famiglia a tre voci
   * @returns { melody, items, events, cards, lengthBeats, pickupBeats, unharmonized, error? }
   */
  function build(real, settings = {}) {
    const s = { ...DEFAULTS, ...settings };
    if (s.ex === 'trio') s.family = 'trio';
    const tl0 = real.timeline;
    const cache = new Map();
    const cands = (seg, midi) => {
      const key = tl0[seg].chord.symbol + ':' + midi;
      if (!cache.has(key)) cache.set(key, candidates(tl0[seg].chord, midi, s));
      return cache.get(key);
    };
    // La melodia evita le altezze che sul tempo forte non avrebbero un voicing della famiglia.
    const melody = Melodies.build(real, { ...s, accept: (on, midi) => !wantsChord(on) || cands(on.seg, midi).length > 0 });
    const base = { melody, items: [], events: [], cards: [], lengthBeats: real.beats, pickupBeats: 0, unharmonized: [] };
    if (!melody.length) return { ...base, error: 'Nessuna melodia possibile su questa corda: scegli un\'altra corda della melodia.' };
    const tl = real.timeline;
    const items = melody.map((x) => ({ ...x, chord: tl[x.seg].chord, voicing: null, single: null }));
    const want = items.map((it) => (wantsChord(it) ? cands(it.seg, it.midi) : null));
    const unharmonized = [];
    want.forEach((c, i) => { if (c && !c.length) unharmonized.push(i); });
    const idx = want.map((c, i) => (c && c.length ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const chosen = lead(idx.map((i) => want[i]), s);
      idx.forEach((i, j) => { items[i].voicing = chosen[j]; });
    }
    let near = (Math.min(s.fretFrom, s.fretTo) + Math.max(s.fretFrom, s.fretTo)) / 2;
    for (const it of items) {
      if (it.voicing) { near = Voicings.topOf(it.voicing).fret; continue; }
      it.single = placeSingle(it.midi, s, near);
      near = it.single.fret;
    }
    const { events, cards } = toEvents(items, s);
    return { ...base, items, events, cards, unharmonized };
  }

  // ------------------------------------------------------------ Esercizi sull'accordo

  const chordOf = (q, rootNote) => ({ root: rootNote, quality: q, symbol: Chords.symbol(q, rootNote) });

  /** Voicing dell'accordo con la melodia sulla corda scelta, in tutte le ottave sul manico. */
  function shapes(q, rootNote, s, melody = false) {
    const pc = Theory.pitchClass(rootNote);
    const strings = melodyStrings(s.string);
    let fams = [s.family];
    if (q.tones.length === 3) fams = ['triad', 'spread'];
    return Voicings.voicings(q, pc, fams, { melody })
      .flatMap(Voicings.octaves)
      .filter((v) => strings.includes(Voicings.topOf(v).string));
  }

  const inZone = (v, s) => v.minFret >= Math.min(s.fretFrom, s.fretTo) && v.maxFret <= Math.max(s.fretFrom, s.fretTo);

  /** Una battuta per forma, semibreve: eventi e cards dagli elementi. */
  function chordSequence(steps, s) {
    const items = steps.map((x, i) => ({
      beat: i * 4, dur: 4, midi: Voicings.topOf(x.voicing).midi, chord: x.chord, seg: i, voicing: x.voicing, single: null,
    }));
    const { events, cards } = toEvents(items, s);
    return { items, events, cards, lengthBeats: items.length * 4, pickupBeats: 0, unharmonized: [] };
  }

  /**
   * `tops`: le forme dell'accordo con le note al canto in salita, una per nota dell'accordo, dalla
   * più grave nella zona (come `cm-drop2-maj7` del capitolo 6).
   */
  function tops(q, rootNote, settings = {}) {
    const s = { ...DEFAULTS, ...settings };
    const chord = chordOf(q, rootNote);
    let all = shapes(q, rootNote, s);
    if (all.some((v) => inZone(v, s))) all = all.filter((v) => inZone(v, s));
    if (!all.length) return { items: [], events: [], cards: [], lengthBeats: 0, pickupBeats: 0, unharmonized: [], error: 'Nessuna forma di questa famiglia con la melodia sulla corda scelta.' };
    const byTop = new Map();
    for (const v of all) {
      const m = Voicings.topOf(v).midi;
      if (!byTop.has(m)) byTop.set(m, []);
      byTop.get(m).push(v);
    }
    const midis = [...byTop.keys()].sort((a, b) => a - b);
    const count = new Set(midis.map((m) => mod(m, 12))).size;
    const seq = midis.slice(0, count + 1).filter((m, i) => i < count || mod(m, 12) === mod(midis[0], 12));
    const chosen = lead(seq.map((m) => byTop.get(m)), { ...s, loop: false });
    return chordSequence(chosen.map((voicing) => ({ voicing, chord })), s);
  }

  /**
   * `same-top`: la fondamentale al canto su maj7, 6, 7, m7 e m7♭5 (la «Verifica» del capitolo 6):
   * fra due qualità cambiano una o due voci, il canto resta.
   */
  function sameTop(rootNote, settings = {}) {
    const s = { ...DEFAULTS, ...settings };
    const qs = SAME_TOP.map((id) => Chords.catalog().find((q) => q.id === id));
    const pc = Theory.pitchClass(rootNote);
    const lists = qs.map((q) => shapes(q, rootNote, s).filter((v) => mod(Voicings.topOf(v).midi, 12) === pc));
    const common = [...new Set(lists[0].map((v) => Voicings.topOf(v).midi))]
      .filter((m) => lists.every((l) => l.some((v) => Voicings.topOf(v).midi === m)));
    if (!common.length) return { items: [], events: [], cards: [], lengthBeats: 0, pickupBeats: 0, unharmonized: [], error: 'Nessuna nota al canto comune alle cinque qualità con questa famiglia e questa corda.' };
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const zoneMid = (lo + hi) / 2;
    // L'ottava della nota al canto con le forme più vicine alla zona.
    const score = (m) => Math.min(...lists[0].filter((v) => Voicings.topOf(v).midi === m)
      .map((v) => Math.abs((v.minFret + v.maxFret) / 2 - zoneMid)));
    const top = common.sort((a, b) => score(a) - score(b))[0];
    const chosen = lead(lists.map((l) => l.filter((v) => Voicings.topOf(v).midi === top)), { ...s, loop: false });
    return chordSequence(chosen.map((voicing, i) => ({ voicing, chord: chordOf(qs[i], rootNote) })), s);
  }

  /**
   * `quiz-top`: una nota dell'accordo al canto scelta con il seme; la soluzione è l'elenco delle
   * forme con quella nota in cima, dalla più vicina alla zona.
   * @returns { tone (indice in toneList), pc, solutions: [voicing], ...esercizio della prima }
   */
  function quiz(q, rootNote, settings = {}) {
    const s = { ...DEFAULTS, ...settings };
    const chord = chordOf(q, rootNote);
    const all = shapes(q, rootNote, s);
    const tones = [...new Set(all.map((v) => v.top))].sort((a, b) => a - b);
    if (!tones.length) return { items: [], events: [], cards: [], lengthBeats: 0, pickupBeats: 0, unharmonized: [], solutions: [], error: 'Nessuna forma di questa famiglia con la melodia sulla corda scelta.' };
    const rand = Melodies.rng(s.seed || 1);
    const tone = tones[Math.floor(rand() * tones.length)];
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const out = (v) => Math.max(0, lo - v.minFret) + Math.max(0, v.maxFret - hi);
    const solutions = all.filter((v) => v.top === tone).sort((a, b) => out(a) - out(b) || a.minFret - b.minFret);
    const ex = chordSequence(solutions.slice(0, 1).map((voicing) => ({ voicing, chord })), s);
    return { ...ex, tone, pc: mod(Theory.pitchClass(rootNote) + Chords.toneSemitones(Voicings.toneList(q)[tone]), 12), solutions };
  }

  const Harmonize = {
    FAMILIES, EXERCISES, ATTACKS, STUDY, SAME_TOP, DEFAULTS,
    exercise, candidates, wantsChord, build, tops, sameTop, quiz,
  };

  if (isNode) module.exports = Harmonize;
  else root.Harmonize = Harmonize;
})(globalThis);
