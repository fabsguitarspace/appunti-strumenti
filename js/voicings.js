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
    { id: 'triad', label: 'Triadi strette', sets: [[3, 4, 5], [2, 3, 4], [1, 2, 3], [0, 1, 2]] },
    // ADR 0015: triadi late (spread), una corda saltata fra le due voci gravi.
    { id: 'spread', label: 'Triadi late', sets: [[0, 2, 3], [1, 3, 4], [2, 4, 5]] },
    { id: 'drop2', label: 'Drop 2', sets: [[2, 3, 4, 5], [1, 2, 3, 4], [0, 1, 2, 3]] },
    { id: 'drop3', label: 'Drop 3', sets: [[0, 2, 3, 4], [1, 3, 4, 5]] },
    // ADR 0015: drop 2 e 4 (drop 2&4) sulle corde 6–5–3–2 e 5–4–2–1.
    { id: 'drop24', label: 'Drop 2 e 4', sets: [[0, 1, 3, 4], [1, 2, 4, 5]] },
    // ADR 0015: senza fondamentale (rootless), note guida al basso.
    { id: 'rootless', label: 'Senza fondamentale', sets: [[2, 3, 4, 5], [1, 2, 3, 4]] },
    // ADR 0015, fase 3: colori costruiti con le tensioni della qualità (Chords: tensions, altered).
    { id: 'ust', label: 'Strutture superiori', sets: [[2, 3, 4, 5], [1, 2, 3, 4]] },
    { id: 'quartal', label: 'Per quarte', sets: [[3, 4, 5], [2, 3, 4], [2, 3, 4, 5], [1, 2, 3, 4], [1, 2, 3, 4, 5]] },
    { id: 'cluster', label: 'Cluster', sets: [[2, 3, 4, 5], [1, 2, 3, 4]] },
  ];

  /**
   * Strutture superiori (ADR 0015, punto 3): triadi maggiori sopra una nota guida, come
   * [semitoni dalla fondamentale, grado, alterata]. Le alterate solo con l'opzione «Tensioni
   * alterate». Niente semidiminuito: senza la ♭5 una triade sopra ♭3 o ♭7 suonerebbe come m7.
   */
  const MAJ_UST = [[2, 'II'], [7, 'V']];
  const MIN_UST = [[5, 'IV'], [10, '♭VII']];
  const DOM_UST = [[2, 'II'], [9, 'VI', true], [8, '♭VI', true], [6, '♭V', true]];
  const UST = {
    maj7: MAJ_UST, maj9: MAJ_UST, 6: MAJ_UST, 69: MAJ_UST,
    m7: MIN_UST, m9: MIN_UST, 7: DOM_UST, 9: DOM_UST,
  };
  /** Famiglie di colore: un elenco di voicing per qualità, non disposizioni per insieme di corde. */
  const COLOR = new Set(['ust', 'quartal', 'cluster']);
  const MAX_CLUSTERS = 4; // per insieme di corde (ADR 0015, punti aperti)

  /**
   * Note dei voicing senza fondamentale (ADR 0015): note guida più due colori fra 5, 9 e 13.
   * Sul dominante la tredicesima prende il posto della quinta; il semidiminuito tiene la ♭5 che
   * lo distingue dal m7 e aggiunge la nona naturale (ø9). Con le note guida al basso ogni
   * qualità ha due forme per gruppo di corde, come i tipi A e B dei pianisti. Le qualità assenti
   * (triadi, °7) non hanno la famiglia.
   */
  const ROOTLESS = {
    maj7: '3 5 7 9', 6: '3 5 6 9', m7: 'b3 5 b7 9', m6: 'b3 5 6 9', mmaj7: 'b3 5 7 9',
    7: '3 13 b7 9', m7b5: 'b3 b5 b7 9', '7s5': '3 #5 b7 9',
    maj9: '3 5 7 9', 69: '3 5 6 9', m9: 'b3 5 b7 9', m69: 'b3 5 6 9', mmaj9: 'b3 5 7 9',
    9: '3 13 b7 9', '7b9': '3 13 b7 b9',
  };

  const sameTone = (a, b) => a.number === b.number && a.alteration === b.alteration;

  /**
   * Note della qualità seguite dai colori dei voicing senza fondamentale che non ne fanno parte
   * (es. 13 nel dominante). Gli indici `tone` dei voicing si riferiscono a questa lista; i primi
   * coincidono con `q.tones`, così etichette e colori della fondamentale non cambiano.
   */
  function toneList(q) {
    const out = q.tones.slice();
    const pcs = new Set(out.map(pcOf));
    const add = (t) => { if (!pcs.has(pcOf(t))) { pcs.add(pcOf(t)); out.push(t); } };
    (ROOTLESS[q.id] || '').split(/\s+/).filter(Boolean).map(Chords.parseTone).forEach(add);
    // Fase 3: tensioni naturali e alterate, nell'ordine; una nota per classe di altezza.
    (q.tensions || []).forEach(add);
    (q.altered || []).forEach(add);
    return out;
  }

  function pcOf(t) { return mod(Chords.toneSemitones(t), 12); }

  /** Indice in toneList della classe di altezza `pc` (relativa alla fondamentale), o -1. */
  const indexOfPc = (list, pc) => list.findIndex((t) => pcOf(t) === mod(pc, 12));

  /** Classi di altezza (relative) delle note della qualità e delle tensioni naturali. */
  function naturalPcs(q) {
    return new Set(q.tones.concat(q.tensions || []).map(pcOf));
  }

  /** Note guida: terza e settima; la sesta se manca la settima. */
  function guidePcs(q) {
    const hasSeventh = q.tones.some((t) => t.number === 7);
    return q.tones.filter((t) => t.number === 3 || (hasSeventh ? t.number === 7 : t.number === 6)).map(pcOf);
  }

  /** Voicing di colore per qualità: [{ set, order (indici toneList), gaps?, alt?, upper? }]. */
  function colorJobs(q, fam) {
    if (q.tones.length < 4 || q.id === 'dim7' || !(q.tensions || []).length) return [];
    const list = toneList(q);
    const idx = (pc) => indexOfPc(list, pc);
    const guide = guidePcs(q);
    const natural = naturalPcs(q);
    const chordTone = (pc) => q.tones.some((t) => pcOf(t) === mod(pc, 12));
    const sets = family(fam).sets;
    const out = [];
    if (fam === 'ust') {
      for (const [r, upper, alt] of UST[q.id] || []) {
        const triad = [r, r + 4, r + 7].map((x) => mod(x, 12));
        if (triad.some((pc) => idx(pc) < 0)) continue;
        for (const bass of guide.filter((g) => !triad.includes(g))) {
          for (let k = 0; k < 3; k++) {
            const rot = [0, 1, 2].map((j) => triad[(k + j) % 3]);
            for (const set of sets) out.push({ set, order: [bass, ...rot].map(idx), alt: !!alt, upper, closeTop: true });
          }
        }
      }
      return out;
    }
    if (fam === 'quartal') {
      const stacks = { 3: [5, 5], 4: [5, 5, 5], 5: [5, 5, 5, 4] };
      for (const set of sets) {
        const gaps = stacks[set.length];
        for (const bass of natural) {
          if (!chordTone(bass)) continue;
          const pcs = gaps.reduce((acc, g) => acc.concat(mod(acc[acc.length - 1] + g, 12)), [bass]);
          if (!pcs.every((pc) => natural.has(pc))) continue;
          if (!guide.some((g) => pcs.includes(g))) continue;
          out.push({ set, order: pcs.map(idx), gaps });
        }
      }
      return out;
    }
    if (fam === 'cluster') {
      // Quattro classi di altezza fra note e tensioni naturali, note guida comprese; tutte le
      // disposizioni con il basso nota dell'accordo, filtrate dopo il posizionamento.
      const others = [...natural].filter((pc) => !guide.includes(pc));
      const need = 4 - guide.length;
      const combos = [];
      const pick = (start, acc) => {
        if (acc.length === need) { combos.push(guide.concat(acc)); return; }
        for (let i = start; i < others.length; i++) pick(i + 1, acc.concat(others[i]));
      };
      pick(0, []);
      const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.filter((_, j) => j !== i)).map((r) => [x, ...r])));
      for (const set of sets) {
        for (const c of combos) {
          for (const pcs of perms(c)) if (chordTone(pcs[0])) out.push({ set, order: pcs.map(idx), cluster: true });
        }
      }
      return out;
    }
    return [];
  }

  /**
   * Un voicing di cluster: almeno una seconda fra voci vicine, al più una seconda minore, nessuna
   * nona minore fra due voci qualsiasi.
   */
  function isCluster(midis) {
    const steps = midis.slice(1).map((m, i) => m - midis[i]);
    if (!steps.some((d) => d <= 2)) return false;
    if (steps.filter((d) => d === 1).length > 1) return false;
    for (let i = 0; i < midis.length; i++) for (let j = i + 1; j < midis.length; j++) if (midis[j] - midis[i] === 13) return false;
    return true;
  }

  /**
   * Tasti con intervalli esatti dal basso (voicing per quarte): il basso più grave sul manico da
   * cui tutte le voci stanno sulle loro corde, entro cinque tasti. null se non esiste.
   */
  function placeExact(bassPc, gaps, set) {
    for (let f = 1; f <= MAX_FRET; f++) {
      if (mod(TUNING[set[0]] + f, 12) !== mod(bassPc, 12)) continue;
      const midis = gaps.reduce((acc, g) => acc.concat(acc[acc.length - 1] + g), [TUNING[set[0]] + f]);
      const frets = midis.map((m, k) => m - TUNING[set[k]]);
      if (frets.some((x) => x < 1 || x > MAX_FRET)) continue;
      const lo = Math.min(...frets);
      const hi = Math.max(...frets);
      if (hi - lo <= SPAN) return { lo, hi, frets, midis };
    }
    return null;
  }

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
    if (COLOR.has(fam)) return colorJobs(q, fam);
    if (fam === 'triad') {
      if (n !== 3) return [];
      return [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
    }
    if (fam === 'spread') {
      // Triade stretta a b c → b a c: la voce centrale scende di un'ottava (drop 2 della triade).
      if (n !== 3) return [];
      return [[1, 0, 2], [2, 1, 0], [0, 2, 1]];
    }
    if (fam === 'rootless') {
      if (!ROOTLESS[q.id]) return [];
      const list = toneList(q);
      const four = ROOTLESS[q.id].split(/\s+/).map(Chords.parseTone)
        .map((t) => list.findIndex((x) => sameTone(x, t)));
      // Note guida: terza e settima (o sesta, se manca la settima).
      const guide = four.filter((i) => [3, 7].includes(list[i].number) ||
        (list[i].number === 6 && !list.some((x) => x.number === 7)));
      const out = [];
      for (let r = 0; r < 4; r++) {
        const [a, b, c, d] = [0, 1, 2, 3].map((k) => four[(r + k) % 4]);
        if (guide.includes(c)) out.push([c, a, b, d]); // drop 2 con una nota guida al basso
      }
      return out;
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
    // Posizione stretta (a b c d, dal basso) nei quattro rivolti; si abbassano di un'ottava le voci
    // contate dall'alto: drop 2 → c a b d, drop 3 → b a c d, drop 2 e 4 → a c b d.
    const out = [];
    for (let r = 0; r < 4; r++) {
      const [a, b, c, d] = [0, 1, 2, 3].map((k) => four[(r + k) % 4]);
      if (fam === 'drop2') out.push([c, a, b, d]);
      else if (fam === 'drop3') out.push([b, a, c, d]);
      else if (fam === 'drop24') out.push([a, c, b, d]);
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
  function voicings(q, rootPc, families = FAMILIES.map((f) => f.id), opts = {}) {
    const tones = toneList(q);
    const semis = tones.map((t) => mod(Chords.toneSemitones(t), 12));
    const out = [];
    for (const famId of families) {
      const fam = family(famId);
      if (!fam) continue;
      const list = orders(q, famId);
      const jobs = famId === 'shell'
        ? list.map((o) => ({ set: fam.sets[o.set], order: o.order }))
        : COLOR.has(famId) ? list.filter((j) => opts.alt || !j.alt)
          : fam.sets.flatMap((set) => (list.length && list[0].length === set.length ? list.map((order) => ({ set, order })) : []));
      const clusters = new Map();
      for (const job of jobs) {
        const { set, order } = job;
        // Nessuna tensione (nona) al basso.
        if (tones[order[0]].number > 7) continue;
        const pcs = order.map((t) => mod(rootPc + semis[t], 12));
        const p = job.gaps ? placeExact(pcs[0], job.gaps, set) : place(pcs, set);
        if (!p) continue;
        // Strutture superiori: la triade resta stretta sopra la nota guida.
        if (job.closeTop && p.midis[p.midis.length - 1] - p.midis[1] >= 12) continue;
        if (job.cluster) {
          if (!isCluster(p.midis)) continue;
          const kept = clusters.get(set) || new Map();
          kept.set(p.frets.join('.'), { job, p });
          clusters.set(set, kept);
          continue;
        }
        out.push(build(famId, set, order, p, job));
      }
      // Cluster: per insieme di corde i più raccolti (apertura minore, poi i più gravi).
      for (const [set, kept] of clusters) {
        const best = [...kept.values()].sort((a, b) => (a.p.hi - a.p.lo) - (b.p.hi - b.p.lo) ||
          a.p.lo - b.p.lo || a.p.midis[0] - b.p.midis[0]);
        for (const { job, p } of best.slice(0, MAX_CLUSTERS)) out.push(build(famId, set, job.order, p, job));
      }
    }
    return out;
  }

  function build(famId, set, order, p, job = {}) {
    const v = {
      family: famId,
      strings: set,
      label: setLabel(set),
      notes: set.map((s, k) => ({ string: s, fret: p.frets[k], midi: p.midis[k], tone: order[k] })),
      bass: order[0],
      top: order[order.length - 1],
      minFret: p.lo,
      maxFret: p.hi,
    };
    if (job.alt) v.alt = true;
    if (job.upper) v.upper = job.upper;
    return v;
  }

  /** Famiglie che hanno almeno un voicing per la qualità (le alterate contano). */
  function familiesFor(q) {
    return FAMILIES.filter((f) => (COLOR.has(f.id)
      ? voicings(q, 0, [f.id], { alt: true }).length > 0
      : orders(q, f.id).length > 0)).map((f) => f.id);
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

  const Voicings = { FAMILIES, ROOTLESS, toneList, family, setLabel, setFrom, sameSet, orders, place, voicings, familiesFor, shift, octaves, SPAN };

  if (isNode) module.exports = Voicings;
  else root.Voicings = Voicings;
})(globalThis);
