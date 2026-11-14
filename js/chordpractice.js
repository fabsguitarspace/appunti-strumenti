/**
 * Pannello Esercizi dello strumento Accordi (ADR 0012): Cosa (rivolti, ciclo delle quarte,
 * II–V–I) · Come (ritmo d'accompagnamento, battute per accordo, pennata) · Dove (famiglia di
 * voicing, corde, zona) · Opzioni; viste sincronizzate (accordi, tastiera, tablatura), ascolto
 * dei voicing, link dell'esercizio. Stessa interfaccia di Practice (js/practice.js) verso il
 * guscio comune (js/app.js); il trasporto è in transport.js.
 */
(function (root) {
  'use strict';

  const { Theory: T, Chords: C, Voicings: V, Comping, Fretboard, ChordChart, TabLayout, TabRender, Transport, Events, Link } = root;
  const DESKTOP = root.matchMedia('(min-width: 1024px)');
  const { BPM_MIN, BPM_MAX, clampBpm } = Transport;

  const DIRECTIONS = [['up', 'Su'], ['down', 'Giù'], ['updown', 'Su e giù']];
  const BARS = [['1', '1 battuta'], ['2', '2 battute']];
  const label = (list, v) => (list.find(([k]) => k === String(v)) || [null, ''])[1];
  const oneOf = (list, v, fallback) => (list.some(([k]) => k === String(v)) ? v : fallback);

  let cfg = { storageKey: 'gsp:accordi:practice:v1' };

  const defaults = () => ({
    ...Comping.DEFAULTS,
    bpm: 80, metronome: true, metroMode: 'all', loop: true, countIn: true,
    volNotes: 0.8, volClick: 0.6,
    trainer: { on: false, step: 5, every: 2, max: 160 },
    views: { chords: true, neck: false, tab: true },
  });

  let settings = defaults();

  function merge(base, s) {
    const out = {
      ...base, ...s,
      trainer: { ...base.trainer, ...(s.trainer || {}) },
      views: { ...base.views, ...(s.views || {}) },
    };
    if (!Comping.EXERCISES.some((e) => e.id === out.exId)) out.exId = base.exId;
    if (!Comping.RHYTHMS.some((r) => r.id === out.rhythmId)) out.rhythmId = base.rhythmId;
    if (!V.family(out.family)) out.family = base.family;
    out.direction = oneOf(DIRECTIONS, out.direction, base.direction);
    out.attack = oneOf(Comping.ATTACKS, out.attack, base.attack);
    out.bars = Number(out.bars) === 2 ? 2 : 1;
    const fret = (f, d) => (Number.isInteger(f) && f >= 1 && f <= 20 ? f : d);
    out.fretFrom = fret(out.fretFrom, base.fretFrom);
    out.fretTo = fret(out.fretTo, base.fretTo);
    if (typeof out.set !== 'string') out.set = base.set;
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

  let mounted = null;   // { key, item, root, patterns, degreeLabels, noteLabels, labelMode, container, title, link }
  let exercise = null;
  let current = null;
  const openAxes = new Set(DESKTOP.matches ? ['cosa', 'come', 'dove', 'opzioni'] : []);
  let panelOpen = DESKTOP.matches;
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

  // ------------------------------------------------------------ DOM helpers

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  function select(id, text, options, value, onChange) {
    const s = h('select', { id: 'cp-' + id, 'data-ctl': id });
    for (const [v, l] of options) s.append(h('option', { value: v }, l));
    s.value = String(value);
    s.addEventListener('change', () => onChange(s.value));
    return h('label', { class: 'field', for: 'cp-' + id }, h('span', { class: 'field-label' }, text), s);
  }

  function segmented(id, text, options, value, onChange) {
    return h('div', { class: 'field' },
      h('span', { class: 'field-label', id: 'cp-' + id + '-l' }, text),
      h('div', { class: 'segmented seg-wrap', role: 'radiogroup', 'aria-labelledby': 'cp-' + id + '-l' },
        options.map(([v, l]) => h('button', {
          type: 'button', role: 'radio', 'data-ctl': id + ':' + v,
          'aria-checked': String(String(value) === String(v)), onclick: () => onChange(v),
        }, l))));
  }

  function toggle(id, text, checked, onChange) {
    const input = h('input', { type: 'checkbox', 'data-ctl': id });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return h('label', { class: 'check' }, input, h('span', {}, text));
  }

  function chips(id, text, options, isOn, onToggle) {
    return h('div', { class: 'field' },
      h('span', { class: 'field-label' }, text),
      h('div', { class: 'chips' }, options.map(([v, l]) => h('button', {
        type: 'button', class: 'chip', 'data-ctl': id + ':' + v,
        'aria-pressed': String(isOn(v)), onclick: () => onToggle(v),
      }, l))));
  }

  function axis(id, title, summary, ...content) {
    const d = h('details', { class: 'axis', 'data-axis': id, open: openAxes.has(id) },
      h('summary', {}, h('span', { class: 'axis-title' }, title), h('span', { class: 'axis-sum' }, summary)),
      h('div', { class: 'axis-body' }, ...content));
    d.firstChild.addEventListener('click', () => { if (d.open) openAxes.delete(id); else openAxes.add(id); });
    return d;
  }

  // ------------------------------------------------------------ Esercizio

  /** Famiglie con voicing per l'accordo corrente; la scelta salvata vale se disponibile. */
  function families() {
    return V.familiesFor(mounted.item);
  }

  function effective() {
    const fams = families();
    const family = fams.includes(settings.family) ? settings.family : fams[0];
    const sets = V.family(family).sets.map(V.setLabel);
    const set = settings.set === 'all' || sets.includes(settings.set) ? settings.set : (family === 'shell' ? 'all' : sets[0]);
    return { ...settings, family, set };
  }

  function getExercise() {
    if (!exercise) exercise = Comping.build(mounted.item, mounted.root, effective());
    return exercise;
  }

  function change(fn) {
    fn(settings);
    save();
    exercise = null;
    if (playing()) stop();
    renderPanel();
  }

  const setName = (l) => (l === 'all' ? 'Tutte' : l.split('').join('–'));

  /** Etichette (gradi o note) delle note di un accordo dell'esercizio. */
  function labelsOf(c) {
    return mounted.labelMode === 'note'
      ? C.spell(c.quality, c.root).map((n) => T.noteToString(n, true))
      : c.quality.tones.map((t) => C.toneToString(t, true));
  }

  // ------------------------------------------------------------ Trasporto

  function placeTransport() {
    const home = mounted && mounted.container.querySelector('.transport-home');
    const slot = document.getElementById('transport-slot');
    const target = DESKTOP.matches ? home : slot;
    if (target && transport.el.parentNode !== target) target.appendChild(transport.el);
  }

  function updatePlayButton() {
    const p = playing();
    const ex = mounted && getExercise();
    transport.setPlayButton(!!p && p.mode === 'exercise', !ex || !ex.events.length);
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

  /** Ascolto di un voicing: pennata e poi le note una per una. */
  function quickPlay(index) {
    if (!mounted) return;
    const p = playing();
    if (p && p.mode === 'pattern' && p.patternIndex === index) { stop(); return; }
    const v = mounted.patterns[index];
    if (!v) return;
    const events = [{ i: 0, beat: 0, dur: 2, ndur: 2, notes: v.notes, accent: true, strum: Comping.STRUM }];
    v.notes.forEach((n, k) => events.push({ i: k + 1, beat: 2 + k / 2, dur: 0.5, ndur: 0.5, notes: [n], string: n.string, fret: n.fret, midi: n.midi }));
    events.push({ i: events.length, beat: 4, dur: 2, ndur: 2, notes: v.notes, accent: false, strum: Comping.STRUM });
    transport.start({ events, lengthBeats: 8, pickupBeats: 0 }, 'pattern', { patternIndex: index });
  }

  function stop() {
    transport.stop();
    updatePlayButton();
  }

  // ------------------------------------------------------------ Evidenziazione

  function highlight(ev) {
    document.querySelectorAll('.is-playing').forEach((e) => e.classList.remove('is-playing'));
    current = ev;
    if (!ev || !mounted) return;
    const c = mounted.container;
    const p = playing();
    const sels = Events.notesOf(ev).map((n) => `.dot[data-s="${n.string}"][data-f="${n.fret}"]`);
    const mark = (scope) => sels.forEach((sel) => { const d = scope && scope.querySelector(sel); if (d) d.classList.add('is-playing'); });
    if (p && p.mode === 'pattern') { mark(document.querySelector(`figure[data-pattern="${p.patternIndex}"]`)); return; }
    mark(c.querySelector('.view-neck'));
    const li = c.querySelector(`.chord-seq [data-c="${ev.chord}"]`);
    if (li) { li.classList.add('is-playing'); mark(li); }
    const num = c.querySelector(`.tab-num[data-i="${ev.i}"]`);
    if (num) num.classList.add('is-playing');
    c.querySelectorAll(`.tab-num[data-i="${ev.i}"]`).forEach((x) => x.classList.add('is-playing'));
  }

  // ------------------------------------------------------------ Pannello

  function cosaAxis() {
    const s = settings;
    const ex = Comping.exercise(s.exId);
    return axis('cosa', 'Cosa', ex.label + (s.exId === 'inv' ? ' · ' + label(DIRECTIONS, s.direction) : ''),
      select('ex', 'Esercizio', Comping.EXERCISES.map((e) => [e.id, e.label]), s.exId, (v) => change((st) => { st.exId = v; })),
      s.exId === 'inv' && segmented('direction', 'Direzione', DIRECTIONS, s.direction, (v) => change((st) => { st.direction = v; })),
      s.exId === 'cycle' && h('p', { class: 'muted small' }, 'Dodici accordi della stessa qualità per quarte, dall\'accordo estratto; i voicing si collegano con il movimento minimo delle voci.'),
      s.exId === 'ii-v-i' && h('p', { class: 'muted small' }, 'L\'accordo estratto è il I. Qualità minori: IIø – V7 – Im6; le altre: IIm7 – V7 – Imaj7 (con le triadi: II, V, I).'),
    );
  }

  function comeAxis() {
    const s = settings;
    const r = Comping.rhythmDef(s.rhythmId);
    return axis('come', 'Come', [r.label, label(BARS, s.bars), r.arp ? '' : label(Comping.ATTACKS, s.attack)].filter(Boolean).join(' · '),
      select('rhythm', 'Ritmo', Comping.RHYTHMS.map((x) => [x.id, x.label]), s.rhythmId, (v) => change((st) => { st.rhythmId = v; })),
      segmented('bars', 'Per ogni accordo', BARS, s.bars, (v) => change((st) => { st.bars = Number(v); })),
      !r.arp && segmented('attack', 'Attacco', Comping.ATTACKS, s.attack, (v) => change((st) => { st.attack = v; })),
    );
  }

  function doveAxis() {
    const e = effective();
    const fams = families();
    const sets = V.family(e.family).sets.map(V.setLabel);
    const frets = Array.from({ length: 20 }, (_, f) => [String(f + 1), String(f + 1)]);
    return axis('dove', 'Dove', `${V.family(e.family).label} · corde ${setName(e.set)} · tasti ${Math.min(e.fretFrom, e.fretTo)}–${Math.max(e.fretFrom, e.fretTo)}`,
      select('family', 'Voicing', fams.map((f) => [f, V.family(f).label]), e.family, (v) => change((st) => {
        st.family = v; st.set = v === 'shell' ? 'all' : V.setLabel(V.family(v).sets[0]);
      })),
      chips('set', 'Corde (dalla più grave)', [['all', 'Tutte'], ...sets.map((l) => [l, setName(l)])],
        (v) => v === e.set, (v) => change((st) => { st.family = e.family; st.set = v; })),
      h('div', { class: 'field-row' },
        select('from', 'Dal tasto', frets, e.fretFrom, (v) => change((st) => { st.fretFrom = Number(v); })),
        select('to', 'Al tasto', frets, e.fretTo, (v) => change((st) => { st.fretTo = Number(v); }))),
      h('p', { class: 'muted small' }, e.exId === 'inv'
        ? 'I rivolti dentro la zona, dal più grave al più acuto.'
        : 'Zona preferita: i voicing ne escono solo se il collegamento lo richiede.'),
    );
  }

  function opzioniAxis() {
    const s = settings;
    const tr = s.trainer;
    const sum = [s.metronome ? 'Metronomo' : 'Senza metronomo', s.loop ? 'loop' : 'una volta'];
    if (tr.on && s.loop) sum.push(`trainer +${tr.step}`);
    const num = (id, text, value, min, max, step, onChange) => {
      const input = h('input', { type: 'number', id: 'cp-' + id, 'data-ctl': id, min, max, step, value, inputmode: 'numeric' });
      input.addEventListener('change', () => onChange(Math.max(min, Math.min(max, Number(input.value) || min))));
      return h('label', { class: 'field', for: 'cp-' + id }, h('span', { class: 'field-label' }, text), input);
    };
    const range = (id, text, value, onChange) => {
      const input = h('input', { type: 'range', id: 'cp-' + id, 'data-ctl': id, min: 0, max: 1, step: 0.05, value });
      input.addEventListener('input', () => onChange(Number(input.value)));
      return h('label', { class: 'field', for: 'cp-' + id }, h('span', { class: 'field-label' }, text), input);
    };
    return axis('opzioni', 'Opzioni', sum.join(' · '),
      h('div', { class: 'toggles' },
        toggle('metronome', 'Metronomo', s.metronome, (v) => change((st) => { st.metronome = v; })),
        toggle('loop', 'Ripeti (loop)', s.loop, (v) => change((st) => { st.loop = v; })),
        toggle('countin', 'Battuta d\'attacco', s.countIn, (v) => change((st) => { st.countIn = v; }))),
      select('metromode', 'Click del metronomo', [['all', 'Tutti i battiti'], ['downbeat', 'Solo il primo battito']], s.metroMode,
        (v) => change((st) => { st.metroMode = v; })),
      h('div', { class: 'field-row' },
        range('volnotes', 'Volume accordi', s.volNotes, (v) => { settings.volNotes = v; save(); transport.setVolumes({ notes: v }); }),
        range('volclick', 'Volume metronomo', s.volClick, (v) => { settings.volClick = v; save(); transport.setVolumes({ click: v }); })),
      toggle('trainer', 'Trainer di velocità (con il loop)', tr.on, (v) => change((st) => { st.trainer.on = v; })),
      tr.on && h('div', { class: 'field-row three' },
        num('tstep', '+BPM', tr.step, 1, 40, 1, (v) => change((st) => { st.trainer.step = v; })),
        num('tevery', 'ogni N giri', tr.every, 1, 16, 1, (v) => change((st) => { st.trainer.every = v; })),
        num('tmax', 'fino a BPM', tr.max, BPM_MIN, BPM_MAX, 5, (v) => change((st) => { st.trainer.max = v; }))),
    );
  }

  function showError(msg) {
    const p = mounted && mounted.container.querySelector('.practice-error');
    if (p) { p.textContent = msg; p.hidden = !msg; }
  }

  function viewsBar() {
    const v = settings.views;
    return chips('views', 'Viste', [['chords', 'Accordi'], ['neck', 'Tastiera'], ['tab', 'Tablatura']],
      (k) => v[k], (k) => change((st) => { st.views[k] = !st.views[k]; }));
  }

  function exerciseUrl() {
    const base = root.location.href.split('#')[0];
    return base + Link.build({ ...mounted.link, ...Link.encodeChordExercise(effective()) });
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
    openAxes.add('cosa'); openAxes.add('come'); openAxes.add('dove');
  }

  function chordsView(ex) {
    return h('section', { class: 'view view-chords' },
      h('h3', { class: 'view-title' }, 'Accordi'),
      h('ol', { class: 'chord-seq' }, ex.chords.map((c, k) => h('li', { 'data-c': k },
        h('span', { class: 'chord-sym' }, c.symbol),
        ChordChart.render(c.voicing, labelsOf(c), `${c.symbol}, corde ${setName(c.voicing.label)}`)))));
  }

  function neckView(ex) {
    const seen = new Map();
    ex.chords.forEach((c) => {
      const labels = labelsOf(c);
      for (const n of c.voicing.notes) {
        const key = n.string + ':' + n.fret;
        if (!seen.has(key)) seen.set(key, { string: n.string, fret: n.fret, degree: 0, label: labels[n.tone], root: n.tone === 0 });
      }
    });
    const pos = [...seen.values()];
    const frets = pos.map((p) => p.fret);
    const lo = Math.max(0, Math.min(...frets) - 1);
    const hi = Math.min(24, Math.max(...frets) + 1);
    const svg = Fretboard.render({ positions: pos, minFret: lo, maxFret: hi }, [], 'Accordi dell\'esercizio sulla tastiera',
      { fretFrom: lo, fretTo: hi, cellWidth: 36 });
    return h('section', { class: 'view view-neck' },
      h('h3', { class: 'view-title' }, 'Tastiera'),
      h('div', { class: 'neck-scroll', tabindex: 0, 'aria-label': 'Tastiera, scorrevole' }, svg));
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
    const lay = TabLayout.layout(ex.events, { width, meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    box.replaceChildren(TabRender.render(lay, { width }));
    if (current) highlight(current);
  }

  function copyTab(btn) {
    const ex = getExercise();
    const names = ex.chords.map((c) => c.symbol).join(' | ');
    const txt = `${mounted.title}\n${names}\n\n` + TabLayout.toAscii(ex.events, { meter: 4, pickupBeats: 0, lengthBeats: ex.lengthBeats });
    copyText(txt, () => { btn.textContent = 'Copiata ✓'; setTimeout(() => { btn.textContent = 'Copia tab'; }, 1500); });
  }

  function copyText(txt, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }

  function fallbackCopy(txt, done) {
    const ta = h('textarea', { class: 'visually-hidden' });
    ta.value = txt;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { /* niente */ }
    ta.remove();
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function renderPanel() {
    if (!mounted) return;
    const focusedCtl = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-ctl');
    const ex = getExercise();
    const s = effective();
    const summary = `${Comping.exercise(s.exId).label} · ${Comping.rhythmDef(s.rhythmId).label} · ${V.family(s.family).label}`;
    const details = h('details', { class: 'card practice', open: panelOpen },
      h('summary', { class: 'practice-summary' },
        h('span', { class: 'practice-title' }, 'Esercizi'),
        h('span', { class: 'practice-sum' }, summary)),
      h('div', { class: 'practice-body' },
        h('div', { class: 'transport-home' }),
        isIOS() && h('p', { class: 'muted small ios-hint' }, 'Se non senti nulla, controlla che l\'iPhone non sia in modalità silenziosa.'),
        cosaAxis(), comeAxis(), doveAxis(), opzioniAxis(),
        h('p', { class: 'practice-error', hidden: !ex.error, role: 'status' }, ex.error || ''),
        !ex.error && viewsBar(),
        !ex.error && linkBar(),
        !ex.error && settings.views.chords && chordsView(ex),
        !ex.error && settings.views.neck && neckView(ex),
        !ex.error && settings.views.tab && tabView(),
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
    if (!same) { stop(); }
    mounted = context;
    exercise = null;
    document.body.classList.add('has-transport');
    renderPanel();
  }

  function unmount() {
    stop();
    mounted = null;
    exercise = null;
    document.body.classList.remove('has-transport');
    if (transport.el.parentNode) transport.el.remove();
  }

  DESKTOP.addEventListener('change', () => { if (mounted) placeTransport(); });
  root.addEventListener('beforeprint', () => drawTab(720));
  root.addEventListener('afterprint', () => drawTab());

  root.ChordPractice = {
    configure, mount, unmount, quickPlay, togglePlay, stop, applyLink,
    bumpBpm: (d) => transport.bumpBpm(d),
    isActive: () => !!mounted,
    isOpen: () => panelOpen,
    isPlaying: () => !!playing(),
  };
})(globalThis);
