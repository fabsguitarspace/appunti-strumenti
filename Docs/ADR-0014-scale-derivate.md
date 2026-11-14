# ADR 0014 — Strumento Scale: pentatoniche, scala blues e scale bebop

- Stato: Accettato (2026-11-15, decisione dell'utente con le quattro scelte proposte); attuato il 2026-11-15
- Data: 2026-11-15
- Collegati: [ADR 0008](ADR-0008-assegnazione-posizioni.md), [ADR 0010](ADR-0010-suite-di-strumenti.md), [ADR 0011](ADR-0011-strumento-arpeggi.md); volume `appunti-pratica`, analisi 022 (fase D della revisione integrata)

## Contesto

Il catalogo dello strumento Scale (`Theory.catalog()`) ha 33 scale: i modi di quattro scale madri eptatoniche e cinque simmetriche. I due volumi trattano però anche materiali che lo strumento non offre:

- Pratica, capitolo Scale: mappe di pentatonica maggiore e minore, scala blues, tre scale bebop (dominante, maggiore, minore in due varianti);
- Pratica, pagina Pentatoniche (14 novembre 2026): passo e salto, formule, scelta sull'accordo, cinque pentatoniche alterate;
- Teoria 4, «Altre pentatoniche: cambiare una nota».

La pagina Pentatoniche non può rimandare allo strumento per esercitarsi: il rimando è stato tolto prima della pubblicazione perché lo strumento non ha queste scale.

Vincoli osservati nel codice:

1. **Diteggiature.** Lo strumento Scale usa solo `Guitar.threeNpsPatterns`, tre note per corda. Con cinque o sei note per ottava il risultato è scomodo e lontano dalle mappe del volume, che lavorano in posizione con due note per corda. `Guitar.positionPatterns`, scritto per gli Arpeggi, produce già diteggiature in posizione per qualsiasi insieme di note: una finestra di cinque tasti per ogni nota di partenza. Prova eseguita il 15 novembre 2026: su La minore pentatonica dà cinque diteggiature di dodici note, due per corda (tasti 5–8, 7–10, 9–13, 12–15, 2–5); sulla scala blues di Do sei diteggiature da quattordici o quindici note entro cinque tasti.
2. **Persistenza.** La scala corrente e la cronologia si salvano come **indice** nel catalogo (`app.js`, `validPick`). Inserire scale in mezzo al catalogo cambierebbe la scala salvata degli utenti.
3. **Famiglie salvate.** Le famiglie abilitate si salvano come elenco. Una famiglia nuova non compare in quell'elenco: chi ha già usato lo strumento non la vedrebbe estratta finché non la abilita a mano.
4. **Nomi degli esercizi.** I preset degli intervalli si chiamano «Terze (1-3, 2-4 …)», «Quarte» ecc. e sono definiti come salti di indice nella collezione (`motif: [0, 2]`). Su una pentatonica «Terze» produce terze e quarte. Per le scale simmetriche esiste già un avviso (`hint`) che lo spiega; il volume ora usa la terminologia «passo» e «salto».
5. **Intestazione della scheda.** Le scale senza modo sono presentate come «Scala simmetrica».
6. **Deep link.** Il parametro `pattern` è documentato come «diteggiatura 3NPS»; gli identificatori delle scale derivano dal nome (`Link.slug`) e sono fissati da `tests/link.test.js`.

## Decisione proposta

1. **Due famiglie nuove, in coda a `FAMILIES`**:
   - `pentatonic`, «Pentatoniche»: pentatonica minore (1 ♭3 4 5 ♭7), pentatonica maggiore (1 2 3 5 6), pentatonica minore 6 (1 ♭3 4 5 6), pentatonica minore 7♭5 (1 ♭3 4 ♭5 ♭7), pentatonica maggiore ♭6 (1 2 3 5 ♭6), pentatonica maggiore ♭2 (1 ♭2 3 5 6), pentatonica esatonale (1 3 ♯4 ♯5 ♭7). Ordine e nomi come nel volume; `aka` solo per i nomi alternativi veri (pentatonica a toni interi, bebop dorica), perché la scheda lo presenta come «detta anche».
   - `bluesBebop`, «Blues e bebop»: scala blues (1 ♭3 4 ♭5 5 ♭7), bebop di dominante (1 2 3 4 5 6 ♭7 7), bebop maggiore (1 2 3 4 5 ♯5 6 7), bebop minore con la settima maggiore (1 2 ♭3 4 5 6 ♭7 7), bebop minore con la terza maggiore (1 2 ♭3 3 4 5 6 ♭7).
   - Le dodici scale si **aggiungono in fondo** al catalogo, dopo le simmetriche: gli indici delle 33 attuali non cambiano. Il catalogo passa a 45 scale.
2. **Diteggiature per famiglia.** Pentatoniche e scala blues usano `positionPatterns` (una diteggiatura in posizione per nota di partenza, come gli Arpeggi e le mappe del volume). Le bebop, con otto note, restano in 3NPS come le scale ottatoniche già presenti. Le scale attuali non cambiano diteggiatura. Titolo della sezione, nota e etichetta dell'ambito «Diteggiatura …» diventano una proprietà della scala invece che dello strumento.
3. **Famiglie nuove abilitate per chi ha già impostazioni salvate.** Si salva anche l'elenco delle famiglie conosciute; una famiglia assente da quell'elenco si considera abilitata alla prima apertura. Chi l'ha disattivata una volta resta con la sua scelta.
4. **Avviso sugli intervalli esteso**, con la terminologia del volume: su pentatoniche, blues e bebop l'avviso spiega che gli esercizi «Terze», «Quarte» … sono salti nella collezione («Terze» = salto, una nota sì e una no; «Quarte» = salto doppio) e che l'intervallo effettivo cambia da nota a nota. Le etichette dei preset non cambiano, perché sono comuni a tutto il catalogo e fanno parte dei link.
5. **Un preset nuovo**, comune a tutte le scale: «Passo su, salto su, passo giù (1243 2354 …)», id `seq-formula`, `motif: [0, 1, 3, 2]`, nella categoria Sequenze. È la formula dell'esempio P1 della pagina Pentatoniche; su una scala eptatonica dà la sequenza 1-2-4-3.
6. **Intestazione della scheda per famiglia**: «Pentatonica», «Scala blues», «Scala bebop» al posto di «Scala simmetrica».
7. **Deep link estesi senza rompere**: dodici identificatori nuovi (`pentatonica-minore`, `pentatonica-maggiore`, `pentatonica-minore-6`, `pentatonica-minore-7b5`, `pentatonica-maggiore-b6`, `pentatonica-maggiore-b2`, `pentatonica-esatonale`, `scala-blues`, `bebop-di-dominante`, `bebop-maggiore`, `bebop-minore`, `bebop-minore-3`, fissati in `tests/link.test.js`); `pattern` documentato come «diteggiatura dello strumento per quella scala: 3NPS o in posizione». Nessun parametro esistente cambia significato.
8. **Volume.** Nel capitolo 11 di Pratica: numero delle scale aggiornato (45), due o tre esercizi pronti sulle pentatoniche (per esempio La minore pentatonica in posizione con il nuovo preset); nella pagina Pentatoniche e nel capitolo Scale il rimando allo strumento. `tests/test_strumenti_links.py` li verifica come gli altri.

## Alternative scartate

- **Una sola famiglia «Scale derivate»** con pentatoniche, blues e bebop: più corta da filtrare, ma mescola collezioni di cinque e di otto note e rende meno utile l'estrazione per famiglia.
- **3NPS anche per le pentatoniche**: nessuna modifica al codice delle diteggiature, ma diteggiature diverse da quelle del volume e scomode con cinque note.
- **Un generatore nuovo a due note per corda**: più vicino alle mappe tradizionali «a box», ma duplica `positionPatterns`, che copre già il caso ed è testato.
- **Rinominare i preset degli intervalli** in «Salti» per tutte le scale: più preciso sulle pentatoniche, ma cambia etichette che sulle scale eptatoniche sono corrette e già usate nel volume.
- **Uno strumento Pentatoniche separato**: duplica pannello, esercizi e persistenza per un materiale che lo strumento Scale gestisce già.

## Conseguenze

- `theory.js`: due famiglie e dodici scale in coda; `scale.js`: diteggiatura, titoli, intestazione e avviso per famiglia; `practice.js` o `app.js`: etichetta dell'ambito «Diteggiatura» per scala; `app.js`: famiglie conosciute nel salvataggio; `presets.js`: un preset.
- Test: slug unici e stabili delle 45 scale (le 33 attuali invariate), indici delle 33 attuali invariati, diteggiature in posizione per pentatoniche e blues (finestra di cinque tasti, tutte le note), formula del nuovo preset, famiglie nuove abilitate con impostazioni salvate precedenti.
- Documentazione: `architecture.md` (catalogo 45, diteggiature per famiglia), `deep-link.md` (identificatori, `pattern`), `esercizi.md` (preset nuovo), README.
- Volume: capitolo 11, pagina Pentatoniche e capitolo Scale di Pratica; nessuna modifica a Teoria.

## Verifiche previste

`node tests/run.test.js`; prova manuale di `scale.html` da `file://` (estrazione delle famiglie nuove, diteggiature in posizione, esercizi con l'avviso, deep link nuovi e vecchi); in Pratica `tests/test_strumenti_links.py` e build HTML con `-W --keep-going`.

## Decisioni richieste all'autore

1. Due famiglie (proposta) o una sola.
2. Diteggiature in posizione per pentatoniche e blues (proposta) o un generatore a due note per corda.
3. Includere le due varianti del bebop minore (proposta) o una sola.
4. Aggiungere il preset della formula (proposta) o lasciare il catalogo degli esercizi com'è.

## Attuazione (2026-11-15)

- `theory.js`: famiglie `pentatonic` e `bluesBebop`, dodici scale in coda al catalogo (45), funzione `collection`. I nomi del bebop minore sono «Bebop minore» (con la 7 maggiore) e «Bebop minore 3» (con la 3 maggiore).
- `scale.js`: diteggiature in posizione per pentatoniche e scala blues, titolo e nota della sezione, intestazione («Pentatonica», «Scala blues», «Scala bebop») e avviso sugli intervalli per famiglia; `legacyFamilies` per le impostazioni salvate in precedenza.
- `app.js`: salvataggio dell'elenco delle famiglie conosciute (`known`) e abilitazione delle famiglie nuove; inoltro di `patternScope` al pannello. `practice.js`: etichetta dell'ambito «Diteggiatura» presa dall'elemento montato.
- `presets.js`: preset `seq-formula`.
- Ortografia: le scale nuove seguono la regola del catalogo, una lettera per grado; per esempio la pentatonica esatonale di Si si scrive Si–Re♯–Mi♯–Fa𝄪–La, come l'esatonale già presente.
- Test: 88 superati (`node --test tests/*.test.js`), fra cui catalogo in coda, formule e ortografia, diteggiature in posizione complete entro cinque tasti per tutte le toniche, slug, preset.
