/**
 * Piano elettrico morbido, tipo Fender Rhodes (ADR 0017): una nota calcolata in un Float32Array.
 * Modulo puro (niente Web Audio), testabile in Node.
 *
 * È la stessa sintesi del soundfont predefinito dei volumi (AppuntiEPiano.sf2, generato da
 * appunti-musica/appunti_musica/epiano_soundfont.py, variante «morbido»), così strumenti e libri
 * suonano uguali:
 * - FM a due operatori in rapporto 1:1, con indice che cala dopo l'attacco (corpo caldo);
 * - «bark» sul secondo armonico, breve;
 * - «tine»: parziale acuta (14 volte la fondamentale) di pochi millisecondi, il colpo del martelletto.
 * La velocity alza l'indice (attacco più ruvido), come su un Rhodes suonato forte.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // Variante «morbido» dei volumi (24 novembre 2026).
  const SOFT = { index: 0.9, indexDecay: 0.35, tine: 0.05, bark: 0.1 };

  /** Durata del buffer: lunga sui bassi, più breve sugli acuti che si spengono prima. */
  function durationFor(freq) {
    return clamp(7 * Math.pow(110 / freq, 0.45), 2, 5);
  }

  /** Costante di decadimento dell'ampiezza in secondi. */
  function tauFor(freq) {
    return clamp(3.2 * Math.sqrt(110 / freq), 0.6, 4);
  }

  /**
   * @param opts { brightness 0..1 (predefinita 0,6: velocity normale; 0,85 accento),
   *               variant 0 | 1 (piccola differenza dell'indice, per le note ripetute) }
   * @returns { data: Float32Array, rate: 1, f0 }
   */
  function renderNote(freq, sampleRate, opts = {}) {
    const brightness = opts.brightness ?? 0.6;
    // 0,6 → indice dei volumi; 0,85 → circa una volta e mezza.
    const hard = 1 + 2 * Math.max(0, brightness - 0.6);
    const index0 = SOFT.index * hard * (opts.variant ? 1.04 : 1) * Math.pow(220 / Math.max(freq, 220), 0.3);
    const tineLevel = SOFT.tine * hard;
    const seconds = durationFor(freq);
    const tau = tauFor(freq);
    const len = Math.round(seconds * sampleRate);
    const w = 2 * Math.PI * freq / sampleRate;
    const tineOn = freq * 14 < 0.42 * sampleRate;
    const out = new Float32Array(len);
    let peak = 0;
    // Esponenziali e seni per ricorrenza (un solo Math.sin per campione, quello della FM):
    // circa dieci volte più veloce del calcolo diretto, con differenze trascurabili.
    const k = (seconds) => Math.exp(-1 / (seconds * sampleRate));
    const kAmp = k(tau); const kIdx = k(SOFT.indexDecay); const kBark = k(0.4); const kTine = k(0.035);
    let eAmp = 1; let eIdx = 1; let eBark = SOFT.bark; let eTine = tineLevel;
    const c1 = Math.cos(w); const s1 = Math.sin(w);
    const c14 = Math.cos(14 * w); const s14 = Math.sin(14 * w);
    let sn = 0; let cs = 1;       // sin e cos di w·n
    let s14n = 0; let c14n = 1;   // sin e cos di 14·w·n
    const attack = 0.003 * sampleRate;
    for (let n = 0; n < len; n++) {
      const env = Math.min(1, n / attack) * eAmp * Math.min(1, (len - n) / (0.3 * sampleRate));
      const index = index0 * (0.35 + 0.65 * eIdx);
      let v = Math.sin(w * n + index * sn);
      v += eBark * 2 * sn * cs;                         // sin(2·w·n)
      if (tineOn) v += eTine * s14n;
      v *= env;
      out[n] = v;
      const m = Math.abs(v);
      if (m > peak) peak = m;
      eAmp *= kAmp; eIdx *= kIdx; eBark *= kBark; eTine *= kTine;
      const sNext = sn * c1 + cs * s1; cs = cs * c1 - sn * s1; sn = sNext;
      const tNext = s14n * c14 + c14n * s14; c14n = c14n * c14 - s14n * s14; s14n = tNext;
      if ((n & 4095) === 4095) {   // ricalibra i rotatori contro la deriva numerica
        sn = Math.sin(w * (n + 1)); cs = Math.cos(w * (n + 1));
        s14n = Math.sin(14 * w * (n + 1)); c14n = Math.cos(14 * w * (n + 1));
      }
    }
    // Stesso livello di picco della chitarra Karplus-Strong (0,9), acuti un po' più presenti.
    const gain = peak > 0 ? 0.9 * Math.min(1, 0.8 * Math.pow(freq / 110, 0.15)) / peak : 0;
    for (let n = 0; n < len; n++) out[n] *= gain;
    return { data: out, rate: 1, f0: freq };
  }

  const EP = { midiToFreq, renderNote, durationFor, tauFor };

  if (isNode) module.exports = EP;
  else root.EP = EP;
})(globalThis);
