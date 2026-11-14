# Deep link degli strumenti

Interfaccia pubblica ([ADR 0010](ADR-0010-suite-di-strumenti.md), punto 5): il volume
Appunti di Pratica e chiunque condivida un esercizio usano questi indirizzi. Le versioni
pubblicate del volume restano online mentre gli strumenti cambiano, quindi lo schema **si estende
senza rompere**: nessun parametro si rinomina o cambia significato; `v` aumenta solo per modifiche
incompatibili, con conversione dei link precedenti. Codice: `js/link.js`, test: `tests/link.test.js`.

## Forma

```
https://fabsguitarspace.github.io/appunti-strumenti/<pagina>#v=1&chiave=valore&…
```

Il frammento (dopo `#`) funziona anche aprendo i file da `file://` e non arriva al server.
Parametri sconosciuti o non validi si ignorano. Dopo l'apertura lo strumento applica il link e
toglie il frammento dall'indirizzo, così ricaricare non annulla le modifiche successive. Il
pulsante **Copia link dell'esercizio** nel pannello Esercizi produce il link dello stato attuale.

## Parametri comuni

| Chiave | Valori | Effetto |
|---|---|---|
| `v` | `1` | versione dello schema |
| `theme` | `dark`, `light`, `auto` | tema per la scheda corrente (vale anche passando ad altre pagine); `auto` torna al tema di sistema. Il volume lo aggiunge ai suoi link |

## Strumento Scale (`scale.html`)

| Chiave | Valori | Note |
|---|---|---|
| `scale` | identificatore della scala, es. `dorica`, `misolidia`, `minore-melodica`, `lidia-b7`, `eolia-b5`, `superlocria`, `frigia-dominante`, `esatonale`, `diminuita-semitono-tono` | nome del catalogo in minuscolo, spazi → `-`, `#` → `s`; elenco completo sotto |
| `root` | `C`, `F#`, `Bb`, `Ebb`, `Fx` | tonica con ortografia; serve insieme a `scale` |
| `preset` | id dell'esercizio, es. `lin-updown` | catalogo in [esercizi.md](esercizi.md) / `js/exercises/presets.js`; porta con sé i propri valori predefiniti |
| `dir` | `up`, `down`, `updown`, `downup` | direzione |
| `ext` | `1`, `2`, `3`, `full` | estensione in ottave |
| `rhythm` | id del ritmo, es. `eighths`, `swing`, `triplets`, `sixteenths` | `Presets.RHYTHMS` |
| `accent` | `group`, `beat`, `2`, `3`, `4` | accento |
| `shift` | `0`–`3` | spostamento dell'accento |
| `pickup` | `0`–`3` | note in levare |
| `scope` | `neck`, `strings`, `pattern`, `position`, `chain` | ambito (Dove) |
| `from`, `to` | `0`–`24` | tasti, per `neck` e `strings` |
| `strings` | cifre da `1` (Mi cantino) a `6` (Mi grave), es. `65`, `321` | per `strings` |
| `open` | `0` | esclude le corde a vuoto (`neck`, `strings`) |
| `pattern` | `1`–`n` | diteggiatura 3NPS, per `pattern` |
| `fret` | `0`–`20` | tasto di partenza, per `position` |
| `profile` | `balanced`, `horizontal`, `vertical` | distribuzione (`neck`, `strings`, `position`) |
| `bpm` | `30`–`300` | tempo |

`start` (`1`–`7`) è comune agli strumenti a note singole ma ha effetto solo negli Arpeggi.

Senza `scale` e `root` validi resta la scala corrente e si applicano solo le impostazioni
dell'esercizio.

Esempio: Re dorico, ottavi swing sulle corde 5 e 4 fino al 12° tasto, 120 BPM, tema scuro:

```
scale.html#v=1&scale=dorica&root=D&preset=lin-updown&rhythm=swing&scope=strings&strings=54&from=0&to=12&bpm=120&theme=dark
```

## Strumento Arpeggi (`arpeggi.html`)

Stessi parametri dell'esercizio dello strumento Scale (`preset`, `dir`, `ext`, `rhythm`, `accent`,
`shift`, `pickup`, `scope`, `from`, `to`, `strings`, `open`, `pattern`, `fret`, `profile`, `bpm`)
con il catalogo degli arpeggi ([esercizi.md](esercizi.md#strumento-arpeggi)), più:

| Chiave | Valori | Note |
|---|---|---|
| `chord` | identificatore della qualità, elenco sotto | serve insieme a `root` |
| `root` | `C`, `F#`, `Bb` … | fondamentale |
| `start` | `1`–`5` | nota di partenza nell'ordine della formula: `1` fondamentale, `2` terza (primo rivolto) …; con `ext` in ottave, non con `ext=full` né `scope=chain` |
| `pattern` | `1`–`n` | diteggiatura in posizione (una per nota dell'arpeggio) |

Identificatori delle qualità (`js/chords.js`, fissati da `tests/arpeggi.test.js`):
`maj` `m` `dim` `aug` · `6` `7` `maj7` `m6` `m7` `mmaj7` `m7b5` `7s5` `dim7` ·
`69` `9` `maj9` `m69` `m9` `mmaj9`

Esempio: B♭7, rivolti in sequenza dalla terza, diteggiatura 1, 90 BPM:

```
arpeggi.html#v=1&chord=7&root=Bb&preset=grp-4&start=2&ext=1&scope=pattern&pattern=1&bpm=90
```

## Strumento Accordi (`accordi.html`)

| Chiave | Valori | Note |
|---|---|---|
| `chord`, `root` | come negli Arpeggi | accordo e fondamentale; vanno insieme |
| `ex` | `inv`, `cycle`, `ii-v-i` | rivolti sullo stesso gruppo di corde, ciclo delle quarte, II–V–I verso l'accordo |
| `dir` | `up`, `down`, `updown` | solo con `ex=inv` |
| `fam` | `shell`, `drop2`, `drop3`, `triad` | famiglia di voicing; se l'accordo non la prevede si usa la prima disponibile |
| `set` | `all` oppure corde da chitarrista, es. `4321`, `5432`, `643`, `321` | insieme di corde della famiglia |
| `from`, `to` | `1`–`20` | zona di tasti |
| `rhythm` | `whole`, `half`, `quarters`, `two-four`, `charleston`, `arp` | ritmo d'accompagnamento |
| `bars` | `1`, `2` | battute per accordo (omesso = 1) |
| `attack` | `strum`, `block` | pennata o simultaneo (omesso = pennata) |
| `bpm` | `30`–`300` | tempo |

Codice: `Link.encodeChordExercise`/`decodeChordExercise`; id fissati da `tests/accordi.test.js`.

Esempio: II–V–I in Do con gli shell, minime, tasti 1–10:

```
accordi.html#v=1&chord=maj7&root=C&ex=ii-v-i&fam=shell&set=all&from=1&to=10&rhythm=half&bpm=80
```

### Identificatori delle scale

`ionica` `dorica` `frigia` `lidia` `misolidia` `eolia` `locria` ·
`minore-melodica` `dorica-b2` `lidia-s5` `lidia-b7` `misolidia-b13` `eolia-b5` `superlocria` ·
`minore-armonica` `locria-n6` `ionica-s5` `dorica-s4` `frigia-dominante` `lidia-s2` `diminuita-b2-b4` ·
`maggiore-armonica` `dorica-b5` `frigia-b4` `lidia-b3` `misolidia-b2` `lidia-aumentata-s2` `locria-bb7` ·
`esatonale` `diminuita-semitono-tono` `diminuita-tono-semitono` `aumentata` `aumentata-inversa`

Derivano dai nomi del catalogo (`js/theory.js`): `#` diventa `s`, `b` resta `b`, `♮` diventa `n`.
Rinominare una scala cambia l'identificatore: il vecchio va aggiunto a `LEGACY_SLUGS` in
`js/theory.js`, così i link già condivisi continuano a funzionare. Un test fissa gli identificatori
più usati e verifica che ogni vecchio identificatore porti a una scala esistente.

Il 14 novembre 2026 sei modi delle minori sono stati rinominati come nelle tabelle di Appunti di
Teoria. I vecchi identificatori restano validi:

| Vecchio | Nuovo | Nome attuale |
|---|---|---|
| `lidia-aumentata` | `lidia-s5` | Lidia ♯5 |
| `lidia-dominante` | `lidia-b7` | Lidia ♭7 |
| `misolidia-b6` | `misolidia-b13` | Misolidia ♭13 |
| `locria-s2` | `eolia-b5` | Eolia ♭5 |
| `locria-s6` | `locria-n6` | Locria ♮6 |
| `superlocria-bb7` | `diminuita-b2-b4` | Diminuita ♭2 ♭4 |
