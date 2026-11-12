# ADR 0010 — Da app per le scale a suite di strumenti di pratica

- Stato: Accettato (2026-11-12, decisione dell'utente; attuazione non avviata)
- Data: 2026-11-12
- Piano: [plans/0002-suite-pratica.md](plans/0002-suite-pratica.md)
- Collegato: `appunti-pratica/Docs/adr/0005-strumenti-interattivi-nel-volume.md` (Accettato). Repository: `fabsguitarspace/appunti-strumenti` (ex Guitar-Scale-Practice)

## Contesto

Il volume Appunti di Pratica vuole un capitolo con strumenti interattivi per Scale, Arpeggi,
Accordi e Progressioni. GSP copre le scale; gran parte del codice è già generico
(`rhythm`, `melodic`, `fingering`, `audio/*`, `tab/*`, `fretboard`), ma `theory.js`, `guitar.js`,
`app.js` e `practice.js` sono legati alla scala, e gli eventi sono monofonici
(`{i, beat, dur, string, fret, accent, rest}`, ADR 0009).

## Decisione

1. **Una pagina HTML per strumento**, nucleo comune: `index.html` (scelta), `scale.html`,
   `arpeggi.html`, `accordi.html`, `progressioni.html`. Restano validi ADR 0001 e 0002:
   nessuna build, script classici, funzionamento da `file://`. Per non rompere i link esistenti,
   `index.html` resta per ora lo strumento Scale finché non c'è una pagina di scelta, poi
   reindirizza i vecchi deep link a `scale.html`.
2. **Separazione del trasporto**: `practice.js` si divide in `transport.js` (Play/Stop, BPM,
   tap, metronomo, loop, trainer, viste sincronizzate, wake lock) e pannelli per strumento.
3. **Eventi polifonici, retrocompatibili**: un evento può portare `notes: [{string, fret, midi}]`;
   l'evento a nota singola resta valido ed è il caso `notes.length === 1`. Scheduler, tastiera e
   tablatura leggono sempre `notes` tramite un normalizzatore puro.
4. **Moduli puri nuovi**: `chords.js` (qualità come insiemi di gradi, simboli e parsing),
   `voicings.js` (close, shell, drop 2, drop 3, tre voci su insiemi di corde, filtro della mano),
   `voiceleading.js` (scelta dei voicing lungo una griglia, Viterbi come in ADR 0008),
   `progression.js` (griglie, ritmo armonico, trasposizione), `comping.js` (pattern di accompagnamento
   e basso semplice), `link.js` (deep link).
5. **Deep link nel frammento**: `#v=1&root=D&scale=dorian&preset=…`. Il frammento funziona da
   `file://` e non arriva al server. Parametri sconosciuti ignorati; `v` incrementato solo per
   cambi incompatibili, con conversione delle versioni precedenti.
6. **Persistenza per strumento**: chiavi `gsp:<strumento>:v1`. Le chiavi attuali
   (`interval-master:v1`, `gsp:practice:v1`) si migrano una volta alla prima apertura.
   Motivo: tutte le pagine della suite condividono l'origine GitHub Pages e quindi `localStorage`.

7. **Tema «Appunti»**, unico tema di GSP anche quando è usato da solo (opzione D1 dell'analisi 019
   di appunti-pratica).
   Solo token CSS, layout invariato: neutri grigi e accento rosso del volume
   Appunti di Pratica (Shibuya, Radix red-9 #e5484d) al posto di crema e arancio; la tonica usa
   l'accento; `--playing` e `--danger` passano a colori distinguibili dal rosso. Chiaro/scuro:
   parametro `theme=dark|light` del deep link, aggiunto dai link del volume, altrimenti
   `prefers-color-scheme`; applicato come `data-theme` già supportato. Testata con logo e link al
   capitolo del volume.
8. **Pubblicazione su GitHub Pages** dal ramo principale (scelta dell'utente del 2026-11-12,
   opzione A1 dell'analisi 019 di appunti-pratica). Lo schema dei deep link è un'interfaccia
   pubblica usata dalle versioni pubblicate del volume: si estende, non si rompe.

## Alternative scartate

- **Due temi (GSP standalone con crema/arancio, tema del volume solo dentro il volume)**: scartato
  dall'utente il 2026-11-12; due temi da mantenere e testare.

- **Un'unica pagina con modalità**: una sola UI più complessa, stato più intrecciato, deep link meno
  leggibili.
- **Quattro repository separati**: duplicazione del nucleo audio/tab/tastiera.
- **Eventi polifonici come tipo distinto**: due percorsi nel codice di scheduler e viste.

## Conseguenze

- Refactor senza cambi funzionali prima di aggiungere strumenti (fase 0 del piano).
- Rinomina (scelta dell'utente del 2026-11-12): il repository `fabsguitarspace/Guitar-Scale-Practice`
  diventa **`fabsguitarspace/appunti-strumenti`**, con rinomina e non con un repository nuovo, prima
  di attivare Pages (l'URL Pages non viene reindirizzato da GitHub; web e git sì). Non ricreare mai
  un repository con il vecchio nome: annullerebbe il reindirizzamento. Le chiavi `localStorage`
  (`gsp:*`, `interval-master:v1`) non cambiano nome: sono dettagli interni e cambiarle
  perderebbe le impostazioni salvate.
- Aggiornare `architecture.md` (diagramma e ordine di caricamento per pagina) e il README.
- Il volume dipende dallo schema dei deep link: va documentato e coperto da test.
