/**
 * Pannello Esercizi dello strumento Chord melody (ADR 0018, punti 6–10): Cosa (esercizio, linea,
 * ritmo della melodia) · Come (attacco) · Dove (famiglia, corda della melodia, zona) · Studio ·
 * Opzioni; viste sincronizzate (forme in diagrammi, griglia con la melodia, tablatura, tastiera),
 * link dell'esercizio. Stessa interfaccia di Practice e ProgPractice verso il guscio (js/app.js).
 */
(function (root) {
  'use strict';

  const {
    Theory: T, Chords: C, Voicings: V, Progression, Melodies, Harmonize,
    ChordChart, Fretboard, TabLayout, TabRender, Transport, Events, Link,
  } = root;
  const DESKTOP = root.matchMedia('(min-width: 1024px)');
  const { BPM_MIN, BPM_MAX, clampBpm } = Transport;
  const mod = (a, n) => ((a % n) + n) % n;

  const STRINGS = [['1', '1ª'], ['2', '2ª'], ['12', '1ª e 2ª']];
  const LABELS = [['degree', 'Gradi'], ['note', 'Note']];
  const STUDY_NOTE = {
    full: 'Melodia, più forte, e voci sotto: la nota al canto deve restare la più chiara.',
    melody: 'Solo la melodia: suonala e cantala prima di aggiungere le voci sotto.',
    bass: 'Melodia e voce più grave della forma: poi aggiungi le voci interne, un po\' più piano.',
    play: 'Resta solo la voce più grave con il metronomo: la melodia e le voci interne le suoni tu.',
  };
  const FAMILY_NOTE = {
    drop2: 'Drop 2 sulle corde 4–3–2–1 (melodia sulla 1ª) o 5–4–3–2 (melodia sulla 2ª).',
    drop3: 'Drop 3 con il basso: corde 6–4–3–2 (melodia sulla 2ª) o 5–3–2–1 (melodia sulla 1ª).',
    trio: 'Tre voci: fondamentale sulla 6ª o 5ª, nota guida nel mezzo, melodia sulla 2ª o 1ª. Corde non vicine: dita o hybrid picking.',
  };
  const label = (list, v) => (list.find(([k]) => k === String(v)) || [null, ''])[1];
  const oneOf = (list, v, fallback) => (list.some(([k]) => k === String(v)) ? String(v) : fallback);
  const ids = (list) => list.map((x) => [x.id, x.label]);

  let cfg = { storageKey: 'gsp:chordmelody:practice:v1' };

  const defaults = () => ({
    ex: 'line', cex: 'tops', line: 'guide', cell: 'whole', seed: 1,
    family: 'drop2', string: '1', fretFrom: 1, fretTo: 12,
    attack: 'strum', study: 'full', labels: 'degree',
    // 60 BPM come gli esempi del capitolo.
    bpm: 60, metronome: true, metroMode: 'all', countIn: true, loop: true,
    volNotes: 0.55, volMelody: 1, volClick: 0.6,
    trainer: { on: false, step: 5, every: 2, max: 160 },
    views: { chart: true, grid: true, tab: true, neck: false },
  });

  let settings = defaults();

  function merge(base, s) {
    const out = {
      ...base, ...s,
      trainer: { ...base.trainer, ...(s.trainer || {}) },
      views: { ...base.views, ...(s.views || {}) },
    };
    const exIds = (on) => Harmonize.EXERCISES.filter((e) => e.on === on).map((e) => [e.id, e.label]);
    out.ex = oneOf(exIds('prog'), out.ex, base.ex);
    out.cex = oneOf(exIds('chord'), out.cex, base.cex);
    out.line = oneOf(ids(Melodies.LINES), out.line, base.line);
    out.cell = oneOf(ids(Melodies.CELLS).concat([['vary', '']]), out.cell, base.cell);
    out.family = Harmonize.FAMILIES.includes(out.family) ? out.family : base.family;
    out.string = oneOf(STRINGS, out.string, base.string);
    out.attack = oneOf(Harmonize.ATTACKS, out.attack, base.attack);
    out.study = oneOf(Harmonize.STUDY, out.study, base.study);
    out.labels = oneOf(LABELS, out.labels, base.labels);
    const fret = (f, d) => (Number.isInteger(f) && f >= 1 && f <= 20 ? f : d);
    out.fretFrom = fret(out.fretFrom, base.fretFrom);
    out.fretTo = fret(out.fretTo, base.fretTo);
    out.seed = Number.isInteger(out.seed) && out.seed > 0 ? out.seed : base.seed;
    out.loop = out.loop !== false;
    out.bpm = clampBpm(out.bpm);
    return out;
  }

  function load() {
    settings = defaults();
    try {
      const raw = localStorage.getItem(cfg.storageKey);
      if (raw) settings = merge(defaults(), JSON.parse(raw));
    } catch (_) { settings = defaults(); }
  }

  function save() {
    try { localStorage.setItem(cfg.storageKey, JSON.stringify(settings)); } catch (_) { /* ignora */ }
  }

  // ------------------------------------------------------------ Stato

  let mounted = null;   // { key, item (materiale), root, container, title, link }
  let exercise = null;
  let current = null;
  let neckCard = -1;
  let revealed = false; // quiz: forme mostrate
  const openAxes = new Set(DESKTOP.matches ? ['cosa', 'come', 'dove', 'studio', 'opzioni'] : ['cosa']);
  let panelOpen = true;
  let resizeObs = null;
  let lastTabWidth = 0;

  const transport = Transport.create({
    options: () => settings,
    onBpm: (bpm) => { settings.bpm = bpm; save(); },
    onPlayClick: () => togglePlay(),
    onHighlight: (ev) => highlight(ev),
    onChange: () => updatePlayButton(),
    onError: (msg) => showError(msg),
  });
  const playing = () => transport.playing();

  const { h, copyText, isIOS } = root.PanelUI;
  const { select, segmented, chips, axis, optionsAxis } = root.PanelUI.create('cm-', openAxes);

  // ------------------------------------------------------------ Esercizio

  const onChord = () => !!mounted && mounted.item.kind === 'chord';

  function effective() {
    const material = onChord() ? 'chord' : 'prog';
    const family = material === 'prog' && settings.ex === 'trio' ? 'trio' : settings.family;
    return { ...settings, material, family };
  }

  function getExercise() {
    if (exercise) return exercise;
    const s = effective();
    const item = mounted.item;
    if (s.material === 'prog') {
      const real = Progression.realize(item, { key: mounted.root });
      exercise = Harmonize.build(real, s);
      exercise.real = real;
    } else if (s.cex === 'same-top') {
      exercise = Harmonize.sameTop(mounted.root, s);
    } else if (s.cex === 'quiz-top') {
      exercise = Harmonize.quiz(item.quality, mounted.root, s);
    } else {
      exercise = Harmonize.tops(item.quality, mounted.root, s);
    }
    return exercise;
  }

  function change(fn) {
    fn(settings);
    save();
    exercise = null;
    neckCard = -1;
    revealed = false;
    if (playing()) stop();
    renderPanel();
  }

  // ------------------------------------------------------------ Etichette

  const toneSpelling = (chord) => C.spell({ ...chord.quality, tones: V.toneList(chord.quality) }, chord.root);

  /** Nome scritto di un'altezza nell'accordo (Fa, non Mi♯), oppure il nome più semplice. */
  function noteName(chord, midi) {
    const n = toneSpelling(chord).find((x) => T.pitchClass(x) === mod(midi, 12));
    return T.noteToString(n || T.rootCandidates(mod(midi, 12))[0], true);
  }

  /** Etichette (gradi o note) per indice di toneList. */
  function labelsOf(chord) {
    return settings.labels === 'note'
      ? toneSpelling(chord).map((n) => T.noteToString(n, true))
      : V.toneList(chord.quality).map((t) => C.toneToString(t, true));
  }

  // ------------------------------------------------------------ Trasporto

  function placeTransport() {
    const slot = document.getElementById('transport-slot');
    if (slot && transport.el.parentNode !== slot) slot.appendChild(transport.el);
  }

  function updatePlayButton() {
    const p = playing();
    const ex = mounted && getExercise();
    const hidden = effective().material === 'chord' && settings.cex === 'quiz-top' && !revealed;
    transport.setPlayButton(!!p && p.mode === 'exercise', !ex || !ex.events.length || hidden);
    document.querySelectorAll('[data-quick]').forEach((b) => {
      const i = Number(b.dataset.quick);
      b.classList.toggle('is-on', !!p && p.mode === 'pattern' && p.patternIndex === i);
    });
  }

  function togglePlay() {
    const p = playing();
    if (p && p.mode === 'exercise') stop();
    else if (mounted) {
      const ex = getExercise();
      if (ex.events.length) transport.start(ex, 'exercise');
    }
  }

  /** Ascolto di una forma: prima la nota al canto, poi la forma intera. */
  function quickPlay(k) {
    if (!mounted) return;
    const p = playing();
    if (p && p.mode === 'pattern' && p.patternIndex === k) { stop(); return; }
    const v = cardList()[k] && cardList()[k].voicing;
    if (!v) return;
    const top = v.notes[v.notes.length - 1];
    const lower = v.notes.slice(0, -1);
    const events = [
      { i: 0, beat: 0, dur: 1, ndur: 1, notes: [top], accent: true, part: 'melody', k },
      { i: 1, beat: 1, dur: 3, ndur: 3, notes: [top], accent: true, part: 'melody', k },
      { i: 2, beat: 1, dur: 3, ndur: 3, notes: lower, accent: false, part: 'comp', strum: 0.018, k },
    ];
    transport.start({ events, lengthBeats: 4, pickupBeats: 0 }, 'pattern', { patternIndex: k });
  }

  function stop() {
    transport.stop();
    updatePlayButton();
  }

  // ------------------------------------------------------------ Evidenziazione

  let tabIndex = new Map(); // indice evento → indice nella tablatura

  function highlight(ev) {
    document.querySelectorAll('.is-playing').forEach((e) => e.classList.remove('is-playing'));
    current = ev;
    if (!ev || !mounted) return;
    const c = mounted.container;
    const sels = Events.notesOf(ev).map((n) => `.dot[data-s="${n.string}"][data-f="${n.fret}"]`);
    const mark = (scope) => scope && sels.forEach((sel) => { const d = scope.querySelector(sel); if (d) d.classList.add('is-playing'); });
    if (ev.k >= 0) {
      // Nella vista delle forme si accende la forma intera, non solo la nota appena suonata.
      const li = c.querySelector(`.cm-seq [data-k="${ev.k}"]`);
      const card = cardList()[ev.k];
      if (li) {
        li.classList.add('is-playing');
        (card ? card.voicing.notes : Events.notesOf(ev)).forEach((n) => {
          const d = li.querySelector(`.dot[data-s="${n.string}"][data-f="${n.fret}"]`);
          if (d) d.classList.add('is-playing');
        });
      }
    }
    const p = playing();
    if (p && p.mode === 'pattern') return;
    const seg = c.querySelector(`.prog-grid [data-seg="${ev.seg}"]`);
    if (seg) seg.classList.add('is-playing');
    const note = c.querySelector(`.prog-grid [data-n="${ev.n}"]`);
    if (note) note.classList.add('is-playing');
    if (settings.views.neck) {
      if (ev.k >= 0 && ev.k !== neckCard) drawNeck(ev.k);
      mark(c.querySelector('.view-neck'));
    }
    const ti = tabIndex.get(ev.i);
    if (ti != null) c.querySelectorAll(`.tab-num[data-i="${ti}"]`).forEach((x) => x.classList.add('is-playing'));
  }

  // ------------------------------------------------------------ Viste

  /** Forme mostrate: quelle dell'esercizio, o tutte le soluzioni del quiz. */
  function cardList() {
    const ex = getExercise();
    if (effective().material === 'chord' && settings.cex === 'quiz-top') {
      const chord = { root: mounted.root, quality: mounted.item.quality, symbol: C.symbol(mounted.item.quality, mounted.root) };
      return (ex.solutions || []).map((voicing) => ({ voicing, chord, melody: V.topOf(voicing).midi }));
    }
    return ex.cards;
  }

  const setName = (l) => l.split('').join('–');

  function chartView() {
    const cards = cardList();
    return h('section', { class: 'view view-chords' },
      h('h3', { class: 'view-title' }, 'Forme'),
      h('ol', { class: 'chord-seq cm-seq' }, cards.map((card, k) => {
        const name = noteName(card.chord, card.melody);
        const title = `${card.chord.symbol} con ${name} al canto, corde ${setName(card.voicing.label)}`;
        const svg = ChordChart.render(card.voicing, labelsOf(card.chord), title);
        const top = V.topOf(card.voicing);
        const dot = svg.querySelector(`.dot[data-s="${top.string}"][data-f="${top.fret}"]`);
        if (dot) dot.classList.add('is-top');
        return h('li', { 'data-k': k },
          h('span', { class: 'chord-sym' }, card.chord.symbol),
          h('span', { class: 'cm-top' }, `${name} al canto`),
          svg,
          h('button', {
            type: 'button', class: 'quick-btn', 'data-quick': k, 'aria-label': `Ascolta: ${title}`,
            onclick: () => quickPlay(k),
          }, h('span', { class: 't-icon', 'aria-hidden': 'true' })));
      })));
  }

  /** Griglia con le note della melodia sotto le sigle (righe di quattro battute). */
  function gridView(ex) {
    const real = ex.real;
    const bySeg = new Map();
    ex.items.forEach((it, n) => {
      if (!bySeg.has(it.seg)) bySeg.set(it.seg, []);
      bySeg.get(it.seg).push({ n, name: noteName(it.chord, it.midi), chord: !!it.voicing });
    });
    const rows = [];
    let row = null;
    let k = 0;
    real.bars.forEach((bar, i) => {
      if (i % 4 === 0) { row = h('div', { class: 'pg-row' }); rows.push(row); }
      row.append(h('div', { class: 'pg-bar', 'data-bar': i },
        h('div', { class: 'pg-chords' }, bar.chords.map((chord) => {
          const notes = bySeg.get(k) || [];
          const cell = h('span', { class: 'pg-chord', 'data-seg': k },
            h('span', { class: 'pg-sym' }, chord.symbol),
            h('span', { class: 'pg-guide cm-melody' }, notes.flatMap((x, j) => [
              j ? ' ' : null,
              h('span', { 'data-n': x.n, class: x.chord ? 'cm-note' : 'cm-note is-single' }, x.name),
            ])));
          k++;
          return cell;
        }))));
    });
    return h('section', { class: 'view view-grid' },
      h('h3', { class: 'view-title' }, 'Griglia e melodia'),
      h('div', { class: 'prog-grid', role: 'list', 'aria-label': 'Griglia con la melodia' }, rows),
      h('p', { class: 'muted small' }, 'In corsivo le note suonate da sole, senza accordo.'));
  }

  function neckView() {
    return h('section', { class: 'view view-neck' },
      h('div', { class: 'view-head' },
        h('h3', { class: 'view-title' }, 'Tastiera'),
        h('span', { class: 'neck-chord muted small' })),
      h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': 'Tastiera, scorrevole' }));
  }

  function drawNeck(k) {
    if (!mounted) return;
    const box = mounted.container.querySelector('.view-neck .neck-scroll');
    const card = cardList()[k];
    if (!box || !card) return;
    neckCard = k;
    const labels = labelsOf(card.chord);
    const pos = card.voicing.notes.map((n) => ({ string: n.string, fret: n.fret, degree: 0, label: labels[n.tone], root: n.tone === 0 }));
    const lo = Math.max(0, Math.min(settings.fretFrom, settings.fretTo, card.voicing.minFret) - 1);
    const hi = Math.min(22, Math.max(settings.fretFrom, settings.fretTo, card.voicing.maxFret) + 1);
    box.replaceChildren(Fretboard.render({ positions: pos, minFret: lo, maxFret: hi }, [], `${card.chord.symbol} sulla tastiera`,
      { fretFrom: lo, fretTo: hi, cellWidth: 36 }));
    const cap = mounted.container.querySelector('.view-neck .neck-chord');
    if (cap) cap.textContent = `${card.chord.symbol} · ${noteName(card.chord, card.melody)} al canto`;
  }

  /** Eventi per la tablatura: melodia e voci sotto nello stesso istante diventano una colonna. */
  function tabEvents(ex) {
    const out = [];
    tabIndex = new Map();
    for (const e of ex.events) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.beat - e.beat) < 1e-9) {
        const used = new Set(last.notes.map((n) => n.string));
        last.notes = last.notes.concat(Events.notesOf(e).filter((n) => !used.has(n.string))).sort((a, b) => a.string - b.string);
        tabIndex.set(e.i, last.i);
        continue;
      }
      const ev = { i: out.length, beat: e.beat, dur: e.dur, ndur: e.ndur, accent: e.part === 'melody', rest: false, notes: Events.notesOf(e).slice() };
      out.push(ev);
      tabIndex.set(e.i, ev.i);
    }
    return out;
  }

  function tabView() {
    const copyBtn = h('button', { type: 'button', class: 'chip-btn', onclick: () => copyTab(copyBtn) }, 'Copia tab');
    return h('section', { class: 'view view-tab' },
      h('div', { class: 'view-head' }, h('h3', { class: 'view-title' }, 'Tablatura'),
        h('div', { class: 'row-buttons' }, copyBtn,
          h('button', { type: 'button', class: 'chip-btn', onclick: () => root.print() }, 'Stampa'))),
      h('div', { class: 'tab-scroll' }));
  }

  function drawTab(forcedWidth) {
    if (!mounted) return;
    const box = mounted.container.querySelector('.tab-scroll');
    if (!box) return;
    const ex = getExercise();
    const width = forcedWidth || Math.max(240, Math.floor(box.clientWidth || mounted.container.clientWidth || 340));
    lastTabWidth = width;
    const lay = TabLayout.layout(tabEvents(ex), { width, meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    box.replaceChildren(TabRender.render(lay, { width }));
    if (current) highlight(current);
  }

  function copyTab(btn) {
    const ex = getExercise();
    const names = ex.real
      ? ex.real.bars.map((b) => b.chords.map((c) => c.symbol).join(' ')).join(' | ')
      : ex.cards.map((c) => c.chord.symbol).join(' | ');
    const txt = `${mounted.title}\n${names}\n\n` + TabLayout.toAscii(tabEvents(ex), { meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    copyText(txt, () => { btn.textContent = 'Copiata ✓'; setTimeout(() => { btn.textContent = 'Copia tab'; }, 1500); });
  }

  // ------------------------------------------------------------ Assi

  function cosaAxis() {
    const s = effective();
    if (s.material === 'chord') {
      const exs = Harmonize.EXERCISES.filter((e) => e.on === 'chord');
      const q = mounted.item.quality;
      const note = {
        tops: 'Una forma per nota dell\'accordo al canto, dalla più grave nella zona: ogni voce sale alla nota successiva dell\'accordo.',
        'same-top': `La fondamentale al canto su ${Harmonize.SAME_TOP.map((id) => C.symbol(C.catalog().find((x) => x.id === id), mounted.root)).join(', ')}: fra due qualità cambiano una o due voci, il canto resta.`,
        'quiz-top': 'Trova la forma con quella nota in cima, poi controlla. «Nuova domanda» cambia la nota al canto.',
      }[s.cex];
      return axis('cosa', 'Cosa', label(ids(exs), s.cex),
        select('cex', 'Esercizio', ids(exs), s.cex, (v) => change((st) => { st.cex = v; })),
        s.cex === 'quiz-top' && h('div', { class: 'row-buttons' },
          h('button', { type: 'button', class: 'chip-btn', onclick: () => change((st) => { st.seed = (st.seed % 999999) + 1; }) }, 'Nuova domanda')),
        q.tones.length === 3 && h('p', { class: 'muted small' }, 'Le triadi usano le triadi strette e late.'),
        h('p', { class: 'muted small' }, note));
    }
    const exs = Harmonize.EXERCISES.filter((e) => e.on === 'prog');
    const cells = ids(Melodies.CELLS).concat([['vary', 'Variata (una cella per battuta)']]);
    return axis('cosa', 'Cosa', [label(ids(exs), s.ex), label(ids(Melodies.LINES), s.line), label(cells, s.cell)].join(' · '),
      select('ex', 'Esercizio', ids(exs), s.ex, (v) => change((st) => { st.ex = v; })),
      segmented('line', 'Melodia', ids(Melodies.LINES), s.line, (v) => change((st) => { st.line = v; })),
      select('cell', 'Ritmo della melodia', cells, s.cell, (v) => change((st) => { st.cell = v; })),
      s.cell === 'vary' && h('div', { class: 'row-buttons' },
        h('button', { type: 'button', class: 'chip-btn', onclick: () => change((st) => { st.seed = (st.seed % 999999) + 1; }) }, 'Nuova variante')),
      h('p', { class: 'muted small' }, Melodies.line(s.line).note + ' Accordo sui tempi forti e sulle note lunghe, nota sola altrove.'));
  }

  function comeAxis() {
    const s = effective();
    return axis('come', 'Come', label(Harmonize.ATTACKS, s.attack),
      segmented('attack', 'Attacco', Harmonize.ATTACKS, s.attack, (v) => change((st) => { st.attack = v; })),
      h('p', { class: 'muted small' }, s.attack === 'melody'
        ? 'La nota al canto sul battito, le voci sotto un ottavo dopo: prima si sente la melodia.'
        : 'La melodia suona più forte delle voci sotto; il volume di ciascuna è nelle Opzioni.'));
  }

  function doveAxis() {
    const s = effective();
    const frets = Array.from({ length: 20 }, (_, f) => [String(f + 1), String(f + 1)]);
    const fams = Harmonize.FAMILIES.map((f) => [f, V.family(f).label]);
    const forced = s.material === 'prog' && settings.ex === 'trio';
    return axis('dove', 'Dove', `${V.family(s.family).label} · melodia sulla ${label(STRINGS, s.string)} · tasti ${Math.min(s.fretFrom, s.fretTo)}–${Math.max(s.fretFrom, s.fretTo)}`,
      !forced && segmented('family', 'Forme', fams, s.family, (v) => change((st) => { st.family = v; })),
      segmented('string', 'Corda della melodia', STRINGS, s.string, (v) => change((st) => { st.string = v; })),
      h('div', { class: 'field-row' },
        select('from', 'Dal tasto', frets, s.fretFrom, (v) => change((st) => { st.fretFrom = Number(v); })),
        select('to', 'Al tasto', frets, s.fretTo, (v) => change((st) => { st.fretTo = Number(v); }))),
      h('p', { class: 'muted small' }, FAMILY_NOTE[s.family]));
  }

  function studioAxis() {
    const s = effective();
    return axis('studio', 'Studio', label(Harmonize.STUDY, s.study),
      segmented('study', 'Modalità', Harmonize.STUDY, s.study, (v) => change((st) => { st.study = v; })),
      h('p', { class: 'muted small' }, STUDY_NOTE[s.study]));
  }

  function opzioniAxis() {
    return optionsAxis({
      settings, change, bpmMin: BPM_MIN, bpmMax: BPM_MAX,
      volumes: [
        ['volMelody', 'melody', 'Volume melodia'], ['volNotes', 'notes', 'Volume voci sotto'],
        ['volClick', 'click', 'Volume metronomo'],
      ],
      onVolume: (key, bus, v) => { settings[key] = v; save(); transport.setVolumes({ [bus]: v }); },
    });
  }

  function showError(msg) {
    const p = mounted && mounted.container.querySelector('.practice-error');
    if (p) { p.textContent = msg; p.hidden = !msg; }
  }

  function viewsBar() {
    const v = settings.views;
    const list = [['chart', 'Forme'], ['grid', 'Griglia'], ['tab', 'Tablatura'], ['neck', 'Tastiera']]
      .filter(([k]) => k !== 'grid' || !onChord());
    return h('div', { class: 'field-row' },
      chips('views', 'Viste', list, (k) => v[k], (k) => change((st) => { st.views[k] = !st.views[k]; })),
      segmented('labels', 'Etichette', LABELS, settings.labels, (x) => change((st) => { st.labels = x; })));
  }

  function exerciseUrl() {
    const base = root.location.href.split('#')[0];
    return base + Link.build({ ...mounted.link, ...Link.encodeChordMelodyExercise(effective()) });
  }

  function linkBar() {
    const btn = h('button', { type: 'button', class: 'chip-btn', onclick: () => copyText(exerciseUrl(), () => {
      btn.textContent = 'Link copiato ✓';
      setTimeout(() => { btn.textContent = 'Copia link dell\'esercizio'; }, 1500);
    }) }, 'Copia link dell\'esercizio');
    return h('div', { class: 'row-buttons link-bar' }, btn);
  }

  function applyLink(partial) {
    settings = merge(settings, partial);
    save();
    exercise = null;
    revealed = false;
    panelOpen = true;
    openAxes.add('cosa'); openAxes.add('dove');
  }

  /** Quiz sulla nota al canto: la domanda, poi le forme. */
  function quizView(ex) {
    const chord = { root: mounted.root, quality: mounted.item.quality };
    const name = ex.solutions && ex.solutions.length ? noteName(chord, V.topOf(ex.solutions[0]).midi) : '';
    const degree = ex.tone != null ? C.toneToString(V.toneList(chord.quality)[ex.tone], true) : '';
    return h('section', { class: 'view quiz cm-quiz' },
      h('p', { class: 'cm-question' }, `${C.symbol(chord.quality, mounted.root)} con ${name} (${degree}) al canto, sulla ${label(STRINGS, settings.string)} corda: trova la forma.`),
      !revealed && h('button', {
        type: 'button', class: 'secondary-btn',
        onclick: () => { revealed = true; renderPanel(); },
      }, 'Mostra le forme'));
  }

  // ------------------------------------------------------------ Pannello

  function renderPanel() {
    if (!mounted) return;
    const focusedCtl = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ctl');
    const ex = getExercise();
    const s = effective();
    const isQuiz = s.material === 'chord' && s.cex === 'quiz-top';
    const exLabel = Harmonize.exercise(s.material === 'chord' ? s.cex : s.ex).label;
    const summary = `${exLabel} · ${V.family(s.family).label} · ${label(Harmonize.STUDY, s.study)}`;
    const ok = !ex.error;
    const showForms = ok && settings.views.chart && (!isQuiz || revealed);
    const details = h('details', { class: 'card practice', open: panelOpen },
      h('summary', { class: 'practice-summary' },
        h('span', { class: 'practice-title' }, 'Esercizi'),
        h('span', { class: 'practice-sum' }, summary)),
      h('div', { class: 'practice-body' },
        isIOS() && h('p', { class: 'muted small ios-hint' }, 'Se non senti nulla, controlla che l\'iPhone non sia in modalità silenziosa.'),
        cosaAxis(), comeAxis(), doveAxis(), studioAxis(), opzioniAxis(),
        h('p', { class: 'practice-error', hidden: ok, role: 'status' }, ex.error || ''),
        ok && viewsBar(),
        ok && linkBar(),
        ok && isQuiz && quizView(ex),
        showForms && chartView(),
        ok && !isQuiz && settings.views.grid && ex.real && gridView(ex),
        ok && (!isQuiz || revealed) && settings.views.neck && neckView(),
        ok && (!isQuiz || revealed) && settings.views.tab && tabView(),
      ));
    details.firstChild.addEventListener('click', () => { panelOpen = !details.open; });
    details.addEventListener('toggle', () => { if (details.open) requestAnimationFrame(() => drawTab()); });
    mounted.container.replaceChildren(details);
    placeTransport();
    transport.render();
    updatePlayButton();
    neckCard = -1;
    if (ok && settings.views.neck) drawNeck(current && current.k >= 0 ? current.k : 0);
    requestAnimationFrame(() => drawTab());
    observeResize();
    if (focusedCtl) {
      const f = mounted.container.querySelector(`[data-ctl="${CSS.escape(focusedCtl)}"]`);
      if (f) f.focus({ preventScroll: true });
    }
    if (current) highlight(current);
  }

  function observeResize() {
    if (!('ResizeObserver' in root)) return;
    if (resizeObs) resizeObs.disconnect();
    resizeObs = new ResizeObserver(() => {
      const box = mounted && mounted.container.querySelector('.tab-scroll');
      if (box && Math.abs(Math.floor(box.clientWidth) - lastTabWidth) > 8) drawTab();
    });
    resizeObs.observe(mounted.container);
  }

  // ------------------------------------------------------------ API (come Practice)

  function configure(c) {
    cfg = { ...cfg, ...c };
    load();
  }

  function mount(context) {
    const same = mounted && mounted.key === context.key;
    if (!same) { stop(); current = null; revealed = false; }
    mounted = context;
    exercise = null;
    neckCard = -1;
    document.body.classList.add('has-transport');
    renderPanel();
  }

  function unmount() {
    stop();
    mounted = null;
    exercise = null;
    current = null;
    document.body.classList.remove('has-transport');
    if (transport.el.parentNode) transport.el.remove();
  }

  root.addEventListener('beforeprint', () => drawTab(720));
  root.addEventListener('afterprint', () => drawTab());

  root.CMPractice = {
    configure, mount, unmount, togglePlay, stop, applyLink,
    quickPlay: () => {},
    bumpBpm: (d) => transport.bumpBpm(d),
    isActive: () => !!mounted,
    isOpen: () => panelOpen,
    isPlaying: () => !!playing(),
  };
})(globalThis);
