/**
 * Strumento Chord melody: definizione per il guscio comune (js/app.js, ADR 0018).
 * Il materiale estratto è una griglia del catalogo di Progressioni (js/progressions.js) oppure un
 * accordo di quattro o cinque note (js/chords.js), in una tonalità; melodia generata, armonizzazione
 * e viste nel pannello proprio (js/cmpractice.js). Nel link: `prog` o `chord`, e `key`.
 */
(function () {
  'use strict';

  const { Theory: T, Chords: C, Progression: P, Progressions: PS, CMPractice, Link, App } = window;
  const CHAPTER = 'https://appunti-pratica-per-chitarra-jazz.readthedocs.io/it/latest/6-accordi.html#chord-melody-voicings';
  const h = window.PanelUI.h;

  const CHORD_FAMILIES = [
    { id: 'cm-sevenths', label: 'Accordi a 4 note' },
    { id: 'cm-extended', label: 'Accordi di nona' },
  ];
  const progs = PS.catalog().map((p) => ({ ...p, kind: 'prog' }));
  const chords = C.catalog().filter((q) => q.family === 'sevenths' || q.family === 'extended')
    .map((q) => ({ kind: 'chord', id: q.id, family: 'cm-' + q.family, quality: q }));
  const items = progs.concat(chords);
  const SLUG = (it) => (it.kind === 'chord' ? 'chord:' + it.id : it.id);

  const volume = h('a', { href: CHAPTER, target: '_blank', rel: 'noopener' }, 'Voicing per il chord melody');

  App.start({
    storageKey: 'gsp:chordmelody:v1',
    itemKey: 'mat',
    linkKey: 'prog',
    rootParam: 'key',
    families: PS.FAMILIES.concat(CHORD_FAMILIES),
    items,
    slugs: items.map(SLUG),
    linkSlug: (params) => (params.chord ? 'chord:' + params.chord : params.prog),
    linkParams: (item) => (item.kind === 'chord' ? { chord: item.id } : { prog: item.id }),
    bestRoots: (it, pc) => (it.kind === 'chord' ? C.bestRoots(it.quality, pc) : [P.keyFor(it, pc)]),
    title: (it, key) => (it.kind === 'chord'
      ? C.symbol(it.quality, key)
      : `${it.label} in ${T.noteToString(key, true)}${it.mode === 'minor' ? ' minore' : ''}`),
    poolLabel: 'Materiali nel pool',
    panel: CMPractice,
    decodeLink: Link.decodeChordMelodyExercise,
    practice: { storageKey: 'gsp:chordmelody:practice:v1' },
    view(it, key) {
      const base = { semis: [], patterns: null, hint: () => null };
      if (it.kind === 'chord') {
        const q = it.quality;
        return {
          ...base,
          eyebrow: CHORD_FAMILIES.find((f) => f.id === it.family).label,
          sub: q.name,
          quizHint: 'Prova a dire quali note dell\'accordo possono stare al canto, poi controlla.',
          notesLabel: 'Note dell\'accordo',
          noteLabels: C.spell(q, key).map((n) => T.noteToString(n, true)),
          degreeLabels: q.tones.map((t) => C.toneToString(t, true)),
          details: [['Formula', C.formula(q, true)], ['Nel volume', volume.cloneNode(true)]],
          plainTitle: C.symbol(q, key, false),
        };
      }
      const real = P.realize(it, { key });
      const seen = new Map();
      for (const e of real.timeline) if (!seen.has(e.chord.symbol)) seen.set(e.chord.symbol, e.chord.roman);
      return {
        ...base,
        eyebrow: PS.family(it.family).label,
        sub: it.mode === 'dorian' ? `Centro ${T.noteToString(real.center, true)} dorico` : null,
        quizHint: 'Canta una melodia di una nota per accordo, poi controlla quella proposta.',
        notesLabel: 'Accordi della griglia',
        noteLabels: [...seen.keys()],
        degreeLabels: [...seen.values()],
        details: [['Battute', String(real.bars.length)], ['Nel volume', volume.cloneNode(true)]],
        plainTitle: `${it.label} in ${T.noteToString(key, false)}`,
      };
    },
  });
})();
