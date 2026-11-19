/**
 * Accompagnamento delle progressioni (ADR 0013, punti 5, 6 e 8): voicing scelti con la conduzione
 * delle voci sull'intera forma (ritorno del loop compreso), eccezioni del capitolo 7, ritmo
 * d'attacco sulla linea del tempo, basso e linee di note guida. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;
  const Theory = isNode ? require('../theory.js') : root.Theory;
  const Chords = isNode ? require('../chords.js') : root.Chords;
  const Guitar = isNode ? require('../guitar.js') : root.Guitar;
  const Voicings = isNode ? require('../voicings.js') : root.Voicings;
  const VoiceLeading = isNode ? require('../voiceleading.js') : root.VoiceLeading;
  const Comping = isNode ? require('./comping.js') : root.Comping;
  const Bass = isNode ? require('./bass.js') : root.Bass;

  const { TUNING } = Guitar;
  const mod = (a, n) => ((a % n) + n) % n;

  /**
   * Capitolo 7, riga 37: negli accompagnamenti essenziali semidiminuiti, dominanti con nona minore
   * e diminuiti completi non sono shell ma voicing a quattro note.
   */
  const FOUR_VOICES = new Set(['m7b5', '7b9', 'dim7']);
  const FOUR_SETS = ['5432', '4321'];

  const DEFAULTS = {
    family: 'shell', set: 'all', fretFrom: 1, fretTo: 12,
    rhythmId: 'half', attack: 'strum', bass: 'roots',
    comp: true,   // false: «suona tu», accompagnamento muto
    guide: false, // true: le note guida suonano piano (parte 'study')
    loop: true,
  };

  /** Triade dalle prime tre note della qualità (1 3 5), per la famiglia delle triadi. */
  function triadOf(q) {
    if (q.tones.length === 3) return q;
    return { ...q, id: q.id + ':triad', tones: q.tones.slice(0, 3), rootOnce: false };
  }

  function permutations(a) {
    if (a.length <= 1) return [a];
    return a.flatMap((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p)));
  }

  /**
   * Sigla con basso (Em7/D): il basso sulla 5ª o 6ª corda, sopra tre note dell'accordo superiore
   * sulle corde 4–3–2 (come nel capitolo: Re, poi Sol–Si–Mi). Se l'accordo ha quattro note e il
   * basso non è una di queste, si omette la quinta.
   */
  function slashVoicings(chord) {
    const q = chord.quality;
    const rootPc = Theory.pitchClass(chord.root);
    const bassPc = Theory.pitchClass(chord.bass);
    const semis = Chords.semitones(q);
    let upper = q.tones.map((_, i) => i).filter((i) => i < 4 && mod(rootPc + semis[i], 12) !== bassPc);
    if (upper.length > 3) upper = upper.filter((i) => q.tones[i].number !== 5);
    upper = upper.slice(0, 3);
    const bassTone = semis.findIndex((s) => mod(rootPc + s, 12) === bassPc);
    const out = [];
    for (const set of [[1, 2, 3, 4], [0, 2, 3, 4]]) {
      for (const order of permutations(upper)) {
        const p = Voicings.place([bassPc].concat(order.map((t) => mod(rootPc + semis[t], 12))), set);
        if (!p) continue;
        const tones = [bassTone].concat(order);
        out.push({
          family: 'slash', strings: set, label: Voicings.setLabel(set),
          notes: set.map((s, k) => ({ string: s, fret: p.frets[k], midi: p.midis[k], tone: tones[k] })),
          bass: bassTone, top: order[order.length - 1], minFret: p.lo, maxFret: p.hi,
        });
      }
    }
    return out.flatMap(Voicings.octaves);
  }

  /**
   * Voicing ammessi per una sigla, con `pref`: il basso preferito (indice nelle note della
   * qualità) o null. Shell e voicing a quattro note preferiscono la fondamentale al basso; 7♭9
   * la terza (voicing senza fondamentale, come G7♭9 nel capitolo).
   */
  function candidates(chord, s, fourVoices) {
    const q = chord.quality;
    const pc = Theory.pitchClass(chord.root);
    const tag = (list, pref) => list.map((v) => ({ ...v, pref }));
    if (chord.bass) return tag(slashVoicings(chord), null);
    const drop2 = () => Voicings.voicings(q, pc, ['drop2'])
      .filter((v) => FOUR_SETS.includes(v.label)).flatMap(Voicings.octaves);
    const pref = q.id === '7b9' ? 1 : 0;
    if (s.family === 'shell' && FOUR_VOICES.has(q.id)) {
      // Il capitolo esplicita questi suoni: basso obbligato (fondamentale, terza per 7♭9).
      const all = drop2();
      const strict = all.filter((v) => v.bass === pref);
      return tag(strict.length ? strict : all, pref);
    }
    if (s.family === 'shell' && fourVoices) return tag(drop2(), pref);
    const triads = s.family === 'triad' || s.family === 'spread';
    const list = triads
      ? Comping.candidatesFor(triadOf(q), pc, s.family, s.set)
      : Comping.candidatesFor(q, pc, s.family, s.set, s.alt);
    if (list.length) return tag(list, s.family === 'shell' ? 0 : null);
    // Nessun voicing della famiglia (es. drop 3 di una qualità senza): drop 2 a quattro voci.
    return tag(drop2(), pref);
  }

  // ------------------------------------------------------------ Note guida

  /** Indici di terza e settima (o sesta, o quinta) nelle note della qualità. */
  function guideTones(q) {
    const find = (...ns) => {
      for (const n of ns) {
        const i = q.tones.findIndex((t) => t.number === n);
        if (i >= 0) return i;
      }
      return -1;
    };
    return [find(3), find(7, 6, 5)];
  }

  /**
   * Due linee di note guida (3ª e 7ª di ogni accordo) con il minimo movimento, Viterbi sulle
   * coppie di altezze nel registro dato. Sul II–V–I in Do: Fa–Fa–Mi e Do–Si–Si (capitolo 7).
   * @returns [{ low, high }] in MIDI, una coppia per accordo
   */
  function guideLines(chords, range) {
    const [lo, hi] = range;
    const layers = chords.map((c) => {
      const pc = Theory.pitchClass(c.root);
      const semis = Chords.semitones(c.quality);
      const pcs = guideTones(c.quality).map((i) => mod(pc + semis[i], 12));
      const states = [];
      for (let a = lo; a <= hi; a++) {
        for (let b = a + 1; b <= hi; b++) {
          const x = mod(a, 12);
          const y = mod(b, 12);
          if ((x === pcs[0] && y === pcs[1]) || (x === pcs[1] && y === pcs[0])) {
            if (b - a <= 12) states.push({ low: a, high: b });
          }
        }
      }
      return states;
    });
    const mid = (lo + hi) / 2;
    const dp = [];
    layers.forEach((states, i) => {
      dp.push(states.map((st) => {
        if (i === 0) return { st, cost: 0.1 * Math.abs((st.low + st.high) / 2 - mid), back: -1 };
        let best = Infinity;
        let arg = 0;
        dp[i - 1].forEach((p, j) => {
          const c = p.cost + Math.abs(p.st.low - st.low) + Math.abs(p.st.high - st.high);
          if (c < best - 1e-9) { best = c; arg = j; }
        });
        return { st, cost: best, back: arg };
      }));
    });
    if (!dp.length || dp.some((l) => !l.length)) return [];
    const last = dp[dp.length - 1];
    let j = 0;
    last.forEach((x, k) => { if (x.cost < last[j].cost - 1e-9) j = k; });
    const out = new Array(dp.length);
    for (let i = dp.length - 1; i >= 0; i--) { out[i] = dp[i][j].st; j = dp[i][j].back; }
    return out;
  }

  /** Corda e tasto per un'altezza, sulle corde 4–2, il più vicino al centro della zona. */
  function placeGuide(midi, lo, hi) {
    let best = null;
    for (const s of [2, 3, 4]) {
      const f = midi - TUNING[s];
      if (f < 1 || f > 20) continue;
      const d = f < lo ? lo - f : f > hi ? f - hi : 0;
      const score = d * 10 + Math.abs(f - (lo + hi) / 2);
      if (!best || score < best.score) best = { string: s, fret: f, midi, score };
    }
    return best ? { string: best.string, fret: best.fret, midi } : { string: 3, fret: midi - TUNING[3], midi };
  }

  // ------------------------------------------------------------ Pipeline

  /**
   * @param real     risultato di `Progression.realize`
   * @param settings vedi DEFAULTS; `fourVoices` dal catalogo (vamp modale)
   * @returns {
   *   segments: [{ beat, dur, bar, section, chord, voicing, guide: { low, high } }],
   *   events (comp, bass e study, in ordine di tempo), lengthBeats, pickupBeats, error?
   * }
   */
  function build(real, settings = {}) {
    const s = { ...DEFAULTS, ...settings };
    const lo = Math.min(s.fretFrom, s.fretTo);
    const hi = Math.max(s.fretFrom, s.fretTo);
    const tl = real.timeline;

    // Sigle consecutive uguali formano un gruppo con lo stesso voicing (riarticolato a ogni battuta).
    const groups = [];
    tl.forEach((seg, k) => {
      const g = groups[groups.length - 1];
      if (g && g.symbol === seg.chord.symbol) g.idx.push(k);
      else groups.push({ symbol: seg.chord.symbol, chord: seg.chord, idx: [k] });
    });

    const cands = groups.map((g) => candidates(g.chord, s, s.fourVoices));
    const cost = (v) => (v.pref != null && v.bass !== v.pref ? 4 : 0);
    const opts = { zone: [lo, hi], cost };
    let chosen = VoiceLeading.lead(cands, opts);
    if (!chosen) {
      return {
        segments: [], events: [], lengthBeats: real.beats, pickupBeats: 0,
        error: 'Nessun voicing di questa famiglia sulle corde e nella zona scelte: allarga la zona o cambia corde.',
      };
    }
    // Loop: il primo accordo si ripete in coda con lo stesso voicing, così anche il ritorno è
    // collegato. Si prova ogni voicing del primo accordo e si tiene il ciclo meno costoso
    // (l'ADR 0013 prevedeva una copia libera in coda: poteva scegliere un voicing diverso dal primo).
    if (s.loop && groups.length > 1) {
      let best = null;
      for (const v0 of cands[0]) {
        const path = VoiceLeading.lead([[v0]].concat(cands.slice(1), [[v0]]), opts);
        if (path && (!best || path.cost < best.cost - 1e-9)) best = path;
      }
      if (best) chosen = best.slice(0, -1);
    }

    const range = [TUNING[2] + lo, TUNING[4] + hi];
    const lines = guideLines(groups.map((g) => g.chord), range);

    const segments = tl.map((seg) => ({ ...seg }));
    groups.forEach((g, i) => g.idx.forEach((k) => {
      segments[k].voicing = chosen[i];
      segments[k].guide = lines[i] || null;
    }));

    let events = [];
    if (s.comp) {
      const r = Comping.progRhythmDef(s.rhythmId);
      events = Comping.comp(segments.map((x) => ({ start: x.beat, dur: x.dur, voicing: x.voicing })), r,
        { attack: s.attack, part: 'comp' });
    }
    events = events.concat(Bass.build(tl, s.bass, { loop: s.loop }).map((e) => ({ ...e, chord: chordAt(tl, e.beat) })));
    if (s.guide) {
      segments.forEach((x, k) => {
        if (!x.guide) return;
        const notes = [x.guide.low, x.guide.high].map((m) => placeGuide(m, lo, hi));
        events.push({ beat: x.beat, dur: x.dur, ndur: x.dur, notes, accent: false, chord: k, rest: false, part: 'study' });
      });
    }
    // Ordine di tempo; a parità, l'accompagnamento prima (la tastiera evidenzia l'ultimo evento).
    const rank = { bass: 0, study: 1, comp: 2 };
    events.sort((a, b) => a.beat - b.beat || rank[a.part] - rank[b.part]);
    events.forEach((e, i) => { e.i = i; });
    return { segments, events, lengthBeats: real.beats, pickupBeats: 0 };
  }

  /** Indice del segmento in vigore al battito. */
  function chordAt(tl, beat) {
    let k = 0;
    while (k + 1 < tl.length && tl[k + 1].beat <= beat + 1e-9) k++;
    return k;
  }

  const ProgComp = { DEFAULTS, FOUR_VOICES, triadOf, slashVoicings, candidates, guideTones, guideLines, placeGuide, build };

  if (isNode) module.exports = ProgComp;
  else root.ProgComp = ProgComp;
})(globalThis);
