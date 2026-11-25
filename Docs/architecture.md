# Architettura

Strumenti per la pratica (ex Guitar Scale Practice) è un sito statico senza build
([ADR 0001](ADR-0001-app-statica-senza-server.md)): script classici caricati in ordine, ognuno
pubblica un oggetto globale ([ADR 0002](ADR-0002-script-classici-namespace-globali.md)). I moduli
puri si caricano anche da Node per i test. È una suite di strumenti con nucleo comune
([ADR 0010](ADR-0010-suite-di-strumenti.md)), pubblicata su GitHub Pages.

## Pagine

| Pagina | Contenuto |
|---|---|
| `index.html` | scelta dello strumento (Scale, Arpeggi, Accordi, Progressioni e Ritmi), ritorno al volume |
| `scale.html` | strumento Scale: scala casuale, diteggiature 3NPS o in posizione (pentatoniche e blues, ADR 0014), esercizi, trasporto |
| `arpeggi.html` | strumento Arpeggi: arpeggio casuale (19 qualità), diteggiature in posizione, rivolti, esercizi, trasporto |
| `accordi.html` | strumento Accordi: accordo casuale, voicing shell/triadi strette e late/drop/senza fondamentale/strutture superiori/quarte/cluster in diagrammi, rivolti, ciclo delle quarte, II–V–I, trasporto |
| `progressioni.html` | strumento Progressioni: progressione casuale del capitolo 7, griglia, accompagnamento, basso, note guida, quiz sui gradi romani, trasporto |
| `ritmi.html` | strumento Ritmi (ADR 0016): figura ritmica casuale della pagina «Ritmo melodico», griglia ritmica, linea sopra una base, click spostato, quiz di lettura, trasporto |

Ogni pagina carica `js/theme.js` nel `<head>` e `css/style.css` (tema «Appunti»).

## Moduli

```
                 ┌────────────────────────── puri, testati in Node ──────────────────────────┐
theory.js ─► chords.js (Chords: qualità) ─► voicings.js (Voicings) ─► voiceleading.js (VoiceLeading)
                         └─► progression.js (Progression: griglie) ◄── progressions.js (catalogo)
                                   └─► exercises/progcomp.js (ProgComp) ◄── exercises/bass.js (Bass)
                                             └─► exercises/comping.js (Comping: esercizi sugli accordi)
theory.js ─► guitar.js ─► exercises/pool.js ─► melodic.js ─► rhythm.js ─► fingering.js ─► presets.js
(Theory)     (Guitar)     (Pool)               (Melodic)     (Rhythm)     (Fingering)     (Presets.build)
events.js (Events.notesOf: note di un evento, singole o simultanee)  link.js (Link: deep link)
                                                                                               │ eventi
                    ┌──────────────────────────────┬──────────────────────┬────────────────────┤
                    ▼                              ▼                      ▼                    ▼
   audio/scheduler.js ─► audio/engine.js     fretboard.js           tab/layout.js ─► tab/render.js
   (Scheduler, puro)     (AudioEngine)        (Fretboard: card e     (TabLayout, puro)  (TabRender)
                         audio/ks.js (KS)      tastiera intera)
                    └── transport.js (Transport: Play/BPM/Tap, scheduler, rAF, wake lock) ──┘
                                     │ onHighlight(evento)
                                     ▼
                         practice.js (Practice: pannello, viste, link dell'esercizio)
                                                    ▲  configure(catalogo) · mount(context)
                                       app.js (App: guscio comune di estrazione, ADR 0011)
                                                    ▲  App.start(definizione)
                                     scale.js · arpeggi.js · accordi.js (definizioni degli strumenti)
   Accordi: chordpractice.js (ChordPractice, stessa interfaccia di Practice) + chordchart.js (diagrammi)
   Ritmi: rhythms.js (Rhythms: figure) ─► exercises/rhythmline.js (RhythmLine: linea + base, via ProgComp)
          └─► rhythmpractice.js (RhythmPractice, stessa interfaccia) ◄── ritmi.js (definizione)
```

| Modulo | Responsabilità | Node |
|---|---|---|
| `theme.js` | tema chiaro/scuro dal parametro `theme` del link (per scheda) | no |
| `theory.js` | note, gradi, catalogo 45 scale (pentatoniche, blues e bebop in coda, ADR 0014), spelling enarmonico, ♭/♯ | sì |
| `guitar.js` | diteggiature 3NPS (18 posizioni per grado di partenza) e in posizione (`positionPatterns`) per gli arpeggi e per pentatoniche e scala blues | sì |
| `chords.js` | 19 qualità come insiemi di gradi (più `extra()`: 7♭9 per Progressioni), ortografia, sigle, trasposizione | sì |
| `progression.js` | griglie di accordi (ADR 0013): sigle (`parseSymbol`), ritmo armonico, trasposizione per lettere e semitoni, nome della tonalità, gradi romani; `realize` → battute e linea del tempo | sì |
| `progressions.js` | catalogo delle 14 griglie del capitolo 7 del volume (id pubblici, sezioni, forma, centri) | sì |
| `voicings.js` | voicing shell, triadi strette e late, drop 2, drop 3, drop 2 e 4, senza fondamentale, strutture superiori, per quarte e cluster generati (ADR 0012, ADR 0015); `toneList(q)` aggiunge alle note della qualità i colori dei senza fondamentale e le tensioni di `chords.js` (es. 13, ♯11, ♭9), con gli stessi indici `tone` usati per le etichette dalle formule (una nota per corda, cinque tasti, niente vuoti né tensioni al basso) | sì |
| `voiceleading.js` | scelta dei voicing lungo una sequenza con movimento minimo (Viterbi) | sì |
| `exercises/comping.js` | esercizi sugli accordi (rivolti, ciclo delle quarte, II–V–I) e ritmi d'accompagnamento sulla linea del tempo (`comp`, ADR 0013): ogni colpo suona l'accordo in vigore → eventi polifonici | sì |
| `exercises/progcomp.js` | accompagnamento delle progressioni (ADR 0013): voicing con la conduzione delle voci sull'intera forma e sul ritorno del loop, eccezioni del capitolo 7 (quattro voci, sigla con barra), ritmi `PROG_RHYTHMS`, note guida → eventi `comp`, `bass`, `study` | sì |
| `exercises/bass.js` | basso deterministico delle progressioni: fondamentali o walking di base, registro 28–48 | sì |
| `events.js` | normalizzatore degli eventi: `notesOf` (nota singola o `notes[]`), `midisOf` | sì |
| `exercises/pool.js` | ambiti, posizioni ammesse, pool di altezze con estensione, nota di partenza, nona al posto della fondamentale (`rootOnce`) | sì |
| `exercises/melodic.js` | motivo × passo × direzione × forma → indici | sì |
| `exercises/rhythm.js` | celle, swing, accenti, levare, ripetute → eventi in battiti (tick interi) | sì |
| `exercises/fingering.js` | Viterbi con finestra della mano e profili → corda e tasto | sì |
| `exercises/presets.js` | cataloghi per strumento (`Presets`, `Presets.ARPEGGI`, `makeCatalog`, [esercizi.md](esercizi.md)) e pipeline `build()` | sì |
| `audio/ks.js` | buffer Karplus-Strong esteso: pizzico, perdita per altezza, allpass frazionario, due polarizzazioni | sì |
| `audio/ep.js` | buffer del piano elettrico morbido in FM, stessa sintesi del soundfont dei volumi (ADR 0017) | sì |
| `audio/scheduler.js` | lookahead, loop, count-in, metronomo (anche sul 2 e 4, solo 4, «e» del 2 e del 4: `METRO`, ADR 0016), trainer, coda visiva | sì (clock finto) |
| `audio/engine.js` | AudioContext, timbro (`setTimbre`: chitarra o piano elettrico, ADR 0017), cache delle voci (strati di velocity, varianti alternate), cassa armonica o equalizzazione del piano e riverbero, bus e volumi per parte (`comp`, `bass`, `study`; ADR 0013), volume generale sul master (`setMaster`), smorzamento per parte e corda, click | no |
| `tab/layout.js` | battute, a capo, travature, gironi, anacrusi; note impilate; tab ASCII | sì |
| `tab/render.js` | SVG della tablatura | no |
| `fretboard.js` | SVG delle diteggiature e della tastiera intera (`fretFrom/To`, `cellWidth`, `path`) | no |
| `link.js` | deep link: frammento ↔ parametri, note, identificatori delle scale, esercizio ([deep-link.md](deep-link.md)) | sì |
| `transport.js` | trasporto comune: barra Play/BPM/Tap/Volume, avvio e arresto, trainer, volumi, volume generale, «muto» e suono (comuni agli strumenti, chiave `appunti-strumenti.volume`), wake lock, ciclo di evidenziazione | no |
| `practice.js` | pannello Cosa/Come/Dove/Opzioni comune a Scale e Arpeggi (`configure`), viste, ascolto rapido, «Copia link», stampa | no |
| `app.js` | guscio comune (`App.start`): estrazione casuale, scheda, diteggiature (facoltative), cronologia, drawer, scorciatoie, lettura del link (parametro della tonica configurabile), contenuto del quiz | no |
| `scale.js`, `arpeggi.js`, `accordi.js` | definizioni degli strumenti: catalogo, ortografia, dettagli, diteggiature o voicing, chiavi di salvataggio | no |
| `chordpractice.js` | pannello Esercizi degli accordi: Cosa/Come/Dove/Opzioni, viste accordi/tastiera/tablatura, ascolto dei voicing, «Copia link» | no |
| `panel-ui.js` | aiuti comuni ai pannelli (DOM, controlli, assi, asse Opzioni con loop esterno facoltativo, copia); usato da `chordpractice.js` e `progpractice.js` | no |
| `progpractice.js` | pannello Esercizi delle progressioni: Cosa/Come/Dove/Studio/Opzioni, viste griglia/tastiera dell'accordo corrente/tablatura, volumi delle parti, «Copia link»; `gridView` serve anche al quiz | no |
| `progressioni.js` | definizione dello strumento Progressioni (link con `key`, quiz con la griglia in gradi romani, nessuna sezione di diteggiature) | no |
| `chordchart.js` | SVG del diagramma d'accordo verticale | no |
| `rhythms.js` | figure ritmiche come gironi di celle (ADR 0016): catalogo di 64 figure in otto famiglie, generatori con seme (partenze, note per battuta, note tolte), realizzazione sulle battute (attacchi, pause, accenti, inizio del ciclo), durata con la base, conteggio | sì |
| `exercises/rhythmline.js` | esercizio dello strumento Ritmi: altezze sugli attacchi (nota fissa, accordo, sequenza di scala, note guida), swing, base da `ProgComp` (accordi su `study`, basso), eventi per la tablatura | sì |
| `rhythmpractice.js` | pannello Esercizi dei ritmi: Cosa/Come/Base/Opzioni, griglia ritmica (anche per il quiz), tablatura, «Copia link» | no |
| `ritmi.js` | definizione dello strumento Ritmi (link con `key`, tonalità con i bemolli, quiz con la griglia senza conteggio) | no |

## Principi

1. **Logica pura separata da DOM e audio** ([ADR 0005](ADR-0005-modello-esercizi.md)).
2. **Altezze prima, posizioni poi**: gli esercizi si generano su altezze; corda e tasto si scelgono
   alla fine secondo l'ambito ([ADR 0006](ADR-0006-ambito-esercizi.md),
   [ADR 0008](ADR-0008-assegnazione-posizioni.md)).
3. **Il DOM si può ricostruire in qualunque momento**: lo scheduler non tiene riferimenti a nodi
   DOM; l'evidenziazione cerca `data-s`/`data-f` (pallini) e `data-i` (tab, gradi) a ogni frame.
   Cambiare le etichette Gradi/Note durante la riproduzione non la interrompe.
4. **Un solo clock**: quello di `AudioContext` ([ADR 0004](ADR-0004-scheduler-lookahead.md)).
5. **Una sola sorgente per audio e notazione**: la tab è una vista degli eventi suonati
   ([ADR 0009](ADR-0009-tablatura.md)).
6. **Le note di un evento si leggono sempre con `Events.notesOf`**: un evento può portare più note
   simultanee (`notes[]`) o una sola (`string`, `fret`, `midi`). Audio, tastiera e tablatura
   funzionano con gli accordi ([ADR 0010](ADR-0010-suite-di-strumenti.md), punto 3); il campo `strum`
   (secondi fra una corda e la successiva) fa suonare l'accordo pennato.
7. **I deep link sono un'interfaccia pubblica**: si estendono, non si rompono ([deep-link.md](deep-link.md)).

## Persistenza

Tutte le pagine condividono l'origine GitHub Pages, quindi `localStorage`: ogni strumento usa chiavi
proprie. Le chiavi dello strumento Scale restano quelle storiche per non perdere le impostazioni
salvate; gli strumenti nuovi useranno `gsp:<strumento>:v1`.

| Chiave | Archivio | Contenuto |
|---|---|---|
| `interval-master:v1` | `localStorage` | Scale: famiglie, tonica, opzioni, scala corrente, cronologia (chiave storica) |
| `gsp:practice:v1` | `localStorage` | Scale: assi, BPM, metronomo, loop, trainer, volumi, viste (chiave storica) |
| `gsp:arpeggi:v1` | `localStorage` | Arpeggi: famiglie, fondamentale, opzioni, arpeggio corrente, cronologia |
| `gsp:arpeggi:practice:v1` | `localStorage` | Arpeggi: impostazioni dell'esercizio |
| `gsp:accordi:v1` | `localStorage` | Accordi: famiglie, fondamentale, opzioni, accordo corrente, cronologia |
| `gsp:accordi:practice:v1` | `localStorage` | Accordi: impostazioni dell'esercizio |
| `gsp:progressioni:v1`, `gsp:progressioni:practice:v1` | `localStorage` | Progressioni: estrazione e impostazioni dell'esercizio |
| `gsp:ritmi:v1` | `localStorage` | Ritmi: famiglie, tonalità, opzioni, figura corrente, cronologia |
| `gsp:ritmi:practice:v1` | `localStorage` | Ritmi: impostazioni dell'esercizio (partenza, seme, altezze, base, click, viste) |
| `gsp:theme` | `sessionStorage` | tema scelto dal link (`dark`/`light`/`auto`), valido per la scheda |

## Ordine di caricamento (`scale.html`)

```html
<!-- nel <head>, prima del CSS -->
<script src="js/theme.js"></script>
<!-- in fondo al <body> -->
<script src="js/theory.js"></script>
<script src="js/guitar.js"></script>
<script src="js/events.js"></script>
<script src="js/exercises/pool.js"></script>
<script src="js/exercises/melodic.js"></script>
<script src="js/exercises/rhythm.js"></script>
<script src="js/exercises/fingering.js"></script>
<script src="js/exercises/presets.js"></script>
<script src="js/tab/layout.js"></script>
<script src="js/tab/render.js"></script>
<script src="js/audio/ks.js"></script>
<script src="js/audio/ep.js"></script>
<script src="js/audio/engine.js"></script>
<script src="js/audio/scheduler.js"></script>
<script src="js/fretboard.js"></script>
<script src="js/link.js"></script>
<script src="js/transport.js"></script>
<script src="js/practice.js"></script>
<script src="js/app.js"></script>
<script src="js/scale.js"></script>
```

`arpeggi.html` carica gli stessi script più `js/chords.js` dopo `js/guitar.js`, e `js/arpeggi.js`
al posto di `js/scale.js`.

`accordi.html` carica `theory`, `guitar`, `chords`, `voicings`, `voiceleading`, `events`,
`exercises/comping`, `tab/*`, `audio/*`, `fretboard`, `chordchart`, `link`, `transport`,
`panel-ui`, `chordpractice`, `app` e `accordi` (non i moduli degli esercizi melodici né `practice.js`).

`progressioni.html` carica gli stessi moduli di Accordi tranne `chordchart` e `chordpractice`, più
`progression`, `progressions`, `exercises/bass`, `exercises/progcomp`, `progpractice` e
`progressioni` al posto di `accordi`.

`ritmi.html` carica gli stessi moduli di Progressioni più `rhythms` ed `exercises/rhythmline` dopo
`exercises/progcomp`, e `rhythmpractice` e `ritmi` al posto di `progpractice` e `progressioni`.

`index.html` carica solo `theme.js` e il CSS.
