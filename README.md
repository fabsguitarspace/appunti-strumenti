# Strumenti per la pratica

Strumenti web per la pratica alla chitarra, di [Fabrizio's Guitar Space](https://www.youtube.com/@fabsguitarspace),
collegati al volume [Appunti di Pratica per Chitarra Jazz](https://appunti-pratica-per-chitarra-jazz.readthedocs.io)
(capitolo «Strumenti per la pratica»). Oggi ci sono gli strumenti **Scale**, **Arpeggi** e **Accordi**;
Progressioni è pianificato ([piano 0002](Docs/plans/0002-suite-pratica.md), [ADR 0010](Docs/ADR-0010-suite-di-strumenti.md)).

Solo HTML, CSS e JavaScript: **nessun server**, responsive e mobile-first. Repository
[`fabsguitarspace/appunti-strumenti`](https://github.com/fabsguitarspace/appunti-strumenti), ex
Guitar-Scale-Practice. Nasce come versione web di `../../interval-master` (app desktop Rust/egui).

## Funzioni

- **Scala casuale** tra 33 scale × 12 toniche: i 7 modi di maggiore, minore melodica, minore
  armonica e maggiore armonica, più 5 scale simmetriche. Note con ortografia corretta, formula,
  struttura T/S, diteggiature a 3 note per corda.
- **Arpeggio casuale** tra 19 qualità × 12 fondamentali: triadi, arpeggi a 4 note (6, 7, maj7, m6,
  m7, m(maj7), m7♭5, 7♯5, °7) e di nona (6/9, 9, maj9, m6/9, m9, m(maj9)), con ortografia corretta,
  formula, intervalli e diteggiature in posizione (una per nota di partenza, entro 5 tasti).
  Esercizi propri: lineari, salti, gruppi e rivolti in sequenza, ritmici; partenza da 3ª, 5ª, 7ª.
- **Accordo casuale** tra le stesse 19 qualità, con i voicing del capitolo «Accordi» del volume come
  diagrammi: shell su 6–4–3 e 5–4–3 (basso di fondamentale, terza o quinta), drop 2 su 4–3–2–1 e
  5–4–3–2, drop 3 su 6–4–3–2 e 5–3–2–1, triadi strette. Esercizi: tutti i rivolti su un gruppo di
  corde, ciclo delle quarte, II–V–I, con conduzione delle voci; ritmi d'accompagnamento (minime, 2 e
  4, Charleston, arpeggiato…), accordo pennato o simultaneo.
- **Ascolto**: suono di chitarra sintetizzato (Karplus-Strong), pulsante ▶ su ogni diteggiatura.
- **Esercizi** su tre assi combinabili ([catalogo](Docs/esercizi.md)):
  - **Cosa**: lineari, intervalli (dalla 3ª alla 7ª), sequenze (gruppi da 3 a 6, alternati),
    sequenze intervallari (alternate, motivi misti, salti crescenti); direzione; estensione in ottave;
  - **Come**: ottavi, terzine, sedicesimi, quintine, sestine, swing, galoppo, puntato, pause,
    note ripetute; accenti (sul gruppo, sul battito, ogni 2/3/4), spostamento, levare;
  - **Dove**: tastiera intera, corde scelte (una, coppie, terne…), diteggiatura 3NPS, posizione
    di 5 tasti, collegamento delle posizioni; distribuzione bilanciata, orizzontale o verticale.
- **Viste sincronizzate**: tastiera con il percorso e la nota corrente, **tablatura** con ritmo e
  accenti (copia come testo, stampa), elenco dei gradi o delle note.
- **Trasporto**: Play/Stop, BPM, tap tempo, metronomo, battuta d'attacco, loop,
  **trainer di velocità** (+N BPM ogni M giri), volumi separati.
- **Link dell'esercizio**: «Copia link dell'esercizio» produce un indirizzo che riapre scala,
  tonica ed esercizio ([schema dei deep link](Docs/deep-link.md)); il volume lo usa per gli esercizi pronti.
- Impostazioni, scala corrente e cronologia ricordate nel browser.

## Uso

Online: **https://fabsguitarspace.github.io/appunti-strumenti/** (GitHub Pages dal ramo `main`).

In locale apri `index.html` (scelta dello strumento), `scale.html`, `arpeggi.html` o `accordi.html` nel browser: funziona anche con
doppio clic, da `file://`. Per clonare: `git clone https://github.com/fabsguitarspace/appunti-strumenti.git`.

| Tasto | Azione |
|---|---|
| Invio | nuova scala (o nuovo arpeggio) casuale |
| Spazio | Play/Stop con il pannello Esercizi aperto, altrimenti nuova estrazione |
| ← → | tempo −5 / +5 BPM |
| Esc | chiude i pannelli laterali |

Su iPhone, se non si sente nulla, controlla la modalità silenziosa (su iOS 17+ l'app chiede
comunque la riproduzione).

## Layout

| Larghezza | Impostazioni | Cronologia | Trasporto | Diteggiature |
|---|---|---|---|---|
| < 640px | drawer | drawer | barra in basso: 🔀 · Play · BPM | 1 colonna |
| ≥ 640px | drawer | drawer | barra in basso (+ Tap) | 2 colonne |
| ≥ 1024px | colonna | drawer | in cima al pannello Esercizi | 2 colonne |
| ≥ 1280px | colonna | colonna | in cima al pannello Esercizi | 2 (3 da 1600px) |

Tema «Appunti» (colori del volume Appunti di Pratica), chiaro/scuro automatico o dal parametro `theme`
del link, aree sicure iOS, target di tocco ≥ 44px, `prefers-reduced-motion`.

## Struttura

Vedi [Docs/architecture.md](Docs/architecture.md) per il diagramma dei moduli e
[Docs/](Docs/README.md) per ADR, catalogo degli esercizi e piano.

```
index.html (scelta dello strumento)  scale.html  arpeggi.html  accordi.html  css/style.css
js/theme.js  js/theory.js  js/chords.js  js/guitar.js  js/events.js  js/link.js  js/fretboard.js
js/voicings.js  js/voiceleading.js  js/chordchart.js  js/chordpractice.js  js/accordi.js
js/transport.js  js/practice.js  js/app.js (guscio comune)  js/scale.js  js/arpeggi.js
js/exercises/  pool · melodic · rhythm · fingering · presets · comping
js/audio/      ks · scheduler · engine
js/tab/        layout · render
tests/         *.test.js (node:test, nessuna dipendenza)
```

## Test

```sh
npm test        # oppure: node --test tests/*.test.js
```
