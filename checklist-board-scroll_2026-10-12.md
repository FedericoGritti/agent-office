# Frecce sul tabellone della checklist

**Data:** 2026-10-12

## Obiettivo

Il tabellone **📋 Checklist** sul muro oggi mostra solo i primi 12 subplan e getta il
resto via (`+N more`): i completati restano al loro posto e i subplan oltre il
dodicesimo non si vedono. Voglio due frecce **▲ / ▼** in fondo al tabellone, cliccabili
col mouse, che spostano l'elenco **una riga alla volta**. La posizione è **condivisa per
piano** (tutti gli utenti nella stanza vedono le stesse righe) e **salvata su disco**, così
resta anche dopo un riavvio dell'office. Se i subplan sono 12 o meno, niente frecce: il
tabellone resta com'è oggi.

## Decisioni prese con l'utente

- Le frecce stanno **sul tabellone**, non solo nella finestra aperta con **E**.
- Si cliccano **col mouse** sul muro (terza persona), e anche col mirino in prima persona.
- Posizione **condivisa e salvata** (opzione 1), non solo nel browser.

## Progetto

### Stato (dominio)

- `CoordinatorState` acquista `row: number`: l'indice del primo subplan mostrato dal
  tabellone (0 = in cima), default 0.
- Costanti pure in `src/shared/coordinator.ts`: `CHECKLIST_ROWS = 12` (righe visibili) e
  `clampRow(row, total, rows=12)` (mai prima della prima riga, mai oltre l'ultima finestra
  piena).

### Server (posizione per piano, su disco)

- `src/server/coordinator.ts`: il `Coordinator` tiene `row`, la carica da
  `<dataDir>/coordinator.json` (`{ row }`) e la salva a ogni spostamento.
  - `scroll(by)`: sanitizza a ±1, clampa, salva, riemette lo stato al piano.
  - `poll()`: dopo aver riletto i file, clampa `row` sul nuovo numero di card e la include
    nello stato emesso; il confronto "è cambiato qualcosa?" ignora `row`/`at`, così un solo
    spostamento non viene ingoiato né replicato.
- `src/server/floor.ts`: passare `dataDir` al costruttore del `Coordinator`.

### Protocollo

- `CoordinatorState` acquista `row` (`src/shared/protocol/coordinator.ts`).
- Nuovo messaggio client → server `{ t: 'coordinator.scroll'; by: number }`.
- Handler `coordinator.scroll` in `src/server/ws/handlers/coordinator.ts`.

### Client (tabellone e click)

- `src/client/features/boards/coordinator.ts`:
  - `drawChecklist` mostra `cards.slice(row, row + CHECKLIST_ROWS)`; se le card superano
    `CHECKLIST_ROWS` riserva una striscia in fondo con due pulsanti **▲ / ▼** e la scritta
    `a–b of N`; il pulsante senza righe da mostrare resta disegnato ma spento.
  - `arrowAt(uv)`: da uv a pixel del canvas, restituisce `'up' | 'down' | null`.
  - `hover(arrow)`: illumina la freccia sotto il mouse (ridisegno solo quando cambia).
- `src/client/features/boards/index.ts`: esporre `checklistTex`.
- `src/client/input/pointer.ts`: dal mirino (prima persona) o dal mouse (terza), riconosce
  la freccia sotto l'aim e manda `coordinator.scroll`; l'aim tick aggiorna l'hover.

### Documenti

- `README.md`, `docs/features.md`, `docs/how-it-works.md`: una riga sulle frecce.

## Verifica

- `npm run typecheck`, `npm test`, `npm run build`.
- Nuovo test in `tests/coordinator.test.ts`: `scroll` si ferma ai due estremi (non oltre
  `total - CHECKLIST_ROWS`, non sopra 0) e la posizione sopravvive a un nuovo `Coordinator`
  sullo stesso piano.
- Aggiornare `tests/client-store.test.ts` (i due letterali dello stato del coordinatore
  acquistano `row: 0`).
- **Screenshot headless** (regola AGENT.md): disegnare il tabellone con un piano reale di
  più di 12 subplan nel browser, a `row` 0 e a `row` > 0, e verificare che le frecce ci
  siano e che la finestra si sposti.

## Consegna

Il main locale è la base di lavoro; il remoto `origin` (AgentSystemLabs) è in sola lettura
per l'utente e non contiene nemmeno il tabellone-coordinatore, quindi la consegna resta sul
fork `FedericoGritti/agent-office`. Branch di lavoro: `feat/checklist-board-scroll`.
