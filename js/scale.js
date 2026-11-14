/**
 * Strumento Scale: definizione per il guscio comune (js/app.js, ADR 0011).
 * Chiavi di salvataggio storiche, mantenute per non perdere le impostazioni salvate.
 * Pentatoniche e scala blues usano diteggiature in posizione, le altre 3NPS (ADR 0014).
 */
(function () {
  'use strict';

  const { Theory: T, Guitar: G, Link, Presets, App } = window;
  const scales = T.catalog();

  /** Diteggiature in posizione per le collezioni di cinque o sei note di pentatoniche e blues. */
  const positional = (scale) =>
    scale.family === 'pentatonic' || (scale.family === 'bluesBebop' && scale.degrees.length < 7);

  function eyebrow(scale) {
    if (scale.mode) return `Modo ${scale.mode} della ${T.family(scale.family).parent}`;
    if (scale.family === 'pentatonic') return 'Pentatonica';
    if (scale.family === 'bluesBebop') return scale.degrees.length < 7 ? 'Scala blues' : 'Scala bebop';
    return 'Scala simmetrica';
  }

  function hint(scale) {
    if (scale.family === 'pentatonic' || scale.family === 'bluesBebop') {
      return 'Gli intervalli sono salti nella collezione: «Terze» = salto (una nota sì e una no), ' +
        '«Quarte» = salto doppio. L\'intervallo effettivo cambia da nota a nota.';
    }
    if (scale.degrees.length !== 7) return 'Scala simmetrica: gli intervalli sono salti di gradi della scala (terza = 2 gradi).';
    return null;
  }

  App.start({
    storageKey: 'interval-master:v1',
    itemKey: 'scale',
    linkKey: 'scale',
    families: T.FAMILIES,
    legacyFamilies: ['major', 'melodic', 'harmonicMinor', 'harmonicMajor', 'symmetric'],
    items: scales,
    slugs: scales.map((sc) => Link.slug(sc.name)),
    slugAliases: T.LEGACY_SLUGS,
    bestRoots: (scale, pc) => T.bestRoots(scale, pc),
    title: (scale, root) => `${T.noteToString(root, true)} ${T.prettify(scale.name)}`,
    poolLabel: 'Scale nel pool',
    practice: { storageKey: 'gsp:practice:v1', catalog: Presets, patternScope: 'Diteggiatura 3NPS', start: false },
    view(scale, root) {
      const notes = T.spell(scale, root);
      const noteLabels = notes.map((n) => T.noteToString(n, true));
      const degreeLabels = scale.degrees.map((d) => T.degreeToString(d, true));
      const inPosition = positional(scale);
      const intervalHint = hint(scale);
      return {
        eyebrow: eyebrow(scale),
        sub: scale.aka && 'detta anche: ' + T.prettify(scale.aka),
        quizHint: 'Prova a ricostruire note e formula, poi controlla.',
        notesLabel: 'Note della scala',
        noteLabels, degreeLabels,
        details: [['Formula', T.formula(scale, true)], ['Struttura', T.stepPattern(scale)], ['Note', notes.length]],
        semis: T.semitones(scale),
        patterns: inPosition
          ? G.positionPatterns(T.semitones(scale), T.pitchClass(root))
          : G.threeNpsPatterns(scale, T.pitchClass(root)),
        patternScope: inPosition ? 'Diteggiatura in posizione' : 'Diteggiatura 3NPS',
        patternMeta: (pat) => `dal grado ${degreeLabels[pat.startDegree]} (${noteLabels[pat.startDegree]}) · tasti ${pat.minFret}–${pat.maxFret}`,
        sectionTitle: inPosition ? 'Diteggiature in posizione' : 'Diteggiature 3 note per corda',
        sectionNote: inPosition
          ? 'Accordatura standard (EADGBE). Una diteggiatura entro cinque tasti per ogni nota di partenza sulla 6ª corda; tonica in rosso.'
          : 'Accordatura standard (EADGBE). Una diteggiatura per ogni grado di partenza sulla 6ª corda; tonica in rosso.',
        plainTitle: `${T.noteToString(root)} ${scale.name}`,
        hint: (category) => intervalHint && category !== 'linear' && category !== 'rhythmic' ? intervalHint : null,
      };
    },
  });
})();
