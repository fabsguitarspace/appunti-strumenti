# ADR 0015 — Strumento Accordi: tutte le famiglie di voicing del capitolo, tensioni per qualità

- Stato: Proposto (2026-11-19; decisioni dell'utente al punto 9; fasi 1, 2 e 3 attuate il 2026-11-19; vedi punti 10 e 11)
- Data: 2026-11-19
- Analisi: [Appunti di Pratica, analisi 024](../../appunti-pratica/Docs/analisi/024-famiglie-di-voicing.md)
- Collegati: [ADR 0012](ADR-0012-strumento-accordi.md) (estende il punto 1),
  [ADR 0013](ADR-0013-strumento-progressioni.md)

## Contesto

L'utente chiede che il capitolo 6 del volume e lo strumento Accordi trattino in modo coerente
tutte le famiglie di voicing per chitarra jazz: shell, triadi strette e late, drop 2, drop 3,
drop 2&4, voicing senza fondamentale, strutture superiori, voicing per quarte, cluster. L'analisi
024 di Appunti di Pratica propone il nuovo ordine del capitolo e un nome unico per famiglia.

Oggi `js/voicings.js` genera quattro famiglie (`shell`, `drop2` su 4321 e 5432, `drop3` su 6432 e
5321, `triad`). Le qualità di `js/chords.js` arrivano alla nona: mancano le tensioni (11, 13,
alterazioni) che servono a strutture superiori, quarte e senza fondamentale con la tredicesima.
Negli accordi di nona i drop usano già 3 5 7 9, cioè sono voicing senza fondamentale, ma lo
strumento non lo dice.

## Decisione

1. **Tensioni disponibili per qualità.** Ogni qualità di settima e di nona ha in `chords.js` un
   campo `tensions` con le tensioni naturali; i dominanti hanno anche `altered`. Non diventano note
   dell'arpeggio (lo strumento Arpeggi non cambia): servono soltanto a `voicings.js`.

   | Qualità | `tensions` | `altered` |
   |---|---|---|
   | maj7, maj9, 6, 69 | 9, ♯11, 13 | — |
   | m7, m9 | 9, 11, 13 | — |
   | m6, m69, mmaj7, mmaj9 | 9, 11 | — |
   | 7, 9 | 9, 13 | ♭9, ♯9, ♯11, ♭13 |
   | 7s5 | 9 | ♭9, ♯9 |
   | m7b5 | 9, 11, ♭13 | — |
   | dim7 | 9, 11, ♭13, 7 (un tono sopra ogni nota) | — |

2. **Famiglie nuove**, generate dalle formule come in ADR 0012 (cinque tasti, una nota per corda,
   niente corde a vuoto, altezze crescenti, posizione più grave). Gli id compaiono nei deep link e
   non si rinominano.

   | Id | Etichetta | Note e disposizioni | Corde |
   |---|---|---|---|
   | `drop2` | Drop 2 | invariato, più l'insieme 6543 | 4321, 5432, **6543** |
   | `drop24` | Drop 2 e 4 | dalla posizione stretta a b c d → a c b d, quattro rivolti | 6532, 5421 |
   | `spread` | Triadi late | triade stretta a b c → b a c (drop 2), tre rivolti | 643, 532, 421 |
   | `rootless` | Senza fondamentale | quattro note: note guida (3, 7 o 6) più due fra 5, 9, 13; disposizioni drop 2 con basso 3 o 7 | 4321, 5432 |
   | `ust` | Strutture superiori | nota guida al basso (3 o 7) e triade stretta sopra, tre rivolti; triadi della tabella al punto 3 | 4321, 5432 |
   | `quartal` | Per quarte | tre o quattro quarte giuste sovrapposte, tutte note dell'accordo o tensioni; più la forma «So What» (quattro voci per quarte e una terza maggiore in cima, sulle minori) | 432, 321, 4321, 5432, 54321 |
   | `cluster` | Cluster | quattro voci fra note dell'accordo e tensioni con almeno una seconda fra voci vicine; terza e settima (o sesta) presenti | 4321, 5432 |

   `shell`, `drop3` e `triad` restano come in ADR 0012, con le stesse etichette, che coincidono
   già con i nomi dell'analisi 024.

3. **Strutture superiori ammesse** (rispetto alla fondamentale; tensioni alterate solo con l'opzione
   «Tensioni alterate» del pannello):

   | Qualità | Triadi | Risultato |
   |---|---|---|
   | maj7 | II maggiore; V maggiore | 9 ♯11 13; 5 7 9 |
   | m7 | IV maggiore; ♭VII maggiore | 11 13 1; ♭7 9 11 |
   | 7 naturale | II maggiore | 9 ♯11 13 |
   | 7 alterato | VI maggiore; ♭VI maggiore; ♭V maggiore | 13 ♭9 3; ♭13 1 ♯9; ♯11 ♭7 ♭9 |
   | m7b5 | ♭VII maggiore | ♭7 9 11 |

   L'ultima riga è da confermare a orecchio all'attuazione (vedi «Punti aperti»). Nel 7 alterato
   la triade di VI unisce la 13 naturale al ♭9: è il classico 13(♭9) e sta fra le alterate perché
   contiene il ♭9.

4. **Convenzioni comuni con il volume, senza eccezioni**: nessuna tensione al basso in nessuna
   famiglia. Nelle famiglie `rootless`, `ust` e `cluster` il basso è una nota guida o la quinta;
   in `quartal` il basso è una nota dell'accordo, quindi le pile di quarte che partono da una
   tensione (es. Re–Sol–Do–Fa su Cm7) restano escluse.

5. **Disponibilità per qualità.** `familiesFor(q)` restituisce solo le famiglie che hanno almeno un
   voicing: `spread` e `triad` per le triadi; `drop24`, `rootless`, `ust`, `quartal`, `cluster` per
   le qualità di settima e di nona che hanno `tensions` (non per `dim7`, già simmetrico: il suo
   voicing senza fondamentale è il 7♭9 nel volume).

6. **Conduzione delle voci** (`voiceleading.js`): la penalità «basso diverso dalla fondamentale»
   resta solo per `shell`; nelle famiglie senza fondamentale il basso segue le note guida.

7. **Pannello e deep link.** Il selettore Famiglia elenca le famiglie nell'ordine del capitolo
   (shell, triadi strette, triadi late, drop 2, drop 3, drop 2 e 4, senza fondamentale, strutture
   superiori, per quarte, cluster). Nuovi valori di `fam`: `drop24`, `spread`, `rootless`, `ust`,
   `quartal`, `cluster`; nuovi `set` come nella tabella; parametro facoltativo `alt=1` per le
   tensioni alterate. Link esistenti invariati. Progressioni accetta le stesse famiglie; il ritmo
   `green` resta limitato a `shell` e `triad`.

8. **Attuazione a fasi, allineata all'analisi 024**: fase 1 `drop2` su 6543 e `drop24`; fase 2
   `spread` e `rootless`; fase 3 `tensions`, `ust`, `quartal`, `cluster`, `alt`.

9. **Decisioni dell'utente del 2026-11-19** (analisi 024): tensioni alterate dei dominanti incluse
   fin dalla fase 3, dietro l'opzione «Tensioni alterate» (`alt=1`); cluster senza corde a vuoto,
   come tutte le famiglie; etichette in italiano (Senza fondamentale, Strutture superiori, Triadi
   late, Drop 2 e 4), con il termine inglese solo nel suggerimento del selettore. Gli id dei deep
   link restano quelli della tabella al punto 2.

10. **Attuazione della fase 2 (2026-11-19).** Le note dei senza fondamentale stanno per ora in
   `ROOTLESS` di `voicings.js` (non in `chords.js`, che riceverà `tensions` nella fase 3);
   `toneList(q)` aggiunge alle note della qualità i colori mancanti (es. 13 nel dominante) e gli
   indici `tone` dei voicing si riferiscono a quella lista, così diagrammi, didascalie ed
   etichette di Accordi e Progressioni nominano anche la tredicesima. Sul semidiminuito la nota
   di colore è la **nona naturale** (♭3 ♭5 ♭7 9) e non l'undicesima: con l'undicesima la forma
   con la settima al basso non sta in cinque tasti. In Progressioni `spread` usa la triade
   dell'accordo, come `triad`. Le famiglie della fase 1 producono esercizi identici (impronta
   delle sole famiglie precedenti invariata).
11. **Attuazione della fase 3 (2026-11-19).** `chords.js` ha `tensions` e `altered` per qualità
   come nella tabella del punto 1 (più `7b9` per Progressioni). In `voicings.js` le famiglie
   `ust`, `quartal` e `cluster` sono generate da `colorJobs`; `voicings(q, pc, fams, { alt })`
   include le strutture superiori alterate solo con `alt`. Scelte prese nell'attuazione:
   - **strutture superiori**: le triadi della tabella del punto 3 per maj7/6/maj9/69, m7/m9 e
     7/9; il basso è una nota guida che non sta nella triade; la triade resta stretta. Il
     semidiminuito resta **senza** strutture superiori: Si♭ maggiore sopra Mi♭ su Cø coincide
     con Cm11 e non fa sentire la ♭5 (punto aperto chiuso);
   - **quarte**: pile di 3 o 4 quarte giuste e forma «So What» (quarte e una terza maggiore,
     corde 5–4–3–2–1) con intervalli esatti dal basso (`placeExact`); note solo fra note
     dell'accordo e tensioni naturali, basso nota dell'accordo, almeno una nota guida;
   - **cluster**: quattro voci con le note guida, almeno una seconda fra voci vicine, al più una
     seconda minore, nessuna nona minore; al più quattro per gruppo di corde, le più raccolte
     (punto aperto chiuso);
   - nel ciclo e nel II–V–I un accordo senza voicing della famiglia di colore (es. m7♭5 con le
     strutture superiori) ripiega su senza fondamentale e poi drop 2;
   - pannello: interruttore «Tensioni alterate» con la famiglia Strutture superiori; nella pagina
     dell'accordo le alterate stanno in un gruppo a parte e la didascalia nomina la triade.
   I test del ciclo di Progressioni confrontano il movimento per famiglia solo per le famiglie
   non di colore: con il ripiego sul drop 2 il ciclo minimizza il costo (zona e preferenze), non
   il solo movimento. Le famiglie precedenti producono esercizi identici.

## Alternative scartate

- **Nuove qualità con le tensioni** (13, 7♭9, 7alt, m11…) nel catalogo: allungano il menu di
  Arpeggi e Accordi e moltiplicano le sigle; le tensioni come proprietà della qualità bastano e
  lasciano la scelta del colore alla famiglia.
- **Forme scritte a mano** per strutture superiori e cluster: stesso motivo di ADR 0012; le regole
  valgono per tutte le tonalità e il test di coerenza con il volume le controlla.
- **Tensioni al basso nelle quarte**: sarebbero più fedeli al jazz modale, ma rompono la convenzione
  comune a volume e strumento e, senza bassista, cambiano la sigla percepita.
- **Cluster con corde a vuoto**: suono caratteristico, ma solo in alcune tonalità e fuori dalle
  convenzioni; il volume li può citare come ascolto.

## Conseguenze

- `chords.js` cresce del campo `tensions`/`altered`; Arpeggi non cambia.
- `orders()` in `voicings.js` diventa una tabella di generatori per famiglia; `voicings()` accetta
  voicing a cinque voci (forma «So What»).
- Nuovi test in `tests/accordi.test.js`: struttura di ogni famiglia, assenza di tensioni al basso,
  presenza delle note guida, almeno una seconda nei cluster, sole quarte giuste nei voicing per
  quarte; test di coerenza con gli esempi del capitolo (`appunti-pratica/tests`).
- `Docs/deep-link.md` e il capitolo 11 del volume si aggiornano a ogni fase.

## Punti aperti

- Strutture superiori del semidiminuito e del minore con settima maggiore: da verificare a orecchio
  prima di includerle.
- Numero di voicing per famiglia: con `cluster` e `quartal` la lista può diventare lunga;
  eventuale limite alle quattro disposizioni con meno apertura per insieme di corde.
