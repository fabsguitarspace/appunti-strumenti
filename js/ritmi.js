/**
 * Strumento Ritmi: definizione per il guscio comune (js/app.js, ADR 0016).
 * Figura del catalogo (js/rhythms.js) × tonalità della base; griglia ritmica, linea suonata e
 * base nel pannello proprio (js/rhythmpractice.js). Nessuna sezione di diteggiature.
 */
(function () {
  'use strict';

  const { Theory: T, Rhythms: R, RhythmPractice, Link, App } = window;
  const items = R.catalog();
  const PAGE = 'https://appunti-pratica-per-chitarra-jazz.readthedocs.io/it/latest/ritmo-melodico.html';
  // Sezione della pagina «Ritmo melodico» del volume per ogni famiglia.
  const ANCHORS = {
    crome: 'ritmo-consecutive', terzine: 'ritmo-terzine', semicrome: 'ritmo-terzine',
    'note-battuta': 'ritmo-note-per-battuta', battuta: 'ritmo-una-battuta',
    sovrapposizioni: 'ritmo-cicli', marce: 'ritmo-marce', cambi: 'ritmo-marce',
  };
  // Tonalità con l'ortografia più comune nel jazz (bemolli per i tasti neri).
  const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => Link.parseNote(k));
  const CELL = { 2: 'croma', 3: 'terzina', 4: 'semicroma', 5: 'quintina', 6: 'sestina', 7: 'settimina', 9: 'nonina' };

  const h = window.PanelUI.h;

  /** Ciclo di riferimento della scheda: la figura con le impostazioni predefinite. */
  function preview(item) {
    const cycle = R.cycleOf(item, { start: 0, seed: 1 }, 4);
    const rhythm = R.realize(cycle, R.cycleBars(cycle.cycleBeats), { accent: R.autoAccent(item) });
    return { cycle, rhythm };
  }

  /** Conteggio degli attacchi della prima battuta: «1», «e», «2»… e il valore della cella. */
  function firstBar(rhythm) {
    const labels = [];
    const values = [];
    rhythm.bars[0].spans.forEach((sp, k, all) => {
      const beatIndex = all.slice(0, k).reduce((a, x) => a + x.beats, 0);
      [...sp.cells].forEach((ch, c) => {
        if (ch !== 'x') return;
        labels.push(R.countLabel(sp, c, beatIndex));
        const per = sp.div / sp.beats;
        values.push(sp.beats === 2 && sp.div === 3 ? 'terzina di ♩' : CELL[per] || `${sp.div} in ${sp.beats}`);
      });
    });
    return { labels, values };
  }

  App.start({
    storageKey: 'gsp:ritmi:v1',
    itemKey: 'rhythm',
    linkKey: 'rhythm',
    rootParam: 'key',
    families: R.FAMILIES,
    items,
    slugs: items.map((r) => r.id),
    bestRoots: (item, pc) => [KEYS[pc]],
    title: (item, key) => `${item.label} · ${T.noteToString(key, true)}`,
    poolLabel: 'Figure nel pool',
    panel: RhythmPractice,
    decodeLink: Link.decodeRhythmExercise,
    practice: { storageKey: 'gsp:ritmi:practice:v1' },
    view(item, key) {
      const { cycle, rhythm } = preview(item);
      const d = R.describe(item, cycle);
      const fb = firstBar(rhythm);
      const more = fb.labels.length > 12;
      const volume = h('a', { href: `${PAGE}#${ANCHORS[item.family]}`, target: '_blank', rel: 'noopener' }, 'pagina «Ritmo melodico»');
      return {
        eyebrow: R.family(item.family).label,
        sub: `Base e altezze in ${T.noteToString(key, true)}`,
        quizHint: 'Batti la figura leggendo la griglia, contando ad alta voce le pulsazioni; poi controlla il conteggio.',
        quizBody: RhythmPractice.gridView({ ...rhythm, cycleMarks: item.family === 'sovrapposizioni' }, { counts: false }),
        notesLabel: 'Attacchi della prima battuta',
        noteLabels: more ? fb.labels.slice(0, 12).concat('…') : fb.labels,
        degreeLabels: more ? fb.values.slice(0, 12).concat('') : fb.values,
        details: [
          ['Attacchi nel ciclo', String(d.attacks)],
          ['Ciclo', item.kind === 'consecutive' ? 'dipende dalla partenza' : item.kind === 'perbar' ? '1 battuta, o una per battuta' : d.length],
          ['Nel volume', volume],
        ],
        semis: [],
        patterns: null,
        plainTitle: `${item.label} in ${T.noteToString(key, false)}`,
        hint: () => null,
      };
    },
  });
})();
