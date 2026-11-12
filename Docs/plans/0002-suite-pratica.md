# Piano 0002 — Suite di pratica: Scale, Arpeggi, Accordi, Progressioni

- Stato: Approvato (2026-11-12), da avviare. Ordine: rinomina → fase 0 → 1 (Scale nel volume, versione 1.1) → 2 Arpeggi → 3 Accordi → 4 Progressioni
- Decisioni: [ADR 0010](../ADR-0010-suite-di-strumenti.md); lato volume
  `appunti-pratica/Docs/adr/0005-strumenti-interattivi-nel-volume.md` e analisi 019

## Obiettivo

Quattro strumenti con lo stesso trasporto e le stesse viste (tastiera, tablatura, gradi),
apribili dal capitolo «Strumenti per la pratica» del volume Appunti di Pratica, anche con
esercizi preconfigurati tramite deep link. Vincoli invariati: statico, `file://`, mobile-first,
nessuna dipendenza.

## Riuso del codice

| Modulo | Scale | Arpeggi | Accordi | Progressioni |
|---|---|---|---|---|
| `theory.js` | sì | sì | sì | sì |
| `chords.js` (nuovo) | — | qualità | qualità, simboli | simboli |
| `guitar.js` (3NPS) | sì | — | — | — |
| `exercises/pool.js`, `melodic.js` | sì | sì (insieme di 3–5 gradi) | — | note guida, arpeggi sull'accordo |
| `exercises/rhythm.js` | sì | sì | sì (ritmi di accordo) | sì |
| `exercises/fingering.js` | sì | sì (profilo per arpeggi) | — | sì |
| `voicings.js`, `voiceleading.js` (nuovi) | — | — | sì | sì |
| `progression.js`, `comping.js` (nuovi) | — | — | — | sì |
| `audio/*`, `tab/*`, `fretboard.js`, `transport.js` | sì | sì | sì (polifonia) | sì (polifonia) |

## Fasi

### 0. Suite e deep link (refactor, nessun cambio funzionale)

- `practice.js` → `transport.js` + pannello Scale; `app.js` → `scale.html` + script dello strumento.
- `index.html`: pagina di scelta; i vecchi URL e lo stato salvato continuano a funzionare.
- `link.js` puro: lettura/scrittura del frammento, pulsante «Copia link dell'esercizio».
- Chiavi `localStorage` per strumento con migrazione.
- Normalizzatore degli eventi (`notes[]`) già introdotto, anche se tutti gli eventi sono a una nota.
- Tema «Appunti» (ADR 0010, punto 7): nuovi valori dei token in chiaro e scuro, parametro `theme`
  nel deep link, testata con ritorno al volume; verifica dei contrasti (WCAG AA) su
  pallini della tastiera, tablatura e nota in riproduzione.
- Accettazione: test esistenti verdi; nuovi test per `link.js` e per la migrazione; prova manuale
  da `file://` e da server statico.

### 1. Integrazione nel volume (solo Scale)

- GSP: attivazione di GitHub Pages; test che fissano lo schema dei deep link `v=1`.
- appunti-pratica (ADR 0005): indirizzo base in `conf.py`, script che aggiunge `theme` ai link,
  capitolo con la pagina Scale ed esercizi pronti ricalcati su `4-scale.rst`.
- Serve a validare presto Pages, iOS e PDF/ePub.

### 2. Arpeggi

- Catalogo da `5-arpeggi.rst`: maj7, 6, m7, m6, 7, m7♭5, dim7, mMaj7, estesi (9, 11, 13), m6/9.
- Estrazione casuale qualità × tonica; filtri per famiglia; modalità quiz.
- Esercizi: lineari, partenza da 3ª/5ª/7ª (rivolti), gruppi da 3–4, salti, ritmi e accenti esistenti.
- Dove: posizione di 5 tasti (diteggiatura per arpeggi: profilo di `fingering.js`, 1–2 note
  per corda), corde scelte, tastiera intera, collegamento delle posizioni.
- Accettazione: test sulle altezze di ogni qualità in 12 toniche, ortografia corretta (B♭7 → A♭,
  non G♯), diteggiature entro 4–5 tasti.

### 3. Accordi (eventi polifonici)

- Polifonia in scheduler, tastiera (più pallini), tablatura (cifre impilate, ASCII), audio
  (strum con ritardo per corda, opzione arpeggiato).
- Diagramma d'accordo SVG in `fretboard.js`.
- Famiglie da `6-accordi.rst`: essenziali, shell su 6–4–3 e 5–4–3, drop 2 su 4–3–2–1 e 5–4–3–2,
  drop 3 su 6–4–3–2 e 5–3–2–1, tre voci. Convenzioni del volume: niente corde a vuoto, tensioni
  non al basso.
- Esercizi: accordo casuale (quiz: mostra il simbolo, poi la soluzione); tutti i rivolti sullo
  stesso insieme di corde; ciclo di quarte con conduzione delle voci; nota al canto fissa.
- Accettazione: test su `voicings.js` (note corrette, estensione della mano, nessun doppione
  indesiderato) e su `voiceleading.js` (movimento totale minimo su II–V–I noti).

### 4. Progressioni

- Catalogo da `7-progressioni.rst`: II–V–I maggiore e minore, turnaround, dominanti secondarie,
  sostituzione di tritono, interscambio, diminuito di passaggio, blues, blues jazz, blues minore,
  vamp modale, due centri, rhythm changes (A), studio AABA.
- Tonalità casuale o scelta; BPM, loop, trainer; griglia con l'accordo corrente evidenziato.
- Accompagnamento automatico: voicing con conduzione delle voci; ritmi (semiminime, Charleston,
  bossa, Freddie Green); basso semplice (fondamentale/quinta, poi walking di base); volumi separati.
- Modalità di studio: note guida (3ª e 7ª) sulla tastiera; arpeggio dell'accordo corrente;
  scala suggerita; «suona tu» (solo basso e metronomo).
- Accettazione: test su parsing, trasposizione e durata delle griglie; sincronizzazione a lungo
  termine (nessuna deriva su 10 minuti di loop, come lo scheduler attuale).

## Rinomina in `appunti-strumenti` (prima della fase 1)

Decisa dall'utente il 2026-11-12 (ADR 0010, Conseguenze).

1. Utente, su GitHub: Settings → General → Repository name → `appunti-strumenti`.
2. Locale: `git remote set-url origin https://github.com/fabsguitarspace/appunti-strumenti.git`;
   facoltativo rinominare la cartella in `~/Projects/appunti/appunti-strumenti` accanto agli altri
   progetti (aggiornare i riferimenti relativi nelle analisi di appunti-pratica).
3. Sorgenti: README, `package.json` (`name`, `description`), `<title>`/meta e testata
   dell'app; nome visibile da decidere (titolo di lavoro «Appunti — Strumenti per la pratica»).
4. Attivare GitHub Pages dal ramo principale; verificare
   `https://fabsguitarspace.github.io/appunti-strumenti/` e un deep link.
5. Solo dopo: link dal volume.

## Rischi

- Carico CPU su mobile con polifonia e accompagnamento: pre-render dei buffer KS già presente,
  limitare le voci contemporanee.
- Correttezza musicale dei cataloghi: test sistematici e revisione sulle sezioni del volume.
- Crescita di `index.html`/pagine: ordine degli script per pagina da documentare in
  `architecture.md`.
