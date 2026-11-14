# ADR 0013 — Strumento Progressioni: griglie del volume, ritmo d'attacco sulla linea del tempo, basso e parti audio

- Stato: Proposto (2026-11-14; domande aperte decise dall'autore il 2026-11-14, attuazione in corso: passi 4.0, 4.1 e 4.2 del piano fatti)
- Data: 2026-11-14
- Piano: [plans/0002-suite-pratica.md](plans/0002-suite-pratica.md), fase 4
- Collegati: [ADR 0003](ADR-0003-sintesi-karplus-strong.md), [ADR 0004](ADR-0004-scheduler-lookahead.md),
  [ADR 0010](ADR-0010-suite-di-strumenti.md) (punto 4), [ADR 0011](ADR-0011-strumento-arpeggi.md),
  [ADR 0012](ADR-0012-strumento-accordi.md)

## Contesto

Progressioni è l'ultimo strumento della suite. Deve far suonare le griglie del capitolo 7 del
volume (`appunti-pratica/src/docs/7-progressioni.rst`) in ogni tonalità, con accompagnamento,
basso e aiuti per l'improvvisazione, e aprirsi dal volume con esercizi pronti come gli altri tre.

Che cosa c'è già:

- guscio di estrazione `App.start` (elemento × tonica, pool, quiz, cronologia, deep link; ADR 0011);
- voicing generati dalle formule (`voicings.js`), conduzione delle voci con Viterbi
  (`voiceleading.js`), ritmi d'accompagnamento e pennata (`exercises/comping.js`; ADR 0012);
- scheduler polifonico, trasporto con metronomo, loop e trainer (ADR 0004, ADR 0010).

Che cosa manca, verificato nel codice e nel capitolo:

1. **Sigle.** `chords.js` non ha un parser delle sigle, anche se l'ADR 0010 lo prevedeva. Il
   capitolo usa sigle fuori dal catalogo delle 19 qualità: `G7♭9` (II–V–I minore) e la sigla con
   basso `Em7/D` (vamp modale).
2. **Ritmo armonico.** Il capitolo distingue il ritmo armonico (quando cambia l'accordo: due
   sigle in una battuta durano due pulsazioni ciascuna) dal ritmo d'attacco (quando colpisci).
   `Comping.build` invece ripete il ritmo d'attacco una o due battute per accordo: i due ritmi
   coincidono, e una battuta come `| Cmaj7 A7 |` non si può scrivere.
3. **Eccezioni ai voicing.** Negli accompagnamenti essenziali il capitolo usa shell sulle corde
   6–4–3 e 5–4–3. Fanno eccezione semidiminuiti, dominanti con nona minore, diminuiti completi e il
   vamp modale, che usano voicing a quattro note (riga 37 del capitolo). Per G7♭9 il voicing è
   senza fondamentale, con la terza al basso.
4. **Basso e volumi separati.** Il motore audio ha un solo bus per le note e smorza per corda: una
   nota di basso sulla 6ª corda chiuderebbe la nota dell'accompagnamento sulla stessa corda.
5. **Forma.** Sezioni (A, B), ripetizioni AABA e chorus non esistono come concetti.
6. **Debito dell'ADR 0012.** `chordpractice.js` duplica circa 100 righe di aiuti per il DOM dal
   pannello delle scale. Da estrarre all'arrivo del pannello di Progressioni.

## Decisione

1. **Pagina e guscio.** `progressioni.html` con `js/progressioni.js` su `App.start`: l'elemento è
   una progressione del catalogo, la tonica è il centro tonale. Estrazione casuale di progressione
   × tonalità, filtri per famiglia, cronologia. Nel **quiz** la griglia mostra i gradi romani, e le
   sigle si vedono solo dopo «Mostra». È il passo 1 della procedura del capitolo («pronuncia le
   sigle contando le battute»).

2. **Catalogo come testo del volume** (`js/progressions.js`, puro). Ogni griglia è scritta con le
   stesse sigle e barre del capitolo, nella sua tonalità di riferimento, con sezioni e forma:

   ```js
   { id: 'blues-jazz', family: 'blues', label: 'Blues jazz', key: 'C', mode: 'major',
     ref: 'progressioni-blues-jazz',
     sections: { A: '| C7 | F7 | C7 | C7 | F7 | F♯°7 | C7 | A7 | Dm7 | G7 | C7 A7 | Dm7 G7 |' },
     form: ['A'] }
   ```

   Ci sono quattordici griglie, una per sezione del capitolo. Gli id sono pubblici (deep link e
   test del volume) e non si rinominano:

   | Famiglia | Id |
   |---|---|
   | Cadenze | `ii-v-i`, `ii-v-i-minore`, `due-centri` |
   | Giri e sostituzioni | `turnaround`, `dominanti-secondarie`, `tritono`, `backdoor`, `diminuito` |
   | Blues | `blues`, `blues-jazz`, `blues-minore` |
   | Forme | `vamp-modale`, `aaba`, `rhythm-changes` |

   `ref` è l'etichetta della sezione del volume, per il collegamento «Nel volume». Il rhythm
   changes segue il capitolo: A e B, sedici battute. La forma intera A–A–B–A è un'opzione.

3. **Sigle, ritmo armonico e trasposizione** (`js/progression.js`, puro).
   - `parseSymbol('Em7/D') → { root, quality, bass }`. Vale per le qualità del catalogo più le
     qualità aggiuntive del punto 4. Una sigla sconosciuta è un errore, e un test controlla che ogni
     griglia del catalogo si legga.
   - Il ritmo armonico segue la regola del capitolo: un accordo nella battuta dura quattro
     pulsazioni, due accordi due ciascuno. Ne viene una lista di `{ beat, dur, bar, section, chord }`.
   - Le sigle si trasportano per intervallo, con lettere e semitoni (`Chords.transpose`), dalla
     tonalità di riferimento a quella scelta. Così si conserva la grafia funzionale: il D♭7 della
     sostituzione di tritono resta un II abbassato, non un C♯7. Le doppie alterazioni prodotte
     dalla trasposizione si riscrivono con il nome enarmonico più semplice. Il nome della tonalità
     si sceglie fra i candidati con `Theory.spellingCost` su tutte le note della griglia, come fa
     `bestRoots`.
   - I gradi romani del quiz si calcolano dalla fondamentale rispetto al centro, con la qualità
     (ii minuscolo, V7, ♭VII7, V7/ii…). Per le dominanti secondarie e per i due centri il catalogo
     può indicare il grado a mano: il calcolo automatico non basta.

4. **Qualità aggiuntive, fuori dai cataloghi di Arpeggi e Accordi.** `Chords.extra()` contiene
   `7b9` (`7♭9`, 1 3 5 ♭7 ♭9, famiglia dei voicing estesi: 3 5 ♭7 ♭9 senza fondamentale, terza al
   basso, come G7♭9 nel capitolo). Arpeggi e Accordi restano a 19 qualità, con deep link e conteggi
   invariati. Si potrà promuovere `7b9` nel catalogo con una decisione separata.

5. **Accompagnamento sulla linea del tempo.** Il ritmo d'attacco è una sequenza di colpi lungo
   tutta la forma, indipendente dal ritmo armonico. Ogni colpo suona l'accordo in vigore al suo
   battito, e la sua durata si tronca al cambio d'accordo.
   - `Comping` viene generalizzato con una funzione `comp(timeline, rhythm)` che le due pagine
     usano insieme. Per Accordi gli eventi restano identici, verificati da un test di equivalenza su
     tutti gli esercizi.
   - Si aggiungono ritmi di più battute: bossa (due battute), Freddie Green (quattro colpi brevi,
     solo shell e triadi) e la cellula del capitolo «levare dell'1 e 3». Gli id esistenti non
     cambiano.
   - I voicing si scelgono con `VoiceLeading.lead` sull'intera forma. Per il loop si aggiunge in
     coda il primo accordo e poi lo si scarta, così anche il ritorno è collegato.
     *Attuazione (4.2):* il primo accordo si fissa a ogni suo voicing come inizio e fine del ciclo e
     si tiene il ciclo meno costoso; la copia libera poteva scegliere un voicing diverso dal primo.
   - **Eccezioni del capitolo**: con la famiglia shell, m7♭5, 7♭9, °7 e le sigle con basso usano
     drop 2 a quattro voci sulle corde 4321 o 5432. La penalità della conduzione delle voci per un
     cambio del numero di voci esiste già.
   - Sigla con basso: l'accompagnamento suona la qualità superiore (Em7), il basso suona la nota
     dopo la barra (Re).

6. **Basso** (`js/exercises/bass.js`, puro, deterministico).
   - Tre modalità: spento, «fondamentali» (minime: fondamentale sull'1, fondamentale o quinta sul
     3) e «walking di base» (semiminime: 1 fondamentale; 2 e 3 note dell'accordo o di passaggio;
     4 avvicinamento cromatico o di tono alla fondamentale seguente).
   - Su un accordo di due pulsazioni: fondamentale e avvicinamento.
   - Registro MIDI 28–48, fondamentale scelta per vicinanza alla nota precedente. Il basso della
     sigla con barra prevale sulla fondamentale.
   - Niente casualità: lo stesso esercizio suona sempre uguale, e i test lo fissano.

7. **Parti audio.** Ogni evento porta `part: 'comp' | 'bass' | 'study'` (predefinito `comp`).
   - `AudioEngine` ha un bus per parte, con volumi `comp`, `bass` e `click`. Lo smorzamento si
     calcola per parte e corda, così il basso non chiude l'accordo.
   - Il suono del basso è lo stesso Karplus-Strong pre-renderizzato (ADR 0003), alle altezze del
     basso: nessun campione e nessun sintetizzatore nuovo.
   - Lo scheduler non cambia: è già polifonico.
   - Il trasporto aggiunge i cursori di volume per le parti presenti. Per gli altri strumenti
     `comp` è il bus «note» di oggi, quindi non cambia nulla di visibile.

8. **Modalità di studio** (asse «Studio» del pannello).
   - **Griglia**: accordo corrente evidenziato in griglia e voicing su tastiera e tablatura.
   - **Note guida**: 3ª e 7ª di ogni accordo nella zona scelta, con le due linee di minimo
     movimento calcolate con la stessa idea di Viterbi. Sul II–V–I in Do danno Fa–Fa–Mi e
     Do–Si–Si, come nel capitolo. Si possono far suonare piano (parte `study`).
   - **Arpeggio dell'accordo**: le note dell'accordo corrente nella zona, solo da vedere.
   - **Suona tu**: accompagnamento muto, solo basso e metronomo.
   - La **scala suggerita** del piano originale è rimandata per decisione dell'autore (2026-11-14). Il
     capitolo chiede di partire dalle note dei singoli accordi e di non uniformare le battute a una
     scala. Teoria 4 ha il riquadro «La scorciatoia e il suo prezzo».

9. **Pannello proprio** (`js/progpractice.js`), con la stessa interfaccia di `Practice` e
   `ChordPractice` verso il guscio.
   - Assi: **Cosa** (giri: 1, 2, 4 o continuo; forma intera per AABA e rhythm changes; finale
     chiuso o ciclico), **Come** (ritmo d'attacco, attacco, basso), **Dove** (famiglia di voicing,
     corde, zona), **Studio** e **Opzioni**.
   - Viste: **Griglia** (righe di quattro battute, etichette di sezione, gradi romani a scelta),
     tastiera e tablatura (solo l'accompagnamento).
   - Gli aiuti per il DOM comuni passano in `js/panel-ui.js`, usato da `chordpractice.js` e
     `progpractice.js`. Chiude il debito dell'ADR 0012, senza cambi visibili in Accordi.

10. **Deep link e persistenza.**
    - Esempio di link: `progressioni.html#v=1&prog=blues&key=F&rhythm=two-four&bass=walk&fam=shell&set=all&from=1&to=10&study=guide&giri=2&form=full&bpm=60`.
    - `Link.encodeProgExercise` e `Link.decodeProgExercise`, documentati in `deep-link.md`.
    - Chiavi `gsp:progressioni:v1` e `gsp:progressioni:practice:v1`.

11. **Temporizzazione.** C'è un test di non deriva: 10 minuti di loop del blues a 200 BPM con il
    clock finto dello scheduler, e ogni colpo cade entro 1 ms dal battito teorico. È il criterio di
    accettazione del piano.

## Alternative scartate

- **Griglie in gradi romani invece che in sigle.** Le sigle in gradi romani non distinguono
  D♭7 da C♯7, non esprimono la sigla con basso e allontanano il catalogo dal testo del volume. Le
  sigle trasportate per lettere e semitoni conservano la funzione.
- **Ritmo d'attacco per accordo, come in Accordi oggi.** Lega il ritmo d'attacco al ritmo armonico,
  cioè proprio ciò che il capitolo insegna a separare, e non permette due sigle in una battuta.
- **Sintetizzatore o campioni per il basso.** Introducono un secondo motore o file da caricare,
  contro gli ADR 0001 e 0003. Il Karplus-Strong nel registro grave basta per l'orientamento.
- **Inserire 7♭9 nel catalogo comune.** Cambierebbe Arpeggi e Accordi (conteggi, pool, test del
  volume) per un bisogno di Progressioni. Resta possibile in seguito.
- **Griglia libera scritta dall'utente nella prima versione.** Il parser la rende facile, ma
  richiede editor, messaggi d'errore e un parametro `grid=` nel link. È rimandata.
- **Batteria.** Fuori ambito: bastano metronomo e basso. Le basi con batteria sono nel capitolo 9
  del volume.

## Conseguenze

- `Comping` passa al modello a linea del tempo. Il test di equivalenza protegge Accordi e i suoi
  esercizi pronti nel volume.
- `AudioEngine` e `transport.js` acquistano le parti. Scale, Arpeggi e Accordi usano solo `comp` e
  non cambiano.
- `chordpractice.js` si alleggerisce con `panel-ui.js`.
- Il catalogo delle progressioni ricopia le griglie del capitolo 7. Se il capitolo cambia, va
  aggiornato a mano, e un test del volume (`tests/test_strumenti_links.py`) deve confrontare le
  sigle.
- Lato volume, in un passo separato su `appunti-pratica`: sezione «Progressioni» nel capitolo 11
  con esercizi pronti per le sezioni del capitolo 7, rimandi dal capitolo 7, test dei link.
- `architecture.md`, README, `deep-link.md` e la pagina di scelta (tessera Progressioni attiva) si
  aggiornano con l'attuazione.
