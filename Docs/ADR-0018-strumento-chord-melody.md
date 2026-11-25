# ADR 0018 — Strumento Chord melody: melodie generate sulle griglie, nota al canto come vincolo, famiglia «tre voci»

- Stato: Proposto (2026-11-25; decisioni dell'utente del 2026-11-25 al punto 1; rilascio 1a attuato il 2026-11-25 sul ramo `strumento-chord-melody`, da approvare; rilascio 1b da fare)
- Data: 2026-11-25
- Analisi: [Appunti di Pratica, analisi 026](../../appunti-pratica/Docs/analisi/026-strumento-chord-melody.md)
- Collegati: [ADR 0010](ADR-0010-suite-di-strumenti.md) (suite), [ADR 0011](ADR-0011-strumento-arpeggi.md)
  (guscio comune), [ADR 0012](ADR-0012-strumento-accordi.md) (voicing, conduzione delle voci; chiude
  i rimandi delle Conseguenze), [ADR 0013](ADR-0013-strumento-progressioni.md) (griglie, linea del
  tempo, parti audio), [ADR 0015](ADR-0015-famiglie-di-voicing.md) (famiglie; questo ADR ne aggiunge
  una), [ADR 0016](ADR-0016-strumento-ritmi.md) (gironi di celle, seme)

## Contesto

Il capitolo 6 di Appunti di Pratica ha la sezione «Voicing per il chord melody»
(`chord-melody-voicings`, analisi 018): drop 2 su 4–3–2–1 con le quattro note al canto per
qualità, la melodia che guida le voci interne nel II–V–I, drop 3 con il basso, tre voci (basso,
nota guida, melodia), diminuiti di passaggio con nota comune, scala di sesta diminuita, un
arrangiamento di otto battute con tre regole («accordo sulle note lunghe e sui tempi forti, nota
singola sulle note brevi di passaggio»; «poche voci quando la melodia si muove»; «una tensione al
canto»). Nessuno strumento la accompagna e il capitolo 11 non ha esercizi pronti su questo.

L'ADR 0012 ha rimandato l'esercizio «nota al canto fissa» e le «tre voci del chord melody»
(Conseguenze; piano 0002, fase 3, «Rimandati»).

Che cosa c'è già, verificato nel codice:

- `voicings.js`: ogni voicing porta `top` (indice del tono più acuto) e `notes[].tone`; filtrare per
  nota al canto è una selezione sull'uscita. Ci sono drop 2 su 4321, drop 3 su 6432 e 5321, le
  qualità 6, m6 e dim7.
- `voiceleading.js`: Viterbi con costo `movement()` sulle voci superiori e costo proprio per voicing.
- `progression.js` e `progressions.js`: sigle, ritmo armonico, trasposizione per lettere e semitoni,
  linea del tempo `{ beat, dur, bar, chord }` delle 14 griglie del capitolo 7.
- `rhythms.js`: gironi di celle e generatore con seme (mulberry32).
- Audio: parti `comp`, `bass`, `study` con bus e volume propri; la velocity è per evento
  (`accent`), non per nota.

Che cosa manca: una sorgente di melodie, la scelta del voicing **a partire dalla nota della
melodia**, il trattamento delle note che non sono dell'accordo, la famiglia a tre voci su corde non
adiacenti, una dinamica propria per la melodia.

## Decisione

1. **Decisioni dell'utente (2026-11-25).**
   - Strumento **nuovo** della suite, non un'estensione di Accordi.
   - Melodie **generate sulle griglie**; nessun catalogo di melodie scritte a mano, nessuna
     melodia inserita dall'utente nella prima versione.
   - La famiglia **«tre voci»** entra in `voicings.js` ed è disponibile **anche in Accordi**.
   - Nella prima versione tutti e quattro i gruppi di esercizi: nota al canto, melodia su griglia,
     diminuiti, tre voci e arrangiamento. Rilascio in due tempi (punto 11).

2. **Pagina e guscio.** `chord-melody.html` con `js/chordmelody.js` su `App.start`, tonalità con
   `rootParam: 'key'` come Progressioni e Ritmi. L'elemento estratto è un **materiale**:
   - una **griglia**: le 14 del catalogo di Progressioni (id invariati, catalogo non toccato) più
     due griglie proprie del chord melody in `js/melodies.js`, `cm-diminuiti`
     (`| C6 C♯°7 | Dm7 D♯°7 | Em7 | Em7 |`, come `cm-diminuiti-passaggio`) e `cm-sesta`
     (`| C6 | C6 | C6 | C6 |`, accordo di tonica lungo);
   - oppure un **accordo**: una qualità di settima o di sesta di `chords.js` su una fondamentale,
     per gli esercizi sulla nota al canto.

   Gli esercizi ammessi dipendono dal tipo di materiale (punto 6). *Da verificare in attuazione*:
   se `App.start` non regge due tipi di elemento, l'accordo diventa la griglia di una battuta
   `| X |` e l'elemento resta unico.

3. **Nota al canto nel nucleo** (`voicings.js`). `voicings(q, rootPc, fams, { top })` tiene solo i
   voicing la cui nota più acuta ha la classe di altezza (o l'altezza MIDI, se intera ≥ 12) data;
   `topOf(v)` restituisce `{ tone, midi, string }`. Nessun voicing nuovo: è un filtro, e vale
   anche per Accordi.

4. **Famiglia `trio` «Tre voci»** (`voicings.js`, estende la tabella del punto 2 dell'ADR 0015;
   l'id è pubblico e non si rinomina).
   - Tre note: **basso** = fondamentale; **nota guida** = 3ª o 7ª (6ª negli accordi di sesta; nel
     diminuito ♭3 o °7); **canto** = un'altra nota dell'accordo o una tensione del
     campo `tensions` della qualità in `chords.js` (mai la stessa classe della guida).
   - Corde: basso sulla 6ª o 5ª, guida su una corda intermedia, canto sulla 2ª o 1ª: 6-5-2, 6-5-1,
     6-4-2, 6-4-1, 6-3-2, 6-3-1, 5-4-2, 5-4-1, 5-3-2, 5-3-1. Comprende le quattro forme di
     `cm-tre-voci` e la forma di A7 su 6-5-1 di `cm-arrangiamento`.
   - Stesse convenzioni delle altre famiglie: cinque tasti, una nota per corda, niente corde a vuoto,
     altezze crescenti, nessuna tensione al basso. In più un costo di suonabilità per il salto di
     corde (usato dalla conduzione delle voci, non come filtro).
   - Non per le triadi (hanno `triad` e `spread`).
   - In Accordi diventa l'**undicesima famiglia**, con `fam=trio` nel link; i link esistenti non
     cambiano.

5. **Melodie generate** (`js/melodies.js`, puro, deterministico con seme come in ADR 0016). Una
   **linea** produce note `{ beat, dur, midi, role: 'chord' | 'passing', chordIndex }` sulla linea
   del tempo di `Progression.realize`. Cinque linee, in ordine di difficoltà:

   | Id | Linea | Regola |
   |---|---|---|
   | `common` | Nota comune | la stessa nota finché l'accordo la contiene (tono o tensione), poi la più vicina |
   | `guide` | Note guida | 3ª o 7ª con movimento minimo (Viterbi di Progressioni): Fa–Fa–Mi sul II–V–I |
   | `tones` | Toni dell'accordo | una nota dell'accordo per attacco, movimento minimo, niente ripetizioni oltre due |
   | `passing` | Toni e passaggi | tono dell'accordo sui tempi forti, nota di scala o cromatica sui deboli, che risolve per grado |
   | `dim6` | Sesta diminuita | linea per gradi sulla scala di sesta diminuita, solo su accordi 6 e m6 di almeno una battuta |

   - **Registro**: corde 1 e 2, MIDI 64–79 di preferenza (Mi4–Sol5), limiti 60–81.
   - **Ritmo della melodia**: celle a gironi di `rhythms.js` (`MELODY_CELLS`: semibreve, due
     minime, minima e due semiminime, quattro semiminime, charleston, minima puntata e semiminima).
     Una cella per battuta, fissa o variata con il seme. Nessun generatore ritmico nuovo; l'uso di
     qualsiasi figura di Ritmi è un ampliamento possibile.

6. **Esercizi** (asse **Cosa**), id pubblici:

   | Gruppo | Id | Materiale | Contenuto |
   |---|---|---|---|
   | Nota al canto | `tops` | accordo | le disposizioni della famiglia con le note al canto in salita (come `cm-drop2-maj7`) |
   | | `same-top` | accordo | la stessa nota al canto su maj7, 6, 7, m7, m7♭5 (la «Verifica» del capitolo) |
   | | `quiz-top` | accordo | mostra qualità e nota al canto, poi la forma |
   | Melodia su griglia | `line` | griglia | la linea scelta (`common`, `guide`, `tones`, `passing`) armonizzata |
   | Diminuiti | `dim-pass` | `cm-diminuiti` | nota comune sopra l'accordo e il diminuito seguente |
   | | `dim6` | `cm-sesta` o accordo 6/m6 | sesta diminuita su e giù, 6 e °7 alternati |
   | Tre voci e arrangiamento | `trio` | griglia | linea `guide` o `tones` con la sola famiglia `trio` |
   | | `arrange` | griglia | linea `passing`, famiglia «misto», le tre regole del capitolo |

7. **Armonizzazione** (`js/exercises/harmonize.js`, puro). Per ogni nota della melodia:
   - **trattamento**: accordo se la nota è dell'accordo (o tensione ammessa) e cade su un tempo
     forte o dura almeno due pulsazioni; altrimenti **nota sola**. Con l'opzione «Diminuito sulle
     note di passaggio», sugli accordi 6 e m6 la nota di passaggio prende il °7 un semitono sotto la
     fondamentale (B°7 su C6, la regola di Barry Harris del capitolo); sugli altri accordi resta
     nota sola;
   - **voicing**: candidati con il filtro del punto 3, nella famiglia scelta e con la melodia sulla
     corda scelta; Viterbi su tutte le note armonizzate, vincolo rigido sulla nota al canto,
     costo di `movement()` sulle voci interne, costo di zona e di salto di corde;
   - famiglia **«misto»** (`mix`): drop 3 sul primo attacco di un accordo che dura almeno una
     battuta, `trio` quando la melodia ha più di una nota per pulsazione, drop 2 altrove («poche voci
     quando la melodia si muove, più voci quando si ferma»);
   - **senza candidati** nella zona: nota sola, contata in un campo `unharmonized` dell'esercizio
     (i test ne controllano l'assenza sui casi del punto 12).

8. **Come, Dove, Studio, Opzioni.**
   - **Come**: attacco «insieme» (pennata o simultaneo, da Accordi) o «prima la melodia» (la nota
     al canto sul battito, le voci sotto un ottavo dopo: il riquadro «important» del capitolo);
     «stride» (basso sull'1 e voci superiori sul 2, solo sulle note lunghe); cella ritmica della
     melodia, fissa o variata.
   - **Dove**: famiglia (`drop2` su 4321, `drop3`, `trio`, `mix`), corda della melodia (1, 2,
     1–2), zona di tasti.
   - **Studio** (il «Come studiare» del capitolo): solo melodia, melodia e basso, completo,
     «suona tu» (solo click e viste).
   - **Opzioni**: asse comune di `PanelUI.optionsAxis` (loop, trainer, metronomo).

9. **Audio: parte `melody`.** `AudioEngine` aggiunge un bus `melody` con volume proprio, e la
   melodia suona più forte delle voci sotto. La nota al canto è un **evento separato** sulla parte
   `melody`; l'evento dell'accordo (`comp`) non la contiene. Diversamente dal basso di Progressioni,
   **`melody` e `comp` condividono lo smorzamento per corda**: le suona la stessa mano, e una corda
   dà una nota sola. Gli altri strumenti non usano `melody` e non cambiano.

10. **Viste, link e persistenza.**
    - Viste: sequenza di diagrammi (`chordchart`) con la nota al canto marcata; griglia
      (`gridView` di `progpractice.js`) con i nomi delle note della melodia sotto le sigle;
      tastiera; tablatura (note impilate, melodia in cima). Il quiz mostra qualità e nota al canto.
    - Link: `chord-melody.html#v=1&prog=ii-v-i&key=C&ex=line&line=guide&fam=drop2&string=1&attack=together&study=full&cell=halves&seed=7&bpm=60`;
      per un accordo `chord=maj7&key=C&ex=tops` (la fondamentale usa `key` come le griglie). `prog` e
      `chord` si escludono.
      `Link.encodeChordMelodyExercise`/`decodeChordMelodyExercise`, documentati in
      [deep-link.md](deep-link.md).
    - Chiavi `gsp:chordmelody:v1` e `gsp:chordmelody:practice:v1`.

11. **Rilascio in due tempi**, nella stessa pagina.
    - **1a**: punti 3 e 4 (anche in Accordi), linee `common`, `guide`, `tones`, esercizi `tops`,
      `same-top`, `quiz-top`, `line`, `trio`; parte `melody`.
    - **1b**: linee `passing` e `dim6`, griglie `cm-diminuiti` e `cm-sesta`, esercizi `dim-pass`,
      `dim6`, `arrange`, famiglia `mix`, opzione del diminuito sulle note di passaggio.
    L'armonizzatore delle note di passaggio è la parte più incerta musicalmente: l'utente lo ascolta
    da solo prima che regga l'arrangiamento.

12. **Criteri di accettazione (test in Node, `tests/chordmelody.test.js`).**
    - Ogni forma degli esempi `cm-*` del capitolo 6 si ritrova fra i voicing generati, con la stessa
      nota al canto (`cm-tre-voci` nella famiglia `trio`).
    - II–V–I in Do, melodia Do–Si–Si–La in drop 2: le voci interne si muovono al massimo di un
      tono, come `cm-drop2-ii-v-i`.
    - `trio` con la linea `guide` sul II–V–I: nota guida interna Do–Si–Si con melodia Fa–Fa–Mi,
      come `cm-tre-voci`.
    - `dim6` su C6: 6 e °7 alternati come `cm-sesta-diminuita`; `dim-pass`: voci interne per
      semitono, come `cm-diminuiti-passaggio`.
    - Su 14 griglie × 12 tonalità × linee `common`, `guide`, `tones`, con drop 2 e tutta la tastiera:
      `unharmonized` vuoto.
    - Determinismo (stesso link, stessi eventi), andata e ritorno del link, smorzamento condiviso
      fra `melody` e `comp`.
    - Accordi: conteggi e link esistenti invariati, `fam=trio` valido.

## Attuazione del rilascio 1a (2026-11-25)

Fatto: punti 2, 3, 4, linee `common`, `guide`, `tones`, esercizi `line`, `trio`, `tops`, `same-top`,
`quiz-top`, parte `melody`, viste, link, test (`tests/chordmelody.test.js`, 12 test; suite 131).
Scostamenti dal testo sopra, decisi in attuazione:

- **Guscio** (punto 2): `App.start` accetta due agganci facoltativi, `linkSlug(params)` e
  `linkParams(item, slug)`, così griglie e accordi convivono come elementi dello stesso catalogo
  (famiglie delle griglie più «Accordi a 4 note» e «Accordi di nona»). Gli altri strumenti non
  cambiano.
- **Opzione `melody`** (punti 3 e 4) al posto di `tensions`: nelle tre voci la fondamentale
  raddoppiata al canto e le tensioni al canto valgono solo per il chord melody. In Accordi la
  famiglia `trio` resta «una nota per grado», come le altre (test esistente). Il filtro `top`
  accetta classe di altezza o altezza MIDI, come previsto.
- **Celle ritmiche** (punto 5): attacchi `[battito, durata]` in `melodies.js`, non gironi di
  `rhythms.js`: bastano per celle di una battuta in 4/4 e non obbligano la pagina a caricare
  Ritmi. Aggiunta la cella «quattro semiminime» (`quarters`), che mette alla prova la nota sola.
  `Melodies.build` accetta `accept(onset, midi)`: l'armonizzatore la usa perché la melodia eviti le
  altezze che sul tempo forte non avrebbero una forma. Così il criterio «`unharmonized` vuoto» vale
  su 14 griglie × 12 tonalità × 3 linee × drop 2, drop 3 e tre voci × corde 1, 2 e 1–2.
- **Come** (punto 8): l'attacco «stride» passa al rilascio 1b, con le note lunghe del ritmo
  `passing`. «Suona tu» lascia la voce più grave della forma con il metronomo (lo scheduler non
  suona una sequenza vuota).
- **Accordi**: con undici famiglie l'ordinamento dei voicing tiene anche l'ordine degli insiemi di
  corde della famiglia; prima, con più insiemi sullo stesso basso (tre voci, ma già per quarte),
  lo stesso gruppo di corde poteva comparire due volte.
- Esiti musicali da sentire: la linea `tones` tende a muoversi fra note vicine (Do–Re–Do); le tre
  voci usano anche forme con il basso sulla 5ª corda dove il capitolo usa la 6ª (stessa nota guida).

Restano: rilascio 1b (punto 11); lato volume (capitolo 11, rimandi dal capitolo 6, test dei link,
note di rilascio dei volumi).

## Alternative scartate

- **Estensione di Accordi** con un asse «nota al canto»: costa meno, ma l'oggetto dello studio è
  una melodia nel tempo sopra una griglia, non un accordo; è lo stesso argomento con cui l'ADR 0016
  ha separato Ritmi da Scale. Il filtro sulla nota al canto va comunque nel nucleo e serve anche ad
  Accordi.
- **Armonizzare ogni nota della melodia**: contraddice la prima regola del capitolo e blocca la
  mano.
- **Nota al canto dentro l'evento dell'accordo**: la velocity è per evento; la melodia non si
  potrebbe far sentire più forte né isolare nello Studio.
- **Smorzamento separato per `melody`**, come per il basso: farebbe suonare due note sulla stessa
  corda.
- **Griglie del chord melody nel catalogo di Progressioni**: cambierebbe conteggi, pool e test del
  volume di uno strumento che ricopia il capitolo 7.
- **Melodie degli standard**: diritti; il volume usa solo melodie originali.

Rimandate, non scartate: un piccolo catalogo di melodie originali scritte a mano (come le otto
battute di `cm-arrangiamento`); la melodia inserita dall'utente (editor, errori, parametro nel link,
come la griglia libera dell'ADR 0013); la seconda nota guida aggiunta alla famiglia `trio`; corde a
vuoto nelle tonalità di chitarra; diteggiatura della mano destra (punto aperto dell'analisi 018).

## Conseguenze

- Moduli nuovi: `js/melodies.js`, `js/exercises/harmonize.js` (puri, testati in Node),
  `js/cmpractice.js` (pannello, stessa interfaccia di `Practice`), `js/chordmelody.js`
  (definizione). Moduli toccati: `voicings.js` (filtro `top`, famiglia `trio`), `link.js`,
  `audio/engine.js` (parte `melody`, smorzamento condiviso), `transport.js` (cursore del volume).
- Accordi passa da dieci a undici famiglie: tessera di `index.html`, README, `architecture.md`,
  `esercizi.md` e test di Accordi. L'ADR 0015 è Accettato e non si modifica: questo ADR lo estende.
- Pagina di scelta: tessera «Chord melody». `architecture.md` (diagramma, tabella dei moduli, ordine
  di caricamento, chiavi), README, `deep-link.md`, note di rilascio dello strumento.
- Lato volume (analisi 026), in un passo separato: sezione «Chord melody» nel capitolo 11 di Pratica
  con esercizi pronti, rimandi dalla sezione `chord-melody-voicings` del capitolo 6 e dal percorso
  Joe Pass; nel capitolo 6 la famiglia «Tre voci» nella tabella delle famiglie e il conteggio delle
  famiglie del capitolo 11; `tests/test_strumenti_links.py` per i nuovi link; note di rilascio dei
  tre volumi. Repertorio non si tocca.
- Le Conseguenze dell'ADR 0012 sul vocabolario per nota al canto restano aperte solo per il
  «Vocabolario avanzato» del capitolo 6 (forme scritte a mano con tensioni al canto), che questo ADR
  non riproduce.
