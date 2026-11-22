/**
 * Esercizio dello strumento Ritmi (ADR 0016): la figura ritmica (js/rhythms.js) diventa una linea
 * suonata sopra una base facoltativa (una progressione del catalogo, con accordi e basso di
 * js/exercises/progcomp.js). Le altezze seguono il ritmo, non il contrario: una nota fissa, le
 * note dell'accordo, una sequenza di scala o le note guida dell'accordo in vigore all'attacco.
 * Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const req = (path, name) => (isNode ? require(path) : root[name]);
  const Theory = req('../theory.js', 'Theory');
  const Chords = req('../chords.js', 'Chords');
  const Progression = req('../progression.js', 'Progression');
  const Progressions = req('../progressions.js', 'Progressions');
  const ProgComp = req('./progcomp.js', 'ProgComp');
  const Rhythms = req('../rhythms.js', 'Rhythms');

  const { TPB } = Rhythms;
  const TUNING = [40, 45, 50, 55, 59, 64];
  const LOW = 55;   // Sol3
  const HIGH = 77;  // Fa5
  const mod = (a, n) => ((a % n) + n) % n;

  const NOTES = [['perc', 'Nota fissa'], ['chord', 'Note dell\'accordo'], ['scale', 'Sequenza di scala'], ['guide', 'Note guida']];
  const FEELS = [['straight', 'Crome regolari'], ['swing', 'Swing']];
  const BASS = [['walk', 'Walking'], ['roots', 'Fondamentali'], ['off', 'Spento']];

  /** Scala dell'accordo (semitoni dalla fondamentale), dalla qualità. */
  const SCALES = {
    ionian: [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    melodic: [0, 2, 3, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
    wholeTone: [0, 2, 4, 6, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  };
  const SCALE_OF = {
    maj: 'ionian', maj7: 'ionian', 6: 'ionian', 69: 'ionian', maj9: 'ionian',
    m: 'dorian', m7: 'dorian', m9: 'dorian',
    m6: 'melodic', m69: 'melodic', mmaj7: 'melodic', mmaj9: 'melodic',
    7: 'mixolydian', 9: 'mixolydian', '7b9': 'phrygianDominant',
    aug: 'wholeTone', '7s5': 'wholeTone',
    dim: 'locrian', m7b5: 'locrian', dim7: 'diminished',
  };

  const DEFAULTS = {
    start: 0, seed: 1, vary: false, omit: 'none', accent: 'auto',
    notes: 'chord', feel: 'straight', base: 'ii-v-i', bass: 'walk', comp: true,
  };

  /** Corda e tasto: il tasto più vicino al 7 (quinta–nona posizione), a parità la corda più acuta. */
  function place(midi) {
    let best = null;
    for (let s = 5; s >= 0; s--) {
      const fret = midi - TUNING[s];
      if (fret < 0 || fret > 15) continue;
      if (!best || Math.abs(fret - 7) < Math.abs(best.fret - 7)) best = { string: s, fret };
    }
    return best || { string: 0, fret: Math.max(0, midi - TUNING[0]) };
  }

  /** Classi di altezza dell'accordo (note dell'arpeggio) e della sua scala. */
  function pcsOf(chord) {
    const r = Theory.pitchClass(chord.root);
    const tones = Chords.semitones(chord.quality).map((x) => mod(r + x, 12));
    const scale = (SCALES[SCALE_OF[chord.quality.id]] || SCALES.ionian).map((x) => mod(r + x, 12));
    const semis = Chords.semitones(chord.quality);
    const guide = ProgComp.guideTones(chord.quality).filter((i) => i >= 0).map((i) => mod(r + semis[i], 12));
    return { root: r, tones: [...new Set(tones)], scale, guide };
  }

  /** Prossima altezza della collezione sopra (dir 1) o sotto (dir −1) `midi`, `n` passi. */
  function stepIn(midi, pcs, dir, n = 1) {
    let m = midi;
    for (let k = 0; k < n; k++) {
      do { m += dir; } while (!pcs.includes(mod(m, 12)));
    }
    return m;
  }

  /** Altezza della collezione più vicina a `near` (a parità quella sotto). */
  function nearest(near, pcs) {
    for (let d = 0; d < 12; d++) {
      if (pcs.includes(mod(near - d, 12))) return near - d;
      if (pcs.includes(mod(near + d, 12))) return near + d;
    }
    return near;
  }

  /**
   * Generatore di altezze: una funzione (accordo) → MIDI chiamata a ogni attacco.
   * La sequenza di scala va per gruppi di quattro (1-2-3-4, 2-3-4-5…) e torna indietro ai bordi del
   * registro; continua da un attacco all'altro, qualunque sia il ritmo.
   */
  function pitchStream(mode, key) {
    const tonic = Theory.pitchClass(key);
    let cur = null;
    let dir = 1;
    let idx = 0;
    let last = null; // indice della nota guida precedente
    const UP = [-2, 1, 1, 1]; // dopo la prima nota: su, su, su, poi due passi indietro
    return (chord) => {
      const p = pcsOf(chord);
      if (mode === 'perc') return nearest(62, [tonic]);
      if (mode === 'chord') {
        if (cur == null) { cur = nearest(60, p.tones); return cur; }
        let next = stepIn(cur, p.tones, dir);
        if (next > HIGH || next < LOW) { dir = -dir; next = stepIn(cur, p.tones, dir); }
        cur = next;
        return cur;
      }
      if (mode === 'scale') {
        if (cur == null) { cur = nearest(60, [p.root]); idx = 1; return cur; }
        const step = UP[idx % 4] * dir;
        let next = stepIn(cur, p.scale, Math.sign(step), Math.abs(step));
        if (next > HIGH || next < LOW) {
          dir = -dir;
          idx = 0;
          next = stepIn(cur, p.scale, dir, 1);
        }
        idx++;
        cur = next;
        return cur;
      }
      // Note guida: terza e settima alternate, la più vicina alla nota precedente.
      const g = p.guide.length ? p.guide : [p.root];
      const k = last == null ? 0 : (last + 1) % g.length;
      last = k;
      const target = cur == null ? 64 : cur;
      let m = nearest(target, [g[k]]);
      while (m < 57) m += 12;
      while (m > 72) m -= 12;
      cur = m;
      return cur;
    };
  }

  /** Accordo in vigore al battito (segmento della progressione realizzata). */
  function segmentAt(tl, beat) {
    let k = 0;
    while (k + 1 < tl.length && tl[k + 1].beat <= beat + 1e-9) k++;
    return k;
  }

  /** Battito dell'attacco con lo swing (2:1) sulle crome: la seconda croma della pulsazione si sposta. */
  function swingTick(t, on) {
    if (!on) return t;
    return mod(t, TPB) === TPB / 2 ? t + TPB / 6 : t;
  }

  /**
   * @param item  figura del catalogo
   * @param key   tonalità (nota scritta) della base e delle altezze
   * @param s     impostazioni (DEFAULTS più trasporto)
   * @returns { cycle, rhythm, real, events, lengthBeats, pickupBeats, bars, restart, error }
   */
  function build(item, key, s = {}) {
    s = { ...DEFAULTS, ...s };
    const prog = s.base && s.base !== 'none' ? Progressions.catalog().find((p) => p.id === s.base) : null;
    const baseReal = prog ? Progression.realize(prog, { key }) : null;
    const baseBars = baseReal ? baseReal.bars.length : 0;

    // Le figure casuali riempiono la base (o quattro battute senza base).
    const randomBars = Math.min(Rhythms.MAX_BARS, baseBars || 4);
    const cycle = Rhythms.cycleOf(item, s, randomBars);
    const { bars, restart } = Rhythms.lengthFor(cycle.cycleBeats, baseBars);
    const accent = s.accent === 'auto' ? Rhythms.autoAccent(item) : s.accent;
    const rhythm = Rhythms.realize(cycle, bars, { accent });

    const real = prog ? Progression.realize(prog, { key, giri: Math.max(1, bars / baseBars) }) : null;
    const tonicChord = { root: key, quality: Chords.catalog().find((q) => q.id === 'maj7'), symbol: '' };
    const chordAt = (beat) => (real ? real.timeline[segmentAt(real.timeline, beat)].chord : tonicChord);

    const next = pitchStream(s.notes, key);
    const swing = s.feel === 'swing';
    const events = rhythm.attacks.map((a) => {
      const beat0 = a.tick / TPB;
      const chord = chordAt(beat0);
      const midi = next(chord);
      const on = swing && isEighthSpan(rhythm, a);
      const t = swingTick(a.tick, on);
      const end = swingTick(a.tick + a.len, on);
      const { string, fret } = place(midi);
      return {
        beat: t / TPB, dur: Math.max(1 / 12, (end - t) / TPB), ndur: a.len / TPB,
        midi, string, fret, accent: a.accent, rest: false, a: a.i,
        chord: real ? segmentAt(real.timeline, beat0) : 0,
      };
    });

    let all = events;
    if (real) {
      const acc = ProgComp.build(real, {
        family: 'shell', rhythmId: 'half', bass: s.bass, comp: !!s.comp, loop: true, fretFrom: 2, fretTo: 10,
      });
      if (acc.error) return { cycle, rhythm, real, events: [], lengthBeats: rhythm.lengthBeats, pickupBeats: 0, bars, restart, error: acc.error };
      // Accordi della base sulla parte 'study' (volume proprio), basso sulla sua parte.
      const backing = acc.events.map((e) => ({ ...e, part: e.part === 'comp' ? 'study' : e.part, backing: true }));
      all = events.concat(backing);
    }
    const rank = (e) => (e.part === 'bass' ? 0 : e.part === 'study' ? 1 : 2);
    all.sort((x, y) => x.beat - y.beat || rank(x) - rank(y));
    all.forEach((e, i) => { e.i = i; });
    return { cycle, rhythm, real, events: all, lengthBeats: rhythm.lengthBeats, pickupBeats: 0, bars, restart, error: null };
  }

  /** L'attacco sta in un girone di una pulsazione diviso in due (crome)? */
  function isEighthSpan(rhythm, a) {
    const bar = rhythm.bars[a.bar];
    const sp = bar && bar.spans.find((x) => a.tick >= x.start && a.tick < x.start + x.beats * TPB);
    return !!sp && sp.beats === 1 && sp.div === 2;
  }

  /** Eventi della sola linea ritmica (senza base). */
  const lineEvents = (ex) => ex.events.filter((e) => !e.backing);

  /**
   * La tablatura (js/tab/layout.js) scrive figure dentro la pulsazione e gironi di 3, 5 e 6:
   * le marce di più pulsazioni (terzine di semiminima, cinque o sette note per battuta…) e le
   * settimine e nonine restano alla griglia.
   */
  function tabbable(ex) {
    return ex.rhythm.bars.every((b) => b.spans.every((sp) => sp.beats === 1 && [1, 2, 3, 4, 5, 6].includes(sp.div)));
  }

  /** Eventi per la tablatura: note della linea con lo swing tolto, più le pause della figura. */
  function tabEvents(ex) {
    const notes = lineEvents(ex).map((e) => ({ ...e }));
    const rests = ex.rhythm.rests.map((r) => ({ beat: r.tick / TPB, dur: r.len / TPB, ndur: r.len / TPB, rest: true, accent: false }));
    const out = notes.concat(rests).sort((x, y) => x.beat - y.beat);
    out.forEach((e, i) => { if (e.rest) e.i = -1 - i; });
    return out;
  }

  const RhythmLine = {
    DEFAULTS, NOTES, FEELS, BASS, SCALES, SCALE_OF, LOW, HIGH,
    place, pcsOf, pitchStream, build, lineEvents, tabbable, tabEvents,
  };

  if (isNode) module.exports = RhythmLine;
  else root.RhythmLine = RhythmLine;
})(globalThis);
