# Sessioni dei worker nella cartella OMP del progetto

**Data:** 2026-10-13

## Obiettivo

Ogni volta che si mette al lavoro un sotto-agente, la sua conversazione non deve più nascere in una
cartella-sessioni nuova (`…-worktrees-pixel-XXXX`): nel selettore di OMP quelle cartelle vengono
elencate insieme a quelle del progetto come "di un'altra cartella di lavoro", e dopo dodici
worktree non si distingue più cosa è di omnitrade. La sessione del worker deve stare **nella cartella
di OMP del progetto del piano** (es. `-raspnas-development-projects-web_apps-omnitrade`), come una
chat normale, senza portare nel nome né il worker né una persona.

Le conversazioni vecchie vanno portate lì, senza riscrivere niente dentro i file: i token di ognuna
devono restare contati.

## Decisioni

- Vale per i worker **OMP** (i piani girano con `--agent omp`); gli altri provider tengono le
  sessioni dove il loro CLI le tiene.
- Niente nomi di persone né prefissi nei percorsi o nei titoli: il titolo di una sessione resta
  quello che OMP le dà da sé.
- Il tabellone dei token continua a dividere **Agenti / Sotto-agenti per dove la sessione ha girato**
  (il `cwd` nel record `session` del file), non per dove è archiviata: così i numeri non cambiano
  significato quando le sessioni cambiano cartella.
- Non si fa il riuso della stessa chat con `/new` (una sola sessione per agente, svuotata a ogni
  spawn): decisione separata, non necessaria per togliere il disordine.

## Cosa cambia

1. **`src/server/omp-usage.ts`** — la regola con cui OMP nomina la cartella di un percorso
   (`ompSessionDirName`: relativa alla home, alla radice temporanea, o assoluta fra trattini) e
   `ompSessionDir(cwd, sessionsRoot)`; la lettura di dove ha girato una sessione (`sessionCwd(file)`,
   `firstSessionFile(dir)`, `sessionCwdIn(dir)`, logica oggi dentro `omp-spend.ts`); e
   `adoptOmpSessions({ dir, dataDir, sessionsRoot })`, che sposta nella cartella del progetto le
   sessioni lasciate nelle cartelle dei worktree (`.agent-office/worktrees/…`) e quelle rimaste in
   `<dataDir>/omp-sessions/<id>` di desk che non esistono più. Idempotente: salta le sessioni che
   `workers.json` nomina ancora (il worker può essere vivo), sposta `<stem>.jsonl` con la sua cartella
   di artefatti e sotto-agenti, e non tocca nient'altro.
2. **`src/server/providers/omp.ts`** — `prepare` esegue l'adozione una volta per piano e calcola la
   cartella del progetto; `launch` la passa a ogni run con `--session-dir`; sparisce il caso speciale
   della "cartella propria del desk" (`state.own`), e con esso la ricerca a due rami nell'uso.
3. **`src/server/providers/types.ts`** + **`src/server/workers/manager.ts`** — `ProviderFloor` porta
   anche `dir`, la cartella del piano (serve a nominare la sua cartella di sessioni).
4. **`src/server/omp-spend.ts`** — la classe di una sessione (agenti / sotto-agenti) si legge dal
   `cwd` **del file**, non da quello della cartella; la cartella resta il filtro di quali sessioni
   sono del progetto; un file dentro la cartella di un'altra sessione resta un sotto-agente, e
   l'advisor conta con la sessione per cui lavora.
5. **Documentazione**: `README.md`, `docs/how-it-works.md` e i commenti in `src/server/omp.ts`.

## Verifica

- `npm run typecheck`, i test toccati, `npm test`, `npm run build`.
- Test nuovi: la regola del nome della cartella; l'adozione (sposta, salta il worker vivo, è
  idempotente); il worker con worktree riceve `--session-dir` **della cartella del progetto**; un
  worker archiviato nella cartella del progetto conta ancora come sotto-agente.
- Riavvio dell'ufficio già in esecuzione (stessa istanza, porta 4600): l'adozione gira all'avvio, le
  cartelle `…-worktrees-*` di omnitrade restano vuote e le loro sessioni compaiono nella cartella di
  omnitrade. L'ufficio lo prova l'utente.

## Cosa resta aperto

- Il riuso di una sola sessione per agente con `/new` a ogni spawn (`src/server/workers/manager.ts`,
  slug del worktree, "mandare a casa"), se il numero di conversazioni nella lista darà ancora
  fastidio.
