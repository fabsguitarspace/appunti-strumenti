/**
 * Strumento Arpeggi: definizione per il guscio comune (js/app.js, ADR 0011).
 * Qualità × fondamentale, diteggiature in posizione (Guitar.positionPatterns), preset propri
 * (Presets.ARPEGGI), partenza da 3ª, 5ª, 7ª per i rivolti.
 */
(function () {
  'use strict';

  const { Theory: T, Chords: C, Guitar: G, Presets, App } = window;
  const chords = C.catalog();
  const INTERVALS = { 2: '2ª m', 3: '3ª m', 4: '3ª M', 5: '4ª' };

  App.start({
    storageKey: 'gsp:arpeggi:v1',
    itemKey: 'chord',
    linkKey: 'chord',
    families: C.FAMILIES,
    items: chords,
    slugs: chords.map((q) => q.id),
    bestRoots: (q, pc) => C.bestRoots(q, pc),
    title: (q, root) => C.symbol(q, root),
    poolLabel: 'Arpeggi nel pool',
    practice: { storageKey: 'gsp:arpeggi:practice:v1', catalog: Presets.ARPEGGI, patternScope: 'Diteggiatura in posizione', start: true },
    view(q, root) {
      const notes = C.spell(q, root);
      const noteLabels = notes.map((n) => T.noteToString(n, true));
      const degreeLabels = q.tones.map((t) => C.toneToString(t, true));
      const semis = C.semitones(q);
      return {
        eyebrow: C.family(q.family).label,
        sub: q.name + (q.aka ? ` · detto anche ${C.symbol({ symbol: q.aka }, root)}` : ''),
        quizHint: 'Prova a ricostruire le note dell\'arpeggio, poi controlla.',
        notesLabel: 'Note dell\'arpeggio',
        noteLabels, degreeLabels,
        details: [
          ['Formula', C.formula(q, true)],
          ['Intervalli', C.steps(q).map((s) => INTERVALS[s] || s + 's').join(' · ')],
          ['Note', notes.length],
        ],
        semis,
        rootOnce: q.rootOnce,
        patterns: G.positionPatterns(semis, T.pitchClass(root)),
        patternMeta: (pat) => `dalla ${pat.startDegree === 0 ? 'fondamentale' : degreeLabels[pat.startDegree]} (${noteLabels[pat.startDegree]}) · tasti ${pat.minFret}–${pat.maxFret}`,
        sectionTitle: 'Diteggiature in posizione',
        sectionNote: 'Accordatura standard (EADGBE). Una diteggiatura per ogni nota di partenza sulla 6ª corda, entro cinque tasti; fondamentale in rosso.',
        plainTitle: C.symbol(q, root, false),
        hint: () => q.rootOnce
          ? 'Arpeggio di nona: sopra la settima suona la nona al posto della fondamentale.' : null,
      };
    },
  });
})();
