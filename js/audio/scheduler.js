/**
 * Scheduler lookahead (ADR 0004): programma note e click in anticipo sul clock audio.
 * Il clock e i timer sono iniettati, così il modulo si testa in Node con un clock finto.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const EPS = 1e-9;

  /**
   * Posizioni del click nella battuta di 4/4, per modalità del metronomo (ADR 0016: le posizioni
   * oltre a 'all' e 'downbeat' servono allo strumento Ritmi). Il count-in suona sempre tutti i battiti.
   */
  const METRO = {
    all: [0, 1, 2, 3],
    downbeat: [0],
    'two-four': [1, 3],
    'one-three': [0, 2],
    three: [2],
    four: [3],
    'and-two-four': [1.5, 3.5],
  };

  /**
   * @param deps {
   *   now(): secondi,  setTimer(fn, ms), clearTimer(id),
   *   onNote(ev, when, dur),  onClick(when, downbeat),  onEnd(),  onTempo(bpm),
   *   lookahead = 0.12 s,  interval = 25 ms,  startDelay = 0.08 s
   * }
   */
  function create(deps) {
    const lookahead = deps.lookahead ?? 0.12;
    const interval = deps.interval ?? 25;
    const startDelay = deps.startDelay ?? 0.08;

    let playing = false;
    let timer = null;
    let events = [];
    let opts = {};
    let anchor = null; // {time, beat, bpm}
    let iter = 0;
    let idx = 0;
    let nextClick = 0;
    let visual = [];
    let endBeat = Infinity;

    const beatToTime = (b) => anchor.time + (b - anchor.beat) * 60 / anchor.bpm;
    const timeToBeat = (t) => anchor.beat + (t - anchor.time) * anchor.bpm / 60;

    function start(evs, o) {
      stop();
      events = evs.filter((e) => !e.rest).slice().sort((a, b) => a.beat - b.beat);
      opts = {
        bpm: 80, loop: false, countIn: true, metronome: true, metroMode: 'all', meter: 4,
        lengthBeats: 4, pickupBeats: 0, tempoAt: null, ...o,
      };
      const meter = opts.meter;
      // Battute di attesa: count-in (1 battuta) e spazio per il levare.
      let leadBars = opts.countIn ? 1 : 0;
      while (leadBars * meter < opts.pickupBeats - EPS) leadBars++;
      const startBeat = -leadBars * meter;
      anchor = { time: deps.now() + startDelay, beat: startBeat, bpm: opts.bpm };
      iter = 0;
      idx = 0;
      clickPos = METRO[opts.metroMode] && opts.meter === 4 ? METRO[opts.metroMode] : null;
      nextClick = startBeat;
      visual = [];
      pending = null;
      endBeat = opts.loop ? Infinity : opts.lengthBeats;
      playing = true;
      tick();
    }

    let pending = null; // cambio di tempo del trainer, applicato all'inizio del giro
    let clickPos = null; // posizioni del click nella battuta (null: ogni battito)

    /** Battito del click dopo `b`: ogni battito nel count-in, poi le posizioni della modalità. */
    function clickAfter(b) {
      const next = Math.floor(b + EPS) + 1;
      if (next < 0 || !clickPos || !opts.metronome) return next;
      const meter = opts.meter;
      const bar = Math.floor((b + EPS) / meter);
      for (let k = bar; k <= bar + 1; k++) {
        for (const p of clickPos) {
          const c = k * meter + p;
          if (c > b + EPS && c >= 0) return c;
        }
      }
      return (bar + 2) * meter + clickPos[0];
    }

    function nextNoteBeat() {
      if (idx >= events.length) {
        if (!opts.loop || !events.length) return Infinity;
        iter++;
        idx = 0;
        if (opts.tempoAt) {
          const bpm = opts.tempoAt(iter);
          if (bpm && bpm !== anchor.bpm) pending = { beat: iter * opts.lengthBeats - opts.pickupBeats, bpm };
        }
      }
      return iter * opts.lengthBeats + events[idx].beat;
    }

    function applyPending(beat) {
      if (!pending || beat < pending.beat - EPS) return false;
      anchor = { time: beatToTime(pending.beat), beat: pending.beat, bpm: pending.bpm };
      if (deps.onTempo) deps.onTempo(pending.bpm);
      pending = null;
      return true;
    }

    function tick() {
      if (!playing) return;
      for (;;) {
        const horizon = timeToBeat(deps.now() + lookahead);
        const nb = nextNoteBeat();
        const cb = nextClick;
        const b = Math.min(nb, cb);
        if (b >= horizon || b >= endBeat) break;
        if (applyPending(b)) continue; // l'orizzonte in battiti cambia con il tempo
        if (nb <= cb) {
          const ev = events[idx];
          const when = beatToTime(nb);
          deps.onNote(ev, when, ev.dur * 60 / anchor.bpm);
          visual.push({ when, ev });
          idx++;
        } else {
          // Click: count-in sempre, poi solo con il metronomo attivo.
          const pos = ((cb % opts.meter) + opts.meter) % opts.meter;
          const downbeat = Math.abs(pos) < EPS;
          const audible = cb < 0 || (opts.metronome && (clickPos ? true : opts.metroMode !== 'downbeat' || downbeat));
          if (audible && deps.onClick) deps.onClick(beatToTime(cb), downbeat);
          nextClick = clickAfter(cb);
        }
      }
      if (!opts.loop && timeToBeat(deps.now()) >= endBeat) {
        stop();
        if (deps.onEnd) deps.onEnd();
        return;
      }
      timer = deps.setTimer(tick, interval);
    }

    function stop() {
      playing = false;
      if (timer != null) deps.clearTimer(timer);
      timer = null;
      visual = [];
    }

    /** Cambio di tempo senza salti: nuova ancora sul battito corrente. */
    function setBpm(bpm) {
      if (!playing) { if (opts) opts.bpm = bpm; return; }
      const t = deps.now();
      anchor = { time: t, beat: timeToBeat(t), bpm };
    }

    /** Ultimo evento con when <= t (rimuove i precedenti), oppure undefined. */
    function drainVisual(t) {
      let cur;
      while (visual.length && visual[0].when <= t) cur = visual.shift();
      return cur;
    }

    return {
      start, stop, setBpm, drainVisual,
      isPlaying: () => playing,
      bpm: () => (anchor ? anchor.bpm : opts.bpm),
    };
  }

  const Scheduler = { create, METRO };

  if (isNode) module.exports = Scheduler;
  else root.Scheduler = Scheduler;
})(globalThis);
