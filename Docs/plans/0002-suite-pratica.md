# Piano 0002 — Suite di pratica: Scale, Arpeggi, Accordi, Progressioni

- Stato: Approvato (2026-11-12); fasi 0 e 1 completate il 2026-11-12, fasi 2 e 3 il 2026-11-14; fase 4 analizzata il 2026-11-14 (ADR 0013), attuazione non avviata. Ordine: rinomina → fase 0 → 1 (Scale nel volume, versione 1.1) → 2 Arpeggi → 3 Accordi → 4 Progressioni
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

### 0. Suite e deep link (refactor, nessun cambio funzionale) — ✅ completata il 2026-11-12

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

Esito (2026-11-12):

- `js/transport.js` (trasporto comune) separato da `practice.js`, che resta il pannello dello
  strumento Scale.
- `index.html` è la pagina di scelta; lo strumento è `scale.html`. L'indirizzo principale apre la
  scelta, a un clic dallo strumento; non esistevano deep link da preservare.
- `js/link.js` e [deep-link.md](../deep-link.md): schema `v=1`, pulsante «Copia link
  dell'esercizio», applicazione del link all'apertura e su `hashchange`.
- `js/events.js`: `notesOf`/`midisOf`; scheduler, tastiera e tablatura (SVG e ASCII) gestiscono
  già note simultanee.
- Tema «Appunti» (gray/red/blue/amber di Radix come nel volume), `js/theme.js` per il parametro
  `theme` (per scheda, `sessionStorage`), testate con ritorno a strumenti e volume. Contrasti
  misurati: testo bianco su tonica 5,2:1 (chiaro, red-11) e 5,6:1 (scuro); nota in riproduzione
  7,2:1; testo secondario ≥ 5,9:1.
- Chiavi `localStorage`: **non migrate**. Le chiavi storiche restano allo strumento Scale e gli
  strumenti nuovi useranno `gsp:<strumento>:v1`: la separazione per strumento è ottenuta senza
  rischiare le impostazioni salvate (vedi la nota nell'ADR 0010, punto 6).
- Test: 43 (8 nuovi in `tests/link.test.js`). Verifica nel browser (server locale, 375 px e
  1280 px, chiaro e scuro): deep link applicato, riproduzione con evidenziazione su tastiera,
  tablatura e gradi, ascolto rapido, «Copia link», nessun errore in console.

### 1. Integrazione nel volume (solo Scale) — ✅ completata il 2026-11-12

- GSP: attivazione di GitHub Pages; test che fissano lo schema dei deep link `v=1`.
- appunti-pratica (ADR 0005): indirizzo base in `conf.py`, script che aggiunge `theme` ai link,
  capitolo con la pagina Scale ed esercizi pronti ricalcati su `4-scale.rst`.
- Serve a validare presto Pages, iOS e PDF/ePub.

**Esito.** Capitolo 11 «Strumenti per la pratica» del volume (versione 1.1) con otto esercizi
pronti, verificati uno per uno sul sito pubblicato; `tests/test_strumenti_links.py` del volume
li controlla con `js/link.js` e i cataloghi di questo repository, quindi **rinominare un id di
esercizio, ritmo o scala fa fallire il test del volume**. Corretto in [deep-link.md](../deep-link.md)
l'esempio sulle corde 6 e 5 (solo nove note fino al XII tasto) con le corde 5 e 4. Resta la prova
su iPhone e Android. Dettagli: analisi 019 di appunti-pratica, «Esito dell'attuazione».

### 2. Arpeggi

- Catalogo da `5-arpeggi.rst`: maj7, 6, m7, m6, 7, m7♭5, dim7, mMaj7, estesi (9, 11, 13), m6/9.
- Estrazione casuale qualità × tonica; filtri per famiglia; modalità quiz.
- Esercizi: lineari, partenza da 3ª/5ª/7ª (rivolti), gruppi da 3–4, salti, ritmi e accenti esistenti.
- Dove: posizione di 5 tasti (diteggiatura per arpeggi: profilo di `fingering.js`, 1–2 note
  per corda), corde scelte, tastiera intera, collegamento delle posizioni.
- Accettazione: test sulle altezze di ogni qualità in 12 toniche, ortografia corretta (B♭7 → A♭,
  non G♯), diteggiature entro 4–5 tasti.

**Esito (2026-11-14, [ADR 0011](../ADR-0011-strumento-arpeggi.md)).** `arpeggi.html` attivo nella
pagina di scelta: 19 qualità (triadi, 9 a quattro note, 6 di nona) × 12 fondamentali, filtri per
famiglia, quiz, cronologia; diteggiature in posizione con ascolto rapido; 17 esercizi in 4
categorie, partenza da 3ª/5ª/7ª, tutti gli ambiti; deep link `chord`, `start`. Guscio comune
`App.start` e pannello `Practice.configure` condivisi con Scale (nessun cambio visibile né di
link per Scale). Test: 54 (11 nuovi in `tests/arpeggi.test.js`). Verifica nel browser a 1280 e
375 px: deep link, riproduzione con evidenziazione, Scale invariato, nessun errore in console.
Lato volume (2026-11-14): sezione «Arpeggi» nel capitolo 11 con nove esercizi pronti, rimando nel
capitolo 5, `arpeggi.html` controllato da `tests/test_strumenti_links.py` (analisi 019 di
appunti-pratica, «Esito dell'attuazione (Arpeggi)»). Resta la revisione musicale delle diteggiature
da parte dell'utente.

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

**Esito (2026-11-14, [ADR 0012](../ADR-0012-strumento-accordi.md)).** `accordi.html` attivo nella
pagina di scelta: 19 qualità × 12 fondamentali; voicing shell, drop 2, drop 3 e triadi strette
generati dalle formule e mostrati come diagrammi d'accordo con ascolto (pennata, poi le note);
esercizi rivolti, ciclo delle quarte e II–V–I con conduzione delle voci; sei ritmi
d'accompagnamento, una o due battute per accordo, pennata o simultaneo; deep link propri. La
polifonia di scheduler, tastiera e tablatura era già pronta dalla fase 0; aggiunta la pennata
(`strum`). Test: 63 (9 nuovi in `tests/accordi.test.js`, fra cui gli shell e il II–V–I del capitolo
6). Verifica nel browser a 1280 e 375 px: deep link, controlli del pannello, riproduzione con
evidenziazione su diagrammi e tablatura, ascolto dei voicing, Scale e Arpeggi invariati.
Rimandati: vocabolario per nota al canto ed esercizio «nota al canto fissa», tre voci del chord
melody.
Lato volume (2026-11-14): sezione «Accordi» nel capitolo 11 con nove esercizi pronti, rimando nel
capitolo 6, `accordi.html` controllato da `tests/test_strumenti_links.py`, che verifica anche che
ogni esercizio produca voicing (analisi 019 di appunti-pratica, «Esito dell'attuazione
(Accordi)»). Resta la revisione musicale dei voicing da parte dell'utente.

### 4. Progressioni

Decisioni: [ADR 0013](../ADR-0013-strumento-progressioni.md) (Proposto, 2026-11-14). Il piano
originale prevedeva:

- catalogo da `7-progressioni.rst`;
- tonalità casuale o scelta;
- griglia con l'accordo corrente;
- accompagnamento con conduzione delle voci;
- ritmi: semiminime, Charleston, bossa, Freddie Green;
- basso semplice e volumi separati;
- modalità note guida, arpeggio, scala suggerita e «suona tu».

L'analisi del 2026-11-14 lo precisa così. Ogni passo si chiude con i test verdi e un commit; i
passi 4.0–4.2 non cambiano nulla di visibile negli strumenti esistenti.

**4.0 Preparazione (refactor, nessun cambio visibile)**

- `js/panel-ui.js`: aiuti DOM e asse Opzioni estratti da `chordpractice.js` (debito dell'ADR 0012).
- `Comping`: ritmo d'attacco sulla linea del tempo (`comp(timeline, rhythm)`); `build` di Accordi
  la usa. Test di equivalenza: eventi identici a oggi per tutti gli esercizi, ritmi e famiglie.
- Parti audio: campo `part` negli eventi, bus e volumi per parte in `AudioEngine`, smorzamento per
  parte e corda; Scale, Arpeggi e Accordi restano su `comp`.
- Accettazione: 63 test esistenti verdi, nuovo test di equivalenza; Accordi provato nel browser.

*Esito (2026-11-14).* Fatto.
- `js/panel-ui.js` è usato da `chordpractice.js`: gli id dei controlli sono invariati (`cp-*`).
  `practice.js` ha ancora i suoi aiuti.
- `Comping.comp(timeline, rhythm, opts)` è il nuovo modello. L'impronta degli eventi è identica
  alla versione precedente su tutte le 192.960 combinazioni di Accordi (qualità × tonica ×
  famiglia × corde × esercizio × direzione × ritmo × battute × attacco).
- Test: 65, di cui due nuovi: l'impronta su un campione e il caso di due accordi in una battuta.
- `AudioEngine` ha i bus `comp`, `bass` e `study`, e lo smorzamento per parte e corda; il
  trasporto passa `part` e i volumi `volBass` e `volStudy`, se presenti.
- Nel browser: Accordi a 1280 px con deep link, riproduzione con evidenziazione, volume salvato
  e trainer; Scale in riproduzione. Nessun errore in console.

**4.1 Modelli puri delle griglie**

- `Chords.extra()` con `7b9`; `js/progression.js` (sigle, ritmo armonico, trasposizione, gradi
  romani); `js/progressions.js` (14 griglie del capitolo 7, id dell'ADR 0013).
- Test:
  - ogni sigla del catalogo si legge;
  - numero di battute: II–V–I 4, blues 12, AABA 32 con la forma intera, rhythm changes 16;
  - due sigle in una battuta durano 2 + 2;
  - trasposizione in 12 tonalità senza doppie alterazioni;
  - esempi del capitolo: in Fa, II–V–I Gm7–C7–Fmaj7 e minore Gm7♭5–C7♭9–Fm6; tritono in Do
    Dm7–D♭7–Cmaj7; `Em7/D` con basso Re.

*Esito (2026-11-14).* Fatto.
- `Chords.extra()` con `7b9` e `Chords.all()`; `Chords.catalog()` resta a 19 qualità.
- `js/progression.js` (`Progression`): `parseSymbol` (anche grafie ASCII, `ø`, `Δ`), `parseGrid`
  (1, 2 o 4 accordi per battuta), `realize(prog, { key, full, ending })` → battute con etichette
  A1/A2/B/A3 e linea del tempo `{ beat, dur, bar, section, chord }`; trasposizione per lettere e
  semitoni senza doppie alterazioni; gradi romani dal centro.
- Nome della tonalità da una classe di altezza: ogni sigla diversa contata una volta, più la scala
  della tonalità (Ionica, Eolia o Dorica secondo `mode`); in parità il bemolle. Ne viene D♭ per
  quasi tutte le griglie, F♯ per il blues di base (G♭ chiederebbe C♭7), C♯ e F♯ per il backdoor,
  C♯m, F♯m e G♯m per le minori.
- `js/progressions.js` (`Progressions`): 14 griglie con gli id dell'ADR. Scelte rispetto all'ADR:
  - `due-centri` ha due sezioni con il proprio centro (`centers: { B: 'B♭' }`): i gradi delle ultime
    quattro battute si leggono rispetto a Si♭, come chiede il capitolo;
  - gradi a mano solo per `dominanti-secondarie` (V7/vi, V7/ii, dall'analisi del capitolo);
  - `aaba` e `rhythm-changes`: forma breve A–B, forma intera A–A–B–A (`fullForm`); `aaba` ha il
    finale chiuso del capitolo (`ending`: battute 31–32 Dm7 G7 | Cmaj7);
  - turnaround e tritono tengono le due righe del capitolo (otto battute: originale e variante);
  - `vamp-modale` e `rhythm-changes` hanno `ref: null`: nel capitolo le due sezioni non hanno
    un'etichetta. Da aggiungere nel volume al passo 4.4.
- Test: 74 (9 nuovi in `tests/progressioni.test.js`). Nessun cambio visibile negli strumenti.

**4.2 Accompagnamento e basso**

- Griglia → voicing con `VoiceLeading.lead` sulla forma intera, collegando anche il ritorno del
  loop; eccezioni del capitolo (m7♭5, 7♭9, °7 e sigle con basso a quattro voci); nuovi ritmi
  (bossa, Freddie Green, cellula «levare dell'1 e 3»).
- `js/exercises/bass.js`: fondamentali e walking di base, deterministico.
- Linee di note guida (3ª e 7ª) di minimo movimento.
- Test:
  - con gli shell il II–V–I in Do riproduce il capitolo (Fa–Fa–Mi, Do–Si–Si);
  - ogni colpo suona l'accordo in vigore;
  - basso: fondamentale sull'1, avvicinamento sul 4 a un semitono o un tono, registro 28–48;
  - nessuna deriva su 10 minuti di loop a 200 BPM (clock finto, scarto massimo 1 ms).

*Esito (2026-11-14).* Fatto.
- `js/exercises/progcomp.js` (`ProgComp.build(realize, settings)`): voicing per gruppo di sigle
  uguali consecutive, eventi `comp`, `bass` e `study` in un'unica sequenza; `comp: false` è «suona
  tu», `guide: true` fa suonare piano le note guida.
- Eccezioni con la famiglia shell: m7♭5, 7♭9 e °7 in drop 2 su 5432 o 4321 con basso **obbligato**
  (fondamentale; terza per 7♭9, senza fondamentale), come negli esempi del capitolo (Dm7♭5 = Re La♭
  Do Fa, G7♭9 = Si Fa La♭ Re). Il vamp (`fourVoices` nel catalogo) usa drop 2 anche per Dm7. La
  sigla con barra ha un voicing proprio: basso sulla 5ª o 6ª corda, tre note dell'accordo superiore
  sopra (Em7/D = Re Sol Si Mi). Le triadi usano le prime tre note della qualità.
- Loop: diverso dall'ADR. La copia libera del primo accordo in coda poteva scegliere un voicing
  diverso dal primo, e in tre casi il ritorno peggiorava. Ora si prova ogni voicing del primo
  accordo come inizio e fine del ciclo e si tiene il ciclo meno costoso (`VoiceLeading.lead`
  restituisce anche `cost`). Su tutto il catalogo × 4 famiglie il movimento del ciclo scende da 2278
  a 1977 semitoni, mai peggiore; l'intero catalogo si calcola in circa 0,2 s.
- Ritmi in `Comping.PROG_RHYTHMS` (l'elenco di Accordi non cambia): `offbeat` (levare dell'1 e sul 3,
  dall'esempio del capitolo), `bossa` (due battute), `green` (Freddie Green, famiglie shell e triadi).
- `js/exercises/bass.js` (`Bass.build`): fondamentali (1 e quinta sul 3) e walking (1, terza e
  quinta o settima e quinta sotto, avvicinamento cromatico o di tono), registro 28–48; nel loop
  l'ultima nota si avvicina alla prima del giro seguente. Corda e tasto sono di un basso a quattro
  corde, solo per lo smorzamento: la tastiera del 4.3 deve mostrare solo la parte `comp`.
- Note guida: Viterbi sulle coppie 3ª–7ª nel registro delle corde 4–2 della zona.
- Test: 82 (8 nuovi in `tests/progcomp.test.js`). Nessun cambio visibile negli strumenti esistenti.

**4.3 Pagina, pannello, deep link**

- `progressioni.html`, `js/progressioni.js`, `js/progpractice.js`.
- Vista Griglia (con quiz sui gradi romani), tastiera, tablatura; assi Cosa, Come, Dove, Studio,
  Opzioni; volumi delle parti nel trasporto.
- Deep link `prog`, `key`, `rhythm`, `attack`, `bass`, `fam`, `set`, `from`, `to`, `study`,
  `giri`, `form`, `bpm`; persistenza `gsp:progressioni:*`.
- Tessera attiva nella pagina di scelta; aggiornati `architecture.md`, README e `deep-link.md`.
- Accettazione:
  - test di link (andata e ritorno, parametri sconosciuti ignorati);
  - prova nel browser a 375 e 1280 px, chiaro e scuro: deep link, riproduzione con
    evidenziazione in griglia, tastiera e tablatura, volumi, «suona tu», nessun errore in console;
  - Scale, Arpeggi e Accordi invariati.

**4.4 Lato volume (appunti-pratica, passo separato da approvare)**

- Sezione «Progressioni» nel capitolo 11, con un esercizio pronto per ogni sezione del capitolo 7.
- Rimando nel capitolo 7.
- `tests/test_strumenti_links.py` esteso: link validi, e sigle del catalogo uguali alle griglie del
  capitolo.
- Analisi 019, «Esito dell'attuazione (Progressioni)».

**Domande per l'autore**: decise il 2026-11-14. L'autore ha accettato le quattro proposte:
nessuna scala suggerita, niente swing, basso in Karplus-Strong da giudicare all'ascolto, nessuna
griglia libera nella prima versione. Il testo delle domande resta qui sotto come riferimento.

1. *Scala suggerita* (prima del 4.3). Il capitolo chiede di partire dalle note degli accordi e
   avverte di non uniformare le battute a una scala. Proposta: rimandarla e tenere note guida e
   arpeggio. In alternativa: «una scala possibile», spenta per impostazione, con i nomi delle
   tabelle di Teoria.
2. *Swing* (prima del 4.2). Il capitolo usa ottavi regolari, senza swing automatico. Proposta:
   niente swing nella prima versione. Il walking in semiminime non ne ha bisogno.
3. *Suono del basso* (prima del 4.2). Proposta: Karplus-Strong attuale nel registro grave, da
   giudicare all'ascolto. Se non basta, un ADR a parte.
4. *Griglia libera* (dopo il 4.3). Proposta: non nella prima versione. Il parser la rende
   possibile in seguito con un parametro `grid=`.

## Rinomina in `appunti-strumenti` (prima della fase 1)

Decisa dall'utente il 2026-11-12 (ADR 0010, Conseguenze).

1. ✅ Utente, su GitHub: Settings → General → Repository name → `appunti-strumenti` (fatto il 2026-11-12).
2. Locale: `git remote set-url origin https://github.com/fabsguitarspace/appunti-strumenti.git`
   (da fare); ✅ cartella spostata in `~/Projects/appunti/appunti-strumenti` e riferimenti nelle
   analisi di appunti-pratica aggiornati (2026-11-12).
3. ✅ Sorgenti: README, `package.json`, `<title>`/meta e testata dell'app con il nome visibile
   **«Strumenti per la pratica»**, scelto dall'utente il 2026-11-12.
4. ✅ GitHub Pages attivo dal ramo `main`, radice (2026-11-12): pagina, CSS e script rispondono,
   estrazione di una scala senza errori in console, testata senza overflow a 375 px. Deep link da
   verificare dopo la fase 0 (`link.js`).
5. Solo dopo: link dal volume.

## Rischi

- Carico CPU su mobile con polifonia e accompagnamento: pre-render dei buffer KS già presente,
  limitare le voci contemporanee.
- Correttezza musicale dei cataloghi: test sistematici e revisione sulle sezioni del volume.
- Crescita di `index.html`/pagine: ordine degli script per pagina da documentare in
  `architecture.md`.
