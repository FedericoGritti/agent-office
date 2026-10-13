# agent-office

- This checkout is **our fork** of `AgentSystemLabs/agent-office`. That remote is upstream, maintained by other people, and we only have read access to it: never push there, never open a pull request there, never force anything against it. We keep and evolve **our own** version of the office.
- Our version lives on the `fork` remote, `FedericoGritti/agent-office`, and on this machine's `main`. Neither lines up with upstream: `origin/main` is missing work we already have, and `main` itself carries commits the fork hasn't got yet. So upstream is **not** a base to branch from — our work isn't there.
- Ship every code change as a PR branched from the tree we're working in (`main`), pushed to `fork`, with the PR opened against `fork`'s `main` — not `origin`. End with the PR URL instead of stopping at a local commit or asking first. Expect the PR to carry whatever `main` had not pushed to the fork yet.
- Upstream keeps moving: every so often, read what it changed that is worth having and bring it in on purpose — a reviewed merge or cherry-pick from `origin/main` into `main`, one change at a time. Never a blind sync, and never a fast-forward that throws our work away.
- The main checkout is shared with other live sessions and board agents, so do branch work in a worktree and never stash, reset or commit anyone else's changes there.
- Verify the code with `npm run typecheck`, `npm test` and `npm run build`; testing the office itself is the user's, never the agent's — no starting an instance, no browser, no playthrough to check your own change.
- **After every change, restart the office that is already running** — the same instance, never a second one and never another port (one office runs at a time, on 4600) — and hand it to the user to test.
- When a change affects how people run, deploy or use the office, update `README.md` and the matching `docs/*.md` page in the same PR.
- New features plug in through the registries as modules of their own (see `docs/code-layout.md`), never by adding their code to `main.ts`, `server.ts`, the state store, `protocol.ts` or another feature's files, and `tests/size.test.ts` must stay green.
- Every modal needs a top-right ✕, and closing it by ✕ or Esc must put the player straight back into mouse-look with no extra click.
- When asked to merge PRs (upstream's, or our fork's), merge only webdevcody's (anyone else's only when linked, after a security review), resolve conflicts so both sides survive, and squash-merge.
