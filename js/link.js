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

  /** Identificatore leggibile e stabile da un nome di scala: "Dorica b2" → "dorica-b2", "#" → "s". */
  function slug(name) {
    return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/♯|#/g, 's').replace(/♭/g, 'b')
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
      preset: s.presetId, dir: s.direction, ext: s.extension, rhythm: s.rhythmId,
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

  const Link = {
    VERSION, parse, build, themeOf, slug, parseNote, noteParam, encodeExercise, decodeExercise,
  };

  if (isNode) module.exports = Link;
  else root.Link = Link;
})(globalThis);
