/**
 * Sintesi Karplus-Strong estesa (ADR 0003): una corda pizzicata calcolata in un Float32Array.
 * Modulo puro (niente Web Audio), testabile in Node.
 *
 * Rispetto al KS di base (filtro media e linea di ritardo intera):
 * - eccitazione con brillantezza regolabile (la sceglie il motore in base alla velocity)
 *   e filtro a pettine del punto di pizzico;
 * - filtro di perdita a uno zero con smorzamento degli acuti che dipende dall'altezza;
 * - ritardo frazionario con un allpass del primo ordine: intonazione esatta senza playbackRate;
 * - due polarizzazioni della corda, scordate di poco, che producono un battimento lento.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /** Generatore pseudo-casuale deterministico (mulberry32), per buffer riproducibili. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Tempo di decadimento (−60 dB) in secondi: le note gravi suonano più a lungo. */
  function t60For(freq) {
    return Math.max(0.9, Math.min(4, 4 * Math.sqrt(82.41 / freq)));
  }

  /**
   * Peso del campione precedente nel filtro di perdita (0,5 = filtro media del KS di base).
   * Valori più bassi smorzano meno gli acuti: serve sulle note alte, che fanno molti più giri
   * della linea di ritardo al secondo e altrimenti diventano sorde.
   */
  function lossFor(freq) {
    return freq < 150 ? 0.42 : freq < 400 ? 0.36 : 0.3;
  }

  /**
   * Una polarizzazione della corda: risposta all'eccitazione `exc` di una linea di ritardo
   * di periodo esatto sr/freq (parte intera + filtro di perdita + allpass frazionario).
   */
  function string(exc, freq, sampleRate, len, S, rho) {
    const P = sampleRate / freq;
    const Nint = Math.max(1, Math.floor(P - S - 0.1));
    const d = P - S - Nint; // ritardo frazionario dell'allpass, fra 0,1 e 1,1 campioni
    const C = (1 - d) / (1 + d);
    const L = Nint + 2;
    const y = new Float32Array(L);
    const out = new Float32Array(len);
    let w = 0;
    let apX = 0;
    let apY = 0;
    for (let n = 0; n < len; n++) {
      let r = w - Nint;
      if (r < 0) r += L;
      const r1 = r === 0 ? L - 1 : r - 1;
      const v = rho * ((1 - S) * y[r] + S * y[r1]);
      const ap = C * v + apX - C * apY;
      apX = v;
      apY = ap;
      const yn = (n < exc.length ? exc[n] : 0) + ap;
      y[w] = yn;
      w = w + 1 === L ? 0 : w + 1;
      out[n] = yn;
    }
    return out;
  }

  /**
   * @param opts { brightness 0..1 (predefinita 0,55), pickPos frazione della corda (0,14),
   *               seed, duration in secondi (2,2) }
   * @returns { data: Float32Array, rate, f0 }
   *   L'allpass frazionario dà già l'altezza esatta: f0 = freq e rate = 1. I due campi restano
   *   per compatibilità con il motore (playbackRate).
   */
  function renderPluck(freq, sampleRate, opts = {}) {
    const brightness = opts.brightness ?? 0.55;
    const pickPos = opts.pickPos ?? 0.14;
    const t60 = t60For(freq) * 1.15;
    const duration = Math.min(opts.duration ?? 2.2, t60 + 0.2);
    const P = sampleRate / freq;
    const len = Math.max(Math.ceil(P * 4), Math.round(duration * sampleRate));
    const S = lossFor(freq);

    // Eccitazione: un periodo di rumore passato in un passa-basso a un polo (più aperto con
    // `brightness`), poi il pettine del punto di pizzico e la rimozione della componente continua.
    const rand = rng(opts.seed ?? Math.round(freq * 1000));
    const nE = Math.max(2, Math.round(P));
    const noise = new Float32Array(nE);
    let prev = 0;
    for (let i = 0; i < nE; i++) {
      prev = brightness * (rand() * 2 - 1) + (1 - brightness) * prev;
      noise[i] = prev;
    }
    const pick = Math.max(1, Math.round(pickPos * nE));
    const exc = new Float32Array(nE);
    let mean = 0;
    for (let i = 0; i < nE; i++) {
      exc[i] = noise[i] - (i >= pick ? noise[i - pick] : 0);
      mean += exc[i];
    }
    mean /= nE;
    for (let i = 0; i < nE; i++) exc[i] -= mean;

    // Due polarizzazioni: la seconda è più alta di 0,8 cent e decade appena prima.
    const rho = (f) => Math.pow(10, -3 / (t60 * f));
    const f2 = freq * Math.pow(2, 0.8 / 1200);
    const a = string(exc, freq, sampleRate, len, S, rho(freq));
    const b = string(exc, f2, sampleRate, len, S, rho(f2) * 0.9995);

    const out = new Float32Array(len);
    let peak = 0;
    for (let n = 0; n < len; n++) {
      const v = 0.62 * a[n] + 0.38 * b[n];
      out[n] = v;
      const m = Math.abs(v);
      if (m > peak) peak = m;
    }

    // Normalizzazione e dissolvenza finale (50 ms) contro i click.
    const gain = peak > 0 ? 0.9 / peak : 0;
    const fade = Math.min(len, Math.round(0.05 * sampleRate));
    for (let n = 0; n < len; n++) {
      let g = gain;
      const fromEnd = len - n;
      if (fromEnd <= fade) g *= (fromEnd - 1) / fade;
      out[n] *= g;
    }
    return { data: out, rate: 1, f0: freq };
  }

  const KS = { midiToFreq, renderPluck, t60For, lossFor };

  if (isNode) module.exports = KS;
  else root.KS = KS;
})(globalThis);
