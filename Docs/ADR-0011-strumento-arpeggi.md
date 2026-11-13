# ADR 0011 — Strumento Arpeggi: guscio comune, qualità come insiemi di gradi, diteggiature in posizione

- Stato: Proposto (2026-11-14; implementato, da accettare dopo la prova dell'utente)
- Data: 2026-11-14
- Piano: [plans/0002-suite-pratica.md](plans/0002-suite-pratica.md), fase 2
- Collegati: [ADR 0005](ADR-0005-modello-esercizi.md), [ADR 0006](ADR-0006-ambito-esercizi.md),
  [ADR 0008](ADR-0008-assegnazione-posizioni.md), [ADR 0010](ADR-0010-suite-di-strumenti.md)

## Contesto

Lo strumento Arpeggi deve avere lo stesso livello dello strumento Scale: estrazione casuale,
filtri, quiz, cronologia, diteggiature con ascolto rapido, pannello Esercizi Cosa/Come/Dove,
viste sincronizzate, deep link. `app.js` e `practice.js` erano legati alla scala
(`scale.degrees`, `Theory.spell`, `Presets` globale, chiavi di salvataggio fisse); la pipeline
degli esercizi (pool → melodia → ritmo → posizioni) era invece già indipendente dal contenuto,
perché lavora su un insieme di classi di altezza dalla tonica.

## Decisione

1. **Guscio comune** (`js/app.js` → `App.start(def)`): stato, estrazione elemento × tonica,
   cronologia, drawer, scorciatoie, deep link e rendering della scheda sono comuni; ogni
   strumento passa una definizione (`js/scale.js`, `js/arpeggi.js`) con catalogo, famiglie,
   ortografia, titolo, dettagli e diteggiature. `js/practice.js` si configura con
   `Practice.configure({ storageKey, catalog, patternScope, start })` e riceve al montaggio
   `semis`, etichette e diteggiature, non più la scala.
2. **Qualità come insiemi di gradi** (`js/chords.js`, previsto dall'ADR 0010 punto 4): 19 qualità
   del capitolo «Arpeggi» del volume (4 triadi, 9 a quattro note, 6 di nona). Il grado decide la
   lettera (B♭7 → A♭, non G♯); la settima diminuita si scrive come sesta, senza doppi bemolle
   (C°7 = C E♭ G♭ A, come negli esempi del volume), con etichetta «°7». Gli `id` sono
   l'identificatore nei deep link (`chord=`).
3. **Diteggiature in posizione** (`Guitar.positionPatterns`): una per nota di partenza sulla
   6ª corda, finestra di 5 tasti, ogni altezza una volta, niente corde a vuoto, nota più grave =
   nota di partenza; fra le finestre possibili quella con meno note in estensione. Sostituiscono
   le 3NPS, che per un arpeggio non hanno senso.
4. **Arpeggi di nona** (`Pool.context(…, { rootOnce })`): sopra la settima suona la nona e la
   fondamentale compare solo come nota più grave (C E G B♭ D E G B♭ D…), come negli esempi
   `arpeggio-c9` del volume. Senza `rootOnce` (scale, triadi, settime) nulla cambia.
5. **Partenza da un'altra nota** (`startDegree`, deep link `start=`, 1-based): l'estensione in
   ottave si misura dalla nota scelta; così 1 = posizione fondamentale, 2 = primo rivolto…
   Vale con estensione in ottave (non con «Tutta» né con il collegamento delle posizioni).
6. **Cataloghi di preset per strumento** (`Presets.makeCatalog`): Scale resta `Presets` (nessun
   id cambia, i link del volume restano validi); Arpeggi usa `Presets.ARPEGGI` con categorie
   Lineari, Salti, Gruppi e rivolti, Ritmici. I motivi si muovono sulle note dell'arpeggio.
   Ritmi comuni.
7. **Persistenza**: `gsp:arpeggi:v1` (estrazioni) e `gsp:arpeggi:practice:v1` (esercizio);
   Scale conserva le chiavi storiche.

## Alternative scartate

- **Copiare `app.js`/`practice.js` in versioni per gli arpeggi**: doppio codice da mantenere
  per due strumenti quasi identici.
- **Arpeggi come «scale» a 4–5 note nel catalogo delle scale**: sigle, ortografia (°7, nona)
  e diteggiature diverse; avrebbe mescolato i deep link dei due strumenti.
- **Nona con la fondamentale ripetuta all'ottava** (C E G B♭ C D …): non corrisponde agli
  esempi del volume e produce un arpeggio a sei note.

## Conseguenze

- `app.js` non è più uno script autonomo: `scale.html` carica anche `js/scale.js`.
- Accordi e Progressioni useranno pannelli propri (polifonia), ma lo stesso guscio di estrazione
  per Accordi è riutilizzabile.
- Lo schema dei deep link si estende con `chord` (solo `arpeggi.html`) e `start` (comune): nessun
  parametro esistente cambia.
