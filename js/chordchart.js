/**
 * Diagramma d'accordo in SVG (ADR 0012): verticale come nei metodi per chitarra, 6ª corda a
 * sinistra, cinque tasti dal più basso del voicing, corde non suonate segnate con ×.
 * Pallini con grado o nome della nota, fondamentale evidenziata; `data-s`/`data-f` come nella
 * tastiera, così l'evidenziazione durante la riproduzione funziona allo stesso modo.
 */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W = 132;
  const H = 168;
  const LEFT = 26;   // spazio per il numero del primo tasto
  const RIGHT = 10;
  const TOP = 26;    // spazio per i segni ×
  const BOTTOM = 8;
  const ROWS = 5;

  function el(name, attrs, text) {
    const e = document.createElementNS(SVG_NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  /**
   * @param v       voicing (js/voicings.js): { notes: [{string, fret, tone}], minFret }
   * @param labels  etichetta per ogni indice di nota della qualità (gradi o note)
   * @param title   testo accessibile
   * @param opts    { rootTone: indice della fondamentale (default 0) }
   */
  function render(v, labels, title, opts = {}) {
    const rootTone = opts.rootTone ?? 0;
    const first = v.minFret <= 1 ? 1 : v.minFret;
    const sx = (W - LEFT - RIGHT) / 5;
    const sy = (H - TOP - BOTTOM) / ROWS;
    const x = (s) => LEFT + s * sx;               // s = 0 (6ª corda) … 5 (1ª)
    const y = (f) => TOP + (f - first + 0.5) * sy; // centro della casella

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chordchart', role: 'img', 'aria-label': title });
    svg.appendChild(el('title', {}, title));

    const grid = el('g', { class: 'cc-grid' });
    for (let r = 0; r <= ROWS; r++) {
      grid.appendChild(el('line', {
        x1: x(0), x2: x(5), y1: TOP + r * sy, y2: TOP + r * sy,
        class: r === 0 && first === 1 ? 'cc-nut' : '',
      }));
    }
    for (let s = 0; s < 6; s++) grid.appendChild(el('line', { x1: x(s), x2: x(s), y1: TOP, y2: TOP + ROWS * sy }));
    svg.appendChild(grid);

    if (first > 1) {
      svg.appendChild(el('text', { x: LEFT - 8, y: y(first), class: 'cc-fret', 'text-anchor': 'end', 'dominant-baseline': 'central' }, first));
    }

    const used = new Set(v.notes.map((n) => n.string));
    const muted = el('g', { class: 'cc-muted' });
    for (let s = 0; s < 6; s++) {
      if (used.has(s)) continue;
      muted.appendChild(el('text', { x: x(s), y: TOP - 9, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, '×'));
    }
    svg.appendChild(muted);

    const r = Math.min(sx, sy) * 0.42;
    const dots = el('g', { class: 'fb-dots' });
    for (const n of v.notes) {
      const g = el('g', { class: n.tone === rootTone ? 'dot is-root' : 'dot', 'data-s': n.string, 'data-f': n.fret });
      g.appendChild(el('circle', { cx: x(n.string), cy: y(n.fret), r }));
      const text = labels[n.tone];
      g.appendChild(el('text', {
        x: x(n.string), y: y(n.fret), 'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': text.length > 2 ? r * 0.82 : r * 1.0,
      }, text));
      dots.appendChild(g);
    }
    svg.appendChild(dots);
    return svg;
  }

  root.ChordChart = { render };
})(globalThis);
