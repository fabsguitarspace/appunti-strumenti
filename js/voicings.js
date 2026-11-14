/**
 * Voicing per chitarra (ADR 0010 punto 4, ADR 0012): famiglie del capitolo «Accordi» del volume,
 * generate dalle formule delle qualità (js/chords.js). Ogni voicing è una disposizione delle note
 * dal basso all'acuto su un insieme di corde, una nota per corda, entro cinque tasti.
 * Convenzioni del volume: niente corde a vuoto, nessuna tensione al basso. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Chords = isNode ? require('./chords.js') : root.Chords;
  const Guitar = isNode ? require('./guitar.js') : root.Guitar;
  const { TUNING } = Guitar;

  const mod = (a, n) => ((a % n) + n) % n;
  const SPAN = 4;       // tasti fra il più basso e il più alto: finestra di cinque tasti
  const MAX_FRET = 20;

  /**
   * Famiglie e insiemi di corde (indici 0 = 6ª corda … 5 = 1ª). `label` è il nome da chitarrista,
   * dalla corda più grave. Gli id compaiono nei deep link (`fam`, `set`): non si rinominano.
   */
  const FAMILIES = [
    { id: 'shell', label: 'Shell', sets: [[0, 2, 3], [1, 2, 3]] },
    { id: 'drop2', label: 'Drop 2', sets: [[2, 3, 4, 5], [1, 2, 3, 4]] },
    { id: 'drop3', label: 'Drop 3', sets: [[0, 2, 3, 4], [1, 3, 4, 5]] },
    { id: 'triad', label: 'Triadi strette', sets: [[3, 4, 5], [2, 3, 4], [1, 2, 3], [0, 1, 2]] },
  ];

  const family = (id) => FAMILIES.find((f) => f.id === id);
  /** "4321" ↔ [2,3,4,5]: corde da chitarrista, dalla più grave. */
  const setLabel = (set) => set.map((s) => 6 - s).join('');
  const setFrom = (label) => String(label).split('').map((c) => 6 - Number(c));
  const sameSet = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /**
   * Note su cui si costruiscono i voicing a quattro voci: le quattro note dell'arpeggio; negli
   * accordi di nona la nona sostituisce la fondamentale (3 5 7 9, come nel comping), così la
   * tensione resta nelle voci superiori. Restituisce indici nelle note della qualità.
   */
  function fourTones(q) {
    if (q.tones.length === 4) return [0, 1, 2, 3];
    if (q.tones.length === 5) return [1, 2, 3, 4];
    return null;
  }

  /** Disposizioni (dal basso, indici nelle note della qualità) di una famiglia. */
  function orders(q, fam) {
    const n = q.tones.length;
    if (fam === 'triad') {
      if (n !== 3) return [];
      return [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    }
    if (fam === 'shell') {
      // Tre voci: fondamentale, terza e settima (o sesta), quinta omessa; il diminuito no
      // (capitolo 6: «evita di applicare automaticamente la regola togli la quinta»).
      if (n !== 4 || q.id === 'dim7') return [];
      return [
        { set: 0, order: [0, 3, 1] }, // R–7–3 sulla 6ª corda
        { set: 1, order: [0, 1, 3] }, // R–3–7 sulla 5ª corda
        { set: 1, order: [1, 3, 0] }, // basso di terza: 3–7–R
        { set: 0, order: [2, 1, 3] }, // basso di quinta, senza fondamentale: 5–3–7
        { set: 1, order: [2, 3, 1] }, //                                    5–7–3
      ];
    }
    const four = fourTones(q);
    if (!four) return [];
    // Posizione stretta (a b c d, dal basso) nei quattro rivolti; drop 2 → c a b d, drop 3 → b a c d.
    const out = [];
    for (let r = 0; r < 4; r++) {
      const [a, b, c, d] = [0, 1, 2, 3].map((k) => four[(r + k) % 4]);
      out.push(fam === 'drop2' ? [c, a, b, d] : [b, a, c, d]);
    }
    return out;
  }

  /**
   * Tasti per una disposizione su un insieme di corde: per ogni corda il tasto (1–20) con la classe
   * di altezza giusta; fra le combinazioni (tasto o tasto + 12) quella più grave con le altezze in
   * ordine crescente ed entro cinque tasti. null se non esiste.
   */
  function place(pcs, set) {
    const cands = set.map((s, k) => {
      const f = 1 + mod(pcs[k] - TUNING[s] - 1, 12);
      return [f, f + 12].filter((x) => x <= MAX_FRET);
    });
    let best = null;
    const walk = (k, frets) => {
      if (k === set.length) {
        const lo = Math.min(...frets);
        const hi = Math.max(...frets);
        if (hi - lo > SPAN) return;
        const midis = frets.map((f, i) => TUNING[set[i]] + f);
        for (let i = 1; i < midis.length; i++) if (midis[i] <= midis[i - 1]) return;
        if (!best || lo < best.lo) best = { lo, hi, frets: [...frets], midis };
        return;
      }
      for (const f of cands[k]) walk(k + 1, [...frets, f]);
    };
    walk(0, []);
    return best;
  }

  /**
   * Tutti i voicing di una qualità con fondamentale `rootPc`.
   * @returns [{ family, strings, label, notes: [{string, fret, midi, tone}], bass, top,
   *             minFret, maxFret }] con `tone` = indice nelle note della qualità.
   */
  function voicings(q, rootPc, families = FAMILIES.map((f) => f.id)) {
    const semis = Chords.semitones(q);
    const out = [];
    for (const famId of families) {
      const fam = family(famId);
      if (!fam) continue;
      const list = orders(q, famId);
      const jobs = famId === 'shell'
        ? list.map((o) => ({ set: fam.sets[o.set], order: o.order }))
        : fam.sets.flatMap((set) => (list.length && list[0].length === set.length ? list.map((order) => ({ set, order })) : []));
      for (const { set, order } of jobs) {
        // Nessuna tensione (nona) al basso.
        if (q.tones[order[0]].number > 7) continue;
        const p = place(order.map((t) => mod(rootPc + semis[t], 12)), set);
        if (!p) continue;
        out.push({
          family: famId,
          strings: set,
          label: setLabel(set),
          notes: set.map((s, k) => ({ string: s, fret: p.frets[k], midi: p.midis[k], tone: order[k] })),
          bass: order[0],
          top: order[order.length - 1],
          minFret: p.lo,
          maxFret: p.hi,
        });
      }
    }
    return out;
  }

  /** Famiglie che hanno almeno un voicing per la qualità. */
  function familiesFor(q) {
    return FAMILIES.filter((f) => orders(q, f.id).length > 0).map((f) => f.id);
  }

  /** Lo stesso voicing trasportato di `semitones` (stesse corde, tasti spostati), se sta sul manico. */
  function shift(v, semitones) {
    const notes = v.notes.map((n) => ({ ...n, fret: n.fret + semitones, midi: n.midi + semitones }));
    if (notes.some((n) => n.fret < 1 || n.fret > MAX_FRET)) return null;
    return { ...v, notes, minFret: v.minFret + semitones, maxFret: v.maxFret + semitones };
  }

  /** Il voicing in tutte le ottave che stanno sul manico (stessa forma, ±12 tasti). */
  function octaves(v) {
    return [-12, 0, 12].map((d) => (d ? shift(v, d) : v)).filter(Boolean);
  }

  const Voicings = { FAMILIES, family, setLabel, setFrom, sameSet, orders, place, voicings, familiesFor, shift, octaves, SPAN };

  if (isNode) module.exports = Voicings;
  else root.Voicings = Voicings;
})(globalThis);
