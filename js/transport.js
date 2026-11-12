/**
 * Trasporto comune agli strumenti (ADR 0010, punto 2): barra Play · BPM · Tap, scheduler,
 * metronomo, loop, count-in, trainer di velocità, volumi, wake lock e ciclo di evidenziazione.
 * Lo strumento fornisce le impostazioni e riceve l'evento corrente da evidenziare.
 * Usa Web Audio e DOM: non si carica in Node (la logica pura è in audio/scheduler.js).
 */
(function (root) {
  'use strict';

  const { Scheduler, AudioEngine, Events } = root;

  const BPM_MIN = 30;
  const BPM_MAX = 300;
  const clampBpm = (b) => Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(b) || 80)));

  function h(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
    return e;
  }

  /**
   * @param deps {
   *   options(): { bpm, loop, countIn, metronome, metroMode, volNotes, volClick, trainer },
   *   onBpm(bpm)          tempo cambiato (pulsanti, tap, trainer): da salvare,
   *   onPlayClick()       pulsante Play/Stop,
   *   onHighlight(ev)     evento da evidenziare, null alla fine,
   *   onChange()          riproduzione avviata o fermata (aggiornare i pulsanti),
   *   onError(msg)
   * }
   */
  function create(deps) {
    let playing = null; // { mode, ...extra }
    let rafId = 0;
    let wakeLock = null;
    let taps = [];

    const sched = Scheduler.create({
      now: () => AudioEngine.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (id) => clearTimeout(id),
      onNote: (ev, when, dur) => {
        for (const n of Events.notesOf(ev)) {
          AudioEngine.playNote(n.midi, when, { velocity: ev.accent ? 1 : 0.6, string: n.string, duration: dur });
        }
      },
      onClick: (when, downbeat) => AudioEngine.click(when, { downbeat }),
      onEnd: () => stop(),
      onTempo: (bpm) => { deps.onBpm(bpm); render(); },
    });

    // ---------------------------------------------------------- Barra

    const play = h('button', { type: 'button', class: 't-play', 'aria-label': 'Avvia esercizio', onclick: () => deps.onPlayClick() },
      h('span', { class: 't-icon', 'aria-hidden': 'true' }), h('span', { class: 't-label' }, 'Play'));
    const out = h('output', { class: 't-bpm-val', 'aria-live': 'polite' });
    const bpmGroup = h('div', { class: 't-bpm', role: 'group', 'aria-label': 'Tempo' },
      h('button', { type: 'button', 'aria-label': 'Rallenta di 5 BPM', onclick: () => bumpBpm(-5) }, '−'),
      h('span', { class: 't-bpm-box' }, out, h('small', {}, 'BPM')),
      h('button', { type: 'button', 'aria-label': 'Accelera di 5 BPM', onclick: () => bumpBpm(5) }, '+'));
    const tapBtn = h('button', { type: 'button', class: 't-tap', onclick: () => tap() }, 'Tap');
    const el = h('div', { class: 'transport' }, play, bpmGroup, tapBtn);

    function render() {
      out.textContent = deps.options().bpm;
    }

    /** Stato del pulsante principale: acceso durante l'esercizio, disabilitato senza note. */
    function setPlayButton(on, disabled) {
      play.classList.toggle('is-on', on);
      play.setAttribute('aria-label', on ? 'Ferma esercizio' : 'Avvia esercizio');
      play.querySelector('.t-label').textContent = on ? 'Stop' : 'Play';
      play.disabled = !!disabled;
    }

    // ---------------------------------------------------------- Tempo

    function setBpm(b) {
      const bpm = clampBpm(b);
      deps.onBpm(bpm);
      render();
      if (playing) sched.setBpm(bpm);
    }

    function bumpBpm(d) {
      setBpm(deps.options().bpm + d);
    }

    function tap() {
      const t = performance.now();
      if (taps.length && t - taps[taps.length - 1] > 2000) taps = [];
      taps.push(t);
      if (taps.length > 5) taps.shift();
      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((x, i) => x - taps[i]);
        setBpm(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
      }
    }

    // ---------------------------------------------------------- Riproduzione

    /**
     * Avvia una sequenza. In modalità 'exercise' valgono loop, count-in, metronomo e trainer;
     * nelle altre (ascolto rapido) si suona una volta, senza click.
     */
    function start(ex, mode, extra = {}) {
      if (!AudioEngine.unlock()) {
        if (deps.onError) deps.onError('Il browser non supporta Web Audio.');
        return;
      }
      stop();
      const o = deps.options();
      const full = mode === 'exercise';
      AudioEngine.setVolumes({ notes: o.volNotes, click: o.volClick });
      AudioEngine.prepare(Events.midisOf(ex.events));
      const bpm0 = o.bpm;
      const tr = o.trainer;
      sched.start(ex.events, {
        bpm: bpm0,
        loop: full ? o.loop : false,
        countIn: full ? o.countIn : false,
        metronome: full ? o.metronome : false,
        metroMode: o.metroMode,
        meter: 4,
        lengthBeats: ex.lengthBeats,
        pickupBeats: ex.pickupBeats,
        tempoAt: full && o.loop && tr.on
          ? (it) => Math.min(Math.max(bpm0, tr.max), bpm0 + tr.step * Math.floor(it / Math.max(1, tr.every)))
          : null,
      });
      playing = { mode, ...extra };
      requestWakeLock();
      deps.onChange();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      sched.stop();
      AudioEngine.stopAll();
      cancelAnimationFrame(rafId);
      const was = playing;
      playing = null;
      deps.onHighlight(null);
      releaseWakeLock();
      if (was) deps.onChange();
    }

    function frame() {
      if (!sched.isPlaying()) return;
      const ev = sched.drainVisual(AudioEngine.now() - AudioEngine.latency());
      if (ev) deps.onHighlight(ev.ev);
      rafId = requestAnimationFrame(frame);
    }

    function requestWakeLock() {
      try {
        if (navigator.wakeLock && !wakeLock) {
          navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
        }
      } catch (_) { /* non supportato */ }
    }

    function releaseWakeLock() {
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    }

    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });

    return {
      el, render, setPlayButton, setBpm, bumpBpm, tap, start, stop,
      playing: () => playing,
      setVolumes: (v) => AudioEngine.setVolumes(v),
    };
  }

  root.Transport = { create, clampBpm, BPM_MIN, BPM_MAX };
})(globalThis);
