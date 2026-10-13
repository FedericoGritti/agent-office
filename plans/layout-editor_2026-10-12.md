# Editor dell'ufficio: spostare e cancellare gli oggetti dal gioco

## Cosa risolve

Oggi ogni oggetto dell'ufficio è una costante scritta a mano in `src/shared/layout.ts`
(`JUKEBOX`, `BOOKSHELF`, `BOARDS.*`, `WHITEBOARD`, `FIGURES`, `GONG`, `CABINET`, `PLANTS`) e finisce
cotta dentro il bundle: per spostare un jukebox di un metro servono una modifica, una compilazione e
un riavvio. L'obiettivo è che quelle posizioni diventino **dati** che si cambiano dall'interfaccia:
un tasto accende le maniglie, si trascina l'oggetto, si cancella quello che non serve, si salva, e
l'ufficio ricarica con la nuova disposizione. Nessuna richiesta a un agente per ogni ritocco.

## Cosa è modificabile (e cosa no)

Modificabili: i mobili e gli arredi nati da quelle costanti — jukebox, libreria dei documenti, le tre
lavagne (checklist, timeline, phase), la lavagna bianca, i due visualizzatori di immagini, il gong, il
cabinete arcade, i vasi delle piante.

Non modificabili, e dico perché: **tavoli, sedie a sacco e la postazione del coordinator**. Non sono
arredi ma *posti a sedere*: hanno un id che il server usa per assegnare i worker, la coda li conta, e
la mappa di navigazione li tratta come ostacoli. Spostarli o cancellarli dal gioco romperebbe
l'assunzione "un worker, un tavolo". Restano da chiedere a me, come oggi. Se un giorno servono, si fa
con lo stesso meccanismo ma con i vincoli dei posti (id stabili, minimo di tavoli per le mappe).

## Come funziona

**1. Un file di disposizione, uno per piano.** `.agent-office/layout.json` nella cartella del
progetto (già esclusa dal sync e da git): `{ "<id>": { "x": 1.5, "z": -4, "rotY": 3.14, "deleted": true } }`.
Solo le differenze dalla base: se un oggetto non è nel file, vale la costante di `layout.ts`.

**2. La base e la sovrapposizione.** Un modulo condiviso (`src/shared/placement.ts`) elenca gli
oggetti spostabili con la loro posizione di partenza e applica sopra il file: `place('jukebox', JUKEBOX)`
restituisce la posizione effettiva. Ogni costruttore (jukebox, libreria, lavagne, gong, cabina,
piante, lavagna bianca, immagini) la legge invece della costante, così una modifica salvata vale al
caricamento successivo, per tutti e per ogni macchina.

**3. Chi disegna gli oggetti li firma.** Ogni costruttore marca il proprio gruppo con
`group.userData.placeId = '<id>'`. È la riga che rende possibile sia la selezione col mouse sia lo
spostamento a caldo, senza che l'editor conosca il codice dei moduli.

**4. La modalità modifica.** Un tasto (proposta: **F2**, e una voce nel menu ☰) accende la modalità:
il mouse-look si ferma, il puntatore torna, e gli oggetti spostabili prendono un contorno quando ci
passi sopra. Trascini → l'oggetto segue il piano con lo **scatto a 25 cm**; `R`/`Maiusc+R` lo ruota a
scatti di 15°; `Canc` lo cancella (sparisce, e il salvataggio lo ricorda); `Ctrl+Z` annulla l'ultima
mossa. Esc, la ✕ o di nuovo il tasto chiudono e ti rimettono dritto in mouse-look.

**5. Il pannello.** Una finestra a lato con la lista degli oggetti: nome, `x`, `z`, `rotY` in campi
numerici per chi vuole la precisione, una ✕ per cancellare, un interruttore per rimettere a posto la
base, e i pulsanti **Salva** e **Annulla**. Salva scrive il file sul server; annulla ricarica la
disposizione salvata. La finestra segue le regole di casa: ✕ in alto a destra, Esc chiude e ti
rimette in mouse-look.

**6. Il filo col server.** La disposizione è un campo della `FloorView` (come i worker e le lavagne):
arriva all'ingresso del piano e si aggiorna via WebSocket quando qualcun altro salva, così due
browser vedono la stessa stanza. Il salvataggio è un messaggio `layout.set` con l'elenco delle
modifiche, non un HTTP a parte: passa per la stessa rete delle altre cose.

## I pezzi, secondo le convenzioni del progetto

| Dove | Cosa |
| --- | --- |
| `src/shared/placement.ts` | gli id spostabili, la posizione di base, `place()` e la forma del file |
| `src/shared/protocol/layout.ts` | il messaggio `layout.set` e il campo della `FloorView` |
| `src/server/office/layout.ts` | il file per piano: lettura, scrittura, validazione |
| `src/server/ws/handlers/layout.ts` | il gestore di `layout.set` + una riga negli handler |
| `src/client/state/slices/layout.ts` | il campo nello store e l'ingresso in `SLICES` |
| `src/client/features/layout-editor/` | `index.ts` (tasto, attività e barra dei comandi), `carry.ts` (mira, presa, posa, giro, rimozione) |
| i costruttori degli arredi | una riga ciascuno: leggono `place()` e firmano il gruppo |

Nessuna modifica al centro di `main.ts`, `server.ts`, allo store o a `protocol.ts`: una riga per
lista, come vuole `docs/code-layout.md`. `tests/size.test.ts` resta verde (moduli piccoli).

## Verifica

- `npm run typecheck`, la suite intera, `npm run build`.
- Test nuovi: `tests/placement.test.ts` (base + sovrapposizione: spostare, cancellare, tornare alla
  base, un file illeggibile non rompe l'ufficio), e un test del gestore `layout.set` (scrive e
  rispedisce).
- Prova vera in browser: accendo la modalità, trascino il jukebox, salvo, ricarico la pagina e lo
  trovo dove l'ho lasciato; lo cancello e non torna; Esc mi rimette in mouse-look. Screenshot del
  prima/dopo.
- Prova del riavvio: riavvio il servizio e la disposizione salvata resta.

## Rischi e paletti

- **Il muro non è un vincolo ancora**: un oggetto trascinato può finire fuori dal pavimento o dentro
  un altro oggetto. Prima versione: lo limito al rettangolo della stanza e alla griglia; i vincoli
  fini (contro il muro, libero da ostacoli) li aggiungo dopo, se servono.
- **Le posizioni sono per piano**: cambiare piano non deve mescolare le disposizioni.
- **Un file scritto a mano rotto** non deve fare danni: si ignora la voce invalida e si tiene la base.
- Il file è stato di esecuzione, non progetto: sta in `.agent-office/`, che non entra né in git né nel
  sync.
