/**
 * Eventi musicali (ADR 0010, punto 3): un evento può portare più note simultanee in `notes`
 * ([{string, fret, midi}]); l'evento a nota singola ({string, fret, midi}) resta valido.
 * Scheduler, tastiera e tablatura leggono le note sempre tramite `notesOf`. Modulo puro.
 */
(function (root) {
  'use strict';

  const isNode = typeof module !== 'undefined' && module.exports;

  /** Note suonate da un evento: [] per le pause. */
  function notesOf(e) {
    if (!e || e.rest) return [];
    if (Array.isArray(e.notes)) return e.notes;
    return e.string == null ? [] : [{ string: e.string, fret: e.fret, midi: e.midi }];
  }

  /** Tutte le altezze MIDI di una sequenza di eventi (per preparare le voci audio). */
  function midisOf(events) {
    return events.flatMap(notesOf).map((n) => n.midi);
  }

  const Events = { notesOf, midisOf };

  if (isNode) module.exports = Events;
  else root.Events = Events;
})(globalThis);
