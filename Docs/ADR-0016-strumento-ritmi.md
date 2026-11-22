# ADR 0016 — Strumento Ritmi: figure come gironi di celle, linea sopra una base, click spostato

- Stato: Proposto (attuato il 2026-11-22 sul ramo `strumento-ritmi`, da approvare)
- Data: 2026-11-22
- Analisi: [Appunti di Pratica, analisi 025](../../appunti-pratica/Docs/analisi/025-ritmo-melodico.md)
- Collegati: [ADR 0010](ADR-0010-suite-di-strumenti.md) (suite), [ADR 0011](ADR-0011-strumento-arpeggi.md)
  (guscio comune), [ADR 0013](ADR-0013-strumento-progressioni.md) (base e parti audio),
  [ADR 0004](ADR-0004-scheduler-lookahead.md) (scheduler)

## Contesto

L'utente chiede una trattazione del ritmo applicato alla melodia, non solo all'accompagnamento,
ispirata a Jerry Bergonzi, *Inside Improvisation*, vol. 4, *Melodic Rhythms*, e uno strumento
dedicato allo stesso livello di Scale, Arpeggi, Accordi e Progressioni. Il volume di Pratica
riceve la pagina «Ritmo melodico» (analisi 025).

Negli strumenti esistenti il ritmo è un asse dell'esercizio («Come»: ottavi, terzine, swing…) o
un ritmo d'attacco degli accordi: la figura ritmica non è mai l'oggetto dello studio. I
procedimenti di Bergonzi richiedono invece figure che partono da ogni punto della battuta, cicli
di 3, 5 o 7 pulsazioni che attraversano le stanghette, divisioni su più pulsazioni (terzine di
semiminima, cinque o sette note per battuta) e un metronomo che non suona su tutti i battiti.

## Decisione

1. **Una figura è una sequenza di gironi** (`js/rhythms.js`): ogni girone dura `beats` pulsazioni
   ed è diviso in `div` celle uguali; ogni cella è un attacco (`x`), il prolungamento della nota
   precedente (`-`) o una pausa (`.`). Crome, terzine, semicrome, terzine di semiminima, quintine,
   settimine e nonine stanno nello stesso modello. I tick per pulsazione sono 2520 (minimo comune
   multiplo di 1…9), così ogni divisione è intera. Un girone di più pulsazioni non attraversa la
   stanghetta; i cicli che la attraversano usano gironi di una pulsazione.
2. **Otto famiglie, 64 figure**, con identificatori stabili (interfaccia dei link):
   crome consecutive (2–7), terzine consecutive (2–7), semicrome consecutive (3–7), note per
   battuta (1–7), ritmi di una battuta (14), cicli di 3, 5 e 7 pulsazioni (8), marce (11: 5, 6, 7,
   8, 9, 10, 12, 14, 16, 20, 24 note per battuta), cambi di marcia (7). Le famiglie seguono i
   capitoli di Bergonzi; **le figure sono originali**.
3. **Generatori per le famiglie aperte.** Le note consecutive hanno una partenza fissa (una cella
   della battuta), «in sequenza» (tutte le partenze una dopo l'altra) o «casuale»; le note per
   battuta hanno lo stesso ritmo in ogni battuta o uno diverso. Le figure casuali e le note tolte
   usano un generatore con seme (mulberry32): lo stesso seme, anche dal link, dà la stessa figura.
4. **Durata dell'esercizio.** Il ciclo della figura arrotondato alla battuta (3 pulsazioni → 3
   battute) e, con una base, il minimo comune multiplo con la sua forma; oltre 32 battute si tiene
   la base e la figura riparte a ogni giro (la griglia lo dice).
5. **Linea sopra una base** (`js/exercises/rhythmline.js`): le altezze seguono il ritmo, non il
   contrario. Quattro modi: nota fissa (tonica), note dell'accordo in vigore (su e giù nel
   registro Sol3–Fa5), sequenza di scala per gruppi di quattro sulla scala dell'accordo (la
   sequenza continua da un attacco all'altro: le pause tolgono note, non le spostano), note guida.
   La base è una progressione del catalogo di Progressioni (`ProgComp.build`, shell a minime e
   basso), con gli accordi sulla parte `study` (volume proprio) e il basso sulla parte `bass`; senza
   base le altezze stanno sull'accordo maj7 di tonica. Swing 2:1 solo sui gironi di crome.
6. **Click spostato** (`js/audio/scheduler.js`): `metroMode` accetta anche `two-four`,
   `one-three`, `three`, `four`, `and-two-four` (`Scheduler.METRO`); il count-in suona sempre tutti
   i battiti. `all` e `downbeat` restano invariati per gli altri strumenti. `PanelUI.optionsAxis`
   riceve le posizioni con `metroModes`.
7. **Viste**: griglia ritmica (una casella per battuta, gironi in proporzione alla durata, celle
   piene, a barra o vuote; conteggio, note suonate, sigle della base, inizio del ciclo marcato) e
   tablatura (`TabLayout`) solo quando ogni girone sta in una pulsazione con divisione 1–6.
8. **Guscio comune** (`App.start`): figura × tonalità, con `rootParam: 'key'` come Progressioni e
   tonalità scritte con i bemolli sui tasti neri. Il quiz mostra la griglia senza conteggio.
9. **Link** (`Link.encodeRhythmExercise`/`decodeRhythmExercise`): `rhythm`, `key`, `start`
   (1–16, `seq`, `rand`), `vary`, `omit`, `seed`, `accent`, `notes`, `feel`, `base`, `bass`, `comp`,
   `metro`, `bpm` ([deep-link.md](deep-link.md)). Persistenza in `gsp:ritmi:v1` e
   `gsp:ritmi:practice:v1`.

## Alternative scartate

- **Notazione su pentagramma generata nel browser**: corretta per i gironi irregolari su più
  pulsazioni richiederebbe un motore di impaginazione; la griglia mostra la stessa informazione
  (dove cade ogni attacco rispetto alla pulsazione) e regge a 375 px. Il pentagramma resta negli
  esempi del volume.
- **Estendere l'asse «Come» dello strumento Scale**: avrebbe lasciato il ritmo subordinato alla
  scala e non avrebbe ammesso cicli oltre la stanghetta né partenze in ogni punto della battuta.
- **Trascrivere le figure di Bergonzi**: le figure sono originali; del metodo si riprendono i
  procedimenti, citati nella pagina del volume.

## Conseguenze

- Nuovi moduli puri testati in Node (`tests/ritmi.test.js`): catalogo, realizzazione, durata,
  esercizio, swing, tablatura, click, link.
- Lo scheduler ha click non interi (`and-two-four`): i test esistenti restano validi.
- Il capitolo 11 di Pratica riceve gli esercizi pronti sui ritmi; `tests/test_strumenti_links.py`
  li verifica con `Link.decodeRhythmExercise` e il catalogo.
