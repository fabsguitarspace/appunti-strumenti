/**
 * Deep link (ADR 0010, punto 5): l'esercizio si descrive nel frammento dell'URL,
 * es. `scale.html#v=1&scale=dorica&root=D&preset=lin-updown&rhythm=swing`.
 * Il frammento funziona anche da file:// e non arriva al server. Schema documentato in
 * Docs/deep-link.md: è un'interfaccia pubblica (il volume vi rimanda), si estende senza
 * rompere; `v` cambia solo per modifiche incompatibili. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const VERSION = 1;
  const LETTERS = 'CDEFGAB';

  // ------------------------------------------------------------ Frammento

  /** Frammento → { v, params } con params oggetto semplice (chiavi sconosciute conservate). */
  function parse(hash) {
    const raw = String(hash || '').replace(/^#/, '');
    const params = {};
    for (const [k, v] of new URLSearchParams(raw)) params[k] = v;
    const v = params.v === undefined ? null : Number(params.v);
    delete params.v;
    return { v: Number.isInteger(v) ? v : null, params };
  }

  /** params → '#v=1&…' (valori null, undefined o '' omessi; ordine delle chiavi conservato). */
  function build(params) {
    const sp = new URLSearchParams();
    sp.set('v', String(VERSION));
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === '') continue;
      sp.set(k, String(v));
    }
    return '#' + sp.toString();
  }

  /** Tema richiesto dal link: 'dark', 'light', 'auto' oppure null. */
  function themeOf(params) {
    return ['dark', 'light', 'auto'].includes(params.theme) ? params.theme : null;
  }

  // ------------------------------------------------------------ Nomi

  /** Identificatore leggibile e stabile da un nome di scala: "Dorica b2" → "dorica-b2", "#" → "s", "♮" → "n". */
  function slug(name) {
    return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/♯|#/g, 's').replace(/♭/g, 'b').replace(/♮/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /** "Bb", "F#", "C", "Ebb", "Fx" → { letter, accidental } oppure null. */
  function parseNote(str) {
    const m = /^([A-Ga-g])(bb|b|##|#|x|♭♭|♭|♯♯|♯)?$/.exec(String(str || '').trim());
    if (!m) return null;
    const acc = { '': 0, b: -1, bb: -2, '#': 1, '##': 2, x: 2, '♭': -1, '♭♭': -2, '♯': 1, '♯♯': 2 }[m[2] || ''];
    return { letter: LETTERS.indexOf(m[1].toUpperCase()), accidental: acc };
  }

  /** { letter, accidental } → "Bb", "F#", "C". */
  function noteParam(n) {
    return LETTERS[n.letter] + (n.accidental < 0 ? 'b' : '#').repeat(Math.abs(n.accidental));
  }

  // ------------------------------------------------------------ Esercizio (strumento Scale)

  // Corde nel link come numeri da chitarrista: 6 = Mi grave (indice 0), 1 = Mi cantino (indice 5).
  const stringsParam = (idx) => [...idx].sort((a, b) => a - b).map((i) => 6 - i).join('');
  const stringsFrom = (s) => [...new Set([...String(s)].map(Number).filter((n) => n >= 1 && n <= 6).map((n) => 6 - n))].sort();

  const int = (s, lo, hi) => {
    if (!/^-?\d+$/.test(String(s))) return undefined;
    const n = Number(s);
    return n >= lo && n <= hi ? n : undefined;
  };

  /** Impostazioni dell'esercizio → parametri del link (solo i campi dell'ambito scelto). */
  function encodeExercise(s) {
    const sc = s.scope;
    const p = {
      preset: s.presetId, dir: s.direction, ext: s.extension, start: s.startDegree ? s.startDegree + 1 : null,
      rhythm: s.rhythmId,
      accent: s.accent, shift: s.accentOffset || null, pickup: s.pickup || null,
      scope: sc.kind,
    };
    if (sc.kind === 'neck' || sc.kind === 'strings') {
      p.from = sc.fretFrom; p.to = sc.fretTo;
      if (sc.allowOpen === false) p.open = 0;
    }
    if (sc.kind === 'strings') p.strings = stringsParam(sc.strings);
    if (sc.kind === 'pattern') p.pattern = sc.index + 1;
    if (sc.kind === 'position') p.fret = sc.fret;
    if (sc.kind === 'neck' || sc.kind === 'strings' || sc.kind === 'position') p.profile = s.profile;
    p.bpm = s.bpm;
    return p;
  }

  /**
   * Parametri del link → impostazioni parziali (solo i campi presenti e ben formati).
   * La validazione dei valori di catalogo (preset, ritmi, …) spetta a chi le applica.
   */
  function decodeExercise(p) {
    const out = {};
    const scope = {};
    if (p.preset) out.presetId = p.preset;
    if (p.dir) out.direction = p.dir;
    if (p.ext) out.extension = p.ext === 'full' ? 'full' : int(p.ext, 1, 3);
    if (p.start !== undefined) { const n = int(p.start, 1, 7); if (n) out.startDegree = n - 1; }
    if (p.rhythm) out.rhythmId = p.rhythm;
    if (p.accent) out.accent = /^\d+$/.test(p.accent) ? int(p.accent, 2, 4) : p.accent;
    if (p.shift !== undefined) out.accentOffset = int(p.shift, 0, 3);
    if (p.pickup !== undefined) out.pickup = int(p.pickup, 0, 3);
    if (p.scope) scope.kind = p.scope;
    if (p.from !== undefined) scope.fretFrom = int(p.from, 0, 24);
    if (p.to !== undefined) scope.fretTo = int(p.to, 0, 24);
    if (p.open !== undefined) scope.allowOpen = p.open !== '0';
    if (p.strings) { const st = stringsFrom(p.strings); if (st.length) scope.strings = st; }
    if (p.pattern !== undefined) { const i = int(p.pattern, 1, 24); if (i) scope.index = i - 1; }
    if (p.fret !== undefined) scope.fret = int(p.fret, 0, 20);
    if (p.profile) out.profile = p.profile;
    if (p.bpm !== undefined) out.bpm = int(p.bpm, 1, 999);
    for (const k of Object.keys(scope)) if (scope[k] === undefined) delete scope[k];
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    if (Object.keys(scope).length) out.scope = scope;
    return out;
  }

  // ------------------------------------------------------------ Esercizio (strumento Accordi)

  /** Impostazioni dell'esercizio sugli accordi → parametri del link (ADR 0012). */
  function encodeChordExercise(s) {
    return {
      ex: s.exId, dir: s.exId === 'inv' ? s.direction : null, fam: s.family, set: s.set,
      from: s.fretFrom, to: s.fretTo, rhythm: s.rhythmId, bars: s.bars === 2 ? 2 : null,
      attack: s.attack === 'block' ? 'block' : null, alt: s.alt ? 1 : null, bpm: s.bpm,
    };
  }

  /** Parametri del link → impostazioni parziali dell'esercizio sugli accordi. */
  function decodeChordExercise(p) {
    const out = {};
    if (p.ex) out.exId = p.ex;
    if (p.dir) out.direction = p.dir;
    if (p.fam) out.family = p.fam;
    if (p.set && (p.set === 'all' || /^[1-6]{3,5}$/.test(p.set))) out.set = p.set;
    if (p.from !== undefined) out.fretFrom = int(p.from, 1, 20);
    if (p.to !== undefined) out.fretTo = int(p.to, 1, 20);
    if (p.rhythm) out.rhythmId = p.rhythm;
    if (p.bars !== undefined) out.bars = int(p.bars, 1, 2);
    if (p.attack) out.attack = p.attack;
    if (p.alt !== undefined) out.alt = p.alt === '1';
    if (p.bpm !== undefined) out.bpm = int(p.bpm, 1, 999);
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // ------------------------------------------------------------ Esercizio (strumento Progressioni)

  /**
   * Impostazioni dell'esercizio sulle progressioni → parametri del link (ADR 0013, punto 10).
   * `giri=0` è il loop continuo; `end=closed` il finale chiuso (solo dove il catalogo lo prevede).
   */
  function encodeProgExercise(s) {
    return {
      rhythm: s.rhythmId, attack: s.attack === 'block' ? 'block' : null, bass: s.bass,
      fam: s.family, set: s.set, from: s.fretFrom, to: s.fretTo, study: s.study,
      giri: s.giri, form: s.form === 'full' ? 'full' : null, end: s.ending === 'closed' ? 'closed' : null,
      alt: s.alt ? 1 : null, bpm: s.bpm,
    };
  }

  /** Parametri del link → impostazioni parziali dell'esercizio sulle progressioni. */
  function decodeProgExercise(p) {
    const out = {};
    if (p.rhythm) out.rhythmId = p.rhythm;
    if (p.attack) out.attack = p.attack;
    if (p.bass) out.bass = p.bass;
    if (p.fam) out.family = p.fam;
    if (p.set && (p.set === 'all' || /^[1-6]{3,5}$/.test(p.set))) out.set = p.set;
    if (p.from !== undefined) out.fretFrom = int(p.from, 1, 20);
    if (p.to !== undefined) out.fretTo = int(p.to, 1, 20);
    if (p.study) out.study = p.study;
    if (p.alt !== undefined) out.alt = p.alt === '1';
    if (p.giri !== undefined) { const g = int(p.giri, 0, 4); if (g !== undefined && g !== 3) out.giri = g; }
    if (p.form) out.form = p.form === 'full' ? 'full' : 'short';
    if (p.end) out.ending = p.end === 'closed' ? 'closed' : 'loop';
    if (p.bpm !== undefined) out.bpm = int(p.bpm, 1, 999);
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // ------------------------------------------------------------ Esercizio (strumento Ritmi)

  /**
   * Impostazioni dell'esercizio sui ritmi → parametri del link (ADR 0016). `start` è la posizione
   * di partenza da 1 (prima cella della battuta), oppure `seq` o `rand`; `seed` riproduce le figure
   * casuali. I valori predefiniti si omettono.
   */
  function encodeRhythmExercise(s) {
    const random = s.start === 'rand' || s.random;
    return {
      start: s.start === 'seq' || s.start === 'rand' ? s.start : (Number.isInteger(s.start) ? s.start + 1 : null),
      vary: s.vary ? 1 : null,
      omit: s.omit && s.omit !== 'none' ? s.omit : null,
      seed: random || (s.omit && s.omit !== 'none') ? s.seed : null,
      accent: s.accent && s.accent !== 'auto' ? s.accent : null,
      notes: s.notes, feel: s.feel === 'swing' ? 'swing' : null,
      base: s.base, bass: s.base !== 'none' ? s.bass : null, comp: s.base !== 'none' && s.comp === false ? 0 : null,
      metro: s.metroMode && s.metroMode !== 'all' ? s.metroMode : null,
      bpm: s.bpm,
    };
  }

  /** Parametri del link → impostazioni parziali dell'esercizio sui ritmi. */
  function decodeRhythmExercise(p) {
    const out = {};
    if (p.start === 'seq' || p.start === 'rand') out.start = p.start;
    else if (p.start !== undefined) { const n = int(p.start, 1, 16); if (n) out.start = n - 1; }
    if (p.vary !== undefined) out.vary = p.vary === '1';
    if (p.omit) out.omit = p.omit;
    if (p.seed !== undefined) out.seed = int(p.seed, 1, 999999);
    if (p.accent) out.accent = p.accent;
    if (p.notes) out.notes = p.notes;
    if (p.feel) out.feel = p.feel === 'swing' ? 'swing' : 'straight';
    if (p.base) out.base = p.base;
    if (p.bass) out.bass = p.bass;
    if (p.comp !== undefined) out.comp = p.comp !== '0';
    if (p.metro) out.metroMode = p.metro;
    if (p.bpm !== undefined) out.bpm = int(p.bpm, 1, 999);
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // ------------------------------------------------------------ Esercizio (strumento Chord melody)

  /**
   * Impostazioni dell'esercizio di chord melody → parametri del link (ADR 0018, punto 10). Il
   * materiale (`prog` o `chord`) e la tonalità (`key`) li aggiunge il guscio. `seed` solo dove
   * serve (cella variata, quiz).
   */
  function encodeChordMelodyExercise(s) {
    const onChord = s.material === 'chord';
    return {
      ex: onChord ? s.cex : s.ex,
      line: onChord ? null : s.line,
      cell: onChord ? null : s.cell,
      seed: (!onChord && s.cell === 'vary') || (onChord && s.cex === 'quiz-top') ? s.seed : null,
      fam: s.family, string: s.string, from: s.fretFrom, to: s.fretTo,
      attack: s.attack, study: s.study, bpm: s.bpm,
    };
  }

  /** Parametri del link → impostazioni parziali dell'esercizio di chord melody. */
  function decodeChordMelodyExercise(p) {
    const out = {};
    if (p.ex === 'line' || p.ex === 'trio') out.ex = p.ex;
    if (p.ex === 'tops' || p.ex === 'same-top' || p.ex === 'quiz-top') out.cex = p.ex;
    if (p.line) out.line = p.line;
    if (p.cell) out.cell = p.cell;
    if (p.seed !== undefined) out.seed = int(p.seed, 1, 999999);
    if (p.fam) out.family = p.fam;
    if (p.string === '1' || p.string === '2' || p.string === '12') out.string = p.string;
    if (p.from !== undefined) out.fretFrom = int(p.from, 1, 20);
    if (p.to !== undefined) out.fretTo = int(p.to, 1, 20);
    if (p.attack) out.attack = p.attack;
    if (p.study) out.study = p.study;
    if (p.bpm !== undefined) out.bpm = int(p.bpm, 1, 999);
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  const Link = {
    VERSION, parse, build, themeOf, slug, parseNote, noteParam, encodeExercise, decodeExercise,
    encodeChordExercise, decodeChordExercise, encodeProgExercise, decodeProgExercise,
    encodeRhythmExercise, decodeRhythmExercise, encodeChordMelodyExercise, decodeChordMelodyExercise,
  };

  if (isNode) module.exports = Link;
  else root.Link = Link;
})(globalThis);
