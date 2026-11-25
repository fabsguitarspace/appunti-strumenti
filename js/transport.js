/**
 * Trasporto comune agli strumenti (ADR 0010, punto 2): barra Play · BPM · Tap, scheduler,
 * metronomo, loop, count-in, trainer di velocità, volumi, volume generale, wake lock e ciclo di
 * evidenziazione.
 * Lo strumento fornisce le impostazioni e riceve l'evento corrente da evidenziare.
 * Usa Web Audio e DOM: non si carica in Node (la logica pura è in audio/scheduler.js).
 */
(function (root) {
  'use strict';

  const { Scheduler, AudioEngine, Events } = root;

  const BPM_MIN = 30;
  const BPM_MAX = 300;
  // Volume generale e suono (ADR 0017): comuni a tutti gli strumenti, ricordati nel browser.
  const VOLUME_KEY = 'appunti-strumenti.volume';
  const TIMBRES = [['guitar', 'Chitarra'], ['epiano', 'Piano elettrico']];
  const clampVol = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
  const validTimbre = (t) => (TIMBRES.some(([k]) => k === t) ? t : 'guitar');
  function loadVolume() {
    try {
      const raw = JSON.parse(localStorage.getItem(VOLUME_KEY));
      if (raw && typeof raw === 'object') {
        return { level: clampVol(Number(raw.level)), muted: !!raw.muted, timbre: validTimbre(raw.timbre) };
      }
    } catch (_) { /* ignora */ }
    return { level: 1, muted: false, timbre: 'guitar' };
  }
  function saveVolume(v) {
    try { localStorage.setItem(VOLUME_KEY, JSON.stringify(v)); } catch (_) { /* ignora */ }
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function speakerIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path class="spk" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>'
      + '<path class="w1" d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>'
      + '<path class="w2" d="M18 7a7 7 0 0 1 0 10"/>'
      + '<path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/>';
    return svg;
  }

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
   *   options(): { bpm, loop, countIn, metronome, metroMode, volNotes, volClick, volBass?, volStudy?, trainer },
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
        // Pennata (accordi): ogni corda un poco dopo la precedente, dal basso all'acuto.
        const strum = ev.strum || 0;
        Events.notesOf(ev).forEach((n, k) => {
          AudioEngine.playNote(n.midi, when + k * strum, { velocity: ev.accent ? 1 : 0.6, string: n.string, duration: dur, part: ev.part });
        });
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

    // Volume generale: pulsante con l'altoparlante e pannellino con cursore e «muto».
    const vol = loadVolume();
    const volId = 't-vol-' + Math.random().toString(36).slice(2, 8);
    const volBtn = h('button', {
      type: 'button', class: 't-vol-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': volId,
      onclick: () => setVolOpen(volPop.hidden),
    }, speakerIcon());
    const volRange = h('input', { type: 'range', min: 0, max: 100, step: 5, 'aria-label': 'Volume generale' });
    const volOut = h('output', { class: 't-vol-val' });
    const muteBtn = h('button', { type: 'button', class: 't-vol-mute', onclick: () => setVolume({ muted: !vol.muted }) });
    volRange.addEventListener('input', () => setVolume({ level: Number(volRange.value) / 100, muted: false }));
    // Suono delle note: chitarra (Karplus-Strong) o piano elettrico (ADR 0017).
    const timbreBtns = TIMBRES.map(([key, label]) => h('button', {
      type: 'button', 'data-timbre': key, onclick: () => setVolume({ timbre: key }),
    }, label));
    const volPop = h('div', { class: 't-vol-pop', id: volId, role: 'group', 'aria-label': 'Volume e suono', hidden: true },
      h('span', { class: 't-vol-label' }, 'Volume'), volOut, volRange, muteBtn,
      h('span', { class: 't-vol-label t-timbre-label' }, 'Suono'),
      h('div', { class: 't-timbre', role: 'group', 'aria-label': 'Suono delle note' }, timbreBtns));
    const volWrap = h('div', { class: 't-vol' }, volBtn, volPop);
    const el = h('div', { class: 'transport' }, play, bpmGroup, tapBtn, volWrap);

    function setVolume(patch) {
      Object.assign(vol, patch);
      vol.level = clampVol(vol.level);
      vol.timbre = validTimbre(vol.timbre);
      saveVolume(vol);
      AudioEngine.setMaster(vol.muted ? 0 : vol.level);
      AudioEngine.setTimbre(vol.timbre);
      renderVolume();
    }

    function renderVolume() {
      const pct = Math.round(vol.level * 100);
      const silent = vol.muted || pct === 0;
      volRange.value = pct;
      volOut.textContent = vol.muted ? 'muto' : pct + '%';
      muteBtn.textContent = vol.muted ? 'Riattiva' : 'Muto';
      muteBtn.setAttribute('aria-pressed', String(vol.muted));
      volBtn.dataset.level = silent ? 'off' : pct < 50 ? 'low' : 'high';
      volBtn.setAttribute('aria-label', 'Volume: ' + (vol.muted ? 'muto' : pct + '%'));
      volBtn.classList.toggle('is-muted', silent);
      for (const b of timbreBtns) b.setAttribute('aria-pressed', String(b.dataset.timbre === vol.timbre));
    }

    function setVolOpen(open) {
      volPop.hidden = !open;
      volBtn.setAttribute('aria-expanded', String(open));
      if (open) volRange.focus();
    }

    document.addEventListener('pointerdown', (e) => { if (!volPop.hidden && !volWrap.contains(e.target)) setVolOpen(false); });
    volWrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !volPop.hidden) { e.stopPropagation(); setVolOpen(false); volBtn.focus(); }
    });
    AudioEngine.setMaster(vol.muted ? 0 : vol.level);
    AudioEngine.setTimbre(vol.timbre);
    renderVolume();

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
      // Le parti 'bass' e 'study' (Progressioni, ADR 0013) hanno volumi propri, se lo strumento li prevede.
      AudioEngine.setVolumes({ notes: o.volNotes, click: o.volClick, bass: o.volBass, study: o.volStudy });
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
      volume: () => ({ ...vol }),
      setVolume,
    };
  }

  root.Transport = { create, clampBpm, BPM_MIN, BPM_MAX };
})(globalThis);
