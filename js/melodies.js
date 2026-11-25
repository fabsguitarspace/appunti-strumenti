/**
 * Melodie generate sulle griglie (ADR 0018, punto 5): una linea di altezze sopra la linea del tempo
 * di `Progression.realize`, con un ritmo a celle di una battuta. Deterministiche: lo stesso
 * esercizio (e lo stesso seme) dà sempre la stessa melodia. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('./theory.js') : root.Theory;
  const Chords = isNode ? require('./chords.js') : root.Chords;
  const Guitar = isNode ? require('./guitar.js') : root.Guitar;

  const { TUNING } = Guitar;
  const mod = (a, n) => ((a % n) + n) % n;
  const EPS = 1e-9;

  /**
   * Linee (id pubblici, link `line`). Rilascio 1a: nota comune, note guida, toni dell'accordo.
   * `passing` e `dim6` arrivano con il rilascio 1b.
   */
  const LINES = [
    { id: 'common', label: 'Nota comune', note: 'La stessa nota finché l\'accordo la contiene, poi la più vicina: le voci sotto cambiano, il canto resta.' },
    { id: 'guide', label: 'Note guida', note: 'Terze e settime con il movimento minimo: la melodia più semplice che fa sentire ogni accordo.' },
    { id: 'tones', label: 'Toni dell\'accordo', note: 'Una nota dell\'accordo per attacco, per grado o per piccoli salti: ogni nota chiede una forma diversa.' },
  ];

  /**
   * Celle ritmiche di una battuta in 4/4 (link `cell`): attacchi [battito, durata]. «Variata»
   * sceglie una cella per battuta con il seme, fra quelle con al più tre attacchi.
   */
  const CELLS = [
    { id: 'whole', label: 'Semibreve', onsets: [[0, 4]] },
    { id: 'halves', label: 'Due minime', onsets: [[0, 2], [2, 2]] },
    { id: 'dotted', label: 'Minima puntata e semiminima', onsets: [[0, 3], [3, 1]] },
    { id: 'half-quarters', label: 'Minima e due semiminime', onsets: [[0, 2], [2, 1], [3, 1]] },
    { id: 'charleston', label: 'Charleston', onsets: [[0, 1.5], [1.5, 2.5]] },
    { id: 'quarters', label: 'Quattro semiminime', onsets: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  ];
  const VARY = ['whole', 'halves', 'dotted', 'half-quarters', 'charleston'];

  const line = (id) => LINES.find((l) => l.id === id);
  const cell = (id) => CELLS.find((c) => c.id === id);

  /** Registro della melodia per corda (ADR 0018): 1ª, 2ª o entrambe, tasti 1–17. */
  const STRINGS = { 1: [5], 2: [4], 12: [4, 5] };
  function range(string) {
    const ss = STRINGS[string] || STRINGS[1];
    return [Math.min(...ss.map((s) => TUNING[s] + 1)), Math.max(...ss.map((s) => TUNING[s] + 17))];
  }

  /** Generatore con seme (mulberry32, come Rhythms). */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Indice del segmento della linea del tempo in vigore al battito. */
  function segAt(tl, beat) {
    let k = 0;
    while (k + 1 < tl.length && tl[k + 1].beat <= beat + EPS) k++;
    return k;
  }

  /**
   * Attacchi della melodia: le celle battuta per battuta, più un attacco a ogni cambio d'accordo,
   * così nessuna nota attraversa il cambio. @returns [{ beat, dur, seg }]
   */
  function onsets(real, cellId, seed) {
    const tl = real.timeline;
    const rand = rng(seed);
    const beats = new Set();
    for (let bar = 0; bar * 4 < real.beats - EPS; bar++) {
      const id = cellId === 'vary' ? VARY[Math.floor(rand() * VARY.length)] : (cell(cellId) ? cellId : 'whole');
      for (const [b] of cell(id).onsets) beats.add(bar * 4 + b);
    }
    for (const seg of tl) beats.add(seg.beat);
    const list = [...beats].sort((a, b) => a - b);
    return list.map((beat, i) => ({ beat, dur: (i + 1 < list.length ? list[i + 1] : real.beats) - beat, seg: segAt(tl, beat) }));
  }

  /** Classi di altezza assolute: note dell'accordo, tensioni naturali, note guida. */
  function pcsOf(chord) {
    const pc = Theory.pitchClass(chord.root);
    const q = chord.quality;
    const abs = (t) => mod(pc + Chords.toneSemitones(t), 12);
    const hasSeventh = q.tones.some((t) => t.number === 7);
    return {
      tones: q.tones.map(abs),
      tensions: (q.tensions || []).map(abs),
      guide: q.tones.filter((t) => t.number === 3 || (hasSeventh ? t.number === 7 : t.number === 6)).map(abs),
    };
  }

  /** Altezze ammesse per una nota della linea, con il costo proprio. */
  function statesFor(lineId, chord, lo, hi) {
    const p = pcsOf(chord);
    const out = [];
    for (let m = lo; m <= hi; m++) {
      const x = mod(m, 12);
      if (lineId === 'guide') { if (p.guide.includes(x)) out.push({ midi: m, own: 0 }); continue; }
      if (p.tones.includes(x)) out.push({ midi: m, own: 0 });
      else if (lineId === 'common' && p.tensions.includes(x)) out.push({ midi: m, own: 1.5 });
    }
    return out;
  }

  /** Costo di transizione fra due altezze consecutive della linea. */
  function step(lineId, a, b, sameChord) {
    const d = Math.abs(a - b);
    if (lineId === 'common') return d;
    if (lineId === 'guide') return d;
    // Toni dell'accordo: muoversi, per grado o piccoli salti; ribattere la nota costa.
    return d + (d === 0 ? (sameChord ? 4 : 2) : 0) + (d > 7 ? d : 0);
  }

  /**
   * Melodia sulla progressione realizzata.
   * @param real  risultato di Progression.realize
   * @param o     { line, cell ('whole' … o 'vary'), seed, string (1, 2, 12),
   *               accept(onset, midi): facoltativo, false esclude un'altezza (es. senza voicing) }
   * @returns [{ beat, dur, midi, seg, role: 'chord' }] (vuota se una nota non ha altezze ammesse)
   */
  function build(real, o = {}) {
    const lineId = line(o.line) ? o.line : 'guide';
    const [lo, hi] = range(o.string);
    const mid = (lo + hi) / 2;
    const tl = real.timeline;
    const ons = onsets(real, o.cell || 'whole', o.seed || 1);
    const layers = ons.map((x) => {
      const all = statesFor(lineId, tl[x.seg].chord, lo, hi);
      const ok = o.accept ? all.filter((st) => o.accept(x, st.midi)) : all;
      return ok.length ? ok : all;
    });
    if (!layers.length || layers.some((l) => !l.length)) return [];
    const dp = [];
    layers.forEach((states, i) => {
      dp.push(states.map((st) => {
        if (i === 0) return { st, cost: st.own + 0.15 * Math.abs(st.midi - mid), back: -1 };
        const same = ons[i].seg === ons[i - 1].seg;
        let best = Infinity;
        let arg = 0;
        dp[i - 1].forEach((p, j) => {
          const c = p.cost + step(lineId, p.st.midi, st.midi, same);
          if (c < best - EPS) { best = c; arg = j; }
        });
        return { st, cost: best + st.own, back: arg };
      }));
    });
    const last = dp[dp.length - 1];
    let j = 0;
    last.forEach((x, k) => { if (x.cost < last[j].cost - EPS) j = k; });
    const out = new Array(dp.length);
    for (let i = dp.length - 1; i >= 0; i--) {
      out[i] = { ...ons[i], midi: dp[i][j].st.midi, role: 'chord' };
      j = dp[i][j].back;
    }
    return out;
  }

  const Melodies = { LINES, CELLS, STRINGS, line, cell, range, rng, onsets, pcsOf, build };

  if (isNode) module.exports = Melodies;
  else root.Melodies = Melodies;
})(globalThis);
