# Coordinator boards — Agent Office

Legare i tre tabelloni a muro (oggi **Issues / PR / Task queue**, alimentati da
GitHub e dalla coda interna) alla **skill del coordinatore** (`skill://coordinator`),
che diventa l'unica cosa che li governa. Sul muro: **Checklist · Timeline di oggi ·
Sintesi di fase**, compatti; nella finestra al click il testo intero. Al posto dei
tre agenti di tabellone, **un solo Coordinatore**.

## Decisioni chiuse con l'utente

1. **Timeline** → nuovo file `plans/<phase>/timeline.md`, scritto dal coordinatore
   (una riga datata per evento). La **skill va aggiornata** perché lo produca.
2. **Muri** → Checklist · Timeline · Sintesi di fase: i tre muri che ci sono già
   cambiano ruolo, nessun muro in più né in meno.
3. **GitHub / queue** → restano nel codice **intatti**, ma **nessun muro li mostra**:
   l'office smette di usarli. Niente interruttore per-floor.

## Fonte di verità (cosa legge l'office)

Dalla cartella del floor (`floor.dir`), nel layout della skill:

| File | Cosa dà |
| --- | --- |
| `plans/current.md` | la fase attiva (`Current phase: <phase>`) |
| `plans/<phase>/masterplan.md` | `## Goal` e i capitoli (`### NN — <chapter>`, `- Core question:`) |
| `plans/<phase>/checklist.md` | la board: righe `In flight/Planned/Ready/Resume` + per capitolo `- [ ] <id> — <Status>` |
| `plans/<phase>/timeline.md` | la timeline (nuovo) |

**Formato di `timeline.md`** (lo definisce la skill, l'office lo segue): una riga
per evento, `- <ISO 8601 locale> — <testo breve>`. L'office mostra solo le righe
di **oggi**. Eventi tipici che il coordinatore vi appende: dispatch di un subplan,
verifica, integrazione, passaggio di fase, domanda all'utente.

## Lavoro

### Fase 1 — Lettura e stato

- `src/shared/protocol/coordinator.ts` **(nuovo)**: `SubplanStatus`
  (`Pending|Ready|Planned|In flight|Blocked|Done`), `SubplanCard`, `TimelineEvent`,
  `CoordinatorState` (`phase`, `goal`, `chapters`, `cards`, `summary`
  {inFlight, planned, ready, resume}, `timeline`, `error?`, `at`), e
  `CoordinatorServerMsg = { t: 'coordinator'; state }`.
- `src/shared/protocol.ts`: `import type` + `export *` del dominio e voce nell'unione
  `ServerMsg`.
- `src/shared/protocol/floors.ts`: `coordinator: CoordinatorState` fra i campi di
  `FloorView`.
- `src/server/coordinator.ts` **(nuovo)**: classe `Coordinator` per floor — legge
  `plans/` da `floor.dir` con un parser tollerante (markdown semplice), aggiorna su
  timer (~5 s) e su richiesta, emette `{ t: 'coordinator', state }`. File assente o
  illeggibile → `state.error`, mai crash.
- `src/shared/coordinator.ts` **(nuovo, puro)**: le funzioni di parsing
  (`parseCurrent`, `parseMasterplan`, `parseChecklist`, `parseTimeline`,
  `todayEvents`) senza import Node, così sono testabili da `tests/`.
- `src/server/floor.ts`: costruisce `new Coordinator(def.dir, (state) => ctx.emit(...))`
  accanto a `github`/`queue`; `shutdown()` ferma il timer.
- `src/server/ws/handlers/coordinator.ts` **(nuovo)** + riga in
  `src/server/ws/handlers/index.ts`: `views.coordinator = coordinatorView`; handler
  `coordinator.refresh`.
- `src/client/state/slices/coordinator.ts` **(nuovo)** + riga in coda a `SLICES`
  (`state/slices/index.ts`): campo `coordinator`, topic `'coordinator'`, `enter` dal
  floor, `on` per `coordinator`.

### Fase 2 — I tabelloni e la finestra

- `src/client/features/boards/coordinator.ts` **(nuovo)**: `ChecklistTexture`,
  `TimelineTexture`, `SummaryTexture` (canvas come `BoardTexture`/`QueueBoardTexture`).
  Sul muro **solo il corto**: id + stato (checklist), `HH:MM — testo` (timeline),
  nome fase + goal su 2–3 righe (sintesi). Il testo lungo **non** va sul muro.
- `src/client/features/boards/index.ts`: montare le tre texture nuove sui tre muri
  **al posto** di Issues/PR/queue. Redraw sui topic `'coordinator'`.
- `src/client/ui/coordinator.ts` **(nuovo)**: una finestra con le tre sezioni
  (Checklist / Timeline / Sintesi) dal `CoordinatorState`; ✕ in alto a destra e chiusura
  con Esc che **rimette subito in mouse-look** (regola di AGENT.md); aperta con **E** a
  qualunque dei tre muri (sostituisce `openBoard('issues'|'pulls'|'queue')`).
- `src/client/ui/help.ts`: riga in `HELP_ROWS`.
- CSS accanto al modulo (`ui/coordinator.css`, importato da lì).

### Fase 3 — Un solo desk: il Coordinatore

- `src/shared/layout.ts` (584 righe: **restare ≤ 600**):
  `StationKind` → `'coordinator'`; `STATIONS` → **una** voce
  `{ id: 'station-coordinator', station: 'coordinator', x: -7.8, z: FLOOR.minZ + 1.3, rotY: Math.PI }`
  (il kiosk centrale di oggi); `STATION_AGENT` → `{ coordinator: { name: 'Coordinator', color: '#9b5de5' } }`;
  `BOARDS` → etichette nuove: `📋 Checklist`, `🕓 Timeline`, `🎯 Fase`. `DESK_BY_ID`
  segue da sé.
- `src/shared/maps/{index,types}.ts`: `STATION_KINDS = ['coordinator']`; la richiesta
  `stations` accetta la sola `coordinator`; `MapConfig.stations:
  Record<StationKind, Place>` col solo membro.
- `src/shared/maps/{castle,station}.ts`: togliere `issues`/`pulls` da `stations`,
  tenere/aggiungere `coordinator`.
- `src/client/world/{office,castle,station}/seats.ts`: `KIOSK_SIGN`/`LECTERN_SIGN`/
  `CONSOLE_SIGN` → una sola voce `coordinator`; `kiosks` costruisce **un** kiosk.
- `src/shared/nav.ts`: gli ostacoli seguono `STATIONS` (già generico) — verificare.
- `src/client/core/stations.ts`: `STATION_INFO` → una voce `coordinator` (icona/offerta,
  es. "Chiedimi lo stato del piano").
- `src/shared/prompts.ts`: `station.issues/pulls/queue` → `station.coordinator`, il cui
  brief dice che **è** il coordinatore del progetto e deve leggere e seguire
  `skill://coordinator` (richiede un harness che risolva le skill — OMP). `JOB`/`BOARD`
  ridotti al solo `coordinator`.
- `src/server/stations.ts`: invariato (`stationBrief` segue `station.${kind}`).

### Fase 4 — GitHub / queue: restano solo nel codice

- Nessun muro li mostra: i tre tabelloni sono **sempre** Checklist · Timeline ·
  Sintesi. Niente interruttore per-floor.
- Il codice GitHub/queue (server `github.ts` / `queue.ts`, `ui/github/*`,
  `ui/queue.ts`, `bin/office-queue.js`, protocolli, texture `BoardTexture` /
  `QueueBoardTexture`) **non si tocca e non si cancella**: semplicemente l'office
  non lo monta più da nessuna parte.
- I `ctx.interactions.define('issues' | 'pulls' | 'queue', …)` legati ai muri si
  tolgono; al **E** sui muri risponde il Coordinatore (Fase 2).

### Fase 5 — La skill produce la timeline

File: `~/raspnas/system/personalization/llms/agents/tool_homes/omp/shared-agent/skills/coordinator/SKILL.md`.

- Aggiungere `timeline.md` fra gli **Artifacts**.
- Definirne il **formato** (`- <ISO 8601 locale> — <testo breve>`) e la regola
  "una riga per evento, in coda".
- Nel loop **Coordinate** e nel **Question protocol**: appendere una riga a
  dispatch, verifica, integrazione, `Done`, passaggio di fase e domanda all'utente.
- Aggiungerlo alla lista **Read** (l'office lo legge; il coordinatore lo mantiene).

### Fase 6 — Documentazione e verifica

- `README.md` e `docs/features.md` (le sezioni Issues board / PR board / Task queue
  / Board agents diventano Checklist / Timeline / Sintesi / Coordinatore, più il modo
  `github` per-floor).
- `docs/code-layout.md` se si aggiungono moduli.
- `tests/coordinator.test.ts` **(nuovo)**: parsing di `current.md`/`masterplan.md`/
  `checklist.md`/`timeline.md` (casi veri + file mancante/garabugliato).
- Adeguare i test che nominano le tre stazioni/agenti; `tests/size.test.ts` verde
  (nuovi file ≤ 600 righe; `layout.ts` non deve superare 600).

## Fuori scope

- GitHub/queue non si cancella (scelta B), ma non si usa più da nessuno.
- Il Coordinatore **non** implementa la coordinazione nell'office: l'office *mostra*
  `plans/`; a coordinare è l'agente (skill).
- Niente editing della board dall'office (write-ownership: solo il coordinatore scrive
  `checklist.md`) — i tabelloni sono **sola lettura**.

## Verifica

- `npm run typecheck`, `npm test`, `npm run build`.
- **Screenshot headless** (regola AGENT.md): un floor con `plans/` reali → i tre muri
  mostrano checklist/timeline/sintesi corti; E apre la finestra col testo intero; ✕/Esc
  tornano in mouse-look.
- Floor senza `plans/` → tabelloni vuoti + nota d'errore, nessun crash.

## Rischi / note

- **Lavoro su worktree + PR** da `origin/main`, come da AGENT.md; `README.md` e la
  pagina `docs/*.md` nella stessa PR; finire con l'URL della PR.
- Il parser markdown è la parte fragile: tollerante, e qualunque deviazione va mostrata
  come nota, non ingoiata.
- La Fase 5 è in **un altro repo** (config omp in raspnas): modifica diretta al file
  della skill, non una PR di agent_office.
