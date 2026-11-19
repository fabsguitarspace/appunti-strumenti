/**
 * Pannello Esercizi dello strumento Progressioni (ADR 0013, punto 9): Cosa (giri, forma, finale,
 * gradi romani) · Come (ritmo d'attacco, attacco, basso) · Dove (famiglia di voicing, corde, zona) ·
 * Studio (griglia, note guida, arpeggio, «suona tu») · Opzioni; viste sincronizzate (griglia,
 * tastiera dell'accordo corrente, tablatura dell'accompagnamento), link dell'esercizio.
 * Stessa interfaccia di Practice e ChordPractice verso il guscio comune (js/app.js).
 */
(function (root) {
  'use strict';

  const {
    Theory: T, Chords: C, Voicings: V, Progression, Comping, Bass, ProgComp,
    Fretboard, TabLayout, TabRender, Transport, Events, Link,
  } = root;
  const DESKTOP = root.matchMedia('(min-width: 1024px)');
  const { BPM_MIN, BPM_MAX, clampBpm } = Transport;
  const mod = (a, n) => ((a % n) + n) % n;

  const STUDY = [['grid', 'Griglia'], ['guide', 'Note guida'], ['arp', 'Arpeggio'], ['play', 'Suona tu']];
  const STUDY_NOTE = {
    grid: 'L\'accordo corrente si accende nella griglia; tastiera e tablatura mostrano il voicing suonato.',
    guide: 'Terza e settima di ogni accordo nella zona scelta, collegate con il minimo movimento: segui una linea, poi l\'altra.',
    arp: 'Le note dell\'accordo corrente nella zona scelta, da vedere: parti da queste prima di aggiungere una scala.',
    play: 'L\'accompagnamento tace: restano basso e metronomo, e la tastiera mostra le note dell\'accordo. Suona tu.',
  };
  const GIRI = [['1', '1 giro'], ['2', '2 giri'], ['4', '4 giri'], ['0', 'Continuo']];
  const FORMS = [['short', 'Breve'], ['full', 'Intera']];
  const ENDINGS = [['loop', 'Ciclico'], ['closed', 'Chiuso']];
  const label = (list, v) => (list.find(([k]) => k === String(v)) || [null, ''])[1];
  const oneOf = (list, v, fallback) => (list.some(([k]) => k === String(v)) ? v : fallback);

  let cfg = { storageKey: 'gsp:progressioni:practice:v1' };

  const defaults = () => ({
    family: ProgComp.DEFAULTS.family, set: ProgComp.DEFAULTS.set,
    fretFrom: ProgComp.DEFAULTS.fretFrom, fretTo: ProgComp.DEFAULTS.fretTo,
    rhythmId: ProgComp.DEFAULTS.rhythmId, attack: ProgComp.DEFAULTS.attack, bass: ProgComp.DEFAULTS.bass,
    study: 'grid', giri: 0, form: 'short', ending: 'loop', romans: false, guideAudio: false,
    // 60 BPM come gli esempi del capitolo.
    bpm: 60, metronome: true, metroMode: 'all', countIn: true,
    volNotes: 0.8, volBass: 0.8, volStudy: 0.5, volClick: 0.6,
    trainer: { on: false, step: 5, every: 2, max: 160 },
    views: { grid: true, neck: true, tab: false },
  });

  let settings = defaults();

  function merge(base, s) {
    const out = {
      ...base, ...s,
      trainer: { ...base.trainer, ...(s.trainer || {}) },
      views: { ...base.views, ...(s.views || {}) },
    };
    if (!Comping.PROG_RHYTHMS.some((r) => r.id === out.rhythmId)) out.rhythmId = base.rhythmId;
    if (!V.family(out.family)) out.family = base.family;
    out.attack = oneOf(Comping.ATTACKS, out.attack, base.attack);
    if (!Bass.MODES.some((m) => m.id === out.bass)) out.bass = base.bass;
    out.study = oneOf(STUDY, out.study, base.study);
    out.giri = Number(oneOf(GIRI, out.giri, base.giri));
    out.form = oneOf(FORMS, out.form, base.form);
    out.ending = oneOf(ENDINGS, out.ending, base.ending);
    const fret = (f, d) => (Number.isInteger(f) && f >= 1 && f <= 20 ? f : d);
    out.fretFrom = fret(out.fretFrom, base.fretFrom);
    out.fretTo = fret(out.fretTo, base.fretTo);
    if (typeof out.set !== 'string') out.set = base.set;
    out.romans = !!out.romans;
    out.guideAudio = !!out.guideAudio;
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

  let mounted = null;   // { key, item (progressione), root (tonalità), labelMode, container, title, link }
  let exercise = null;
  let current = null;
  let neckSeg = -1;     // segmento mostrato sulla tastiera
  const openAxes = new Set(DESKTOP.matches ? ['cosa', 'come', 'dove', 'studio', 'opzioni'] : ['studio']);
  let panelOpen = true;
  let resizeObs = null;
  let lastTabWidth = 0;

  const transport = Transport.create({
    // I giri decidono il loop: «Continuo» è il loop, 1, 2 o 4 giri suonano una volta.
    options: () => ({ ...settings, loop: settings.giri === 0 }),
    onBpm: (bpm) => { settings.bpm = bpm; save(); },
    onPlayClick: () => togglePlay(),
    onHighlight: (ev) => highlight(ev),
    onChange: () => updatePlayButton(),
    onError: (msg) => showError(msg),
  });
  const playing = () => transport.playing();

  // ------------------------------------------------------------ DOM helpers (js/panel-ui.js)

  const { h, copyText, isIOS } = root.PanelUI;
  const { select, segmented, toggle, chips, axis, optionsAxis } = root.PanelUI.create('pp-', openAxes);

  // ------------------------------------------------------------ Esercizio

  /** Ritmi adatti alla famiglia (Freddie Green: solo shell e triadi). */
  function rhythmsFor(family) {
    return Comping.PROG_RHYTHMS.filter((r) => !r.families || r.families.includes(family));
  }

  function effective() {
    const family = V.family(settings.family) ? settings.family : 'shell';
    const sets = V.family(family).sets.map(V.setLabel);
    const set = settings.set === 'all' || sets.includes(settings.set) ? settings.set : 'all';
    const rhythmId = rhythmsFor(family).some((r) => r.id === settings.rhythmId) ? settings.rhythmId : 'half';
    const prog = mounted ? mounted.item : null;
    const form = prog && prog.fullForm ? settings.form : 'short';
    const ending = prog && prog.ending && settings.giri !== 0 ? settings.ending : 'loop';
    return { ...settings, family, set, rhythmId, form, ending };
  }

  function getExercise() {
    if (exercise) return exercise;
    const s = effective();
    const prog = mounted.item;
    const real = Progression.realize(prog, {
      key: mounted.root, full: s.form === 'full', ending: s.ending === 'closed', giri: s.giri || 1,
    });
    exercise = ProgComp.build(real, {
      ...s, fourVoices: prog.fourVoices,
      comp: s.study !== 'play', guide: s.study === 'guide' && s.guideAudio, loop: s.giri === 0,
    });
    exercise.real = real;
    return exercise;
  }

  function change(fn) {
    fn(settings);
    save();
    exercise = null;
    neckSeg = -1;
    if (playing()) stop();
    renderPanel();
  }

  const setName = (l) => (l === 'all' ? 'Tutte' : l.split('').join('–'));

  // ------------------------------------------------------------ Etichette

  /** Nome scritto di un'altezza nell'accordo (Fa, non Mi♯), oppure il nome più semplice. */
  function noteName(chord, midi) {
    const notes = C.spell({ ...chord.quality, tones: V.toneList(chord.quality) }, chord.root)
      .concat(chord.bass ? [chord.bass] : []);
    const n = notes.find((x) => T.pitchClass(x) === mod(midi, 12));
    const name = n || T.rootCandidates(mod(midi, 12))[0];
    return T.noteToString(name, true);
  }

  /** Etichetta di una nota dell'accordo: grado (1, ♭3, ♭7…) o nome, secondo le impostazioni. */
  function toneLabel(chord, midi) {
    if (mounted.labelMode === 'note') return noteName(chord, midi);
    const rootPc = T.pitchClass(chord.root);
    const t = V.toneList(chord.quality).find((x) => mod(rootPc + C.toneSemitones(x), 12) === mod(midi, 12));
    return t ? C.toneToString(t, true) : noteName(chord, midi);
  }

  // ------------------------------------------------------------ Trasporto

  /** Il trasporto sta nella barra in cima alla pagina (in basso su mobile), sempre a portata. */
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
    current = ev;
    if (!ev || !c) return;
    const k = ev.chord;
    const seg = c.querySelector(`.prog-grid [data-seg="${k}"]`);
    if (seg) {
      seg.classList.add('is-playing');
      const bar = seg.closest('.pg-bar');
      if (bar) bar.classList.add('is-playing');
    }
    if (settings.views.neck && k !== neckSeg) drawNeck(k);
    if (ev.part === 'comp' || ev.part === undefined) {
      const neck = c.querySelector('.view-neck');
      Events.notesOf(ev).forEach((n) => {
        const d = neck && neck.querySelector(`.dot[data-s="${n.string}"][data-f="${n.fret}"]`);
        if (d) d.classList.add('is-playing');
      });
      c.querySelectorAll(`.tab-num[data-i="${ev.i}"]`).forEach((x) => x.classList.add('is-playing'));
    }
  }

  // ------------------------------------------------------------ Griglia

  /**
   * Griglia della progressione: righe di quattro battute, etichette di sezione, sigle e gradi.
   * Usata anche dal quiz della pagina (solo gradi romani, nessuna sigla).
   * @param real  risultato di Progression.realize
   * @param o     { symbols = true, romans = false, guide: [{ low, high }] per segmento, names(chord, midi) }
   */
  function gridView(real, o = {}) {
    const showSym = o.symbols !== false;
    const rows = [];
    let k = 0;
    let row = null;
    let lastLabel = null;
    real.bars.forEach((bar, i) => {
      if (i % 4 === 0) { row = h('div', { class: 'pg-row' }); rows.push(row); }
      const startsSection = bar.label !== lastLabel || (i > 0 && bar.giro !== real.bars[i - 1].giro);
      lastLabel = bar.label;
      const tags = [];
      if (bar.giro > 0 && (i === 0 || bar.giro !== real.bars[i - 1].giro)) tags.push(`Giro ${bar.giro + 1}`);
      if (startsSection && (real.bars.some((b) => b.label !== bar.label) || bar.label !== 'A')) tags.push(bar.label);
      row.append(h('div', { class: 'pg-bar', 'data-bar': i },
        tags.length ? h('span', { class: 'pg-sec' }, tags.join(' · ')) : null,
        h('div', { class: 'pg-chords' }, bar.chords.map((chord) => {
          const g = o.guide && o.guide[k];
          const cell = h('span', { class: 'pg-chord', 'data-seg': k },
            showSym && h('span', { class: 'pg-sym' }, chord.symbol),
            (o.romans || !showSym) && h('span', { class: 'pg-roman' }, chord.roman),
            g && o.names && h('span', { class: 'pg-guide' }, `${o.names(chord, g.low)} · ${o.names(chord, g.high)}`));
          k++;
          return cell;
        }))));
    });
    return h('div', { class: 'prog-grid', role: 'list', 'aria-label': 'Griglia della progressione' }, rows);
  }

  function gridSection(ex) {
    const s = effective();
    const guide = s.study === 'guide' ? ex.segments.map((x) => x.guide) : null;
    return h('section', { class: 'view view-grid' },
      h('h3', { class: 'view-title' }, 'Griglia'),
      gridView(ex.real, { romans: s.romans, guide, names: noteName }));
  }

  // ------------------------------------------------------------ Tastiera dell'accordo corrente

  function neckSection() {
    return h('section', { class: 'view view-neck' },
      h('div', { class: 'view-head' },
        h('h3', { class: 'view-title' }, 'Tastiera'),
        h('span', { class: 'neck-chord muted small' })),
      h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': 'Tastiera, scorrevole' }));
  }

  /** Posizioni da mostrare per il segmento: voicing, note guida o note dell'accordo nella zona. */
  function positionsFor(seg, s, lo, hi) {
    const chord = seg.chord;
    if (s.study === 'grid') {
      return seg.voicing.notes.map((n) => ({
        string: n.string, fret: n.fret, degree: 0, label: toneLabel(chord, n.midi),
        root: mod(n.midi, 12) === T.pitchClass(chord.root),
      }));
    }
    if (s.study === 'guide') {
      if (!seg.guide) return [];
      return [seg.guide.low, seg.guide.high].map((m) => ProgComp.placeGuide(m, lo, hi)).map((n) => ({
        string: n.string, fret: n.fret, degree: 0, label: toneLabel(chord, n.midi), root: false,
      }));
    }
    // Arpeggio e «suona tu»: tutte le note dell'accordo nella zona (basso della sigla compreso).
    const rootPc = T.pitchClass(chord.root);
    const pcs = new Set(C.semitones(chord.quality).map((x) => mod(rootPc + x, 12)));
    if (chord.bass) pcs.add(T.pitchClass(chord.bass));
    const out = [];
    for (let st = 0; st < 6; st++) {
      for (let f = lo; f <= hi; f++) {
        const midi = root.Guitar.TUNING[st] + f;
        if (pcs.has(mod(midi, 12))) {
          out.push({ string: st, fret: f, degree: 0, label: toneLabel(chord, midi), root: mod(midi, 12) === rootPc });
        }
      }
    }
    return out;
  }

  function drawNeck(k) {
    if (!mounted) return;
    const box = mounted.container.querySelector('.view-neck .neck-scroll');
    if (!box) return;
    const ex = getExercise();
    const seg = ex.segments[k] || ex.segments[0];
    if (!seg) return;
    neckSeg = ex.segments[k] ? k : 0;
    const s = effective();
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const pos = positionsFor(seg, s, lo, hi);
    const frets = pos.map((p) => p.fret);
    const from = Math.max(0, Math.min(lo, ...frets) - 1);
    const to = Math.min(22, Math.max(hi, ...frets) + 1);
    const title = `${seg.chord.symbol} sulla tastiera`;
    box.replaceChildren(Fretboard.render({ positions: pos, minFret: from, maxFret: to }, [], title,
      { fretFrom: from, fretTo: to, cellWidth: 36 }));
    const cap = mounted.container.querySelector('.view-neck .neck-chord');
    if (cap) cap.textContent = `${seg.chord.symbol} · ${seg.chord.roman}`;
  }

  // ------------------------------------------------------------ Tablatura

  const compEvents = (ex) => ex.events.filter((e) => e.part === 'comp');

  function tabSection() {
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
    const lay = TabLayout.layout(compEvents(ex), { width, meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    box.replaceChildren(TabRender.render(lay, { width }));
    if (current) highlight(current);
  }

  function gridText(ex) {
    const lines = [];
    for (let i = 0; i < ex.real.bars.length; i += 4) {
      lines.push('| ' + ex.real.bars.slice(i, i + 4).map((b) => b.chords.map((c) => c.symbol).join(' ')).join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  function copyTab(btn) {
    const ex = getExercise();
    const txt = `${mounted.title}\n${gridText(ex)}\n\n` + TabLayout.toAscii(compEvents(ex), { meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    copyText(txt, () => { btn.textContent = 'Copiata ✓'; setTimeout(() => { btn.textContent = 'Copia tab'; }, 1500); });
  }

  // ------------------------------------------------------------ Assi

  function cosaAxis() {
    const s = effective();
    const prog = mounted.item;
    const sum = [label(GIRI, s.giri)];
    if (prog.fullForm) sum.push(s.form === 'full' ? 'forma intera' : 'forma breve');
    if (prog.ending && s.giri !== 0) sum.push(s.ending === 'closed' ? 'finale chiuso' : 'finale ciclico');
    return axis('cosa', 'Cosa', sum.join(' · '),
      segmented('giri', 'Giri', GIRI, s.giri, (v) => change((st) => { st.giri = Number(v); })),
      prog.fullForm && segmented('form', `Forma (breve ${prog.form.join('–')}, intera ${prog.fullForm.join('–')})`, FORMS, s.form,
        (v) => change((st) => { st.form = v; })),
      prog.ending && s.giri !== 0 && segmented('ending', 'Finale dell\'ultimo giro', ENDINGS, s.ending,
        (v) => change((st) => { st.ending = v; })),
      toggle('romans', 'Gradi romani nella griglia', s.romans, (v) => change((st) => { st.romans = v; })),
      h('p', { class: 'muted small' }, s.giri === 0
        ? 'Il giro si ripete finché premi Stop; il trainer di velocità funziona solo così.'
        : 'Conta le battute in gruppi di quattro e riconosci un punto di riferimento per gruppo.'),
    );
  }

  function comeAxis() {
    const s = effective();
    const r = Comping.progRhythmDef(s.rhythmId);
    const bass = Bass.MODES.find((m) => m.id === s.bass);
    return axis('come', 'Come', [r.label, r.arp ? '' : label(Comping.ATTACKS, s.attack), 'basso: ' + bass.label.toLowerCase()].filter(Boolean).join(' · '),
      select('rhythm', 'Ritmo d\'attacco', rhythmsFor(s.family).map((x) => [x.id, x.label]), s.rhythmId, (v) => change((st) => { st.rhythmId = v; })),
      !r.arp && segmented('attack', 'Attacco', Comping.ATTACKS, s.attack, (v) => change((st) => { st.attack = v; })),
      select('bass', 'Basso', Bass.MODES.map((m) => [m.id, m.label]), s.bass, (v) => change((st) => { st.bass = v; })),
      h('p', { class: 'muted small' }, 'Il ritmo d\'attacco è indipendente dal ritmo armonico: ogni colpo suona l\'accordo in vigore.'),
    );
  }

  function doveAxis() {
    const e = effective();
    const sets = V.family(e.family).sets.map(V.setLabel);
    const frets = Array.from({ length: 20 }, (_, f) => [String(f + 1), String(f + 1)]);
    return axis('dove', 'Dove', `${V.family(e.family).label} · corde ${setName(e.set)} · tasti ${Math.min(e.fretFrom, e.fretTo)}–${Math.max(e.fretFrom, e.fretTo)}`,
      select('family', 'Voicing', V.FAMILIES.map((f) => [f.id, f.label]), e.family, (v) => change((st) => { st.family = v; st.set = 'all'; })),
      chips('set', 'Corde (dalla più grave)', [['all', 'Tutte'], ...sets.map((l) => [l, setName(l)])],
        (v) => v === e.set, (v) => change((st) => { st.family = e.family; st.set = v; })),
      h('div', { class: 'field-row' },
        select('from', 'Dal tasto', frets, e.fretFrom, (v) => change((st) => { st.fretFrom = Number(v); })),
        select('to', 'Al tasto', frets, e.fretTo, (v) => change((st) => { st.fretTo = Number(v); }))),
      h('p', { class: 'muted small' }, e.family === 'shell'
        ? 'Shell sulle corde 6–4–3 e 5–4–3. Semidiminuiti, 7♭9, diminuiti e sigle con basso usano quattro voci, come nel capitolo.'
        : 'Zona preferita: i voicing ne escono solo se il collegamento lo richiede.'),
    );
  }

  function studioAxis() {
    const s = effective();
    return axis('studio', 'Studio', label(STUDY, s.study),
      segmented('study', 'Modalità', STUDY, s.study, (v) => change((st) => { st.study = v; })),
      s.study === 'guide' && toggle('guideaudio', 'Fai suonare le note guida (piano)', s.guideAudio,
        (v) => change((st) => { st.guideAudio = v; })),
      h('p', { class: 'muted small' }, STUDY_NOTE[s.study]),
    );
  }

  function opzioniAxis() {
    return optionsAxis({
      settings, change, bpmMin: BPM_MIN, bpmMax: BPM_MAX, loop: settings.giri === 0,
      volumes: [
        ['volNotes', 'notes', 'Volume accordi'], ['volBass', 'bass', 'Volume basso'],
        ['volStudy', 'study', 'Volume note guida'], ['volClick', 'click', 'Volume metronomo'],
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
    return chips('views', 'Viste', [['grid', 'Griglia'], ['neck', 'Tastiera'], ['tab', 'Tablatura']],
      (k) => v[k], (k) => change((st) => { st.views[k] = !st.views[k]; }));
  }

  function exerciseUrl() {
    const base = root.location.href.split('#')[0];
    return base + Link.build({ ...mounted.link, ...Link.encodeProgExercise(effective()) });
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
    openAxes.add('cosa'); openAxes.add('come'); openAxes.add('studio');
  }

  // ------------------------------------------------------------ Pannello

  function renderPanel() {
    if (!mounted) return;
    const focusedCtl = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ctl');
    const ex = getExercise();
    const s = effective();
    const summary = `${label(STUDY, s.study)} · ${Comping.progRhythmDef(s.rhythmId).label} · ${V.family(s.family).label}`;
    const showTab = settings.views.tab && s.study !== 'play';
    const details = h('details', { class: 'card practice', open: panelOpen },
      h('summary', { class: 'practice-summary' },
        h('span', { class: 'practice-title' }, 'Esercizi'),
        h('span', { class: 'practice-sum' }, summary)),
      h('div', { class: 'practice-body' },
        isIOS() && h('p', { class: 'muted small ios-hint' }, 'Se non senti nulla, controlla che l\'iPhone non sia in modalità silenziosa.'),
        cosaAxis(), comeAxis(), doveAxis(), studioAxis(), opzioniAxis(),
        h('p', { class: 'practice-error', hidden: !ex.error, role: 'status' }, ex.error || ''),
        !ex.error && viewsBar(),
        !ex.error && linkBar(),
        !ex.error && settings.views.grid && gridSection(ex),
        !ex.error && settings.views.neck && neckSection(),
        !ex.error && showTab && tabSection(),
        !ex.error && settings.views.tab && s.study === 'play' && h('p', { class: 'muted small' }, 'Con «Suona tu» la tablatura dell\'accompagnamento è vuota.'),
      ));
    details.firstChild.addEventListener('click', () => { panelOpen = !details.open; });
    details.addEventListener('toggle', () => { if (details.open) requestAnimationFrame(() => drawTab()); });
    mounted.container.replaceChildren(details);
    placeTransport();
    transport.render();
    updatePlayButton();
    if (!ex.error && settings.views.neck) drawNeck(current ? current.chord : 0);
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
    neckSeg = -1;
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

  root.ProgPractice = {
    configure, mount, unmount, togglePlay, stop, applyLink, gridView,
    quickPlay: () => {},
    bumpBpm: (d) => transport.bumpBpm(d),
    isActive: () => !!mounted,
    isOpen: () => panelOpen,
    isPlaying: () => !!playing(),
  };
})(globalThis);
