/**
 * Conduzione delle voci (ADR 0012): sceglie un voicing per ogni accordo di una sequenza con il
 * movimento complessivo minimo, con l'algoritmo di Viterbi come per le posizioni (ADR 0008).
 * Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  const BASS_WEIGHT = 0.25;

  /**
   * Movimento fra due voicing: semitoni percorsi dalle voci superiori, dal basso all'acuto, più un
   * quarto del salto del basso (il basso segue le fondamentali e può saltare; le voci interne no).
   */
  function movement(a, b) {
    const x = a.notes.map((n) => n.midi);
    const y = b.notes.map((n) => n.midi);
    const bass = BASS_WEIGHT * Math.abs(x[0] - y[0]);
    if (x.length !== y.length) return bass + Math.abs(x[x.length - 1] - y[y.length - 1]) + 6;
    return bass + x.slice(1).reduce((sum, m, i) => sum + Math.abs(m - y[i + 1]), 0);
  }

  /**
   * @param candidates  per ogni accordo l'elenco dei voicing ammessi
   * @param opts        { zone: [lo, hi] tasti preferiti, zoneWeight, shiftWeight,
   *                      cost(v): costo proprio di un voicing (es. basso diverso dalla fondamentale) }
   * @returns           un voicing per accordo (null se un accordo non ha candidati)
   */
  function lead(candidates, opts = {}) {
    if (!candidates.length || candidates.some((c) => !c.length)) return null;
    const [lo, hi] = opts.zone || [1, 20];
    const zoneW = opts.zoneWeight ?? 4;
    const shiftW = opts.shiftWeight ?? 0.3;
    // Uscire dalla zona costa per tasto; spostare la mano costa un poco per tasto.
    const outside = (v) => Math.max(0, lo - v.minFret) + Math.max(0, v.maxFret - hi);
    const layers = [];
    candidates.forEach((cands, i) => {
      const prev = layers[i - 1];
      layers.push(cands.map((v) => {
        const own = zoneW * outside(v) + (opts.cost ? opts.cost(v) : 0);
        if (!prev) return { v, cost: own + 0.01 * v.minFret, back: -1 };
        let best = Infinity;
        let arg = 0;
        prev.forEach((p, j) => {
          const c = p.cost + movement(p.v, v) + shiftW * Math.abs(p.v.minFret - v.minFret);
          if (c < best - 1e-9) { best = c; arg = j; }
        });
        return { v, cost: best + own, back: arg };
      }));
    });
    const last = layers[layers.length - 1];
    let j = 0;
    last.forEach((s, k) => { if (s.cost < last[j].cost - 1e-9) j = k; });
    const out = new Array(layers.length);
    for (let i = layers.length - 1; i >= 0; i--) { out[i] = layers[i][j].v; j = layers[i][j].back; }
    return out;
  }

  const VoiceLeading = { movement, lead };

  if (isNode) module.exports = VoiceLeading;
  else root.VoiceLeading = VoiceLeading;
})(globalThis);
