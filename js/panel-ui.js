/**
 * Aiuti comuni ai pannelli Esercizi (ADR 0012, Conseguenze; ADR 0013, punto 9): costruzione del
 * DOM, controlli (select, segmented, toggle, chips), assi richiudibili, asse Opzioni del trasporto,
 * copia negli appunti. Usato da js/chordpractice.js e js/progpractice.js; il pannello delle
 * scale (js/practice.js) ha ancora i suoi.
 */
(function (root) {
  'use strict';

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

  /**
   * Controlli con id prefissati (es. 'cp-'): gli id restano quelli di prima dell'estrazione.
   * @param prefix    prefisso degli id
   * @param openAxes  Set degli assi aperti, condiviso con il pannello
   */
  function create(prefix, openAxes) {
    const pid = (id) => prefix + id;

    function select(id, text, options, value, onChange) {
      const s = h('select', { id: pid(id), 'data-ctl': id });
      for (const [v, l] of options) s.append(h('option', { value: v }, l));
      s.value = String(value);
      s.addEventListener('change', () => onChange(s.value));
      return h('label', { class: 'field', for: pid(id) }, h('span', { class: 'field-label' }, text), s);
    }

    function segmented(id, text, options, value, onChange) {
      return h('div', { class: 'field' },
        h('span', { class: 'field-label', id: pid(id) + '-l' }, text),
        h('div', { class: 'segmented seg-wrap', role: 'radiogroup', 'aria-labelledby': pid(id) + '-l' },
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

    function num(id, text, value, min, max, step, onChange) {
      const input = h('input', { type: 'number', id: pid(id), 'data-ctl': id, min, max, step, value, inputmode: 'numeric' });
      input.addEventListener('change', () => onChange(Math.max(min, Math.min(max, Number(input.value) || min))));
      return h('label', { class: 'field', for: pid(id) }, h('span', { class: 'field-label' }, text), input);
    }

    function range(id, text, value, onChange) {
      const input = h('input', { type: 'range', id: pid(id), 'data-ctl': id, min: 0, max: 1, step: 0.05, value });
      input.addEventListener('input', () => onChange(Number(input.value)));
      return h('label', { class: 'field', for: pid(id) }, h('span', { class: 'field-label' }, text), input);
    }

    /**
     * Asse Opzioni del trasporto: metronomo, loop, battuta d'attacco, click, volumi, trainer.
     * @param o { settings, change(fn), onVolume(key, bus, value),
     *            volumes: [[chiave delle impostazioni, bus, etichetta]], bpmMin, bpmMax,
     *            loop: facoltativo, il loop deciso da un altro controllo (Progressioni: «giri»);
     *                  allora l'interruttore del loop non compare }
     */
    function optionsAxis(o) {
      const s = o.settings;
      const tr = s.trainer;
      const loop = o.loop ?? s.loop;
      const sum = [s.metronome ? 'Metronomo' : 'Senza metronomo'];
      if (o.loop === undefined) sum.push(s.loop ? 'loop' : 'una volta');
      if (tr.on && loop) sum.push(`trainer +${tr.step}`);
      const change = o.change;
      return axis('opzioni', 'Opzioni', sum.join(' · '),
        h('div', { class: 'toggles' },
          toggle('metronome', 'Metronomo', s.metronome, (v) => change((st) => { st.metronome = v; })),
          o.loop === undefined && toggle('loop', 'Ripeti (loop)', s.loop, (v) => change((st) => { st.loop = v; })),
          toggle('countin', 'Battuta d\'attacco', s.countIn, (v) => change((st) => { st.countIn = v; }))),
        select('metromode', 'Click del metronomo', [['all', 'Tutti i battiti'], ['downbeat', 'Solo il primo battito']], s.metroMode,
          (v) => change((st) => { st.metroMode = v; })),
        h('div', { class: 'field-row' + (o.volumes.length > 2 ? ' three' : '') },
          o.volumes.map(([key, bus, text]) => range(key.toLowerCase(), text, s[key], (v) => o.onVolume(key, bus, v)))),
        toggle('trainer', 'Trainer di velocità (con il loop)', tr.on, (v) => change((st) => { st.trainer.on = v; })),
        tr.on && h('div', { class: 'field-row three' },
          num('tstep', '+BPM', tr.step, 1, 40, 1, (v) => change((st) => { st.trainer.step = v; })),
          num('tevery', 'ogni N giri', tr.every, 1, 16, 1, (v) => change((st) => { st.trainer.every = v; })),
          num('tmax', 'fino a BPM', tr.max, o.bpmMin, o.bpmMax, 5, (v) => change((st) => { st.trainer.max = v; }))),
      );
    }

    return { select, segmented, toggle, chips, axis, num, range, optionsAxis };
  }

  function fallbackCopy(txt, done) {
    const ta = h('textarea', { class: 'visually-hidden' });
    ta.value = txt;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { /* niente */ }
    ta.remove();
  }

  function copyText(txt, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  root.PanelUI = { h, create, copyText, isIOS };
})(globalThis);
