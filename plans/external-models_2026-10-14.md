# Catalogo esterno: modelli veri, presi da un catalogo online

**Data:** 2026-10-14

## Obiettivo

Il catalogo aggiunto ieri sa mettere in stanza otto cose che l'ufficio sa costruire da sé. Adesso deve
poter pescare anche **fuori**: cercare in un catalogo online e mettere in stanza un modello 3D vero —
un altro divano, una statua, una roccia, quello che c'è — senza che nessuno tocchi il codice.

La fonte che regge da sola, verificata con richieste vere:

- **Poly Haven** (`api.polyhaven.com`): 521 modelli **CC0**, categorie utili a un ufficio (furniture 85,
  seating 34, table 27, office 12, plants 57, decorative 76, vases, lighting, containers…) e tante cose
  che non c'entrano nulla. Nessuna chiave, nessun account. I termini d'uso chiedono due cose sole, e
  sono il motivo per cui le rotte del server portano un `user-agent` con il nome dell'app e la finestra
  mostra **"Powered by Poly Haven"**: gli asset scaricati sono CC0 e non chiedono nulla, la *loro API
  viva* sì.
- **Poly Pizza** e **Sketchfab** si potranno aggiungere dopo: la prima vuole una chiave API (gratuita,
  da chiedere), il secondo un token OAuth. **Kenney** è CC0 ma non ha API: sono pacchetti da scaricare a
  mano, non una ricerca.

## Come funziona

**1. Una fonte è una riga.** `src/shared/model-sources.ts` elenca le fonti (nome, credito, licenza) e
`src/server/model-sources/` ha un adattatore per fonte in una mappa `Record<ModelSource, …>`: una fonte senza
adattatore non compila. Oggi c'è Poly Haven e basta.

**2. Cercare passa dall'ufficio, non dal browser.** Il catalogo online si interroga dal server (CORS,
chiavi e `user-agent` restano suoi): `GET /api/models/search?floor=…&source=polyhaven&q=chair` risponde
con nome, categorie, poligoni, dimensioni, autori e miniatura di ogni modello. L'elenco della fonte si
tiene in memoria per un'ora: è un JSON da 550 KB.

**3. Scegliere vuol dire scaricare.** `POST /api/models/add` scarica il modello nella cartella del
piano (`<progetto>/.agent-office/models/<fonte>/<id>/`), cioè dove sta già `layout.json`: fuori da git
e fuori dal sync, come tutto il resto dello stato dell'ufficio. Un glTF di Poly Haven non è un file ma
un pacchetto — il `.gltf` più il `.bin` e le texture che nomina — quindi si scaricano tutti i file del
`1k` (mezzo mega in tutto) **mantenendo i nomi relativi**, ed è la cartella intera a essere servita:

```
GET /api/models/polyhaven/ArmChair_01/            → il .gltf d'ingresso
GET /api/models/polyhaven/ArmChair_01/textures/…  → la texture che quel .gltf nomina
```

Il caricatore del browser risolve i nomi relativi da solo, esattamente come se fossero file veri. Il
percorso di ogni file è controllato (`..` non esce dalla cartella del modello), e un modello già
scaricato non si riscarica.

**4. Un modello scaricato è un pezzo della stanza.** La voce salvata porta
`kind: "polyhaven:ArmChair_01"` — la stessa forma delle voci del catalogo interno — e il client lo
costruisce con il proprio caricatore glTF, prendendo dal modello la sua misura: il piede del collider e
l'altezza vengono dal suo bounding box, quindi una sedia è una sedia e non un cubo indovinato. I
materiali restano quelli del modello (è il punto: roba di fuori non vestita da cartone), e l'oggetto
si sposta, gira e si cancella come qualunque altro pezzo.

**5. La finestra del catalogo ha due parti.** Sopra le otto cose dell'ufficio, sotto la ricerca in
linea: campo di ricerca (o Invio), risultati con miniatura, nome, poligoni, misura e autore, e ogni
riga cliccabile. In fondo il credito verso la fonte. Il resto del flusso è quello di ieri: l'oggetto
compare davanti a te, in mano, e **E** lo posa dove guardi.

## I pezzi, secondo le convenzioni del progetto

| Dove | Cosa |
| --- | --- |
| `src/shared/model-sources.ts` | le fonti, `ModelInfo`, `externalKind`/`parseExternal`, gli indirizzi delle rotte |
| `src/shared/placement.ts` | `kind` diventa "una cosa del catalogo **o** `fonte:id`" |
| `src/server/model-sources/polyhaven.ts` | l'adattatore: elenco, ricerca, scelta della risoluzione, file da scaricare |
| `src/server/model-sources/store.ts` | la cartella dei modelli di un piano: scaricare, servire, rifiutare un percorso fuori |
| `src/server/http/routes/model-sources.ts` | le tre rotte (cerca, aggiungi, servi) + una riga in `routes/index.ts` |
| `src/server/floor.ts` | `readonly models: ModelStore` (una riga, accanto a `layout`) |
| `src/client/world/office/external.ts` | il modello diventa un pezzo: caricatore, misura, collider |
| `src/client/world/office/catalog.ts` | `applyCatalog` costruisce sia i tipi interni sia i modelli scaricati |
| `src/client/features/layout-editor/ui.ts` | la ricerca nella finestra, con il credito alla fonte |
| `src/client/features/layout-editor/index.ts` | `addModel`: scarica, poi mette in mano |
| `src/client/state/slices/layout.ts` | niente: il file è lo stesso di ieri |

Niente nel centro di `main.ts`, `server.ts`, dello store o di `protocol.ts`: la ricerca è HTTP, non un
messaggio sul WebSocket (è una cosa di chi guarda, non dello stato del piano). `tests/size.test.ts`
resta verde.

## Verifica

- `npm run typecheck`, i test toccati, la suite intera, `npm run build`.
- Test nuovi: il contratto condiviso (`externalKind`/`parseExternal`, un `kind` con fonte sconosciuta
  buttato da `sanitize`), la mappatura della risposta di Poly Haven (una fixture: dimensioni in mm →
  metri, il `1k` scelto, i file da scaricare elencati), il magazzino (un percorso con `..` rifiutato,
  il manifest scritto e riletto, il modello già scaricato non riscaricato).
- Prova vera della rete: `curl` sull'API e sul CDN (già fatta in fase di progetto: elenco 200, 549 KB;
  `ArmChair_01` 1k = 2,6 KB + 154 KB + 3 texture).
- L'ufficio lo prova l'utente: l'agente non avvia un browser (PROJECT.md).
- Riavvio dell'istanza già in esecuzione (porta 4600) e commit su `fork/main`.

## Esito

Fatto e spinto su `fork/main`.

- **La catena provata davvero, con la rete**: `search("arm chair")` → 7 risultati; `add` di
  `modern_arm_chair_01` → 8 file, 2,7 MB sotto `.agent-office/models/polyhaven/<id>/`, idempotente
  (una seconda `add` non riscarica); il file d'ingresso servito come `model/gltf+json` e **ogni**
  riferimento interno (`modern_arm_chair_01.bin`, sei texture) risolto dalla stessa cartella; un
  percorso con `..` rifiutato. E `LoaderUtils.extractUrlBase` di three conferma che quei nomi
  relativi cadono esattamente dove le rotte li servono.
- **Le rotte provate sull'ufficio in esecuzione** (porta 4600, dopo il riavvio): login, ricerca dal
  vivo con `credit: "Powered by Poly Haven"` e `licence: "CC0"`, una fonte sconosciuta → 400 con il
  suo messaggio, un modello non scaricato → 404. La rotta che *scarica* (POST) non è stata chiamata
  dal vivo: avrebbe lasciato un modello nella cartella dell'utente, e la stessa strada
  (`ModelStore.add`) è quella provata qui sopra.
- **Suite**: 651 test prima, 656 dopo (4 nuovi sui cataloghi esterni, 1 sulla voce nel file),
  tutti verdi. Typecheck, build, ufficio riavviato.
- **Un inciampo, per memoria**: `tests/models.test.ts` e `src/server/models.ts` esistevano già — sono
  i modelli che il dialogo di assunzione chiede ai CLI degli agenti. Una `write` distratta ha
  sovrascritto quel file di test (15 test spariti dalla suite, senza un fallimento che lo dicesse); è
  stato rimesso da git, e i moduli di questa funzione sono diventati `shared/model-sources.ts` e
  `server/model-sources/` per non lasciare un file e una cartella con lo stesso nome. La lezione: su
  un percorso mai letto, una scrittura non è una novità, è una cancellazione — e un calo del numero
  di test è un sintomo che va letto, non un dettaglio della suite.
- **Non verificato**: il browser. La finestra, la miniatura, il modello in stanza con i suoi materiali
  e il piede preso dalla sua misura: li prova l'utente (PROJECT.md).

## Rischi e paletti

- **Il catalogo di fuori è roba di fuori**: un modello può essere pesantissimo (poligoni) o enorme.
  La finestra mostra i poligoni e la misura prima di scaricare, e non filtra niente: decidere è di chi
  guarda.
- **La rete può mancare**: se il download fallisce, la voce non si scrive e la finestra lo dice; nulla
  resta a metà. Un modello già scaricato si usa anche senza rete.
- **Un modello che non c'è più** (cartella cancellata a mano): la voce resta nel file e il pezzo non
  compare finché qualcuno non prova a riscaricarlo — più avanti, con la stessa finestra.
- **Licenze**: gli asset Poly Haven sono CC0 (nessun obbligo), ma la loro API viva chiede il credito,
  che sta nella finestra; quando si aggiunge una fonte con altre licenze (Poly Pizza, Sketchfab) il
  credito e la licenza dovranno stare nella riga del risultato, non solo in fondo.
