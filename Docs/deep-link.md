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
| `scale` | identificatore della scala, es. `dorica`, `misolidia`, `minore-melodica`, `lidia-dominante`, `locria-s2`, `superlocria`, `frigia-dominante`, `esatonale`, `diminuita-semitono-tono` | nome del catalogo in minuscolo, spazi → `-`, `#` → `s`; elenco completo sotto |
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

Senza `scale` e `root` validi resta la scala corrente e si applicano solo le impostazioni
dell'esercizio.

Esempio: Re dorico, ottavi swing sulle corde 6 e 5 fino al 12° tasto, 120 BPM, tema scuro:

```
scale.html#v=1&scale=dorica&root=D&preset=lin-updown&rhythm=swing&scope=strings&strings=65&from=0&to=12&bpm=120&theme=dark
```

### Identificatori delle scale

`ionica` `dorica` `frigia` `lidia` `misolidia` `eolia` `locria` ·
`minore-melodica` `dorica-b2` `lidia-aumentata` `lidia-dominante` `misolidia-b6` `locria-s2` `superlocria` ·
`minore-armonica` `locria-s6` `ionica-s5` `dorica-s4` `frigia-dominante` `lidia-s2` `superlocria-bb7` ·
`maggiore-armonica` `dorica-b5` `frigia-b4` `lidia-b3` `misolidia-b2` `lidia-aumentata-s2` `locria-bb7` ·
`esatonale` `diminuita-semitono-tono` `diminuita-tono-semitono` `aumentata` `aumentata-inversa`

Derivano dai nomi del catalogo (`js/theory.js`): rinominare una scala nel catalogo cambierebbe
l'identificatore e romperebbe i link. Un test fissa quelli più usati.
