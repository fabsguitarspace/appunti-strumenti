/**
 * Diteggiature a 3 note per corda (3NPS) per chitarra in accordatura standard.
 * Porting di interval-master/src/guitar.rs.
 */
(function (root) {
  'use strict';

  const Theory = typeof module !== 'undefined' && module.exports ? require('./theory.js') : root.Theory;

  /** Altezze MIDI delle corde a vuoto, dalla 6ª (E grave) alla 1ª (e acuto). */
  const TUNING = [40, 45, 50, 55, 59, 64];
  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
  /** Tasto più alto ammesso prima di riportare la diteggiatura un'ottava sotto. */
  const MAX_FRET = 24;

  const mod = (a, n) => ((a % n) + n) % n;

  /**
   * Tutte le diteggiature 3NPS della scala: una per ogni grado di partenza sulla 6ª corda.
   * Ogni posizione: { string (0 = 6ª … 5 = 1ª), fret, degree (indice, 0 = tonica) }.
   */
  function threeNpsPatterns(scale, rootPc) {
    const semis = Theory.semitones(scale);
    const n = semis.length;
    const patterns = [];
    for (let start = 0; start < n; start++) {
      // Primo tasto (0..11) della 6ª corda che suona il grado di partenza.
      const firstPc = mod(rootPc + semis[start], 12);
      const base = TUNING[0] + mod(firstPc - TUNING[0], 12);

      const positions = [];
      for (let k = 0; k < 18; k++) {
        const idx = start + k;
        const deg = idx % n;
        const octave = Math.floor(idx / n);
        const midi = base + semis[deg] - semis[start] + 12 * octave;
        const string = Math.floor(k / 3);
        positions.push({ string, fret: midi - TUNING[string], degree: deg });
      }

      // Sotto il capotasto: un'ottava sopra; oltre la tastiera: un'ottava sotto.
      const frets = positions.map((p) => p.fret);
      const min = Math.min(...frets);
      const max = Math.max(...frets);
      const shift = min < 0 ? 12 : max > MAX_FRET && min >= 12 ? -12 : 0;
      for (const p of positions) p.fret += shift;

      patterns.push({
        startDegree: start,
        positions,
        minFret: min + shift,
        maxFret: max + shift,
      });
    }
    return patterns;
  }

  /**
   * Diteggiature in posizione per un insieme di note (arpeggi): una per ogni nota di partenza
   * sulla 6ª corda. Ogni diteggiatura è una finestra di 5 tasti (quattro dita più
   * un'estensione) con tutte le note dell'insieme, ciascuna altezza una volta sola, senza corde
   * a vuoto. Fra le finestre che hanno la nota di partenza come più grave si sceglie quella con
   * meno note in estensione.
   * @param semis   classi di altezza dalla tonica, nell'ordine dei gradi (indice 0 = tonica)
   * @returns come threeNpsPatterns: [{ startDegree, positions, minFret, maxFret }]
   */
  function positionPatterns(semis, rootPc) {
    const pcs = semis.map((s) => mod(rootPc + s, 12));
    const degreeAt = (string, fret) => pcs.indexOf(mod(TUNING[string] + fret, 12));
    const SPAN = 4;

    function windowAt(a, f) {
      let positions = [];
      for (let string = 0; string < 6; string++) {
        for (let fret = a; fret <= a + SPAN; fret++) {
          if (string === 0 && fret < f) continue;
          const degree = degreeAt(string, fret);
          if (degree >= 0) positions.push({ string, fret, degree });
        }
      }
      const edge = (fret) => positions.filter((p) => p.fret === fret).length;
      // Il lato con meno note è quello in estensione; lì si toglie l'unisono fra 3ª e 2ª corda.
      const high = edge(a + SPAN) <= edge(a);
      const dup = positions.some((p) => p.string === 3 && p.fret === a + SPAN) &&
        positions.some((p) => p.string === 4 && p.fret === a);
      if (dup) positions = positions.filter((p) => (high ? !(p.string === 3 && p.fret === a + SPAN) : !(p.string === 4 && p.fret === a)));
      return { positions, stretch: Math.min(edge(a), edge(a + SPAN)) };
    }

    return semis.map((_, start) => {
      const f = 1 + mod(pcs[start] - TUNING[0] - 1, 12); // tasto 1–12 della 6ª corda
      let best = null;
      for (let a = Math.max(1, f - SPAN); a <= f; a++) {
        let lower = false;
        for (let x = a; x < f; x++) if (degreeAt(0, x) >= 0) lower = true;
        if (lower) continue;
        const w = windowAt(a, f);
        const rank = [w.stretch, Math.abs(a - (f - 1)), a];
        const d = best ? rank.findIndex((v, i) => v !== best.rank[i]) : 0;
        const better = !best || (d >= 0 && rank[d] < best.rank[d]);
        if (better) best = { ...w, rank };
      }
      const frets = best.positions.map((p) => p.fret);
      return { startDegree: start, positions: best.positions, minFret: Math.min(...frets), maxFret: Math.max(...frets) };
    });
  }

  const Guitar = { TUNING, STRING_NAMES, MAX_FRET, threeNpsPatterns, positionPatterns };

  if (typeof module !== 'undefined' && module.exports) module.exports = Guitar;
  else root.Guitar = Guitar;
})(typeof globalThis !== 'undefined' ? globalThis : this);
