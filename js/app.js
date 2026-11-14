/**
 * Guscio comune agli strumenti a estrazione (Scale, Arpeggi; ADR 0011): stato, estrazione
 * casuale di elemento × tonica, rendering, cronologia, drawer, scorciatoie, persistenza locale
 * e deep link. Lo strumento si descrive con una definizione passata ad App.start (js/scale.js,
 * js/arpeggi.js). Nato come porting di interval-master/src/app.rs.
 *
 * Definizione:
 *   storageKey   chiave localStorage dello strumento
 *   itemKey      nome del campo dell'elemento nelle estrazioni salvate ('scale', 'chord')
 *   linkKey      parametro del deep link che identifica l'elemento
 *   families     [{ id, label }]; items [{ family, … }]; slugs: identificatore di ogni elemento
 *   bestRoots(item, pc)   nomi ammessi della tonica
 *   title(item, root)     titolo mostrato
 *   poolLabel             es. 'Scale nel pool'
 *   practice              configurazione del pannello Esercizi (configure del pannello)
 *   panel                 pannello Esercizi (default window.Practice; Accordi: window.ChordPractice)
 *   decodeLink(params)    impostazioni dell'esercizio dal link (default Link.decodeExercise)
 *   view(item, root) → { eyebrow, sub, quizHint, notesLabel, notes, degreeLabels, noteLabels,
 *                        details: [[termine, valore]], semis, rootOnce, patterns, patternMeta(pat),
 *                        sectionTitle, sectionNote, plainTitle, hint(categoria),
 *                        facoltativi: diagram(pat, labels, title), patternCaption(pat, i),
 *                        groupLabel(pat): intestazione del gruppo di diteggiature }
 */
(function () {
  'use strict';

  const T = window.Theory;
  const F = window.Fretboard;
  const Link = window.Link;

  function start(def) {

  const PITCH_LABELS = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const HISTORY_LEN = 12;
  const STORAGE_KEY = def.storageKey;
  const K = def.itemKey;
  const DESKTOP = window.matchMedia('(min-width: 1024px)');
  const WIDE = window.matchMedia('(min-width: 1280px)');

  const items = def.items;
  const slugs = def.slugs;
  const isFamily = (id) => def.families.some((f) => f.id === id);
  const P = def.panel || window.Practice;
  P.configure(def.practice);

  // ------------------------------------------------------------ Stato

  /** Un'estrazione: indice dell'elemento nel catalogo (campo K) + tonica scritta. */
  const state = {
    enabled: new Set(def.families.map((f) => f.id)),
    fixedRoot: null, // null = casuale, altrimenti classe di altezza
    avoidRepeats: true,
    quizMode: false,
    revealed: false,
    dotLabel: 'degree', // 'degree' | 'note'
    current: null,
    history: [],
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const validPick = (p) => p && Number.isInteger(p[K]) && items[p[K]] && p.root &&
        Number.isInteger(p.root.letter) && Number.isInteger(p.root.accidental);
      if (Array.isArray(s.enabled)) state.enabled = new Set(s.enabled.filter(isFamily));
      if (s.fixedRoot === null || (Number.isInteger(s.fixedRoot) && s.fixedRoot >= 0 && s.fixedRoot < 12)) state.fixedRoot = s.fixedRoot;
      if (typeof s.avoidRepeats === 'boolean') state.avoidRepeats = s.avoidRepeats;
      if (typeof s.quizMode === 'boolean') state.quizMode = s.quizMode;
      if (s.dotLabel === 'degree' || s.dotLabel === 'note') state.dotLabel = s.dotLabel;
      if (validPick(s.current)) state.current = s.current;
      if (Array.isArray(s.history)) state.history = s.history.filter(validPick).slice(0, HISTORY_LEN);
    } catch (_) { /* storage non disponibile o dati corrotti: si parte puliti */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: [...state.enabled],
        fixedRoot: state.fixedRoot,
        avoidRepeats: state.avoidRepeats,
        quizMode: state.quizMode,
        dotLabel: state.dotLabel,
        current: state.current,
        history: state.history,
      }));
    } catch (_) { /* ignora */ }
  }

  // ------------------------------------------------------------ Logica

  const randInt = (n) => Math.floor(Math.random() * n);
  const samePick = (a, b) => !!a && !!b && a[K] === b[K] && T.noteEquals(a.root, b.root);

  function pool() {
    return items.map((_, i) => i).filter((i) => state.enabled.has(items[i].family));
  }

  function draw(p) {
    const item = p[randInt(p.length)];
    const pc = state.fixedRoot ?? randInt(12);
    const roots = def.bestRoots(items[item], pc);
    return { [K]: item, root: roots[randInt(roots.length)] };
  }

  function pickRandom() {
    const p = pool();
    if (!p.length) return;
    // Qualche tentativo per evitare di ripetere la stessa estrazione.
    let pick = draw(p);
    if (state.avoidRepeats) {
      for (let i = 0; i < 20 && samePick(pick, state.current); i++) pick = draw(p);
    }
    if (state.current) {
      state.history.unshift(state.current);
      state.history.length = Math.min(state.history.length, HISTORY_LEN);
    }
    state.current = pick;
    state.revealed = false;
    save();
    renderResult();
    renderHistory();
  }

  function showFromHistory(i) {
    const [p] = state.history.splice(i, 1);
    if (state.current) state.history.unshift(state.current);
    state.current = p;
    state.revealed = false;
    save();
    renderResult();
    renderHistory();
  }

  const titleOf = (p) => def.title(items[p[K]], p.root);

  // ------------------------------------------------------------ Deep link (Docs/deep-link.md)

  /**
   * Applica il link nel frammento: elemento e tonica diventano l'estrazione corrente, i parametri
   * dell'esercizio vanno al pannello. Poi il frammento si toglie dall'indirizzo, così ricaricare
   * la pagina non annulla le modifiche successive. Restituisce true se c'era un elemento valido.
   */
  function applyHash() {
    const { params } = Link.parse(location.hash);
    // Il solo tema lo gestisce theme.js: niente da applicare qui.
    if (!Object.keys(params).some((k) => k !== 'theme')) return false;
    const item = slugs.indexOf(params[def.linkKey]);
    const root = Link.parseNote(params.root);
    let ok = false;
    if (item >= 0 && root) {
      const pick = { [K]: item, root };
      if (state.current && !samePick(state.current, pick)) {
        state.history.unshift(state.current);
        state.history.length = Math.min(state.history.length, HISTORY_LEN);
      }
      state.current = pick;
      state.revealed = true;
      ok = true;
    }
    P.applyLink((def.decodeLink || Link.decodeExercise)(params));
    save();
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* file:// restrittivi */ }
    return ok;
  }

  // ------------------------------------------------------------ DOM helpers

  const $ = (sel) => document.querySelector(sel);

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

  // ------------------------------------------------------------ Impostazioni

  function renderSettings() {
    const fam = $('#families');
    fam.replaceChildren(...def.families.map((f) => {
      const count = items.filter((s) => s.family === f.id).length;
      const input = h('input', { type: 'checkbox', value: f.id });
      input.checked = state.enabled.has(f.id);
      input.addEventListener('change', () => {
        if (input.checked) state.enabled.add(f.id); else state.enabled.delete(f.id);
        onSettingsChanged();
      });
      return h('label', { class: 'check check-family' }, input, h('span', {}, f.label, h('em', { class: 'count' }, count)));
    }));

    const sel = $('#root-select');
    if (!sel.options.length) {
      sel.append(h('option', { value: '' }, 'Casuale'));
      PITCH_LABELS.forEach((l, pc) => sel.append(h('option', { value: pc }, l)));
      sel.addEventListener('change', () => {
        state.fixedRoot = sel.value === '' ? null : Number(sel.value);
        onSettingsChanged();
      });
    }
    sel.value = state.fixedRoot == null ? '' : String(state.fixedRoot);

    $('#avoid-repeats').checked = state.avoidRepeats;
    $('#quiz-mode').checked = state.quizMode;
    updatePool();
  }

  function updatePool() {
    const n = pool().length;
    $('#pool-count').textContent = `${def.poolLabel}: ${n}`;
    $('#draw').disabled = n === 0;
    $('#empty-pool').hidden = n !== 0;
  }

  function onSettingsChanged() {
    save();
    updatePool();
  }

  // ------------------------------------------------------------ Risultato

  function renderResult() {
    const out = $('#result');
    const p = state.current;
    if (!p) {
      P.unmount();
      out.replaceChildren($('#tpl-empty').content.cloneNode(true));
      return;
    }
    const item = items[p[K]];
    const v = def.view(item, p.root);

    const head = h('section', { class: 'card scale-head' },
      h('p', { class: 'eyebrow' }, v.eyebrow),
      h('h2', { class: 'scale-title' }, titleOf(p)),
      v.sub && h('p', { class: 'aka' }, v.sub),
    );

    if (state.quizMode && !state.revealed) {
      head.append(h('div', { class: 'quiz' },
        h('p', { class: 'muted' }, v.quizHint),
        h('button', {
          type: 'button', class: 'secondary-btn',
          onclick: () => { state.revealed = true; renderResult(); },
        }, 'Mostra soluzione'),
      ));
      P.unmount();
      out.replaceChildren(head);
      return;
    }

    head.append(
      h('ol', { class: 'notes', 'aria-label': v.notesLabel },
        v.noteLabels.map((n, i) => h('li', { class: i === 0 ? 'is-root' : '' },
          h('span', { class: 'note-name' }, n),
          h('span', { class: 'note-degree' }, v.degreeLabels[i]),
        )),
      ),
      h('dl', { class: 'details' },
        v.details.map(([term, value]) => h('div', {}, h('dt', {}, term), h('dd', {}, value)))),
    );

    const labels = state.dotLabel === 'degree' ? v.degreeLabels : v.noteLabels;

    const diagram = v.diagram || F.render;
    let group = null;
    const grid = h('div', { class: 'patterns' + (v.diagram ? ' patterns-compact' : '') },
      v.patterns.flatMap((pat, i) => {
        const caption = v.patternCaption ? v.patternCaption(pat, i) : `Diteggiatura ${i + 1}`;
        const meta = v.patternMeta(pat);
        const g = v.groupLabel ? v.groupLabel(pat) : null;
        const head = g && g !== group ? h('h3', { class: 'pattern-group' }, g) : null;
        group = g;
        return [head, h('figure', { class: 'card pattern', 'data-pattern': i },
          h('figcaption', {},
            h('span', { class: 'cap-text' }, h('strong', {}, caption), h('span', {}, meta)),
            h('button', {
              type: 'button', class: 'quick-btn', 'data-quick': i,
              'aria-label': `Ascolta: ${caption}`,
              onclick: () => P.quickPlay(i),
            }, h('span', { class: 't-icon', 'aria-hidden': 'true' }))),
          diagram(pat, labels, `${caption}, ${meta}`),
        )];
      }),
    );

    const segmented = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Etichette dei pallini' },
      [['degree', 'Gradi'], ['note', 'Note']].map(([val, l]) => h('button', {
        type: 'button', role: 'radio',
        'aria-checked': String(state.dotLabel === val),
        onclick: () => { state.dotLabel = val; save(); renderResult(); },
      }, l)),
    );

    const fingerings = h('section', { class: 'fingerings' },
      h('div', { class: 'section-head' },
        h('h2', {}, v.sectionTitle),
        segmented,
      ),
      h('p', { class: 'muted small' }, v.sectionNote),
      grid,
    );

    const practiceHost = h('div', { class: 'practice-host' });
    out.replaceChildren(head, practiceHost, fingerings);
    P.mount({
      key: `${p[K]}:${p.root.letter}:${p.root.accidental}`,
      item, root: p.root,
      semis: v.semis, rootOnce: !!v.rootOnce, patterns: v.patterns,
      degreeLabels: v.degreeLabels, noteLabels: v.noteLabels,
      rootPc: T.pitchClass(p.root),
      labelMode: state.dotLabel,
      container: practiceHost,
      title: v.plainTitle,
      hint: v.hint,
      link: { [def.linkKey]: slugs[p[K]], root: Link.noteParam(p.root) },
    });
  }

  // ------------------------------------------------------------ Cronologia

  function renderHistory() {
    const list = $('#history-list');
    list.replaceChildren(...state.history.map((p, i) => h('li', {},
      h('button', {
        type: 'button', class: 'history-item', title: 'Mostra di nuovo',
        onclick: () => { showFromHistory(i); closePanels(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      }, titleOf(p)),
    )));
    $('#history-empty').hidden = state.history.length > 0;
  }

  // ------------------------------------------------------------ Pannelli (drawer su mobile)

  const panels = { settings: $('#settings'), history: $('#history') };
  const openers = { settings: $('#open-settings'), history: $('#open-history') };
  let lastFocus = null;

  /** I pannelli sono drawer quando non c'è spazio per mostrarli come colonne. */
  function isDrawer(name) {
    return name === 'settings' ? !DESKTOP.matches : !WIDE.matches;
  }

  function openPanel(name) {
    closePanels(false);
    lastFocus = document.activeElement;
    panels[name].classList.add('is-open');
    panels[name].removeAttribute('inert');
    openers[name].setAttribute('aria-expanded', 'true');
    $('#backdrop').hidden = false;
    document.body.classList.add('has-drawer');
    const focusable = panels[name].querySelector('button, input, select');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function closePanels(restoreFocus = true) {
    let wasOpen = false;
    for (const [name, panel] of Object.entries(panels)) {
      if (panel.classList.contains('is-open')) wasOpen = true;
      panel.classList.remove('is-open');
      openers[name].setAttribute('aria-expanded', 'false');
    }
    $('#backdrop').hidden = true;
    document.body.classList.remove('has-drawer');
    syncInert();
    if (wasOpen && restoreFocus && lastFocus) lastFocus.focus({ preventScroll: true });
  }

  /** I drawer chiusi non devono ricevere il focus da tastiera. */
  function syncInert() {
    for (const [name, panel] of Object.entries(panels)) {
      if (isDrawer(name) && !panel.classList.contains('is-open')) panel.setAttribute('inert', '');
      else panel.removeAttribute('inert');
    }
  }

  // ------------------------------------------------------------ Eventi

  function bind() {
    $('#draw').addEventListener('click', pickRandom);
    $('#all-families').addEventListener('click', () => {
      state.enabled = new Set(def.families.map((f) => f.id));
      renderSettings(); save();
    });
    $('#no-families').addEventListener('click', () => {
      state.enabled.clear();
      renderSettings(); save();
    });
    $('#avoid-repeats').addEventListener('change', (e) => { state.avoidRepeats = e.target.checked; save(); });
    $('#quiz-mode').addEventListener('change', (e) => {
      state.quizMode = e.target.checked;
      state.revealed = false;
      save();
      renderResult();
    });

    openers.settings.addEventListener('click', () => openPanel('settings'));
    openers.history.addEventListener('click', () => openPanel('history'));
    $('#backdrop').addEventListener('click', () => closePanels());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closePanels()));

    const onBreakpoint = () => closePanels(false);
    DESKTOP.addEventListener('change', onBreakpoint);
    WIDE.addEventListener('change', onBreakpoint);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closePanels(); return; }
      if (![' ', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.body.classList.contains('has-drawer')) return;
      // Niente scorciatoia mentre un controllo usa la tastiera.
      const t = e.target;
      if (t.closest && t.closest('input, select, textarea, button, a, summary, [contenteditable], .neck-scroll')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!P.isActive()) return;
        e.preventDefault();
        P.bumpBpm(e.key === 'ArrowRight' ? 5 : -5);
        return;
      }
      e.preventDefault();
      // Spazio: Play/Stop con il pannello Esercizi aperto; Invio: nuova estrazione.
      if (e.key === ' ' && P.isActive() && P.isOpen()) P.togglePlay();
      else pickRandom();
    });
  }

  load();
  applyHash();
  renderSettings();
  renderResult();
  renderHistory();
  syncInert();
  bind();
  // Un link incollato nella stessa scheda: si applica senza ricaricare.
  window.addEventListener('hashchange', () => {
    if (!location.hash) return;
    applyHash();
    renderResult();
    renderHistory();
    window.scrollTo({ top: 0 });
  });
  }

  window.App = { start };
})();
