/**
 * Strumento Progressioni: definizione per il guscio comune (js/app.js, ADR 0013).
 * Progressione del catalogo (js/progressions.js) × tonalità; griglia, accompagnamento, basso e
 * note guida nel pannello proprio (js/progpractice.js). Nessuna sezione di diteggiature: i voicing
 * dipendono dalle scelte del pannello e stanno nelle sue viste.
 */
(function () {
  'use strict';

  const { Theory: T, Progression: P, Progressions: PS, ProgPractice, Link, App } = window;
  const progs = PS.catalog();
  const CHAPTER = 'https://appunti-pratica-per-chitarra-jazz.readthedocs.io/it/latest/7-progressioni.html';

  const h = window.PanelUI.h;

  /** Forma leggibile: A–A–B–A. */
  const formText = (form) => form.join('–');

  App.start({
    storageKey: 'gsp:progressioni:v1',
    itemKey: 'prog',
    linkKey: 'prog',
    rootParam: 'key',
    families: PS.FAMILIES,
    items: progs,
    slugs: progs.map((p) => p.id),
    bestRoots: (p, pc) => [P.keyFor(p, pc)],
    title: (p, key) => `${p.label} in ${T.noteToString(key, true)}${p.mode === 'minor' ? ' minore' : ''}`,
    poolLabel: 'Progressioni nel pool',
    panel: ProgPractice,
    decodeLink: Link.decodeProgExercise,
    practice: { storageKey: 'gsp:progressioni:practice:v1' },
    view(p, key) {
      const real = P.realize(p, { key });
      const seen = new Map();
      for (const e of real.timeline) if (!seen.has(e.chord.symbol)) seen.set(e.chord.symbol, e.chord.roman);
      const full = p.fullForm ? P.realize(p, { key, full: true }) : null;
      const bars = full ? `${real.bars.length} (forma intera ${full.bars.length})` : String(real.bars.length);
      const form = formText(p.form) + (p.fullForm ? ` · intera ${formText(p.fullForm)}` : '');
      const volume = p.ref
        ? h('a', { href: `${CHAPTER}#${p.ref}`, target: '_blank', rel: 'noopener' }, 'capitolo «Progressioni»')
        : h('a', { href: CHAPTER, target: '_blank', rel: 'noopener' }, 'capitolo «Progressioni»');
      return {
        eyebrow: PS.family(p.family).label,
        sub: p.mode === 'dorian' ? `Centro ${T.noteToString(real.center, true)} dorico` : null,
        quizHint: 'Pronuncia le sigle contando le battute, poi controlla.',
        quizBody: ProgPractice.gridView(real, { romans: true, symbols: false }),
        notesLabel: 'Accordi della griglia',
        noteLabels: [...seen.keys()],
        degreeLabels: [...seen.values()],
        details: [
          ['Battute', bars],
          ['Forma', form],
          ['Nel volume', volume],
        ],
        semis: [],
        patterns: null,
        plainTitle: `${p.label} in ${T.noteToString(key, false)}`,
        hint: () => null,
      };
    },
  });
})();
