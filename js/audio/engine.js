/**
 * Motore audio (ADR 0003, ADR 0017): AudioContext, voci in cache (chitarra Karplus-Strong o
 * piano elettrico FM, a scelta con setTimbre), cassa armonica o equalizzazione del piano,
 * riverbero, click del metronomo.
 * Si attiva solo dentro un gesto dell'utente (unlock), come richiedono i browser mobili.
 * Parti (ADR 0013, punto 7): ogni nota appartiene a una parte ('comp', predefinita, 'bass',
 * 'study') con bus e volume propri; lo smorzamento per corda vale dentro la stessa parte.
 * Sopra i bus c'è il volume generale (setMaster), regolato dalla barra di trasporto.
 */
(function (root) {
  'use strict';

  const KS = root.KS;
  const EP = root.EP;
  const TIMBRES = ['guitar', 'epiano'];
  let timbre = 'guitar';
  let ctx = null;
  let notesIn = null;  // ingresso comune delle parti, collegato alla catena del timbro scelto
  const chains = {};   // timbro → nodo d'ingresso della sua catena
  let master = null;
  let noteBus = null;  // parte 'comp': le note degli strumenti (volume 'notes')
  let bassBus = null;
  let studyBus = null;
  let clickBus = null;
  const cache = new Map(); // 'midi:strato:variante' → {buffer, rate}
  const rr = new Map();    // 'midi:strato' → ultima variante usata (alternanza)
  const active = new Set();
  const voices = new Map(); // parte:corda → voce in corso (smorzamento per corda)
  let volumes = { notes: 0.8, bass: 0.8, study: 0.5, click: 0.6 };
  let level = 1; // volume generale (barra di trasporto), moltiplica il master
  const MASTER = 0.9;
  const busOf = (part) => (part === 'bass' ? bassBus : part === 'study' ? studyBus : noteBus);

  function supported() {
    return !!(root.AudioContext || root.webkitAudioContext);
  }

  /** Crea o riprende l'AudioContext. Va chiamata nel gestore di un tap o click. */
  function unlock() {
    if (!supported()) return false;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      // iOS 17+: riproduzione anche con il tasto silenzioso attivo.
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* ignora */ }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = MASTER * level;
      master.connect(comp).connect(ctx.destination);
      // Catene solo per le note, non per il click: cassa armonica (chitarra) o equalizzazione
      // leggera (piano elettrico), entrambe con il riverbero.
      chains.guitar = createBody();
      chains.guitar.connect(master);
      chains.epiano = createKeys();
      notesIn = ctx.createGain();
      notesIn.connect(chains[timbre]);
      noteBus = ctx.createGain();
      noteBus.connect(notesIn);
      bassBus = ctx.createGain();
      bassBus.connect(notesIn);
      studyBus = ctx.createGain();
      studyBus.connect(notesIn);
      clickBus = ctx.createGain();
      clickBus.connect(master);
      setVolumes(volumes);
      // Buffer silenzioso: sblocca l'audio su Safari meno recenti.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  /** Catena con i filtri in serie e il riverbero; restituisce il nodo d'ingresso. */
  function filterChain(specs, wetGain) {
    const chain = specs.map(([type, f, Q, gain = 0]) => {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = Q;
      b.gain.value = gain;
      return b;
    });
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    const out = chain[chain.length - 1];
    const dry = ctx.createGain();
    dry.gain.value = 0.86;
    out.connect(dry).connect(master);
    try {
      const verb = ctx.createConvolver();
      verb.buffer = roomImpulse(1.1);
      const wet = ctx.createGain();
      wet.gain.value = wetGain;
      out.connect(verb).connect(wet).connect(master);
    } catch (_) { /* senza riverbero se il convolutore non è disponibile */ }
    return chain[0];
  }

  /**
   * Piano elettrico: niente risonanze di cassa, solo un taglio del rombo, un poco meno di
   * medio-bassi (il suono resta chiaro negli accordi) e un passa-basso morbido.
   */
  function createKeys() {
    return filterChain([
      ['highpass', 45, 0.7],
      ['peaking', 280, 1, -1.5],
      ['lowpass', 8000, 0.6],
    ], 0.2);
  }

  /**
   * Cassa armonica: filtri risonanti (aria ~100 Hz, tavola ~215 e ~430 Hz, presenza ~2,6 kHz),
   * taglio del rombo e degli acuti duri, più un riverbero breve da stanza piccola.
   * Restituisce il nodo d'ingresso; l'uscita va al master.
   */
  function createBody() {
    return filterChain([
      ['highpass', 70, 0.7],
      ['peaking', 102, 2.2, 5],
      ['peaking', 215, 2.5, 3.5],
      ['peaking', 430, 2, 2],
      ['peaking', 2600, 1.2, 1.5],
      ['lowpass', 7500, 0.6],
    ], 0.22);
  }


  /** Risposta all'impulso sintetica di una stanza piccola: rumore stereo che decade e si scurisce. */
  function roomImpulse(seconds) {
    const sr = ctx.sampleRate;
    const len = Math.round(seconds * sr);
    const ir = ctx.createBuffer(2, len, sr);
    const pre = Math.round(0.008 * sr);
    let seed = 0x9e3779b9;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let n = pre; n < len; n++) {
        const t = (n - pre) / sr;
        const k = 0.6 - 0.45 * Math.min(1, t / seconds); // le code sono più scure
        lp = k * rand() + (1 - k) * lp;
        d[n] = lp * Math.exp(-6.9 * t / (seconds * 0.8));
      }
    }
    return ir;
  }

  /**
   * Voce in cache per altezza e strato di velocity (morbido / accentato: cambia la brillantezza
   * dell'eccitazione), con due varianti alternate perché le note ripetute non siano identiche.
   */
  function voiceFor(midi, velocity = 0.8) {
    const layer = velocity > 0.85 ? 1 : 0;
    const rk = timbre + ':' + midi + ':' + layer;
    const variant = rr.get(rk) === 0 ? 1 : 0;
    rr.set(rk, variant);
    const key = rk + ':' + variant;
    let v = cache.get(key);
    if (!v) {
      const freq = KS.midiToFreq(midi);
      const brightness = layer ? 0.85 : 0.6;
      const { data, rate } = timbre === 'epiano'
        ? EP.renderNote(freq, ctx.sampleRate, { brightness, variant })
        : KS.renderPluck(freq, ctx.sampleRate, {
          brightness,
          seed: Math.round(freq * 1000) + layer * 7919 + variant * 104729,
        });
      const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      v = { buffer, rate };
      cache.set(key, v);
    }
    return v;
  }

  /** Pre-calcola i buffer delle altezze di un esercizio (evita lavoro durante la riproduzione). */
  function prepare(midis) {
    if (!ctx) return;
    // Una variante per strato; la seconda si calcola alla prima nota ripetuta (circa 1–2 ms).
    for (const m of new Set(midis)) if (m != null) { voiceFor(m, 0.6); voiceFor(m, 1); }
  }

  /**
   * @param when     tempo AudioContext di inizio
   * @param opts     { velocity 0..1, string (per lo smorzamento), duration in secondi,
   *                  part: 'comp' | 'bass' | 'study' (predefinita 'comp') }
   */
  function playNote(midi, when, opts = {}) {
    if (!ctx) return;
    const vel = opts.velocity ?? 0.8;
    const { buffer, rate } = voiceFor(midi, vel);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.002);
    // Rilascio a fine nota con una coda breve (legato naturale).
    const dur = Math.max(0.08, opts.duration ?? 1);
    g.gain.setTargetAtTime(0, when + dur, 0.035);
    src.connect(g).connect(busOf(opts.part));
    src.start(when);
    src.stop(when + Math.min(buffer.duration, dur + 0.4));
    const voice = { src, g, when };
    active.add(voice);
    src.onended = () => { active.delete(voice); src.disconnect(); g.disconnect(); };
    // Smorzamento per corda: la nuova nota chiude la precedente sulla stessa corda.
    if (opts.string != null) {
      const key = (opts.part || 'comp') + ':' + opts.string;
      const prev = voices.get(key);
      if (prev && prev.when < when) {
        try {
          prev.g.gain.cancelScheduledValues(when);
          prev.g.gain.setTargetAtTime(0, when, 0.008);
        } catch (_) { /* nota già terminata */ }
      }
      voices.set(key, voice);
    }
  }

  function click(when, opts = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = opts.downbeat ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(opts.downbeat ? 0.9 : 0.55, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    osc.connect(g).connect(clickBus);
    osc.start(when);
    osc.stop(when + 0.05);
    osc.onended = () => { osc.disconnect(); g.disconnect(); };
  }

  function stopAll() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of active) {
      try {
        v.g.gain.cancelScheduledValues(t);
        v.g.gain.setTargetAtTime(0, t, 0.01);
        v.src.stop(t + 0.08);
      } catch (_) { /* già fermata */ }
    }
    voices.clear();
  }

  function setVolumes(v) {
    for (const [k, x] of Object.entries(v)) if (typeof x === 'number') volumes[k] = x;
    if (noteBus) noteBus.gain.value = volumes.notes;
    if (bassBus) bassBus.gain.value = volumes.bass;
    if (studyBus) studyBus.gain.value = volumes.study;
    if (clickBus) clickBus.gain.value = volumes.click;
  }

  /**
   * Timbro delle note: 'guitar' (Karplus-Strong, predefinito) o 'epiano' (piano elettrico).
   * Si può cambiare anche durante la riproduzione: le note successive usano il nuovo timbro.
   */
  function setTimbre(t) {
    if (!TIMBRES.includes(t) || t === timbre) return;
    timbre = t;
    if (notesIn) {
      notesIn.disconnect();
      notesIn.connect(chains[timbre]);
    }
  }

  /** Volume generale 0..1 (tutte le parti e il metronomo), con una rampa breve contro i click. */
  function setMaster(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    level = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(MASTER * level, ctx.currentTime, 0.015);
  }

  const now = () => (ctx ? ctx.currentTime : 0);
  const latency = () => (ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0);

  root.AudioEngine = { supported, unlock, prepare, playNote, click, stopAll, setVolumes, setMaster, setTimbre, now, latency,
    get timbre() { return timbre; }, get ready() { return !!ctx; } };
})(globalThis);
