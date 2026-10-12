# Le finestre dell'ufficio: metterne di nuove e spostarle dal gioco

## Cosa risolve

Oggi le finestre sono una costante scritta a mano, `WINDOWS` in `src/shared/layout.ts`: dieci fori nei
muri esterni, con i loro vetri, e li leggono tutti — il guscio che costruisce i muri, la torre che da
fuori mostra i piani che non sono il tuo, le luci di Halloween sui davanzali, i suoni della strada, il
cartello sopra la scala. Per aggiungerne una, o per spostarla di un metro, servono una modifica, una
compilazione e un riavvio: esattamente il problema che l'editor dell'ufficio ha già risolto per i
mobili.

L'obiettivo è che le finestre diventino dati come i mobili. In modalità modifica (**F2**) guardi una
finestra, la prendi con **E**, la porti dove guardi **sul muro**, la metti giù e viene salvata; con
**N** ne metti una nuova nel muro che stai guardando; **Canc** la toglie e resta il muro; **Esc** la
rimette dov'era. Nessuna richiesta a un agente per ogni ritocco.

## Le decisioni (e perché)

**Una disposizione per tutto l'edificio, non una per piano.** La stanza è una sola: `buildOffice()`
la costruisce una volta (`src/client/core/scene.ts`) e ogni piano è quella stessa stanza, e la torre
disegna gli *altri* piani con la stessa lista di finestre. Una disposizione per piano vorrebbe dire
vedere gli altri piani con le finestre del piano dove sei: una bugia che si vede dal balcone. Quindi
un file solo, `.agent-office/windows.json` nella cartella dell'ufficio (`cfg.dataDir`, dove stanno
`floors.json` e `sky-place.json`), non il `layout.json` di ogni progetto, che è per piano e per i
mobili.

**Solo i muri esterni che danno fuori.** Fuori resta il muro nord, dove si apre il retro-ufficio (la
sua baia ha finestre sue, `wingWindows`), e i muri interni: una finestra è un buco verso l'esterno, e
altrove non c'è niente da vedere.

**In questo giro le dimensioni non si cambiano.** Una finestra nuova nasce della misura della sua
parete (ufficio: 3 m, da 1,1 a 3,3 sopra il pavimento; soppalco: 2,4 m o 1,8 m, da 0,9 a 2,5 sopra il
soppalco), e spostandola porta con sé la sua misura e la sua altezza: si scivola lungo il muro, non si
allarga. Larghezza e altezza regolabili sono due gesti in più sullo stesso meccanismo, quando
serviranno.

**Le finestre non si sovrappongono**: né fra loro — fra due ci vuole un pilastro, come dice il commit
che ha portato il soppalco a quattro finestre — né alle porte (uscita, porta del balcone), e tengono
un margine dagli angoli e dal solaio del soppalco.

## Come funziona

**1. Le finestre hanno un nome.** `WINDOWS` diventa `WINDOW_DEFS` in un modulo suo, `src/shared/windows.ts`:
le stesse dieci finestre di oggi, ognuna con un id (`window-south-1`, `window-west-2`, `loft-south-1`…),
il muro, la `u` lungo il muro, la larghezza e il davanzale e l'architrave. Il tipo `Opening` resta in
`layout.ts` (lo usano anche le porte e la baia del retro-ufficio) e `layout.ts` si alleggerisce: è a 599
righe su un tetto di 600, quindi la lista deve uscire da lì comunque.

**2. Il file, e la lista effettiva.** `src/shared/windows.ts` tiene le voci salvate e le applica alla
base, come fa `placement.ts` per i mobili: `{ "window-west-2": { "u": -6.5 }, "loft-south-1": { "deleted": true },
"window-11": { "wall": "east", "u": 7.5, "width": 3, "y0": 1.1, "y1": 3.3 } }` — solo le differenze dalla base;
una finestra nuova è una voce intera con un id nuovo. `windows()` restituisce la lista effettiva (base meno
cancellate, con le spostate al posto loro, più le nuove), `changeWindow(id, base, at)` scrive cosa è
cambiato, `sanitizeWindows(file)` scarta le voci storte una per una e tiene la base per quelle, e
`windowFits(list, candidate)` dice se un foro ci sta: dentro il muro con il margine, senza toccare
un'altra finestra, una porta o il solaio del soppalco.

**3. Il muro si ricostruisce.** Il muro è geometria, non un gruppo che si sposta: quando una finestra
cambia, il guscio si smonta e si rifà. La fixture `walls` (`src/client/world/office/shell.ts`) si
annota quello che ha costruito — i pezzi di muro, i telai, i vetri, il vetro bagnato della pioggia, i
colliders che ha messo e i segni «qui c'è una finestra» che le cornici dei quadri leggono
(`office.fixtures()`, vedi `features/hanging/controller.ts`) — e su `windowsChanged()` li toglie e
ricostruisce dalla lista effettiva. Perché i segni si possano togliere, `site.wall(...)` restituisce il
rettangolo che ha messo. La torre si rifà con lo stesso `setLevel` che usa il cambio piano (i suoi
materiali notturni restano quelli, non si duplicano).

**4. I gesti.** In F2 la finestra che guardi si accende come i mobili: il raggio che colpisce un pezzo
di muro (`userData.wall` c'è già) dice quale muro e dove. **E** la prende; mentre la porti segue il
punto in cui guardi sul muro, con lo scatto a 25 cm come i mobili, e può passare da un muro esterno a
un altro; **E** la posa e salva; **Esc** la rimette dov'era; **Canc** la toglie. **N** mette una
finestra nuova nel muro che guardi, dove guardi, e te la mette in mano. Se il posto non va bene, il
cartello in alto dice perché (fuori dal muro, addosso a un'altra finestra, nella porta). Il cartello e
la barra dei tasti (`features/layout-editor/banner.ts` e `index.ts`) dicono i tasti nuovi.

**5. Il filo col server.** `windows.set` dal browser; il server scrive `windows.json` e rispedisce
`windows` a tutti (come fanno `sky` e `theme`, che sono uguali per ogni piano), e la stessa lista è un
campo della `welcome`, così chi entra la trova già. In lettura passa da `sanitizeWindows`, come un file
scritto a mano.

**6. Chi legge le finestre legge la lista effettiva**, mai la costante: i suoni della strada
(`sound/places.ts`), le luci sui davanzali (`world/holiday.ts`), l'altezza del cartello sopra la scala
(`world/stack.ts`), la torre (`world/tower.ts`) e i segni per i quadri.

## I pezzi, secondo le convenzioni del progetto

| Dove | Cosa |
| --- | --- |
| `src/shared/windows.ts` **(nuovo)** | `WINDOW_DEFS` con gli id, la lista effettiva `windows()`, `changeWindow()`, `sanitizeWindows()`, `windowFits()` |
| `src/shared/layout.ts` | `WINDOWS` esce di qui (e `Opening` resta) |
| `src/shared/protocol/windows.ts` **(nuovo)** | `windows.set` e il messaggio `windows` |
| `src/shared/protocol/presence.ts` | il campo `windows` nella `welcome` |
| `src/server/windows.ts` **(nuovo)** | `.agent-office/windows.json`: lettura, scrittura, validazione |
| `src/server/ws/handlers/windows.ts` **(nuovo)** | il gestore di `windows.set` + una riga negli handler |
| `src/client/state/slices/windows.ts` **(nuovo)** | il campo nello store e l'ingresso in `SLICES` |
| `src/client/world/office/shell.ts` | la fixture che si smonta e si rifà (`windowsChanged()`), e `site.wall()` che restituisce il segno |
| `src/client/world/office/fixture.ts` | `wall(...)` restituisce il rettangolo |
| `src/client/features/layout-editor/windows.ts` **(nuovo)** | la mira sul muro, la presa, la posa, la finestra nuova, la rimozione |
| `src/client/features/layout-editor/index.ts` | due righe: il tasto **N**, il cartello e la barra dei tasti |
| i lettori | una riga ciascuno: suoni, luci di Halloween, cartello della scala, torre |
| `docs/controls.md`, `docs/features.md`, `docs/room.md`, `README.md`, `docs/how-it-works.md` | i tasti e le finestre come dati |

Nessuna modifica al centro di `main.ts`, `server.ts`, allo store o a `protocol.ts`: una riga per lista,
come vuole `docs/code-layout.md`. `tests/size.test.ts` resta verde (moduli piccoli).

## Verifica

- Test nuovi, `tests/windows.test.ts`: la base e la sovrapposizione — spostare, aggiungere, cancellare,
  tornare alla base, un file illeggibile che non fa danni — e la regola «ci sta»: due finestre addosso,
  una dentro la porta, una fuori dal muro, una che scavalca il solaio del soppalco.
- Un test del guscio, senza browser: costruire i muri con una finestra spostata e verificare che il
  foro e i colliders siano dove dice il file (come `tests/placed.test.ts` fa con i mobili).
- `npm run typecheck`, la suite intera, `npm run build`.
- Prova vera dell'occhio: il laboratorio (`src/client/lab`) mette in scena i muri esterni con una
  disposizione scritta a mano, e `node src/client/lab/shot.mjs` ne fa uno screenshot headless
  (prima/dopo). Poi la prova nell'ufficio vero col server di sviluppo: F2, sposto una finestra, salvo,
  ricarico e la trovo dove l'ho lasciata; ne metto una nuova; ne cancello una e resta il muro; dalla
  finestra e dal balcone si vede la stessa disposizione sull'edificio.
- Prova del riavvio: riavvio il servizio e la disposizione salvata resta.

## Rischi e paletti

- **Il pezzo delicato è la ricostruzione.** Un collider o un segno lasciato indietro è un muro
  invisibile o un quadro appeso sopra una finestra: va smontato esattamente quello che è stato
  costruito, e il test lo pinna.
- **La disposizione è di tutti**: due browser vedono le stesse finestre, e chi entra dopo le trova già.
- **Un file scritto a mano rotto** non deve fare danni: voce per voce, si ignora e resta la base.
- **Vale per tutto l'edificio**: spostare una finestra la sposta su ogni piano e nella torre. È voluto,
  ma va detto nella documentazione.
- Il file è stato di esecuzione, non progetto: sta in `.agent-office/`, che non entra né in git né nel
  sync.

## Consegna

Una PR dal ramo `main` in un worktree, verso `fork/main`, con la URL alla fine.
