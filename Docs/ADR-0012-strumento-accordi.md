# ADR 0012 — Strumento Accordi: voicing generati dalle formule, conduzione delle voci, pannello proprio

- Stato: Proposto (2026-11-14; implementato, da accettare dopo la prova dell'utente)
- Data: 2026-11-14
- Piano: [plans/0002-suite-pratica.md](plans/0002-suite-pratica.md), fase 3
- Collegati: [ADR 0008](ADR-0008-assegnazione-posizioni.md), [ADR 0010](ADR-0010-suite-di-strumenti.md)
  (punti 3 e 4), [ADR 0011](ADR-0011-strumento-arpeggi.md)

## Contesto

Lo strumento Accordi deve stare al livello di Scale e Arpeggi e preparare Progressioni, che ne
userà voicing e conduzione delle voci. Gli eventi polifonici (`notes[]`) erano già supportati da
scheduler, tastiera e tablatura (ADR 0010, punto 3); il guscio di estrazione `App.start` e le
qualità di `chords.js` esistevano già (ADR 0011). Mancavano voicing, diagrammi d'accordo, esercizi
sugli accordi e un pannello adatto: quello delle scale lavora su motivi melodici.

## Decisione

1. **Voicing generati dalle formule** (`js/voicings.js`), non scritti a mano: famiglia × insieme di
   corde × disposizione delle note dal basso; i tasti si cercano entro cinque tasti, con le altezze
   in ordine crescente, nella posizione più grave possibile (1–20). Famiglie del capitolo 6 del
   volume:
   - **shell** a tre voci su 6–4–3 e 5–4–3: R–7–3 (6ª corda), R–3–7, basso di terza 3–7–R, basso di
     quinta senza fondamentale 5–3–7 (6ª) e 5–7–3 (5ª); per settime e seste, non per il diminuito;
   - **drop 2** su 4–3–2–1 e 5–4–3–2 e **drop 3** su 6–4–3–2 e 5–3–2–1, nei quattro rivolti
     (posizione stretta a b c d → c a b d e b a c d);
   - **triadi strette** sulle quattro terne di corde adiacenti, per le triadi.
   Convenzioni del volume: niente corde a vuoto, nessuna tensione al basso. Negli accordi di nona i
   voicing a quattro voci usano 3 5 7 9 (la nona sostituisce la fondamentale).
2. **Conduzione delle voci** (`js/voiceleading.js`): Viterbi come in ADR 0008. Costo di transizione:
   semitoni percorsi dalle voci superiori più un quarto del salto del basso (il basso segue le
   fondamentali); costo proprio: uscita dalla zona di tasti scelta, spostamento della mano, e negli
   shell basso diverso dalla fondamentale. Con gli shell il II–V–I in Do riproduce l'esempio del
   capitolo (Dm7 sulla 5ª, G7 sulla 6ª, Cmaj7 sulla 5ª; Fa–Fa–Mi e Do–Si–Si).
3. **Esercizi** (`js/exercises/comping.js`): rivolti sullo stesso gruppo di corde (su, giù, su e giù,
   dentro la zona), ciclo delle quarte (dodici accordi della stessa qualità), II–V–I verso l'accordo
   estratto (maggiore o minore secondo la qualità; con le triadi II, V, I). Ritmi d'accompagnamento
   (semibreve, minime, semiminime, 2 e 4, Charleston, arpeggiato in ottavi), una o due battute per
   accordo, pennata (18 ms fra le corde, campo `strum` dell'evento letto da `transport.js`) o attacco
   simultaneo.
4. **Pannello proprio** (`js/chordpractice.js`) con la stessa interfaccia di `Practice` verso il
   guscio (`configure`, `mount`, `unmount`, `quickPlay`, `applyLink`, …); `App.start` accetta
   `panel`, `decodeLink` e, nella vista, `diagram`, `patternCaption`, `groupLabel`.
   Viste: sequenza di diagrammi d'accordo, tastiera, tablatura (note impilate).
5. **Diagramma d'accordo** verticale (`js/chordchart.js`), cinque tasti, × sulle corde mute, stessi
   `data-s`/`data-f` della tastiera per l'evidenziazione.
6. **Deep link** (`accordi.html`): `chord`, `root`, `ex`, `dir`, `fam`, `set` (`all` o corde da
   chitarrista, es. `4321`), `from`, `to`, `rhythm`, `bars`, `attack`, `bpm`
   (`Link.encodeChordExercise`/`decodeChordExercise`). Persistenza: `gsp:accordi:v1`,
   `gsp:accordi:practice:v1`.

## Alternative scartate

- **Catalogo di forme scritte a mano** dagli spartiti del volume: centinaia di forme da trascrivere
  e controllare per dodici tonalità; le regole generano le stesse forme (verificato sugli shell e
  sui drop del capitolo) e valgono per ogni qualità.
- **Estendere il pannello delle scale**: assi diversi (niente motivi, pool, estensione); avrebbe
  riempito `practice.js` di casi particolari.
- **Movimento contato anche sul basso a peso pieno**: sceglieva shell senza fondamentale nel
  II–V–I, contro l'esempio del capitolo.

## Conseguenze

- `chordpractice.js` duplica dal pannello delle scale gli aiuti per il DOM e l'asse Opzioni (circa
  100 righe): da estrarre in un modulo comune quando arriverà il pannello di Progressioni.
- Il vocabolario per nota al canto (capitolo 6, «Vocabolario avanzato») e le tre voci del chord
  melody non sono ancora famiglie dello strumento; l'esercizio «nota al canto fissa» del piano è
  rimandato.
- Progressioni riusa `voicings.js`, `voiceleading.js` e il ritmo d'accompagnamento di `comping.js`.
