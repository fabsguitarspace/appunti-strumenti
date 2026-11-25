/**
 * Strumento Accordi: definizione per il guscio comune (js/app.js, ADR 0012).
 * Qualità × fondamentale, voicing delle famiglie del capitolo «Accordi» (js/voicings.js) come
 * diagrammi d'accordo, pannello Esercizi proprio (js/chordpractice.js).
 */
(function () {
  'use strict';

  const { Theory: T, Chords: C, Voicings: V, ChordChart, Link, App } = window;
  const chords = C.catalog();
  const FAMILY_ORDER = V.FAMILIES.map((f) => f.id);
  const FAMILIES = C.FAMILIES.map((f) => ({ ...f, label: f.label.replace('Arpeggi', 'Accordi') }));
  // Mappa delle famiglie di voicing nel capitolo «Accordi» del volume (analisi 024 di appunti-pratica).
  const CHAPTER = 'https://appunti-pratica-per-chitarra-jazz.readthedocs.io/it/latest/6-accordi.html#famiglie-voicing';
  const h = window.PanelUI.h;

  App.start({
    storageKey: 'gsp:accordi:v1',
    itemKey: 'chord',
    linkKey: 'chord',
    families: FAMILIES,
    items: chords,
    slugs: chords.map((q) => q.id),
    bestRoots: (q, pc) => C.bestRoots(q, pc),
    title: (q, root) => C.symbol(q, root),
    poolLabel: 'Accordi nel pool',
    panel: window.ChordPractice,
    decodeLink: Link.decodeChordExercise,
    practice: { storageKey: 'gsp:accordi:practice:v1' },
    view(q, root) {
      const notes = C.spell(q, root);
      const noteLabels = notes.map((n) => T.noteToString(n, true));
      const degreeLabels = q.tones.map((t) => C.toneToString(t, true));
      // Etichette dei voicing: le note della qualità più i colori dei voicing senza fondamentale
      // (es. 13 nel dominante), con gli stessi indici `tone` di js/voicings.js (ADR 0015).
      const tones = V.toneList(q);
      const voicingDegrees = tones.map((t) => C.toneToString(t, true));
      const voicingNotes = C.spell({ ...q, tones }, root).map((n) => T.noteToString(n, true));
      // Con le alterate (strutture superiori dei dominanti, ADR 0015) in un gruppo a parte.
      // Un gruppo per insieme di corde: a parità di corda del basso, l'ordine degli insiemi della
      // famiglia (con le tre voci più insiemi hanno lo stesso basso, ADR 0018).
      const setIndex = (v) => V.family(v.family).sets.findIndex((s) => V.sameSet(s, v.strings));
      const voicings = V.voicings(q, T.pitchClass(root), undefined, { alt: true })
        .sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
          (a.alt ? 1 : 0) - (b.alt ? 1 : 0) ||
          a.strings[0] - b.strings[0] || setIndex(a) - setIndex(b) || a.notes[0].midi - b.notes[0].midi);
      const setName = (v) => v.label.split('').join('–');
      return {
        eyebrow: FAMILIES.find((f) => f.id === q.family).label,
        sub: q.name + (q.aka ? ` · detto anche ${C.symbol({ symbol: q.aka }, root)}` : ''),
        quizHint: 'Prova a ricostruire le note dell\'accordo e un voicing, poi controlla.',
        notesLabel: 'Note dell\'accordo',
        noteLabels, degreeLabels,
        details: [
          ['Formula', C.formula(q, true)],
          ['Voicing', voicings.length],
          ['Nel volume', h('a', { href: CHAPTER, target: '_blank', rel: 'noopener' }, 'capitolo «Accordi»')],
        ],
        semis: C.semitones(q),
        patterns: voicings,
        diagram: (v, labels, title) => ChordChart.render(v, labels === degreeLabels ? voicingDegrees : voicingNotes, title),
        groupLabel: (v) => `${V.family(v.family).label}${v.alt ? ' alterate' : ''} · corde ${setName(v)}`,
        patternCaption: (v) => (v.upper ? `triade di ${v.upper} · ` : '') + `${voicingDegrees[v.top]} al canto`,
        patternMeta: (v) => `basso ${voicingDegrees[v.bass]} · tasti ${v.minFret}–${v.maxFret}`,
        sectionTitle: 'Voicing',
        sectionNote: q.family === 'extended'
          ? 'Accordatura standard. Negli accordi di nona la nona sostituisce la fondamentale (3 5 7 9) e non va mai al basso. Niente corde a vuoto; fondamentale in rosso.'
          : 'Accordatura standard. Famiglie del capitolo «Accordi» del volume, una nota per corda, entro cinque tasti, niente corde a vuoto né tensioni al basso; fondamentale in rosso.',
        plainTitle: C.symbol(q, root, false),
        hint: () => null,
      };
    },
  });
})();
