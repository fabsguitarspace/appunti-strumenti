/**
 * Pannello Esercizi dello strumento Ritmi (ADR 0016): Cosa (partenza, ritmo per battuta, note
 * tolte, accenti) · Come (altezze, swing) · Base (progressione, basso, accordi, posizione del
 * click) · Opzioni; viste sincronizzate (griglia ritmica con conteggio e note, tablatura), link
 * dell'esercizio. Stessa interfaccia di Practice e ProgPractice verso il guscio comune (js/app.js).
 */
(function (root) {
  'use strict';

  const { Theory: T, Rhythms: R, RhythmLine: RL, Progressions: PS, TabLayout, TabRender, Transport, Link } = root;
  const DESKTOP = root.matchMedia('(min-width: 1024px)');
  const { BPM_MIN, BPM_MAX, clampBpm } = Transport;
  const mod = (a, n) => ((a % n) + n) % n;

  const METRO = [
    ['all', 'Tutti i battiti'], ['two-four', 'Sul 2 e sul 4'], ['one-three', 'Sull\'1 e sul 3'],
    ['downbeat', 'Solo sull\'1'], ['three', 'Solo sul 3'], ['four', 'Solo sul 4'],
    ['and-two-four', 'Sull\'«e» del 2 e del 4'],
  ];
  const NOTES_NOTE = {
    perc: 'Una sola altezza, la tonica: tutta l\'attenzione va al ritmo.',
    chord: 'Le note dell\'accordo in vigore, su e giù nel registro: il ritmo decide quando cambiano.',
    scale: 'Una sequenza di quattro note (1-2-3-4, 2-3-4-5…) sulla scala dell\'accordo. La sequenza continua da un attacco all\'altro: le pause tolgono note, non le spostano.',
    guide: 'Terza e settima dell\'accordo in vigore, alternate e vicine fra loro.',
  };
  const label = (list, v) => (list.find(([k]) => k === String(v)) || [null, ''])[1];
  const oneOf = (list, v, fallback) => (list.some(([k]) => k === String(v)) ? v : fallback);
  const BASES = () => [['none', 'Nessuna (solo metronomo)'], ...PS.catalog().map((p) => [p.id, p.label])];

  let cfg = { storageKey: 'gsp:ritmi:practice:v1' };

  const defaults = () => ({
    ...RL.DEFAULTS,
    // 60 BPM come gli esempi del volume.
    bpm: 60, metronome: true, metroMode: 'two-four', countIn: true, loop: true,
    volNotes: 0.8, volStudy: 0.45, volBass: 0.7, volClick: 0.6,
    trainer: { on: false, step: 5, every: 2, max: 160 },
    views: { grid: true, counts: true, names: false, tab: false },
  });

  let settings = defaults();

  function merge(base, s) {
    const out = {
      ...base, ...s,
      trainer: { ...base.trainer, ...(s.trainer || {}) },
      views: { ...base.views, ...(s.views || {}) },
    };
    if (!(Number.isInteger(out.start) && out.start >= 0 && out.start < 16) && !R.START_MODES.includes(out.start)) out.start = base.start;
    out.seed = Number.isInteger(out.seed) && out.seed > 0 ? out.seed : base.seed;
    out.vary = !!out.vary;
    out.omit = oneOf(R.OMIT, out.omit, base.omit);
    out.accent = oneOf(R.ACCENTS, out.accent, base.accent);
    out.notes = oneOf(RL.NOTES, out.notes, base.notes);
    out.feel = oneOf(RL.FEELS, out.feel, base.feel);
    out.base = oneOf(BASES(), out.base, base.base);
    out.bass = oneOf(RL.BASS, out.bass, base.bass);
    out.comp = out.comp !== false;
    out.metroMode = oneOf(METRO, out.metroMode, base.metroMode);
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

  let mounted = null;   // { key, item (figura), root (tonalità), container, title, link }
  let exercise = null;
  let current = null;
  const openAxes = new Set(DESKTOP.matches ? ['cosa', 'come', 'base', 'opzioni'] : ['cosa']);
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
  const { select, segmented, toggle, chips, axis, optionsAxis } = root.PanelUI.create('rp-', openAxes);

  // ------------------------------------------------------------ Esercizio

  /** Partenze ammesse per la figura: celle della battuta, in sequenza o casuale. */
  function startOptions(item) {
    const per = R.METER * item.div;
    const pos = Array.from({ length: per }, (_, p) => [String(p), R.positionName(p, item.div)]);
    return [...pos, ['seq', 'Tutte, in sequenza'], ['rand', 'Casuale']];
  }

  /** Impostazioni valide per la figura montata (es. una partenza oltre la griglia torna sull'1). */
  function effective() {
    const s = { ...settings };
    const item = mounted && mounted.item;
    if (item && item.kind === 'consecutive') {
      const per = R.METER * item.div;
      if (Number.isInteger(s.start) && s.start >= per) s.start = 0;
    }
    return s;
  }

  function getExercise() {
    if (exercise) return exercise;
    exercise = RL.build(mounted.item, mounted.root, effective());
    return exercise;
  }

  function change(fn) {
    fn(settings);
    save();
    exercise = null;
    if (playing()) stop();
    renderPanel();
  }

  // ------------------------------------------------------------ Trasporto

  function placeTransport() {
    const slot = document.getElementById('transport-slot');
    if (slot && transport.el.parentNode !== slot) slot.appendChild(transport.el);
  }

  function updatePlayButton() {
    const p = playing();
    const ex = mounted && getExercise();
    transport.setPlayButton(!!p && p.mode === 'exercise', !ex || !ex.events.length);
  }

  function togglePlay() {
    const p = playing();
    if (p && p.mode === 'exercise') stop();
    else if (mounted) {
      const ex = getExercise();
      if (ex.events.length) transport.start(ex, 'exercise');
    }
  }

  function stop() {
    transport.stop();
    updatePlayButton();
  }

  // ------------------------------------------------------------ Evidenziazione

  function highlight(ev) {
    const c = mounted && mounted.container;
    document.querySelectorAll('.is-playing').forEach((e) => e.classList.remove('is-playing'));
    if (ev && ev.backing) {
      // La base non cambia l'evidenziazione: resta l'ultimo attacco della linea.
      if (current) highlight(current);
      return;
    }
    current = ev;
    if (!ev || !c) return;
    const cell = c.querySelector(`.rg-cell[data-a="${ev.a}"]`);
    if (cell) {
      cell.classList.add('is-playing');
      const bar = cell.closest('.rg-bar');
      if (bar) bar.classList.add('is-playing');
    }
    c.querySelectorAll(`.tab-num[data-i="${ev.i}"]`).forEach((x) => x.classList.add('is-playing'));
  }

  // ------------------------------------------------------------ Griglia ritmica

  /** Nome della nota (tonalità di riferimento per i diesis e i bemolle). */
  function noteName(midi) {
    const pc = mod(midi, 12);
    const flats = mounted && mounted.root.accidental < 0;
    const c = T.rootCandidates(pc);
    const n = c.find((x) => (flats ? x.accidental <= 0 : x.accidental >= 0)) || c[0];
    return T.noteToString(n, true);
  }

  /**
   * Griglia della figura: una casella per battuta, i gironi in proporzione alla durata, una cella
   * per suddivisione (attacco pieno, prolungamento a barra, pausa vuota). Usata anche dal quiz.
   * @param rhythm  risultato di Rhythms.realize
   * @param o       { counts, names: [MIDI per attacco], chords: [[{ beat, symbol }]] per battuta }
   */
  function gridView(rhythm, o = {}) {
    const byCell = new Map();
    rhythm.attacks.forEach((a) => byCell.set(`${a.span}:${a.c}`, a));
    let spanIndex = 0;
    const bars = rhythm.bars.map((bar, b) => {
      let beat = 0;
      const spans = bar.spans.map((sp) => {
        const si = spanIndex++;
        const beatIndex = beat;
        beat += sp.beats;
        let sounding = false;
        const cells = [...sp.cells].map((ch, c) => {
          const a = ch === 'x' ? byCell.get(`${si}:${c}`) : null;
          if (ch === 'x') sounding = true;
          else if (ch === '.') sounding = false;
          const kind = ch === 'x' ? 'is-x' : ch === '-' && sounding ? 'is-sus' : 'is-rest';
          const cls = ['rg-cell', kind, a && a.accent ? 'is-acc' : ''].filter(Boolean).join(' ');
          return h('span', { class: cls, 'data-a': a ? a.i : null },
            h('span', { class: 'rg-mark', 'aria-hidden': 'true' }),
            o.counts && h('span', { class: 'rg-count' }, R.countLabel(sp, c, beatIndex)),
            o.names && a && o.names[a.i] != null && h('span', { class: 'rg-name' }, noteName(o.names[a.i])));
        });
        return h('div', {
          class: 'rg-span' + (sp.cycleStart && rhythm.cycleMarks ? ' rg-cycle' : ''),
          style: `flex: ${sp.beats} 1 0`,
          title: sp.div === sp.beats * 2 ? null : `${sp.div} in ${sp.beats === 1 ? 'una pulsazione' : sp.beats + ' pulsazioni'}`,
        }, cells);
      });
      const chords = o.chords && o.chords[b];
      return h('div', { class: 'rg-bar', 'data-bar': b },
        h('span', { class: 'rg-num' }, String(b + 1)),
        chords && chords.length ? h('div', { class: 'rg-chords' }, chords.map((x) => h('span', {
          class: 'rg-chord', style: `left: ${(x.beat / R.METER) * 100}%`,
        }, x.symbol))) : null,
        h('div', { class: 'rg-beats' }, spans));
    });
    return h('div', { class: 'rhythm-grid' + (o.counts ? ' has-counts' : '') + (o.names ? ' has-names' : ''),
      role: 'img', 'aria-label': 'Griglia ritmica: celle piene per gli attacchi, barre per le note tenute, vuote per le pause' }, bars);
  }

  /** Sigle per battuta della base realizzata. */
  function chordsPerBar(ex) {
    if (!ex.real) return null;
    const out = ex.real.bars.map(() => []);
    for (const seg of ex.real.timeline) {
      const b = Math.floor(seg.beat / R.METER);
      if (out[b]) out[b].push({ beat: seg.beat - b * R.METER, symbol: seg.chord.symbol });
    }
    return out;
  }

  function gridSection(ex) {
    const v = settings.views;
    const names = v.names ? RL.lineEvents(ex).reduce((acc, e) => { acc[e.a] = e.midi; return acc; }, []) : null;
    const rhythm = { ...ex.rhythm, cycleMarks: mounted.item.family === 'sovrapposizioni' };
    return h('section', { class: 'view view-grid' },
      h('div', { class: 'view-head' },
        h('h3', { class: 'view-title' }, 'Griglia'),
        h('span', { class: 'muted small' }, gridCaption(ex))),
      gridView(rhythm, { counts: v.counts, names, chords: chordsPerBar(ex) }));
  }

  function gridCaption(ex) {
    const d = R.describe(mounted.item, ex.cycle);
    const parts = [`${d.attacks} attacchi nel ciclo`, `ciclo di ${d.length}`];
    if (ex.restart) parts.push('riparte a ogni giro della base');
    return parts.join(' · ');
  }

  // ------------------------------------------------------------ Tablatura

  function tabSection(ex) {
    if (!RL.tabbable(ex)) {
      return h('section', { class: 'view view-tab' },
        h('h3', { class: 'view-title' }, 'Tablatura'),
        h('p', { class: 'muted small' }, 'Questa figura ha gironi di più pulsazioni o settimine e nonine: segui la griglia.'));
    }
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
    const lay = TabLayout.layout(RL.tabEvents(ex), { width, meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    box.replaceChildren(TabRender.render(lay, { width }));
    if (current) highlight(current);
  }

  function copyTab(btn) {
    const ex = getExercise();
    const txt = `${mounted.title}\n\n` + TabLayout.toAscii(RL.tabEvents(ex), { meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    copyText(txt, () => { btn.textContent = 'Copiata ✓'; setTimeout(() => { btn.textContent = 'Copia tab'; }, 1500); });
  }

  // ------------------------------------------------------------ Assi

  function cosaAxis() {
    const item = mounted.item;
    const s = effective();
    const sum = [];
    const parts = [];
    if (item.kind === 'consecutive') {
      sum.push(s.start === 'seq' ? 'tutte le partenze' : s.start === 'rand' ? 'partenza casuale' : 'da ' + R.positionName(s.start, item.div));
      parts.push(select('start', 'Partenza', startOptions(item), String(s.start),
        (v) => change((st) => { st.start = v === 'seq' || v === 'rand' ? v : Number(v); })));
    }
    if (item.kind === 'perbar') {
      sum.push(s.vary ? 'un ritmo per battuta' : 'stesso ritmo');
      parts.push(segmented('vary', 'Ritmo', [['0', 'Lo stesso in ogni battuta'], ['1', 'Diverso in ogni battuta']], s.vary ? '1' : '0',
        (v) => change((st) => { st.vary = v === '1'; })));
    }
    parts.push(select('omit', 'Note', R.OMIT, s.omit, (v) => change((st) => { st.omit = v; })));
    if (s.omit !== 'none') sum.push(label(R.OMIT, s.omit).toLowerCase());
    parts.push(select('accent', 'Accenti', R.ACCENTS, s.accent, (v) => change((st) => { st.accent = v; })));
    const random = (item.kind === 'consecutive' && s.start === 'rand') || item.kind === 'perbar' || s.omit !== 'none';
    if (random) {
      parts.push(h('div', { class: 'row-buttons' }, h('button', {
        type: 'button', class: 'chip-btn', 'data-ctl': 'reseed',
        onclick: () => change((st) => { st.seed = 1 + Math.floor(Math.random() * 999998); }),
      }, 'Nuova figura casuale')));
    }
    parts.push(h('p', { class: 'muted small' }, cosaNote(item, s)));
    return axis('cosa', 'Cosa', sum.join(' · ') || item.label, ...parts);
  }

  function cosaNote(item, s) {
    if (item.kind === 'consecutive') {
      return s.start === 'rand'
        ? 'Gruppi della stessa lunghezza in punti diversi della battuta, anche a cavallo della stanghetta.'
        : 'Lo stesso gruppo da ogni punto della battuta: le note dopo la stanghetta possono già suonare l\'accordo successivo.';
    }
    if (item.kind === 'perbar') return 'Il numero di note è fisso, il ritmo no: ascolta quante note dice la frase e dove cadono.';
    if (item.family === 'sovrapposizioni') return 'La figura dura 3, 5 o 7 pulsazioni e attraversa le stanghette: torna sull\'uno dopo 3, 5 o 7 battute.';
    if (item.family === 'marce' || item.family === 'cambi') return 'Note uniformi in una «marcia»: conta le pulsazioni, non le note, e lascia che la frase scorra sopra il tempo.';
    return 'Suona la figura come uno strumento a percussione, poi con le note.';
  }

  function comeAxis() {
    const s = effective();
    return axis('come', 'Come', `${label(RL.NOTES, s.notes)} · ${label(RL.FEELS, s.feel).toLowerCase()}`,
      segmented('notes', 'Altezze', RL.NOTES, s.notes, (v) => change((st) => { st.notes = v; })),
      segmented('feel', 'Crome', RL.FEELS, s.feel, (v) => change((st) => { st.feel = v; })),
      h('p', { class: 'muted small' }, NOTES_NOTE[s.notes]),
    );
  }

  function baseAxis() {
    const s = effective();
    const hasBase = s.base !== 'none';
    const sum = [label(BASES(), s.base), 'click: ' + label(METRO, s.metroMode).toLowerCase()];
    return axis('base', 'Base', sum.join(' · '),
      select('base', 'Progressione', BASES(), s.base, (v) => change((st) => { st.base = v; })),
      hasBase && h('div', { class: 'field-row' },
        select('bass', 'Basso', RL.BASS, s.bass, (v) => change((st) => { st.bass = v; })),
        h('div', { class: 'toggles' }, toggle('comp', 'Accordi', s.comp, (v) => change((st) => { st.comp = v; })))),
      h('p', { class: 'muted small' }, hasBase
        ? 'La base è una progressione del capitolo «Progressioni» nella tonalità estratta; le altezze seguono i suoi accordi.'
        : 'Senza base le altezze stanno sull\'accordo di tonica.'),
      h('p', { class: 'muted small' }, 'La posizione del click è nelle Opzioni: sul 2 e sul 4 fa il charleston della batteria; solo sul 4, o sull\'«e» del 2 e del 4, ti lascia tenere il resto del tempo da solo.'),
    );
  }

  function opzioniAxis() {
    return optionsAxis({
      settings, change, bpmMin: BPM_MIN, bpmMax: BPM_MAX, metroModes: METRO,
      volumes: [
        ['volNotes', 'notes', 'Volume ritmo'], ['volStudy', 'study', 'Volume accordi'],
        ['volBass', 'bass', 'Volume basso'], ['volClick', 'click', 'Volume metronomo'],
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
    return chips('views', 'Viste', [['grid', 'Griglia'], ['counts', 'Conteggio'], ['names', 'Note'], ['tab', 'Tablatura']],
      (k) => v[k], (k) => change((st) => { st.views[k] = !st.views[k]; }));
  }

  function exerciseUrl() {
    const base = root.location.href.split('#')[0];
    const s = effective();
    const item = mounted.item;
    const random = item.kind === 'perbar' || (item.kind === 'consecutive' && s.start === 'rand');
    const enc = Link.encodeRhythmExercise({ ...s, random, start: item.kind === 'consecutive' ? s.start : null, vary: item.kind === 'perbar' && s.vary });
    return base + Link.build({ ...mounted.link, ...enc });
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
    panelOpen = true;
    openAxes.add('cosa'); openAxes.add('come'); openAxes.add('base');
  }

  // ------------------------------------------------------------ Pannello

  function renderPanel() {
    if (!mounted) return;
    const focusedCtl = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ctl');
    const ex = getExercise();
    const s = effective();
    const summary = `${label(RL.NOTES, s.notes)} · ${label(BASES(), s.base)}`;
    const details = h('details', { class: 'card practice', open: panelOpen },
      h('summary', { class: 'practice-summary' },
        h('span', { class: 'practice-title' }, 'Esercizi'),
        h('span', { class: 'practice-sum' }, summary)),
      h('div', { class: 'practice-body' },
        isIOS() && h('p', { class: 'muted small ios-hint' }, 'Se non senti nulla, controlla che l\'iPhone non sia in modalità silenziosa.'),
        cosaAxis(), comeAxis(), baseAxis(), opzioniAxis(),
        h('p', { class: 'practice-error', hidden: !ex.error, role: 'status' }, ex.error || ''),
        !ex.error && viewsBar(),
        !ex.error && linkBar(),
        !ex.error && settings.views.grid && gridSection(ex),
        !ex.error && settings.views.tab && tabSection(ex),
      ));
    details.firstChild.addEventListener('click', () => { panelOpen = !details.open; });
    details.addEventListener('toggle', () => { if (details.open) requestAnimationFrame(() => drawTab()); });
    mounted.container.replaceChildren(details);
    placeTransport();
    transport.render();
    updatePlayButton();
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
    if (!same) { stop(); current = null; }
    mounted = context;
    exercise = null;
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

  root.RhythmPractice = {
    configure, mount, unmount, togglePlay, stop, applyLink, gridView,
    quickPlay: () => {},
    bumpBpm: (d) => transport.bumpBpm(d),
    isActive: () => !!mounted,
    isOpen: () => panelOpen,
    isPlaying: () => !!playing(),
  };
})(globalThis);
