# ADR 0017 — Suono: piano elettrico selezionabile accanto alla chitarra

- Stato: Accettato (2026-11-24, `js/audio/ep.js`, `js/audio/engine.js`, `js/transport.js`)
- Data: 2026-11-24
- Affianca l'[ADR 0003](ADR-0003-sintesi-karplus-strong.md) senza sostituirlo: la chitarra
  Karplus-Strong resta il suono predefinito.

## Contesto

Il 24 novembre 2026 gli esempi audio dei tre volumi (Teoria, Pratica, Repertorio) sono passati
dalla chitarra campionata a un piano elettrico originale, tipo Fender Rhodes, sintetizzato in FM
(ADR 0006 dei volumi, soundfont `AppuntiEPiano.sf2` della libreria appunti-musica, variante
«morbido»). L'utente ha chiesto lo stesso suono negli strumenti, come scelta e non al posto della
chitarra: chi studia può voler sentire il timbro dello strumento che suona.

## Decisione

1. **Modulo puro `js/audio/ep.js`** (`EP.renderNote(freq, sampleRate, opts)`), gemello di
   `ks.js` e testato in Node. Usa la stessa sintesi e gli stessi parametri del generatore dei
   volumi: FM a due operatori in rapporto 1:1 con indice che cala dopo l'attacco, «bark» sul
   secondo armonico, «tine» breve a 14 volte la fondamentale. La velocity alza l'indice: l'accento
   ha un attacco più ruvido. La variante 1 alza l'indice del 4%, per le note ripetute.
   Esponenziali e seni sono calcolati per ricorrenza (un solo `Math.sin` per campione), con
   ricalibrazione ogni 4096 campioni: circa 3 ms per nota a 48 kHz su un computer recente.
2. **Motore.** `AudioEngine.setTimbre('guitar' | 'epiano')`. Le tre parti (`comp`, `bass`,
   `study`) entrano in un nodo comune collegato alla catena del timbro scelto: per la chitarra la
   cassa armonica dell'ADR 0003, per il piano un'equalizzazione leggera (passa-alto a 45 Hz,
   −1,5 dB a 280 Hz, passa-basso a 8 kHz), entrambe con il riverbero. La cache delle voci ha il
   timbro nella chiave; il cambio vale dalle note successive, anche durante la riproduzione.
   Lo smorzamento per corda resta valido: gli esercizi sono diteggiati sulla chitarra.
3. **Interfaccia.** Nel pannello del volume della barra di trasporto, sotto «Muto», la scelta
   «Suono: Chitarra / Piano elettrico». Come il volume generale vale per tutti gli strumenti ed è
   ricordata nel browser (campo `timbre` della chiave `appunti-strumenti.volume`).

## Alternative scartate

- **Sostituire la chitarra**: più semplice, ma toglie il timbro dello strumento studiato.
- **Campioni di un piano elettrico**: file da scaricare (ADR 0001: niente file audio) e licenze
  da verificare.
- **Leggere il soundfont dei volumi**: servirebbe un lettore SF2 nel browser e un file di 3 MB;
  la sintesi diretta dà lo stesso suono senza file.

## Conseguenze

- Calcolo più lento della chitarra (circa 3 ms contro meno di 1 per nota): con la tastiera intera
  la preparazione al Play arriva a qualche centinaio di millisecondi su un computer, di più su un
  telefono. Se servisse, si riduce la durata dei buffer o si preparano solo le note dello strato
  morbido.
- Memoria: fino a 5 s per nota sui bassi (circa 1 MB a 48 kHz in float32), più della chitarra.
- Le note di rilascio degli strumenti e il capitolo «Strumenti per la pratica» di Pratica citano
  la scelta del suono.
- Test in `tests/audio.test.js`: intonazione, picco, decadimento, coda senza click, accento più
  brillante, buffer deterministici.
