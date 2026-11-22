/**
 * Strumento Ritmi (ADR 0016): catalogo delle figure ritmiche e loro realizzazione sulle battute
 * di 4/4. Una figura è una sequenza di «gironi» (span): `beats` pulsazioni divise in `div` celle
 * uguali; ogni cella è un attacco (`x`), il prolungamento della nota precedente (`-`) o una pausa
 * (`.`). Così crome, terzine, terzine di semiminima, quintine, settimine e nonine stanno nello
 * stesso modello, e la griglia, l'audio e il conteggio derivano dagli stessi dati.
 *
 * Le famiglie seguono le sezioni della pagina «Ritmo melodico» del volume (gruppi di note
 * consecutive spostati nella battuta, note per battuta, figure in 3/4, 5/4 e 7/4 sopra il 4/4,
 * «marce» e cambi di marcia); le figure sono originali.
 * Modulo puro: si carica anche in Node per i test.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  /** Tick per pulsazione: minimo comune multiplo di 1…9, così ogni divisione del catalogo è intera. */
  const TPB = 2520;
  const METER = 4;
  const BAR = METER * TPB;
  const MAX_BARS = 32;

  const FAMILIES = [
    { id: 'crome', label: 'Crome consecutive' },
    { id: 'terzine', label: 'Terzine consecutive' },
    { id: 'semicrome', label: 'Semicrome consecutive' },
    { id: 'note-battuta', label: 'Note per battuta' },
    { id: 'battuta', label: 'Ritmi di una battuta' },
    { id: 'sovrapposizioni', label: 'Cicli di 3, 5 e 7 pulsazioni' },
    { id: 'marce', label: 'Marce' },
    { id: 'cambi', label: 'Cambi di marcia' },
  ];
  const family = (id) => FAMILIES.find((f) => f.id === id);

  /** Celle per pulsazione delle famiglie a note consecutive. */
  const GRID = { crome: 2, terzine: 3, semicrome: 4 };

  const NUMBERS = ['', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ------------------------------------------------------------ Figure di base

  /** Gironi di una pulsazione divisa in `div`, dalle celle scritte una dopo l'altra. */
  function beatsOf(cells, div) {
    const out = [];
    for (let i = 0; i < cells.length; i += div) out.push({ beats: 1, div, cells: cells.slice(i, i + div) });
    return out;
  }

  /** Gironi uguali e pieni: `count` volte `beats` pulsazioni divise in `div`. */
  const even = (beats, div, count) => Array.from({ length: count }, () => ({ beats, div, cells: 'x'.repeat(div) }));

  // Ritmi di una battuta (crome e semiminime, otto celle): originali.
  const ONE_BAR = [
    ['battere', 'Semiminime in battere', 'x-x-x-x-'],
    ['levare', 'Semiminime in levare', '.x-x-x-x'],
    ['charleston', 'Charleston', 'x--x----'],
    ['charleston-levare', 'Charleston in levare', '.x--x---'],
    ['risposta', 'Pausa, poi tre crome', '..xxx-..'],
    ['sincope', 'Sincope sul due', 'x-.x-x-.'],
    ['anticipo', 'Anticipo sull\'«e» del quattro', 'x-x-x--x'],
    ['domanda', 'Due crome e una minima', 'xx.x---.'],
    ['cascata', 'Crome che si fermano sul tre', 'xxxxx---'],
    ['rimbalzo', 'Croma, semiminima, croma', 'xx-xx-x.'],
    ['controtempo', 'Tutte in levare', '.x.x.x.x'],
    ['eco', 'Eco a metà battuta', 'x-x...x.'],
    ['arrivo', 'Arrivo sul quattro', '...xx.x-'],
    ['spinta', 'Spinta verso la battuta dopo', '.xx-.xxx'],
  ];

  // Cicli più lunghi o più corti della battuta (crome): il ciclo torna sull'uno dopo 3, 5 o 7 battute.
  const CYCLES = [
    ['ciclo-3a', 'Ciclo di 3: quattro crome e pausa', 3, 'xxxx..'],
    ['ciclo-3b', 'Ciclo di 3: semiminima puntata', 3, 'x--xx-'],
    ['ciclo-3c', 'Ciclo di 3: in levare', 3, '.xx.x-'],
    ['ciclo-3d', 'Ciclo di 3: tre semiminime', 3, 'x-x-x-'],
    ['ciclo-5a', 'Ciclo di 5: tre più due', 5, 'xxx.x-xx..'],
    ['ciclo-5b', 'Ciclo di 5: puntate e crome', 5, 'x--x-.xx.x'],
    ['ciclo-7a', 'Ciclo di 7: quattro più tre', 7, 'xxxx.x-x-xx.x.'],
    ['ciclo-7b', 'Ciclo di 7: frasi brevi', 7, 'x-xx.x--.xxx-.'],
  ];

  // Marce: la stessa quantità di note distribuite in modo uniforme (note per battuta).
  const GEARS = [
    ['marcia-5', 'Cinque note per battuta', [[4, 5, 1]]],
    ['marcia-6', 'Terzine di semiminima', [[2, 3, 2]]],
    ['marcia-7', 'Sette note per battuta', [[4, 7, 1]]],
    ['marcia-8', 'Crome', [[1, 2, 4]]],
    ['marcia-9', 'Nove note per battuta', [[4, 9, 1]]],
    ['marcia-10', 'Quintine di croma', [[2, 5, 2]]],
    ['marcia-12', 'Terzine di croma', [[1, 3, 4]]],
    ['marcia-14', 'Settimine di croma', [[2, 7, 2]]],
    ['marcia-16', 'Semicrome', [[1, 4, 4]]],
    ['marcia-20', 'Quintine di semicroma', [[1, 5, 4]]],
    ['marcia-24', 'Sestine', [[1, 6, 4]]],
  ];

  // Cambi di marcia: due battute, o metà battuta, per marcia.
  const SHIFTS = [
    ['crome-terzine', 'Crome e terzine', [[1, 2, 4], [1, 3, 4]]],
    ['terzine-semicrome', 'Terzine e semicrome', [[1, 3, 4], [1, 4, 4]]],
    ['semicrome-sestine', 'Semicrome e sestine', [[1, 4, 4], [1, 6, 4]]],
    ['terzine-quintine', 'Terzine e quintine di croma', [[1, 3, 4], [2, 5, 2]]],
    ['semiminima3-crome', 'Terzine di semiminima e crome', [[2, 3, 2], [1, 2, 4]]],
    ['mezza-battuta', 'Crome e terzine ogni due pulsazioni', [[1, 2, 2], [1, 3, 2], [1, 4, 2], [1, 3, 2]]],
    ['semicrome-settimine', 'Semicrome e settimine', [[1, 4, 4], [2, 7, 2]]],
  ];

  const spansOf = (list) => list.flatMap(([beats, div, count]) => even(beats, div, count));

  function buildCatalog() {
    const items = [];
    for (const [fam, div] of Object.entries(GRID)) {
      const sizes = fam === 'semicrome' ? [3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7];
      const noun = { crome: 'crome', terzine: 'note di terzina', semicrome: 'semicrome' }[fam];
      for (const n of sizes) {
        items.push({ id: `${fam}-${n}`, family: fam, kind: 'consecutive', size: n, div,
          label: `${cap(NUMBERS[n])} ${noun} consecutive` });
      }
    }
    for (let n = 1; n <= 7; n++) {
      items.push({ id: `note-${n}`, family: 'note-battuta', kind: 'perbar', size: n, div: 2,
        label: n === 1 ? 'Una nota per battuta' : `${cap(NUMBERS[n])} note per battuta` });
    }
    for (const [id, label, cells] of ONE_BAR) {
      items.push({ id, family: 'battuta', kind: 'fixed', label, spans: beatsOf(cells, 2) });
    }
    for (const [id, label, beats, cells] of CYCLES) {
      if (cells.length !== beats * 2) throw new Error('ciclo non valido: ' + id);
      items.push({ id, family: 'sovrapposizioni', kind: 'fixed', label, spans: beatsOf(cells, 2), cycle: beats });
    }
    for (const [id, label, list] of GEARS) {
      items.push({ id, family: 'marce', kind: 'fixed', label, spans: spansOf(list) });
    }
    for (const [id, label, list] of SHIFTS) {
      items.push({ id, family: 'cambi', kind: 'fixed', label, spans: spansOf(list) });
    }
    return items;
  }

  const CATALOG = buildCatalog();
  const catalog = () => CATALOG;
  const byId = (id) => CATALOG.find((r) => r.id === id) || null;

  // ------------------------------------------------------------ Impostazioni

  /** Partenza delle note consecutive: posizione nella battuta (1…celle), in sequenza o casuale. */
  const START_MODES = ['seq', 'rand'];
  const OMIT = [['none', 'Tutte le note'], ['one', 'Togli una nota per gruppo'], ['rand', 'Pause casuali']];
  const ACCENTS = [['auto', 'Secondo la figura'], ['group', 'Inizio di ogni gruppo'], ['cycle', 'Inizio del ciclo'],
    ['beat', 'Sulle pulsazioni'], ['none', 'Nessuno']];

  /** Generatore pseudocasuale riproducibile (mulberry32): lo stesso seme dà la stessa figura. */
  function rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => a / gcd(a, b) * b;

  /** Nome della posizione nella battuta: «1», «e del 2», «2ª terzina del 3»… */
  function positionName(pos, div) {
    const beat = Math.floor(pos / div) + 1;
    const k = pos % div;
    if (k === 0) return String(beat);
    if (div === 2) return `«e» del ${beat}`;
    return `${k + 1}ª ${div === 3 ? 'nota di terzina' : 'semicroma'} del ${beat}`;
  }

  // ------------------------------------------------------------ Generatori

  /** Celle di `bars` battute, tutte pause, sulla griglia di `div` celle per pulsazione. */
  const blank = (bars, div) => Array(bars * METER * div).fill('.');

  /** Un gruppo di `n` attacchi da `pos`: una battuta, o due se attraversa la stanghetta. */
  function consecutiveAt(n, pos, div) {
    const per = METER * div;
    const bars = pos + n > per ? 2 : 1;
    const cells = blank(bars, div);
    for (let k = 0; k < n; k++) cells[pos + k] = 'x';
    return cells;
  }

  /**
   * Note consecutive: partenza fissa (indice di cella), in sequenza (tutte le partenze, una figura
   * dopo l'altra) o casuale (gruppi con pause di lunghezza variabile per `bars` battute).
   */
  function consecutive(item, s, bars) {
    const div = item.div;
    const per = METER * div;
    const n = item.size;
    if (s.start === 'seq') {
      let cells = [];
      for (let p = 0; p < per; p++) cells = cells.concat(consecutiveAt(n, p, div));
      return { cells, div, cycleBars: cells.length / per, random: false };
    }
    if (s.start === 'rand') {
      const r = rng(s.seed);
      const cells = blank(bars, div);
      let t = Math.floor(r() * div * 2);
      while (t + n <= cells.length) {
        for (let k = 0; k < n; k++) cells[t + k] = 'x';
        t += n + 1 + Math.floor(r() * div * 2);
      }
      return { cells, div, cycleBars: bars, random: true };
    }
    const pos = Math.max(0, Math.min(per - 1, Number(s.start) || 0));
    const cells = consecutiveAt(n, pos, div);
    return { cells, div, cycleBars: cells.length / per, random: false };
  }

  /** `n` attacchi in una battuta di crome: posizioni casuali, note lunghe o seguite da pause. */
  function barWith(n, r) {
    const slots = [...Array(8).keys()];
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const on = slots.slice(0, n).sort((a, b) => a - b);
    const cells = Array(8).fill('.');
    on.forEach((p, i) => {
      cells[p] = 'x';
      const next = i + 1 < on.length ? on[i + 1] : 8;
      if (r() < 0.6) for (let k = p + 1; k < next; k++) cells[k] = '-';
    });
    return cells;
  }

  /** Note per battuta: lo stesso ritmo in ogni battuta oppure un ritmo nuovo per battuta. */
  function perBar(item, s, bars) {
    const r = rng(s.seed);
    if (!s.vary) return { cells: barWith(item.size, r), div: 2, cycleBars: 1, random: true };
    let cells = [];
    for (let b = 0; b < bars; b++) cells = cells.concat(barWith(item.size, r));
    return { cells, div: 2, cycleBars: bars, random: true };
  }

  /** Celle → gironi di una pulsazione. */
  const toSpans = (g) => beatsOf(g.cells.join(''), g.div);

  /** Togli note: una per girone (mai la prima) oppure circa una su quattro, con il seme. */
  function omit(spans, mode, seed) {
    if (mode !== 'one' && mode !== 'rand') return spans;
    const r = rng((Number(seed) || 1) * 7 + 3);
    return spans.map((sp) => {
      const cells = sp.cells.split('');
      const on = cells.map((c, i) => (c === 'x' && i > 0 ? i : -1)).filter((i) => i >= 0);
      if (mode === 'one') {
        if (on.length >= 2) cells[on[Math.floor(r() * on.length)]] = '.';
      } else {
        for (const i of on) if (r() < 0.25) cells[i] = '.';
      }
      return { ...sp, cells: cells.join('') };
    });
  }

  const spanTicks = (sp) => sp.beats * TPB;
  const totalBeats = (spans) => spans.reduce((a, sp) => a + sp.beats, 0);

  /**
   * Ciclo della figura con le impostazioni: { spans, cycleBeats, random }.
   * @param s  { start, seed, vary, omit }; `bars` battute per le figure casuali.
   */
  function cycleOf(item, s = {}, bars = 4) {
    let spans;
    let random = false;
    if (item.kind === 'consecutive') {
      const g = consecutive(item, s, bars);
      spans = toSpans(g);
      random = g.random;
    } else if (item.kind === 'perbar') {
      const g = perBar(item, s, bars);
      spans = toSpans(g);
      random = true;
    } else {
      spans = item.spans.map((sp) => ({ ...sp }));
    }
    if (s.omit && s.omit !== 'none') { spans = omit(spans, s.omit, s.seed); random = true; }
    return { spans, cycleBeats: totalBeats(spans), random };
  }

  /** Battute del ciclo, arrotondate alla battuta intera (un ciclo di 3 pulsazioni torna dopo 3 battute). */
  const cycleBars = (cycleBeats) => lcm(cycleBeats, METER) / METER;

  /**
   * Realizza la figura su `bars` battute di 4/4, ripetendo il ciclo senza interruzioni.
   * Un girone di più pulsazioni non attraversa la stanghetta (il catalogo lo garantisce).
   * @returns { bars: [{ spans: [{ beats, div, cells, start (tick), cycleStart }] }],
   *            attacks: [{ i, tick, len, cell, accent, group, cycleStart, bar }],
   *            rests: [{ tick, len }], lengthBeats }
   */
  function realize(cycle, bars, opts = {}) {
    const flat = [];
    let t = 0;
    let k = 0;
    const end = bars * BAR;
    while (t < end && cycle.spans.length) {
      const sp = cycle.spans[k % cycle.spans.length];
      flat.push({ ...sp, start: t, cycleStart: k % cycle.spans.length === 0 });
      t += spanTicks(sp);
      k++;
    }
    const outBars = Array.from({ length: bars }, () => ({ spans: [] }));
    for (const sp of flat) {
      const b = Math.floor(sp.start / BAR);
      if (b < bars) outBars[b].spans.push(sp);
    }

    // Celle in fila: attacchi, prolungamenti e pause.
    const cells = [];
    flat.forEach((sp, si) => {
      const len = spanTicks(sp) / sp.div;
      for (let c = 0; c < sp.div; c++) {
        cells.push({ tick: sp.start + c * len, len, ch: sp.cells[c], span: si, c,
          cycleStart: sp.cycleStart && c === 0 });
      }
    });

    // Pause: celle '.' consecutive dentro lo stesso girone (servono alla tablatura).
    const rests = [];
    for (const cell of cells) {
      if (cell.ch !== '.') continue;
      const last = rests[rests.length - 1];
      if (last && last.span === cell.span && last.tick + last.len === cell.tick) last.len += cell.len;
      else rests.push({ tick: cell.tick, len: cell.len, span: cell.span });
    }

    const accent = opts.accent || 'group';
    const attacks = [];
    let group = -1;
    let prevAttack = false;
    let prevEnd = -1;
    let cycleMark = false;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.cycleStart) cycleMark = true;
      if (cell.ch !== 'x') {
        if (cell.ch === '.') prevAttack = false;
        continue;
      }
      let len = cell.len;
      for (let j = i + 1; j < cells.length && cells[j].ch === '-'; j++) len += cells[j].len;
      const newGroup = !prevAttack || cell.tick !== prevEnd;
      if (newGroup) group++;
      const onBeat = cell.tick % TPB === 0;
      let acc = false;
      if (accent === 'group') acc = newGroup;
      else if (accent === 'cycle') acc = cycleMark;
      else if (accent === 'beat') acc = onBeat;
      attacks.push({
        i: attacks.length, tick: cell.tick, len, cell: cell.len, accent: acc, group,
        cycleStart: cycleMark, bar: Math.floor(cell.tick / BAR), span: cell.span, c: cell.c,
      });
      cycleMark = false;
      prevAttack = true;
      prevEnd = cell.tick + len;
    }
    return { bars: outBars, attacks, rests, lengthBeats: bars * METER };
  }

  /** Accento predefinito della famiglia. */
  function autoAccent(item) {
    if (item.family === 'sovrapposizioni') return 'cycle';
    if (item.family === 'marce' || item.family === 'cambi') return 'beat';
    return 'group';
  }

  /**
   * Durata dell'esercizio in battute: il ciclo della figura, oppure il minimo comune multiplo con
   * la base. Oltre MAX_BARS si tiene la base e la figura riparte a ogni giro (`restart`).
   */
  function lengthFor(cycleBeats, baseBars) {
    const fig = cycleBars(cycleBeats);
    if (!baseBars) return { bars: Math.min(fig, MAX_BARS), restart: fig > MAX_BARS };
    const both = lcm(fig, baseBars);
    if (both <= MAX_BARS) return { bars: both, restart: false };
    return { bars: baseBars, restart: true };
  }

  // ------------------------------------------------------------ Testi

  /** Quanti attacchi ha il ciclo e quanto dura, in parole. */
  function describe(item, cycle) {
    const attacks = cycle.spans.reduce((a, sp) => a + [...sp.cells].filter((c) => c === 'x').length, 0);
    const beats = cycle.cycleBeats;
    const bars = cycleBars(beats);
    let length;
    if (beats % METER === 0) length = beats === METER ? '1 battuta' : `${beats / METER} battute`;
    else length = `${beats} pulsazioni: torna sull'uno dopo ${bars} battute di 4/4`;
    return { attacks, length };
  }

  /** Etichetta di conteggio di una cella: numero della pulsazione, «e» per la seconda croma, «·» altrove. */
  function countLabel(sp, c, beatIndex) {
    if (c === 0) return String(beatIndex + 1);
    if (sp.beats === 1 && sp.div === 2) return 'e';
    if (sp.beats === 1 && sp.div === 4 && c === 2) return 'e';
    const per = sp.div / sp.beats;
    if (Number.isInteger(per) && c % per === 0) return String(beatIndex + 1 + c / per);
    return '·';
  }

  const Rhythms = {
    TPB, METER, BAR, MAX_BARS, FAMILIES, GRID, START_MODES, OMIT, ACCENTS,
    family, catalog, byId, rng, lcm, positionName, cycleOf, cycleBars, realize,
    autoAccent, lengthFor, describe, countLabel,
  };

  if (isNode) module.exports = Rhythms;
  else root.Rhythms = Rhythms;
})(globalThis);
