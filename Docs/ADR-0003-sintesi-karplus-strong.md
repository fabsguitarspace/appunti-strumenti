# ADR 0003 — Suono: Karplus-Strong pre-renderizzato in AudioBuffer

- Stato: Accettato (2026-11-01, `js/audio/ks.js`, `js/audio/engine.js`); esteso il 2026-11-15
  (vedi «Revisione 2026-11-15: Karplus-Strong esteso e cassa armonica»)
- Data: 2026-11-01

## Contesto

Per ascoltare scale ed esercizi serve un suono che ricordi una chitarra, intonato con precisione
su tutta l'estensione usata (MIDI 40, E2 a vuoto, fino a MIDI 88, 24° tasto della 1ª corda),
senza file audio (ADR 0001) e reattivo anche a 200+ BPM in sedicesimi.

## Decisione

Si sintetizza ogni nota con l'algoritmo **Karplus-Strong** (corda pizzicata), calcolato in
JavaScript **una sola volta per altezza** dentro un `AudioBuffer` mono (circa 2 s), in modo
*lazy*, cioè solo quando la nota serve, e tenuto in cache per numero MIDI. Ogni nota suonata
crea un `AudioBufferSourceNode` → `GainNode` (inviluppo e accento) → bus master.

Dettagli:

- **Intonazione**: con la linea di ritardo intera `N = floor(sr / f + 0,5)` e il filtro media
  `y[n] = ½(y[n−N] + y[n−N+1])` il periodo è di `N − 0,5` campioni, quindi `f0 = sr / (N − 0,5)`.
  L'errore si corregge con `playbackRate = f / f0`, che evita i filtri allpass frazionari (senza
  correzione, a 1319 Hz l'errore sarebbe di decine di cent). Il test di intonazione ha corretto una
  prima stima sbagliata (`N + 0,5`).
- **Timbro**: rumore iniziale passato in un passa-basso; decadimento per altezza (le note acute
  si spengono prima). Nella prima versione la brillantezza era fissa (una sola voce per altezza),
  anche se qui era scritto che seguiva la velocity: la revisione del 2026-11-15 lo realizza.
- **Smorzamento per corda**: una nuova nota sulla stessa corda chiude la precedente con un
  rilascio di circa 10 ms, come su una chitarra vera. Si può fare perché ogni evento porta `string`.
- **Click del metronomo**: oscillatore breve (circa 30 ms) a 1500 Hz sul primo battito della
  battuta e a 1000 Hz sugli altri, su un bus separato con volume proprio.
- **Memoria**: circa 350 KB per nota a 44,1 kHz in float32. Una diteggiatura usa al massimo
  18 altezze distinte (circa 6 MB); con l'ambito "tutta la tastiera" (ADR 0006) si arriva
  all'intera estensione, circa 17 MB: accettabile. Se servisse, la durata del buffer si riduce
  per le note acute, che decadono comunque prima.

## Alternative scartate

- **Campioni registrati** (MP3/OGG): suono migliore, ma da `file://` non si caricano con
  `fetch`; inserirli in base64 aggiunge MB e pone problemi di licenza.
- **Oscillatore + filtro** (sintesi sottrattiva): banale da scrivere, ma suona "synth" e non chitarra.
- **Karplus-Strong in `AudioWorklet`**: suono in tempo reale e senza cache, ma
  `addModule` da `file://` non funziona (servirebbe un Blob URL), è più complesso e Safari è
  meno stabile. Il pre-rendering costa circa 1–2 ms per nota, quindi non serve.

## Conseguenze

- Il generatore del buffer è una funzione pura `(freq, sampleRate, opzioni) → Float32Array`,
  testabile in Node (lunghezza, assenza di NaN, ampiezza ≤ 1, decadimento).
- Se in futuro si vogliono campioni reali, si sostituisce solo `engine.js`: l'interfaccia
  `playNote(midi, time, {velocity, string, duration})` resta la stessa.

## Revisione 2026-11-15: Karplus-Strong esteso e cassa armonica

Il KS di base suonava sottile e uniforme («chitarra giocattolo»): solo corda, nessun corpo,
note ripetute identiche, accenti più forti ma non più brillanti. Restando nella sintesi pura
(niente file, ADR 0001) e con la stessa interfaccia `playNote`, si aggiunge:

- **Eccitazione**: brillantezza del rumore come opzione (`brightness`) e **filtro a pettine del
  punto di pizzico** (`pickPos`, predefinito 0,14 della corda, vicino al ponte).
- **Filtro di perdita a uno zero** `(1−S)·y[n−N] + S·y[n−N−1]` con `S` per altezza (`lossFor`:
  0,42 sotto 150 Hz, 0,36 fino a 400 Hz, 0,3 sopra): le note acute non diventano sorde.
  Il decadimento complessivo è un 15% più lungo di `t60For`.
- **Intonazione con allpass frazionario** del primo ordine: periodo esatto `sr/f` dentro la
  linea di ritardo, quindi `rate = 1` e `f0 = freq` (errore misurato < 0,2 cent da MIDI 40 a 88).
  Il campo `rate` resta per compatibilità.
- **Due polarizzazioni** sommate 0,62/0,38, la seconda più alta di 0,8 cent: battimento lento
  che toglie l'effetto statico.
- **Strati di velocity e varianti** (`engine.js`): la cache è per `midi:strato:variante`.
  Strato accentato per velocity > 0,85 (brillantezza 0,85), morbido altrimenti (0,6); due
  varianti per strato con semi diversi, alternate a ogni nota ripetuta.
- **Cassa armonica** al posto del passa-basso a 5,2 kHz: passa-alto 70 Hz, picchi a 102 Hz
  (+5 dB), 215 Hz (+3,5), 430 Hz (+2), 2,6 kHz (+1,5), passa-basso 7,5 kHz; poi un
  **riverbero** `ConvolverNode` con risposta all'impulso sintetica stereo di 1,1 s
  (mandata 0,22, segnale diretto 0,86). Il click del metronomo resta fuori dalla cassa.

Conseguenze:

- **Memoria**: fino a 4 buffer per altezza invece di 1, ma creati solo quando servono:
  `prepare` calcola una variante per strato (circa 1 ms ciascuna nel browser), la seconda
  nasce alla prima ripetizione. Nel caso peggiore (tutta la tastiera, tutti gli strati) circa
  60 MB; con una diteggiatura tipica circa 15–25 MB.
- `ks.js` resta puro e testato in Node: intonazione (< 2 cent), effetto della brillantezza sul
  timbro, riproducibilità per seme.
