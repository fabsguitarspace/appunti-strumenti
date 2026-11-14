/**
 * Catalogo delle progressioni (ADR 0013, punto 2): le griglie del capitolo 7 del volume
 * (`appunti-pratica/src/docs/7-progressioni.rst`), con le stesse sigle e barre, nella tonalità di
 * riferimento del capitolo. Modulo puro.
 *
 * Gli `id` compaiono nei deep link (`prog=`) e nei test del volume: non si rinominano.
 * `ref` è l'etichetta della sezione del volume (null se la sezione non ne ha una).
 * Se il capitolo cambia, il catalogo va aggiornato a mano: lo controlla
 * `tests/test_strumenti_links.py` del volume.
 */
(function (root) {
  'use strict';

  const FAMILIES = [
    { id: 'cadenze', label: 'Cadenze' },
    { id: 'giri', label: 'Giri e sostituzioni' },
    { id: 'blues', label: 'Blues' },
    { id: 'forme', label: 'Forme' },
  ];

  const family = (id) => FAMILIES.find((f) => f.id === id);

  function P(id, familyId, label, key, mode, ref, sections, form, extra = {}) {
    return { id, family: familyId, label, key, mode, ref, sections, form, ...extra };
  }

  function catalog() {
    return [
      // Cadenze
      P('ii-v-i', 'cadenze', 'II–V–I maggiore', 'C', 'major', 'progressioni-ii-v-i',
        { A: '| Dm7 | G7 | Cmaj7 | Cmaj7 |' }, ['A']),
      P('ii-v-i-minore', 'cadenze', 'II–V–I minore', 'C', 'minor', 'progressioni-minore',
        { A: '| Dm7♭5 | G7♭9 | Cm6 | Cm(maj7) |' }, ['A']),
      P('due-centri', 'cadenze', 'Due centri tonali', 'C', 'major', 'progressioni-centri',
        { A: '| Dm7 | G7 | Cmaj7 | Cmaj7 |', B: '| Cm7 | F7 | B♭maj7 | B♭maj7 |' }, ['A', 'B'],
        { centers: { B: 'B♭' } }),

      // Giri e sostituzioni
      P('turnaround', 'giri', 'Turnaround', 'C', 'major', 'progressioni-turnaround',
        { A: '| Cmaj7 | Am7 | Dm7 | G7 | Cmaj7 | A7 | Dm7 | G7 |' }, ['A']),
      P('dominanti-secondarie', 'giri', 'Dominanti secondarie', 'C', 'major', 'progressioni-dominanti',
        { A: '| Cmaj7 | E7 | Am7 | A7 | Dm7 | G7 | Cmaj7 | Cmaj7 |' }, ['A'],
        // Analisi del capitolo: «E7 è V7/vi, A7 è V7/ii, G7 è V7».
        { romans: { A: ['Imaj7', 'V7/vi', 'vi7', 'V7/ii', 'ii7', 'V7', 'Imaj7', 'Imaj7'] } }),
      P('tritono', 'giri', 'Sostituzione di tritono', 'C', 'major', 'progressioni-tritono',
        { A: '| Dm7 | G7 | Cmaj7 | Cmaj7 | Dm7 | D♭7 | Cmaj7 | Cmaj7 |' }, ['A']),
      P('backdoor', 'giri', 'Backdoor', 'C', 'major', 'progressioni-backdoor',
        { A: '| Cmaj7 | Fm7 | B♭7 | Cmaj7 |' }, ['A']),
      P('diminuito', 'giri', 'Diminuito di passaggio', 'C', 'major', 'progressioni-diminuito',
        { A: '| Cmaj7 | C♯°7 | Dm7 | G7 |' }, ['A']),

      // Blues
      P('blues', 'blues', 'Blues di base', 'C', 'major', 'progressioni-blues',
        { A: '| C7 | C7 | C7 | C7 | F7 | F7 | C7 | C7 | G7 | F7 | C7 | G7 |' }, ['A']),
      P('blues-jazz', 'blues', 'Blues jazz', 'C', 'major', 'progressioni-blues-jazz',
        { A: '| C7 | F7 | C7 | C7 | F7 | F♯°7 | C7 | A7 | Dm7 | G7 | C7 A7 | Dm7 G7 |' }, ['A']),
      P('blues-minore', 'blues', 'Blues minore', 'C', 'minor', 'progressioni-blues-minore',
        { A: '| Cm6 | Cm6 | Cm6 | Cm6 | Fm7 | Fm7 | Cm6 | Cm6 | A♭7 | G7 | Cm6 | G7 |' }, ['A']),

      // Forme
      P('vamp-modale', 'forme', 'Vamp modale', 'D', 'dorian', null,
        { A: '| Dm7 | Em7/D | Dm7 | Em7/D | Dm7 | Em7/D | Dm7 | Em7/D |' }, ['A'],
        // Capitolo 7, riga 37: il vamp usa voicing a quattro note anche con gli shell.
        { fourVoices: true }),
      P('aaba', 'forme', 'Studio in AABA', 'C', 'major', 'progressioni-aaba',
        {
          A: '| Cmaj7 | Am7 | Dm7 | G7 | Em7 | A7 | Dm7 | G7 |',
          B: '| D7 | D7 | Gmaj7 | Gmaj7 | Em7 | A7 | Dm7 | G7 |',
        },
        ['A', 'B'],
        // Forma intera A–A–B–A; per un finale le battute 31–32 diventano Dm7 G7 | Cmaj7.
        { fullForm: ['A', 'A', 'B', 'A'], ending: '| Dm7 G7 | Cmaj7 |' }),
      P('rhythm-changes', 'forme', 'Rhythm changes', 'C', 'major', null,
        {
          A: '| Cmaj7 A7 | Dm7 G7 | Em7 A7 | Dm7 G7 | C7 | F7 F♯°7 | Cmaj7 A7 | Dm7 G7 |',
          B: '| E7 | E7 | A7 | A7 | D7 | D7 | G7 | G7 |',
        },
        ['A', 'B'], { fullForm: ['A', 'A', 'B', 'A'] }),
    ];
  }

  const Progressions = { FAMILIES, family, catalog };

  if (typeof module !== 'undefined' && module.exports) module.exports = Progressions;
  else root.Progressions = Progressions;
})(globalThis);
