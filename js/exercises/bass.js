/**
 * Basso per le progressioni (ADR 0013, punto 6): fondamentali o walking di base sulla linea del
 * tempo delle sigle. Deterministico: lo stesso esercizio suona sempre uguale. Modulo puro.
 *
 * Eventi con `part: 'bass'` (bus e volume propri, ADR 0013 punto 7). `string` e `fret` sono quelli
 * di un basso a quattro corde (0 = Mi grave … 3 = Sol): servono allo smorzamento per corda del
 * motore audio, non alla tastiera della chitarra, che mostra solo la parte `comp`.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('../theory.js') : root.Theory;
  const Chords = isNode ? require('../chords.js') : root.Chords;

  const LOW = 28;   // Mi1, corda più grave del basso
  const HIGH = 48;  // Do3
  const START = 36; // prima fondamentale vicina a Do2
  const OPEN = [28, 33, 38, 43];
  const mod = (a, n) => ((a % n) + n) % n;

  const MODES = [
    { id: 'off', label: 'Spento' },
    { id: 'roots', label: 'Fondamentali (minime)' },
    { id: 'walk', label: 'Walking di base (semiminime)' },
  ];

  /** Altezza della classe `pc` più vicina a `near`, dentro il registro. */
  function nearest(pc, near) {
    let best = null;
    for (let m = LOW; m <= HIGH; m++) {
      if (mod(m, 12) !== mod(pc, 12)) continue;
      if (best === null || Math.abs(m - near) < Math.abs(best - near)) best = m;
    }
    return best;
  }

  /** Riporta un'altezza nel registro spostandola di ottave. */
  function fit(m) {
    while (m < LOW) m += 12;
    while (m > HIGH) m -= 12;
    return m;
  }

  /** Nota del basso: la nota dopo la barra prevale sulla fondamentale (Em7/D → Re). */
  const bassPc = (c) => Theory.pitchClass(c.bass || c.root);

  /** Semitoni del grado `number` (3, 5, 7; per il 7 anche la sesta) della qualità, o null. */
  function toneOf(q, ...numbers) {
    for (const n of numbers) {
      const t = q.tones.find((x) => x.number === n);
      if (t) return mod(Chords.toneSemitones(t), 12);
    }
    return null;
  }

  function event(beat, dur, midi, accent) {
    let s = 0;
    for (let k = OPEN.length - 1; k >= 0; k--) if (OPEN[k] <= midi) { s = k; break; }
    return {
      beat, dur, ndur: dur, midi, string: s, fret: midi - OPEN[s],
      notes: [{ string: s, fret: midi - OPEN[s], midi }],
      accent, rest: false, part: 'bass',
    };
  }

  /**
   * @param timeline [{ beat, dur, chord }] da `Progression.realize` (chord: { root, quality, bass })
   * @param mode     'off' | 'roots' | 'walk'
   * @param opts     { loop: l'ultima battuta si avvicina al primo accordo }
   * @returns        eventi del basso, in ordine di tempo
   */
  function build(timeline, mode, opts = {}) {
    if (mode !== 'roots' && mode !== 'walk') return [];
    const out = [];
    let prev = START;
    const n = timeline.length;
    // Nel loop l'ultima battuta si avvicina proprio alla prima nota del giro seguente.
    const firstMidi = n ? nearest(bassPc(timeline[0].chord), START) : null;

    timeline.forEach((seg, k) => {
      const c = seg.chord;
      const next = k + 1 < n ? timeline[k + 1].chord : (opts.loop ? timeline[0].chord : null);
      const rootM = nearest(bassPc(c), prev);
      const slash = !!c.bass;
      const end = seg.beat + seg.dur;

      if (mode === 'roots') {
        // Minime: fondamentale sull'1, quinta sul 3 se l'accordo continua (sulla sigla con barra
        // il basso resta fermo); un accordo di due pulsazioni ha solo la fondamentale.
        const fifth = toneOf(c.quality, 5);
        for (let b = seg.beat, j = 0; b < end - 1e-9; b += 2, j++) {
          let m = rootM;
          if (j % 2 === 1 && !slash && fifth !== null) m = nearest(bassPc(c) + fifth, rootM);
          out.push(event(b, Math.min(2, end - b), m, j === 0));
          prev = m;
        }
        return;
      }

      // Walking: per ogni battuta (o mezza battuta) dell'accordo.
      for (let b = seg.beat; b < end - 1e-9;) {
        const len = Math.min(4, end - b);
        const last = b + len >= end - 1e-9;
        // Destinazione della nota successiva: fondamentale dell'accordo seguente o di nuovo questa.
        const target = last ? (next ? bassPc(next) : null) : bassPc(c);
        const notes = [rootM];
        if (len >= 4) {
          // 2 e 3: note dell'accordo, verso l'alto se c'è spazio, altrimenti verso il basso.
          const third = slash ? null : toneOf(c.quality, 3);
          const fifth = slash ? null : toneOf(c.quality, 5);
          const seventh = slash ? null : toneOf(c.quality, 7, 6);
          if (third !== null && fifth !== null && rootM + fifth <= HIGH) {
            notes.push(rootM + third, rootM + fifth);
          } else if (seventh !== null && fifth !== null) {
            notes.push(fit(rootM + seventh - 12), fit(rootM + fifth - 12));
          } else {
            notes.push(rootM, rootM);
          }
        }
        if (len >= 2) {
          // Avvicinamento: semitono verso la destinazione, dal lato da cui arriva la linea;
          // un tono se il semitono ripeterebbe la nota precedente.
          const before = notes[notes.length - 1];
          if (target === null) {
            notes.push(before);
          } else {
            const wrapsAround = last && k === n - 1 && opts.loop;
            const t = wrapsAround ? firstMidi : nearest(target, before);
            let side = t > before ? -1 : 1;
            // Ai bordi del registro ci si avvicina dall'altro lato.
            if (t + side < LOW || t + side > HIGH) side = -side;
            let a = t + side;
            if (a === before) a = t + 2 * side;
            if (a < LOW || a > HIGH) a = t - side;
            notes.push(a);
          }
        }
        if (len >= 4) notes.forEach((m, j) => out.push(event(b + j, 1, m, j === 0)));
        else if (len >= 2) notes.forEach((m, j) => out.push(event(b + j * (len / 2), len / 2, m, j === 0)));
        else out.push(event(b, len, notes[0], true));
        prev = notes[notes.length - 1];
        b += len;
      }
    });
    return out;
  }

  const Bass = { MODES, LOW, HIGH, build, nearest };

  if (isNode) module.exports = Bass;
  else root.Bass = Bass;
})(globalThis);
