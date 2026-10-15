# Modelli da fuori, e fino a che punto si può sostituire lo scenario

**Data:** 2026-10-15
**Stato:** solo studio. Niente implementato, niente scaricato, repository invariato.
**Perché è scritto:** è una questione **estetica**, non funzionale — l'ufficio fa già tutto quello che
serve. Questo è il materiale raccolto per poterla affrontare più avanti, senza rifare la ricerca.

Continua `external-models_2026-10-14.md`, che finisce con «Poly Pizza e Sketchfab si potranno
aggiungere dopo».

## Da dove vengono i modelli, oggi

Due strade, e sono diverse per natura.

**Costruiti in casa, in Blender.** `blender/scripts/build_<nome>.py` scrive
`src/client/models/<nome>.glb`, e lo script è la fonte: si cambia il modello cambiando lo script e
rieseguendolo. Sono cane (una `.glb` per razza), cucina, lounge, piante, `desk_props`. Le convenzioni
(`blender/README.md`) sono quelle che il codice conta: metri, il modello guarda **-Y** in Blender cioè
**+Z** nell'ufficio, **i materiali sono nomi** che il codice ripittura, le parti che si muovono sono
oggetti a sé con l'origine sul perno, un props sta entro qualche migliaio di triangoli e una creatura
attorno a 12.000. `world/models.ts` è il registro che le carica (`preload` per quelle con cui si
costruisce il mondo, altrimenti alla prima richiesta), `paintModel()`/`palette()` le dipingono,
`tests/<nome>-model.test.ts` controlla nomi e misure.

**Scaricati da un catalogo online, già durante l'esecuzione.** È la funzione di ieri: la finestra del
catalogo (**F2** → **C**) cerca in **Poly Haven** e mette in stanza il modello che scegli. Il giro è
questo, e vale come stampo per qualunque fonte nuova:

| Pezzo | Dove |
| --- | --- |
| Le fonti, la forma dei dati, `fonte:id` | `src/shared/model-sources.ts` |
| Un adattatore per fonte, `Record<ModelSource, ModelAdapter>` | `src/server/model-sources/<fonte>.ts` |
| Ricerca, scaricamento, cartella dei modelli | `GET /api/models/search`, `POST /api/models/add`, `GET /api/models/files/…` |
| Il modello diventa un pezzo della stanza | `src/client/world/office/external.ts` |
| La ricerca nella finestra | `src/client/features/layout-editor/` |

I file scaricati vivono in `<progetto>/.agent-office/models/<fonte>/<id>/`, **fuori da git e fuori dal
sync**, come il resto dello stato dell'ufficio. Un modello già scaricato si usa senza rete, e la voce
salvata ricorda solo `polyhaven:ArmChair_01`.

## I cataloghi, e cosa chiede ciascuno

Verificato il 2026-10-15 sulle pagine ufficiali.

| Fonte | Cosa dà | Come si accede | Licenza |
| --- | --- | --- | --- |
| **Sketchfab** | oltre un milione di modelli gratuiti, si guardano animati nel browser, filtro *Downloadable* | **API ufficiale** con OAuth 2.0 | Creative Commons per modello: CC0, CC BY, talvolta CC BY-SA/NC |
| **Fab** (Epic) | il successore dello Sketchfab Store: asset commerciali e professionali | account e libreria, **nessuna API pubblica** equivalente | per prodotto, licenza d'acquisto |
| **Poly Haven** | 521 modelli CC0, arredo/piante/oggetti | API libera, senza chiave | **CC0** (l'API viva chiede il credito, e c'è nella finestra) |
| **Poly Pizza** | low-poly vari, API gratuita su chiave | chiave API da chiedere | CC0 **o** CC BY, da controllare per modello; i termini vietano scraping e uso del materiale per addestrare IA |
| **Quaternius** | pacchetti CC0 coerenti: animali animati, personaggi base, libreria di oltre 120 animazioni umanoidi | download di pacchetti, nessuna API | **CC0**; glTF disponibile su alcuni pacchetti, non su tutti |
| **Kenney** | arredi, ambienti, veicoli, stile game low-poly | pacchetti a mano, nessuna API | **CC0** |
| **BlenderKit** | materiali, HDRI, oggetti, dentro Blender | add-on di Blender | misto: CC0 e royalty-free |
| **CGTrader** | mercato generalista, anche realistico | acquisto | per prodotto |
| **Mixamo** | personaggi e grande libreria di animazioni bipedi | account Adobe | royalty-free in opere finite (giochi, film); la FAQ non concede di ridistribuire i file grezzi |
| **Gobkit** | GLB già pronti, riggati e animati, animali e personaggi | GitHub / itch.io | **CC0**; animazioni in un'unica traccia a intervalli di frame |

Ordine pratico: **Sketchfab** per cercare e provare (è il catalogo più grande e mostra le animazioni),
**Fab** per comprare, **Quaternius** e **Kenney** per pacchetti CC0 coerenti fra loro.

## Sketchfab in dettaglio

L'API di download esiste ancora e non ha un sostituto: la migrazione a Fab ha riguardato il negozio e
la pubblicazione, non questa.

- `GET https://api.sketchfab.com/v3/models/{UID}/download`, con `Authorization: Bearer <token>`.
- Risponde con collegamenti temporanei (`gltf`, `usdz`); l'archivio glTF è uno zip con `scene.gltf`,
  `scene.bin` e `textures/`. Geometria, skin, **animazioni** e texture arrivano con il modello.
- **Serve l'autenticazione dell'utente finale** con un account Sketchfab (OAuth 2.0: Authorization
  Code per un server, Implicit per un browser, username/password come ultima scelta). L'access token
  dura un mese e si rinnova con il refresh token.
- I formati sorgente (FBX, OBJ) **non** passano dall'API: solo glTF/GLB e USDZ.
- L'app va registrata presso Sketchfab per ottenere Client ID e Client Secret: **il secret resta
  locale e non entra nel repository** (stessa regola delle altre chiavi).
- Obblighi dell'app che usa l'API, dai termini: dire che i modelli scaricabili vengono da Sketchfab,
  **mostrare la licenza Creative Commons** del modello e **attribuire l'autore** (nome utente e
  collegamento alla pagina del modello).
- Lo Sketchfab Store (i modelli a pagamento) è migrato su **Fab**, e Fab non ha un'API pubblica
  equivalente: quello che si scarica via API è il catalogo gratuito CC.

Poiché l'ufficio è usato da una sola persona, **l'OAuth è una volta sola**: un'applicazione
registrata, un account, un token salvato sulla macchina. Non serve un accesso per utente.

## Il cane: cosa serve davvero per sostituirlo

Il cane è il pezzo più facile da rimpiazzare, perché tutto ciò che lo riguarda è già separato dal
modello: dove va, cosa fa, quando abbaia e cosa succede quando lo accarezzi stanno nel server e nel
codice, non nella `.glb`. Ma un modello esterno non può semplicemente prendere il posto del file: il
codice si aspetta un contratto preciso.

**Animazioni** (`DogAct` in `shared/dog.ts` più il movimento): `stand`, `sit`, `lie`, `nap`, `sniff`,
`bark`, `wag`, `walk`, `run`. `play()` cerca la clip per nome e ripiega su `stand` se non c'è, quindi
un modello con meno clip funziona — con meno espressività.

**Ossa** che il codice muove da sé: `jaw`, `eye_L`, `eye_R`.

**Socket** dove si appendono i costumi: `socket_head`, `socket_back`, `socket_nose`, `socket_neck`.

**Materiali**, per nome, perché vengono ripitturati: `Fur`, `Light`, `Ear` (i tre che seguono il
mantello), più `Ink`, `Shine`, `Nose`, `Tongue`, `Collar`, `Tag`.

**Per essere preso dal mouse**: capsule costruite sopra lo scheletro (`hips`, `spine`, `chest`,
`neck`, `head`, `jaw`, `tail_1..3`, `front_*`/`back_*` per ogni lato, `ear_*`), perché il raycast
triangolo per triangolo costerebbe troppo.

**Altre due cose**: l'altezza della sommità e di quanto ogni clip la abbassa (per nome tag e fumetti),
e la larghezza del collare rispetto a quello del cucciolo (per la sciarpa).

Un **adattatore per modello** — clip esterne mappate agli stati, socket ricostruiti, misure
normalizzate, materiali o ripitturati o lasciati come sono — risolve il resto. Oggi il cane ha sei
razze con lo stesso scheletro, mantelli ricolorabili e costumi; un cane di fuori non avrebbe né le
altre razze né i costumi, a meno di non rifarli.

### Candidati trovati, con i numeri letti sulle pagine

| Modello | Triangoli | Animazioni | Licenza |
| --- | ---: | --- | --- |
| [Dachshund, JoseDiaz](https://sketchfab.com/3d-models/dachshund-03cbe5bfd63c41a6a7a6f7f5f5a67857) | 11.952 | 20, fra cui idle, happy, sitting, laying down, sleeping, walking, running, sniff, tilt head, bark; più blendshape per le espressioni | a pagamento (Sketchfab Store) |
| [Stylized Low Poly German Shepherd, DreamNoms](https://sketchfab.com/3d-models/stylized-low-poly-german-shepherd-18d8fbe184c5448283762893b6ea9752) | 852 | run, lie down, scratch, jump | **CC BY** |
| [Low poly Black dog, Nulla](https://sketchfab.com/3d-models/low-poly-black-dog-ccb46d74399f442aad3f70341fd823ac) | 876 | walk, idle, tilt head | **CC BY** + **NoAI** |

Il primo copre quasi tutti gli stati dell'ufficio e sta nel budget di una creatura; il secondo e il
terzo sono leggeri e liberi ma con poche clip. Da verificare prima di usare il primo: la licenza d'uso
e la possibilità di ridistribuire il file, perché è a pagamento e la pagina è dello Store migrato su
Fab. Va anche tenuto presente che un modello **può sparire dal sito**: uno dei candidati trovati in
questa ricerca risultava già cancellato — motivo in più per tenere i file in casa una volta scaricati.

## Gli agenti: molto più lavoro

Gli agenti **non sono un modello**: sono costruiti dal codice. `WorkerRig` è fatto di `root`, `body`,
`skin`, `armL`, `armR`, `feet`, `pupils`, `bulb`, `bulbMesh`, `props`; sopra ci stanno il volto
(sopracciglia e bocca, `worker-face.ts`), le posizioni mescolate fra loro (`Stance`, `blendStance`),
il ballo, i cartelli e le nuvolette, i costumi delle feste, la barba e la vecchiaia, la cella del
castello, il pacco in braccio quando va a casa, e la lampadina di stato.

Sostituirli con un personaggio di fuori significa mappare **tutte** queste cose su uno scheletro che
non le conosce: è un lavoro di gran lunga maggiore di quello del cane, e va fatto solo se lo stile
attuale non piace più.

Chi volesse quella strada, le due fonti sensate sono **Quaternius** (personaggi base + libreria di
animazioni CC0, pensate per il retargeting) e **Mixamo** (libreria enorme, ma i file grezzi non sono
ridistribuibili).

## Sostituire lo scenario intero

**Si può**, e l'ufficio è già predisposto: oltre all'ufficio esistono un **castello** e una **stazione
spaziale**, costruiti da `BUILDERS: Record<MapStyle, (plan) => World>` in `world/styles.ts`, con lo
stesso contratto `World` (`plan`, `group`, `colliders`, `interactables`, `desks`, `boardMeshes`,
`nav`, `ways`, `rain`, `room`, `acoustics`…). Una mappa è **dati** (`MapConfig` → `MapPlan`: confini,
altezza, punto di arrivo, postazioni, tavoli, lavagne, ostacoli, dungeon, aria lock, palette) e una
mappa nuova è un builder più un piano. `docs/maps.md` è il riferimento.

Il punto è che **un modello non è una mappa**. Un GLB porta geometria, materiali e animazioni; non
porta il significato che l'ufficio deve conoscere.

| Elemento | Ricavabile dal GLB | Da dichiarare |
| --- | --- | --- |
| Geometria, materiali | sì | — |
| Animazioni presenti | sì (nomi e durata) | quale clip, e quando |
| Misure e appoggio a terra | sì | eventuale scala |
| Pavimento percorribile | solo in parte | le superfici su cui si cammina |
| Muri e ostacoli | solo approssimativamente | le collisioni semplificate |
| Porte e scale | no | dove sono, dove portano |
| Punto d'ingresso | no | dove si arriva e guardando dove |
| Posti degli agenti | no | sedute, scrivanie, direzione |
| Schermi e lavagne | no | su quale superficie dipingere |
| Ascensore, balcone, uscite | no | i punti funzionali |
| Luci e suoni | solo in parte | interno/esterno, finestre, atmosfera |

La strada naturale non è modellare la mappa a mano nel codice: è **importare lo scenario e annotarlo
dentro l'ufficio** — cliccare il pavimento, marcare muri, ingresso, porte, scrivanie e schermi — e
salvare il risultato accanto al modello. Da lì è selezionabile come oggi lo sono castello e stazione.

## I limiti tecnici, coi numeri

**Il raycast è il primo muro.** Il mirino casta un raggio ogni frame per sapere cosa stai guardando, e
three prova i triangoli uno per uno. Misurato su questa macchina (`core/raycast.ts`):

| Scena | Tempo per raggio |
| --- | ---: |
| 200 oggetti, nessun modello pesante | 1,3 ms |
| 200 oggetti + un modello da 57.000 triangoli | 46,6 ms |
| 300 oggetti + un modello da 300.000 triangoli | 307,0 ms |

Da qui `RAY_TRIANGLE_BUDGET = 4000`: sopra quella soglia un mesh risponde al raggio con la sua scatola
(`coarseMeshes`). Uno scenario intero importato dovrà avere lo stesso trattamento per collisioni e
navigazione: **mai triangolo per triangolo**.

**Il costo grafico non è il numero di mobili.** Un frame è la stanza disegnata due volte (il contorno)
fino a quattro pixel di dispositivo per pixel di schermo, in una shadow map 2048²
(`core/graphics.ts`): contano passate e pixel. Non esiste quindi una soglia unica di triangoli da
dichiarare come "accettabile": il validatore dovrà **misurare** mesh, materiali, texture, trasparenze,
skin, luci e pesare il tutto, non indovinare.

**Formati.** Il caricatore in uso è `GLTFLoader` semplice: **non** sono configurati i decoder per
Draco, Meshopt o texture KTX2 (verificato: nessun riferimento nel sorgente). Diversi modelli di
Sketchfab sono compressi, e senza quei decoder non si aprono.

**Rete e licenze.** La rete può mancare: se lo scaricamento fallisce la voce non si scrive e nulla
resta a metà; un modello già scaricato si usa anche offline. Il tetto di misura già in vigore per un
modello scaricato è `MAX_SIDE = 40` metri (`office/external.ts`): oltre, non è un mobile.

**Dove finirebbe uno scenario.** Come i modelli, in `<progetto>/.agent-office/…`: fuori da git e fuori
dal sync. Vale a dire che uno scenario importato vive nella macchina che l'ha scaricato, e una seconda
macchina lo riscarica — lo stesso limite già noto per i mobili esterni.

## Decisioni che restano da prendere

Sono del proprietario, non del repository:

1. **Licenze ammesse.** Consiglio CC0 e CC BY: l'attribuzione si conserva in automatico e si evitano
   NonCommercial e ShareAlike. Sketchfab impone comunque di mostrare licenza e autore.
2. **Registrazione dell'app su Sketchfab** per Client ID e Client Secret (da tenere locali).
3. **A che livello fermarsi**: arredi (già fatto), cane, agenti, oppure scenario intero.
4. **Se serva un editor di mappa** dentro l'ufficio per annotare uno scenario importato.

## Cosa non è stato fatto

- Nessun modello scaricato, nessuna fonte interrogata via API: solo pagine ufficiali lette e codice
  del progetto riletto.
- Nessuna riga di codice scritta, nessun test eseguito, nessuna modifica al repository.
- La resa in pagina non è stata vista: quando si farà, la prova visiva è dell'utente (PROJECT.md).
