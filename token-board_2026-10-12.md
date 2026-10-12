# Tabellone dei token al posto di quello dei Services

**Data:** 2026-10-12

## Obiettivo

Il tabellone sul muro vicino al lounge mostrava i server web dei worker. Voglio che mostri
**quanto ha speso il progetto in OMP**: i token di oggi accanto a quelli di sempre, divisi
tra **agenti**, **sotto-agenti** e **advisor**, e per provider. I numeri vengono dai record
di sessione di OMP — gli stessi che somma `omp stats` — quindi non c'è niente di stimato.
La finestra **🌐 Services** resta dov'è: nel menu **☰** e nella palette dei comandi.

## Decisioni prese con l'utente

- Si cambia **solo il muro**: la finestra Services resta raggiungibile dal menu.
- **Oggi in evidenza, totale sotto**.
- Il dollaro è l'**equivalente API** (quello che avresti pagato a listino), non la spesa
  reale: ChatGPT è a piano fisso, DeepSeek a consumo. Il tabellone lo dichiara.
- **Agenti, sotto-agenti e advisor su righe distinte**.
- **Niente aggiornamento a tempo**: un **bottone 🔄** sul tabellone legge i record quando lo
  premi.
- **Regola di conteggio (A)**: una sessione conta quando la sua cartella è il progetto o
  qualcosa sotto di esso — quindi contano i worktree dei worker, che stanno in
  `<progetto>/.agent-office/worktrees/`.

## Perché si può fare senza indovinare (indagine)

- OMP archivia una sessione per cartella di lavoro, e i **sotto-agenti dentro la cartella
  del genitore**, in una sottocartella intitolata alla sessione; l'advisor è un file
  `__advisor…` lì dentro. Quindi: livello 1 = agente, livello 2 = sotto-agente o advisor.
  (Verificato in `~/.omp/stats.db`, tabella `messages`: `agent_type` = main/subagent/advisor,
  e la profondità del file combacia.)
- I worker dell'office girano in un worktree dentro il progetto (`manager.ts`: `cwd =
  projectDir + workspace`), quindi una regola per **prefisso di path** li prende tutti.
- `omp stats -j` da solo copre solo una finestra recente (~24h): per il totale non basta.
  I record di sessione invece hanno tutto, con `timestamp`, token e `cost.total`.

## Progetto

- `src/shared/protocol/spend.ts` **(nuovo)**: `SpendNumbers`, `SpendWindow`, `SpendState`,
  i messaggi `spend.refresh` / `spend`, e lo stato vuoto.
- `src/server/omp-spend.ts` **(nuovo)**: legge i record di sessione del progetto (e dei suoi
  worktree) in modo **incrementale** — prima lettura 3 s su ~163 MB, poi solo la coda — e li
  somma per giorno, tipo di agente e provider.
- `src/server/omp-usage.ts`: `recorded()` riporta anche `provider` e il tempo del record; i
  numeri dei worker non cambiano.
- `src/server/ws/handlers/spend.ts` **(nuovo)**: la vista `spend` e l'handler del refresh.
- `src/server/floor.ts`: la floor ha il suo `OmpSpend`; la prima lettura parte fuori dal
  percorso di avvio.
- `src/client/features/boards/spend.ts` **(nuovo)**: il tabellone, il bottone 🔄,
  `refreshAt(uv)` e l'hover.
- `src/client/features/boards/index.ts`: la texture della spesa sullo slot del muro; la
  classe `ServicesBoardTexture` (ormai morta) è tolta da `world.ts`.
- `src/client/input/pointer.ts`: il click sul bottone (mirino o mouse) manda `spend.refresh`.
- `src/client/ui/spend.ts` + `spend.css` **(nuovi)**: la finestra che apre **E**.
- `src/client/state/slices/spend.ts` **(nuovo)**: la slice dello store.
- Etichette dei muri (`layout.ts`, `maps/*`) e voce di palette: da Services a 🪙 Token.
- Documenti: `README.md`, `docs/features.md`, `docs/how-it-works.md`; altrove "Services
  board" diventa "Services window".

## Verifica

- `npm run typecheck`, `npm test` (625 test, incluso quello nuovo sulla regola di conteggio),
  `npm run build`.
- Controllo sui dati veri del progetto omnitrade: oggi 80,7M token / ≈ $0,74 / 436 richieste;
  totale 844M token / ≈ $129,32 / 6617 richieste, di cui 6001 agenti, 9 sotto-agenti e 607
  advisor. Seconda lettura in 15 ms.

## Consegna

Branch `feat/token-board`, PR sul fork `FedericoGritti/agent-office` (base `main`); unito
anche nel `main` locale e servizio dell'office riavviato su z13.
