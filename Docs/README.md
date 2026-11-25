# Documentazione

- [architecture.md](architecture.md): architettura attuale e architettura di arrivo.
- [esercizi.md](esercizi.md): catalogo degli esercizi e corrispondenza con i parametri del modello.
- [deep-link.md](deep-link.md): schema dei link agli esercizi (interfaccia pubblica, usata dal volume).
- [plans/0001-audio-ed-esercizi.md](plans/0001-audio-ed-esercizi.md): piano (completato) per ascolto, esercizi su tutta la tastiera e tablatura.
- [plans/0002-suite-pratica.md](plans/0002-suite-pratica.md): piano (approvato) per la suite Scale, Arpeggi, Accordi, Progressioni e l'integrazione nel volume Appunti di Pratica (fasi 0–3 completate; fase 4 analizzata, ADR 0013).

## Note di rilascio

Dal 19 novembre 2026, su richiesta dell'utente: `note-di-rilascio.html`, collegata dal piè di pagina della pagina principale. A ogni aggiornamento pubblicato (push su main che cambia ciò che l'utente vede) aggiungere in cima una sezione `<section class="card release">` con la data in `<time datetime="AAAA-MM-GG">` e le voci scritte per chi usa gli strumenti; una sola sezione per data. `tests/release-notes.test.js` controlla link, date e ordine. Le novità dei capitoli restano nelle note di rilascio dei volumi.

## ADR (Architecture Decision Records)

| # | Titolo | Stato |
|---|---|---|
| [0001](ADR-0001-app-statica-senza-server.md) | Applicazione statica, senza server e senza build | Accettato |
| [0002](ADR-0002-script-classici-namespace-globali.md) | Script classici con namespace globali | Accettato |
| [0003](ADR-0003-sintesi-karplus-strong.md) | Suono: Karplus-Strong pre-renderizzato in AudioBuffer | Accettato |
| [0004](ADR-0004-scheduler-lookahead.md) | Temporizzazione: scheduler lookahead sul clock audio | Accettato |
| [0005](ADR-0005-modello-esercizi.md) | Esercizi: melodia × ritmo (Cosa × Come), funzioni pure | Accettato |
| [0006](ADR-0006-ambito-esercizi.md) | Ambito (Dove): altezze prima, posizioni poi; corde, posizioni collegate | Accettato |
| [0007](ADR-0007-ui-pratica-mobile.md) | UI della pratica: pannello, tastiera intera, tablatura, trasporto | Accettato |
| [0008](ADR-0008-assegnazione-posizioni.md) | Assegnazione delle posizioni: Viterbi con vincoli e profili | Accettato |
| [0009](ADR-0009-tablatura.md) | Tablatura dell'esercizio in SVG generata dagli eventi | Accettato |
| [0010](ADR-0010-suite-di-strumenti.md) | Da app per le scale a suite di strumenti di pratica | Accettato |
| [0011](ADR-0011-strumento-arpeggi.md) | Strumento Arpeggi: guscio comune, qualità come insiemi di gradi, diteggiature in posizione | Proposto |
| [0012](ADR-0012-strumento-accordi.md) | Strumento Accordi: voicing generati dalle formule, conduzione delle voci, pannello proprio | Proposto |
| [0013](ADR-0013-strumento-progressioni.md) | Strumento Progressioni: griglie del volume, ritmo d'attacco sulla linea del tempo, basso e parti audio | Proposto (non attuato) |
| [0014](ADR-0014-scale-derivate.md) | Strumento Scale: pentatoniche, scala blues e scale bebop | Accettato |
| [0015](ADR-0015-famiglie-di-voicing.md) | Strumento Accordi: tutte le famiglie di voicing del capitolo, tensioni per qualità | Accettato |
| [0016](ADR-0016-strumento-ritmi.md) | Strumento Ritmi: figure come gironi di celle, linea sopra una base, click spostato | Proposto |
| [0017](ADR-0017-piano-elettrico.md) | Suono: piano elettrico selezionabile accanto alla chitarra | Accettato |
| [0018](ADR-0018-strumento-chord-melody.md) | Strumento Chord melody: melodie generate sulle griglie, nota al canto come vincolo, famiglia «tre voci» | Proposto (rilascio 1a attuato, da approvare) |

Formato: contesto, decisione, alternative scartate, conseguenze.
Un ADR accettato non si modifica: se la decisione cambia se ne scrive uno nuovo che lo sostituisce.
Gli ADR "Proposti" si possono rivedere finché non vengono accettati (di norma a fine implementazione).
