/**
 * Griglie di accordi (ADR 0013, punto 3): lettura delle sigle, ritmo armonico, trasposizione per
 * lettere e semitoni, gradi romani. Modulo puro: niente DOM, niente audio.
 *
 * Una griglia è il testo del volume: `| Cmaj7 A7 | Dm7 G7 |`. Un accordo nella battuta dura quattro
 * pulsazioni, due accordi due ciascuno, quattro una ciascuno (capitolo 7, «Leggere una griglia»).
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('./theory.js') : root.Theory;
  const Chords = isNode ? require('./chords.js') : root.Chords;

  const BEATS_PER_BAR = 4;
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const mod = (a, n) => ((a % n) + n) % n;

  // ------------------------------------------------------------------ Sigle

  const ACC = { '': 0, b: -1, bb: -2, '♭': -1, '♭♭': -2, '#': 1, '##': 2, x: 2, '♯': 1, '♯♯': 2 };
  const NOTE_RE = '([A-G])(♭♭|♯♯|bb|##|♭|♯|b|#|x)?';

  /** "B♭", "Bb", "F#", "C" → { letter, accidental } oppure null. */
  function parseNote(s) {
    const m = new RegExp('^' + NOTE_RE + '$').exec(String(s || '').trim());
    if (!m) return null;
    return Theory.note(Theory.LETTERS.indexOf(m[1]), ACC[m[2] || '']);
  }

  /** Grafie alternative delle qualità, già con ♭/♯ tipografici. */
  const ALIASES = { 'ø': 'm7♭5', 'ø7': 'm7♭5', 'Δ': 'maj7', 'Δ7': 'maj7', o: '°', o7: '°7', '-7': 'm7', '-': 'm' };

  let bySymbol = null;
  function qualityBySymbol(text) {
    if (!bySymbol) {
      bySymbol = new Map();
      for (const q of Chords.all()) bySymbol.set(q.symbol, q);
    }
    const t = text.replace(/b(?=\d)/g, '♭').replace(/#(?=\d)/g, '♯');
    return bySymbol.get(t) || bySymbol.get(ALIASES[t]) || null;
  }

  /**
   * Sigla → { root, quality, bass }. `bass` è null salvo sigla con barra (Em7/D).
   * Una sigla sconosciuta è un errore: le griglie del catalogo devono leggersi tutte.
   */
  function parseSymbol(text) {
    const s = String(text).trim();
    const m = new RegExp('^' + NOTE_RE + '(.*?)(?:/' + NOTE_RE + ')?$').exec(s);
    if (!m) throw new Error('sigla non valida: ' + text);
    const quality = qualityBySymbol(m[3]);
    if (!quality) throw new Error('qualità sconosciuta nella sigla: ' + text);
    const root = Theory.note(Theory.LETTERS.indexOf(m[1]), ACC[m[2] || '']);
    const bass = m[4] ? Theory.note(Theory.LETTERS.indexOf(m[4]), ACC[m[5] || '']) : null;
    return { root, quality, bass };
  }

  /** Sigla scritta, es. "B♭maj7", "Em7/D". */
  function symbolOf(chord, pretty = true) {
    const s = Chords.symbol(chord.quality, chord.root, pretty);
    return chord.bass ? s + '/' + Theory.noteToString(chord.bass, pretty) : s;
  }

  /** Testo di una griglia → battute, ognuna con le sue sigle: [['Cmaj7', 'A7'], ['Dm7', 'G7']]. */
  function parseGrid(text) {
    const bars = String(text).split('|').map((b) => b.trim()).filter(Boolean).map((b) => b.split(/\s+/));
    for (const b of bars) {
      if (BEATS_PER_BAR % b.length !== 0) {
        throw new Error('battuta con ' + b.length + ' accordi: ' + b.join(' '));
      }
    }
    return bars;
  }

  // ------------------------------------------------------------ Trasposizione

  /** Doppie alterazioni → nome enarmonico più semplice (F𝄪 → G, B♭♭ → A). */
  function simplify(n) {
    if (Math.abs(n.accidental) < 2) return n;
    const candidates = Theory.rootCandidates(Theory.pitchClass(n));
    return candidates.find((c) => Math.sign(c.accidental) === Math.sign(n.accidental)) || candidates[0];
  }

  /** Nota spostata di `letters` lettere e `semis` semitoni, senza doppie alterazioni. */
  function moveNote(n, letters, semis) {
    return simplify(Chords.transpose(n, letters, semis));
  }

  function moveChord(chord, letters, semis) {
    return {
      root: moveNote(chord.root, letters, semis),
      quality: chord.quality,
      bass: chord.bass ? moveNote(chord.bass, letters, semis) : null,
    };
  }

  /** Lettere e semitoni da una nota all'altra (C → B♭: 6 lettere, 10 semitoni). */
  function interval(from, to) {
    return {
      letters: mod(to.letter - from.letter, 7),
      semis: mod(Theory.pitchClass(to) - Theory.pitchClass(from), 12),
    };
  }

  /**
   * Costo di lettura della griglia (come `bestRoots`, sull'intera griglia): ogni sigla diversa una
   * volta sola, più la scala della tonalità. Senza la scala il blues in Re♭ perderebbe di un punto
   * contro Do♯ (sette diesis) solo perché C7 torna più spesso di G7.
   */
  const MODE_SCALE = { major: 'Ionica', minor: 'Eolia', dorian: 'Dorica' };
  let scales = null;
  function gridCost(chords, key, mode) {
    if (!scales) scales = Theory.catalog();
    const seen = new Set();
    let cost = 0;
    for (const c of chords) {
      const id = symbolOf(c, false);
      if (seen.has(id)) continue;
      seen.add(id);
      cost += Theory.spellingCost(Chords.spell(c.quality, c.root));
      if (c.bass) cost += Theory.spellingCost([c.bass]);
    }
    const scale = scales.find((s) => s.name === (MODE_SCALE[mode] || 'Ionica'));
    return cost + Theory.spellingCost(Theory.spell(scale, key));
  }

  /** Tutte le sigle della progressione, nella tonalità di riferimento. */
  function referenceChords(prog) {
    const out = [];
    for (const id of Object.keys(prog.sections)) {
      for (const bar of parseGrid(prog.sections[id])) for (const s of bar) out.push(parseSymbol(s));
    }
    if (prog.ending) for (const bar of parseGrid(prog.ending)) for (const s of bar) out.push(parseSymbol(s));
    return out;
  }

  /**
   * Nome della tonalità per una classe di altezza: fra i candidati (F♯ o G♭) vince la griglia
   * più leggibile; in parità il bemolle, come nelle tonalità del repertorio jazz.
   */
  function keyFor(prog, pc) {
    const ref = parseNote(prog.key);
    const chords = referenceChords(prog);
    const candidates = Theory.rootCandidates(pc).slice().sort((a, b) => a.accidental - b.accidental);
    let best = null;
    let bestCost = Infinity;
    for (const k of candidates) {
      const { letters, semis } = interval(ref, k);
      const cost = gridCost(chords.map((c) => moveChord(c, letters, semis)), k, prog.mode);
      if (cost < bestCost) { best = k; bestCost = cost; }
    }
    return best;
  }

  // ------------------------------------------------------------- Gradi romani

  const LOWER = new Set(['m', 'dim', 'm6', 'm7', 'mmaj7', 'm7b5', 'dim7', 'm69', 'm9', 'mmaj9']);
  const SUFFIX = {
    maj: '', m: '', dim: '°', aug: '+', 6: '6', 7: '7', maj7: 'maj7', m6: '6', m7: '7',
    mmaj7: '(maj7)', m7b5: 'ø7', '7s5': '7♯5', dim7: '°7', 69: '6/9', 9: '9', maj9: 'maj9',
    m69: '6/9', m9: '9', mmaj9: '(maj9)', '7b9': '7♭9',
  };

  /** Grado di una nota rispetto al centro: { number 1..7, alteration } sulla scala maggiore. */
  function degreeOf(n, center) {
    const { letters, semis } = interval(center, n);
    return { number: letters + 1, alteration: mod(semis - MAJOR_STEPS[letters] + 6, 12) - 6 };
  }

  function accidentalPrefix(a) {
    return a === 0 ? '' : (a < 0 ? '♭' : '♯').repeat(Math.abs(a));
  }

  /**
   * Grado romano della sigla rispetto al centro: ii7, V7, ♭VII7, ♯I°7. Minuscolo per le qualità
   * minori e diminuite. La sigla con barra aggiunge il grado del basso in cifre arabe (ii7/1).
   */
  function roman(chord, center) {
    const d = degreeOf(chord.root, center);
    const numeral = ROMAN[d.number - 1];
    let s = accidentalPrefix(d.alteration)
      + (LOWER.has(chord.quality.id) ? numeral.toLowerCase() : numeral)
      + SUFFIX[chord.quality.id];
    if (chord.bass) {
      const b = degreeOf(chord.bass, center);
      s += '/' + accidentalPrefix(b.alteration) + b.number;
    }
    return s;
  }

  // ------------------------------------------------------------ Ritmo armonico

  /**
   * Realizza la progressione nella tonalità scelta.
   *
   * opts.key   nota ({ letter, accidental }), nome ("B♭") o classe di altezza (0..11); predefinita
   *            la tonalità di riferimento del catalogo
   * opts.full  forma intera (`fullForm`, es. A–A–B–A) invece della forma breve
   * opts.ending finale chiuso (`ending` sostituisce le ultime battute dell'ultima sezione)
   * opts.giri  quante volte si ripete la forma (predefinito 1); il finale chiuso va nell'ultimo giro
   *
   * Restituisce { key, center, bars, timeline, beats }:
   * - bars:     [{ index, section, label, giro, chords }] con `label` A1, A2… se la sezione si ripete;
   * - timeline: [{ beat, dur, bar, section, giro, chord }] con `chord` = { root, quality, bass, symbol,
   *             roman, center }, in pulsazioni da 0.
   */
  function realize(prog, opts = {}) {
    const ref = parseNote(prog.key);
    let key = ref;
    if (typeof opts.key === 'number') key = keyFor(prog, opts.key);
    else if (typeof opts.key === 'string') key = parseNote(opts.key) || ref;
    else if (opts.key) key = opts.key;
    key = simplify(key);
    const { letters, semis } = interval(ref, key);

    const form = (opts.full && prog.fullForm) || prog.form;
    const total = {};
    for (const id of form) total[id] = (total[id] || 0) + 1;
    const giri = Math.max(1, Math.floor(opts.giri || 1));
    let seen = {};

    const centers = prog.centers || {};
    const bars = [];
    const timeline = [];
    let beat = 0;

    // Giri: la forma si ripete; le etichette ripartono a ogni giro, il finale chiuso sta nell'ultimo.
    const sequence = [];
    for (let g = 0; g < giri; g++) form.forEach((id, i) => sequence.push({ id, giro: g, first: i === 0 }));

    sequence.forEach(({ id, giro, first }, seqIndex) => {
      if (first) seen = {};
      seen[id] = (seen[id] || 0) + 1;
      const label = total[id] > 1 ? id + seen[id] : id;
      const center = moveNote(parseNote(centers[id] || prog.key), letters, semis);
      let grid = parseGrid(prog.sections[id]);
      if (opts.ending && prog.ending && seqIndex === sequence.length - 1) {
        const end = parseGrid(prog.ending);
        grid = grid.slice(0, grid.length - end.length).concat(end);
      }
      const manual = prog.romans && prog.romans[id];
      let k = 0;
      for (const symbols of grid) {
        const dur = BEATS_PER_BAR / symbols.length;
        const chords = symbols.map((text) => {
          const c = moveChord(parseSymbol(text), letters, semis);
          c.symbol = symbolOf(c);
          c.roman = (manual && manual[k]) || roman(c, center);
          c.center = center;
          k++;
          return c;
        });
        const index = bars.length;
        bars.push({ index, section: id, label, giro, chords });
        chords.forEach((chord, i) => {
          timeline.push({ beat: beat + i * dur, dur, bar: index, section: label, giro, chord });
        });
        beat += BEATS_PER_BAR;
      }
    });

    return { key, center: moveNote(ref, letters, semis), bars, timeline, beats: beat };
  }

  const Progression = {
    BEATS_PER_BAR,
    parseNote, parseSymbol, symbolOf, parseGrid, simplify, moveNote, interval,
    keyFor, degreeOf, roman, realize,
  };

  if (isNode) module.exports = Progression;
  else root.Progression = Progression;
})(globalThis);
