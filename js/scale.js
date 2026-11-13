/**
 * Strumento Scale: definizione per il guscio comune (js/app.js, ADR 0011).
 * Chiavi di salvataggio storiche, mantenute per non perdere le impostazioni salvate.
 */
(function () {
  'use strict';

  const { Theory: T, Guitar: G, Link, Presets, App } = window;
  const scales = T.catalog();

  App.start({
    storageKey: 'interval-master:v1',
    itemKey: 'scale',
    linkKey: 'scale',
    families: T.FAMILIES,
    items: scales,
    slugs: scales.map((sc) => Link.slug(sc.name)),
    bestRoots: (scale, pc) => T.bestRoots(scale, pc),
    title: (scale, root) => `${T.noteToString(root, true)} ${T.prettify(scale.name)}`,
    poolLabel: 'Scale nel pool',
    practice: { storageKey: 'gsp:practice:v1', catalog: Presets, patternScope: 'Diteggiatura 3NPS', start: false },
    view(scale, root) {
      const notes = T.spell(scale, root);
      const noteLabels = notes.map((n) => T.noteToString(n, true));
      const degreeLabels = scale.degrees.map((d) => T.degreeToString(d, true));
      const symmetric = scale.degrees.length !== 7;
      return {
        eyebrow: scale.mode ? `Modo ${scale.mode} della ${T.family(scale.family).parent}` : 'Scala simmetrica',
        sub: scale.aka && 'detta anche: ' + T.prettify(scale.aka),
        quizHint: 'Prova a ricostruire note e formula, poi controlla.',
        notesLabel: 'Note della scala',
        noteLabels, degreeLabels,
        details: [['Formula', T.formula(scale, true)], ['Struttura', T.stepPattern(scale)], ['Note', notes.length]],
        semis: T.semitones(scale),
        patterns: G.threeNpsPatterns(scale, T.pitchClass(root)),
        patternMeta: (pat) => `dal grado ${degreeLabels[pat.startDegree]} (${noteLabels[pat.startDegree]}) · tasti ${pat.minFret}–${pat.maxFret}`,
        sectionTitle: 'Diteggiature 3 note per corda',
        sectionNote: 'Accordatura standard (EADGBE). Una diteggiatura per ogni grado di partenza sulla 6ª corda; tonica in rosso.',
        plainTitle: `${T.noteToString(root)} ${scale.name}`,
        hint: (category) => symmetric && category !== 'linear' && category !== 'rhythmic'
          ? 'Scala simmetrica: gli intervalli sono salti di gradi della scala (terza = 2 gradi).' : null,
      };
    },
  });
})();
