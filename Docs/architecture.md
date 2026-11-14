# Architettura

Strumenti per la pratica (ex Guitar Scale Practice) è un sito statico senza build
([ADR 0001](ADR-0001-app-statica-senza-server.md)): script classici caricati in ordine, ognuno
pubblica un oggetto globale ([ADR 0002](ADR-0002-script-classici-namespace-globali.md)). I moduli
puri si caricano anche da Node per i test. È una suite di strumenti con nucleo comune
([ADR 0010](ADR-0010-suite-di-strumenti.md)), pubblicata su GitHub Pages.

## Pagine

| Pagina | Contenuto |
|---|---|
| `index.html` | scelta dello strumento (Scale, Arpeggi e Accordi attivi; Progressioni in arrivo), ritorno al volume |
| `scale.html` | strumento Scale: scala casuale, diteggiature 3NPS, esercizi, trasporto |
| `arpeggi.html` | strumento Arpeggi: arpeggio casuale (19 qualità), diteggiature in posizione, rivolti, esercizi, trasporto |
| `accordi.html` | strumento Accordi: accordo casuale, voicing shell/drop 2/drop 3/triadi in diagrammi, rivolti, ciclo delle quarte, II–V–I, trasporto |

Ogni pagina carica `js/theme.js` nel `<head>` e `css/style.css` (tema «Appunti»).

## Moduli

```
                 ┌────────────────────────── puri, testati in Node ──────────────────────────┐
theory.js ─► chords.js (Chords: qualità) ─► voicings.js (Voicings) ─► voiceleading.js (VoiceLeading)
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
```

| Modulo | Responsabilità | Node |
|---|---|---|
| `theme.js` | tema chiaro/scuro dal parametro `theme` del link (per scheda) | no |
| `theory.js` | note, gradi, catalogo 33 scale, spelling enarmonico, ♭/♯ | sì |
| `guitar.js` | diteggiature 3NPS (18 posizioni per grado di partenza) e in posizione per gli arpeggi (`positionPatterns`) | sì |
| `chords.js` | 19 qualità come insiemi di gradi, ortografia, sigle, trasposizione | sì |
| `voicings.js` | voicing shell, drop 2, drop 3, triadi generati dalle formule (una nota per corda, cinque tasti, niente vuoti né tensioni al basso) | sì |
| `voiceleading.js` | scelta dei voicing lungo una sequenza con movimento minimo (Viterbi) | sì |
| `exercises/comping.js` | esercizi sugli accordi (rivolti, ciclo delle quarte, II–V–I) e ritmi d'accompagnamento → eventi polifonici | sì |
| `events.js` | normalizzatore degli eventi: `notesOf` (nota singola o `notes[]`), `midisOf` | sì |
| `exercises/pool.js` | ambiti, posizioni ammesse, pool di altezze con estensione, nota di partenza, nona al posto della fondamentale (`rootOnce`) | sì |
| `exercises/melodic.js` | motivo × passo × direzione × forma → indici | sì |
| `exercises/rhythm.js` | celle, swing, accenti, levare, ripetute → eventi in battiti (tick interi) | sì |
| `exercises/fingering.js` | Viterbi con finestra della mano e profili → corda e tasto | sì |
| `exercises/presets.js` | cataloghi per strumento (`Presets`, `Presets.ARPEGGI`, `makeCatalog`, [esercizi.md](esercizi.md)) e pipeline `build()` | sì |
| `audio/ks.js` | buffer Karplus-Strong + correzione di intonazione | sì |
| `audio/scheduler.js` | lookahead, loop, count-in, metronomo, trainer, coda visiva | sì (clock finto) |
| `audio/engine.js` | AudioContext, cache delle voci, smorzamento per corda, click | no |
| `tab/layout.js` | battute, a capo, travature, gironi, anacrusi; note impilate; tab ASCII | sì |
| `tab/render.js` | SVG della tablatura | no |
| `fretboard.js` | SVG delle diteggiature e della tastiera intera (`fretFrom/To`, `cellWidth`, `path`) | no |
| `link.js` | deep link: frammento ↔ parametri, note, identificatori delle scale, esercizio ([deep-link.md](deep-link.md)) | sì |
| `transport.js` | trasporto comune: barra Play/BPM/Tap, avvio e arresto, trainer, volumi, wake lock, ciclo di evidenziazione | no |
| `practice.js` | pannello Cosa/Come/Dove/Opzioni comune a Scale e Arpeggi (`configure`), viste, ascolto rapido, «Copia link», stampa | no |
| `app.js` | guscio comune (`App.start`): estrazione casuale, scheda, diteggiature, cronologia, drawer, scorciatoie, lettura del link | no |
| `scale.js`, `arpeggi.js`, `accordi.js` | definizioni degli strumenti: catalogo, ortografia, dettagli, diteggiature o voicing, chiavi di salvataggio | no |
| `chordpractice.js` | pannello Esercizi degli accordi: Cosa/Come/Dove/Opzioni, viste accordi/tastiera/tablatura, ascolto dei voicing, «Copia link» | no |
| `chordchart.js` | SVG del diagramma d'accordo verticale | no |

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
`chordpractice`, `app` e `accordi` (non i moduli degli esercizi melodici né `practice.js`).

`index.html` carica solo `theme.js` e il CSS.
