/**
 * Qualità degli accordi come insiemi di gradi (ADR 0010, punto 4; ADR 0011): catalogo degli
 * arpeggi del capitolo «Arpeggi» del volume, ortografia e sigle. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('./theory.js') : root.Theory;

  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
  const mod = (a, n) => ((a % n) + n) % n;

  const FAMILIES = [
    { id: 'triads', label: 'Triadi' },
    { id: 'sevenths', label: 'Arpeggi a 4 note' },
    { id: 'extended', label: 'Arpeggi estesi (nona)' },
  ];

  const family = (id) => FAMILIES.find((f) => f.id === id);

  /**
   * Nota dell'accordo da una stringa: "b7", "#5", "9". Con "6:°7" il grado 6 decide altezza e
   * nome della nota e "°7" è l'etichetta mostrata (settima diminuita scritta come sesta, come
   * negli esempi del volume: C°7 = C E♭ G♭ A).
   */
  function parseTone(s) {
    const [spec, label] = s.split(':');
    const m = /^([b#]*)(\d+)$/.exec(spec);
    if (!m) throw new Error('nota d\'accordo non valida: ' + s);
    let alteration = 0;
    for (const c of m[1]) alteration += c === 'b' ? -1 : 1;
    return { number: Number(m[2]), alteration, label: label || null };
  }

  /** Semitoni dalla fondamentale; le tensioni restano sopra l'ottava (9 = 14). */
  function toneSemitones(t) {
    const i = t.number - 1;
    return 12 * Math.floor(i / 7) + MAJOR_STEPS[i % 7] + t.alteration;
  }

  function toneToString(t, pretty = false) {
    return t.label || Theory.degreeToString(t, pretty);
  }

  function Q(id, symbol, name, familyId, formula, aka = '') {
    return {
      id, symbol, name, aka, family: familyId,
      tones: formula.split(/\s+/).map(parseTone),
      // Arpeggi estesi: la nona sta sopra la settima e sostituisce la fondamentale (Pool.pitchPool).
      rootOnce: familyId === 'extended',
    };
  }

  /**
   * Catalogo (19). Gli `id` compaiono nei deep link (`chord=`): non si rinominano.
   * Ordine delle famiglie a 4 e 5 note come nel capitolo del volume.
   */
  function catalog() {
    return [
      Q('maj', '', 'Triade maggiore', 'triads', '1 3 5'),
      Q('m', 'm', 'Triade minore', 'triads', '1 b3 5'),
      Q('dim', '°', 'Triade diminuita', 'triads', '1 b3 b5'),
      Q('aug', '+', 'Triade aumentata', 'triads', '1 3 #5'),
      Q('6', '6', 'Sesta', 'sevenths', '1 3 5 6'),
      Q('7', '7', 'Settima di dominante', 'sevenths', '1 3 5 b7'),
      Q('maj7', 'maj7', 'Settima maggiore', 'sevenths', '1 3 5 7', 'Δ'),
      Q('m6', 'm6', 'Minore sesta', 'sevenths', '1 b3 5 6'),
      Q('m7', 'm7', 'Minore settima', 'sevenths', '1 b3 5 b7'),
      Q('mmaj7', 'm(maj7)', 'Minore con settima maggiore', 'sevenths', '1 b3 5 7', 'mΔ'),
      Q('m7b5', 'm7♭5', 'Semidiminuito', 'sevenths', '1 b3 b5 b7', 'ø'),
      Q('7s5', '7♯5', 'Settima con quinta aumentata', 'sevenths', '1 3 #5 b7', '+7'),
      Q('dim7', '°7', 'Settima diminuita', 'sevenths', '1 b3 b5 6:°7'),
      Q('69', '6/9', 'Sesta e nona', 'extended', '1 3 5 6 9'),
      Q('9', '9', 'Nona di dominante', 'extended', '1 3 5 b7 9'),
      Q('maj9', 'maj9', 'Nona maggiore', 'extended', '1 3 5 7 9', 'Δ9'),
      Q('m69', 'm6/9', 'Minore sesta e nona', 'extended', '1 b3 5 6 9'),
      Q('m9', 'm9', 'Minore nona', 'extended', '1 b3 5 b7 9'),
      Q('mmaj9', 'm(maj9)', 'Minore nona con settima maggiore', 'extended', '1 b3 5 7 9', 'mΔ9'),
    ];
  }

  /** Classi di altezza dalla fondamentale, nell'ordine delle note dell'accordo. */
  function semitones(q) {
    return q.tones.map((t) => mod(toneSemitones(t), 12));
  }

  /** Formula, es. "1 3 5 b7 9". */
  function formula(q, pretty = false) {
    return q.tones.map((t) => toneToString(t, pretty)).join(' ');
  }

  /** Intervalli fra note consecutive dell'arpeggio, in semitoni (terza maggiore = 4 …). */
  function steps(q) {
    const s = q.tones.map(toneSemitones);
    return s.slice(1).map((x, i) => x - s[i]);
  }

  /** Note dell'accordo dalla fondamentale data: la lettera segue il grado (♭7 di B♭ = A♭). */
  function spell(q, rootNote) {
    const rootPc = Theory.pitchClass(rootNote);
    return q.tones.map((t) => {
      const letter = (rootNote.letter + t.number - 1) % 7;
      const target = mod(rootPc + toneSemitones(t), 12);
      const accidental = mod(target - Theory.LETTER_PC[letter] + 6, 12) - 6;
      return Theory.note(letter, accidental);
    });
  }

  /** Nomi della fondamentale che danno la scrittura più leggibile (tutti, se in parità). */
  function bestRoots(q, pc) {
    const candidates = Theory.rootCandidates(pc);
    const costs = candidates.map((r) => Theory.spellingCost(spell(q, r)));
    const min = Math.min(...costs);
    return candidates.filter((_, i) => costs[i] === min);
  }

  /** Sigla, es. "B♭7", "Cm7♭5". */
  function symbol(q, rootNote, pretty = true) {
    return Theory.noteToString(rootNote, pretty) + q.symbol;
  }

  const Chords = {
    FAMILIES, family, parseTone, toneSemitones, toneToString,
    catalog, semitones, formula, steps, spell, bestRoots, symbol,
  };

  if (isNode) module.exports = Chords;
  else root.Chords = Chords;
})(globalThis);
