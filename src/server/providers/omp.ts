// OMP: an extension the office writes and loads with --extension (see ../omp.ts), so the person's own
// OMP login, settings, packages and extensions stay as they are. It reports on /hooks/omp in the same
// statuses as OpenCode's plugin. Its sessions are OMP's own, in the person's OMP store: the conversation
// a desk starts is the one a terminal `omp --resume` opens, and its spend is read off the same session
// records `omp stats` sums (see omp-usage.ts) rather than metered separately by the office. Every worker
// is filed in the project's own folder there, whatever folder it works in, so a run in a worktree is
// still one of the project's own conversations rather than another working directory's; what the office
// left in the worktrees' folders before that is moved there as the floor starts (adoptOmpSessions).
import path from 'node:path';
import { normalizeOmpHook, ompArgs, writeOmpExtension, writeOmpOverlay } from '../omp.js';
import { stopIdleOmpBrowser } from '../omp-browser.js';
import { OmpUsageReader, adoptOmpSessions, ompAgentDir, ompSessionDir, ompSessionFile } from '../omp-usage.js';
import { reduceStatus, type StatusState } from './opencode.js';
import type { ProviderAdapter } from './types.js';

interface OmpSetup {
  /** The office's extension. */
  extension: string;
  /** The office's config overlay: a desk starts its own conversation, never the folder's last one. */
  overlay: string;
  /** The folder every one of the floor's workers is filed in: the project's own (see omp-usage.ts). */
  sessionDir: string;
}

interface OmpState extends StatusState {
  /** Its session records, followed as the file grows. */
  usage: OmpUsageReader;
  /** Where the person's OMP keeps its sessions, from the environment the worker starts in. */
  sessions?: string;
  /** The session file being read, and the session it belongs to. */
  file?: { id: string; path: string };
}

export const omp: ProviderAdapter<OmpState, OmpSetup> = {
  id: 'omp',
  createState: () => ({ usage: new OmpUsageReader() }),
  prepare: ({ dir, dataDir }) => {
    const sessionsRoot = path.join(ompAgentDir(dir, process.env), 'sessions');
    // What the office left in worktrees' own folders, before it filed them in the project's: once per
    // floor, and nothing to do the second time (see adoptOmpSessions).
    const adopted = adoptOmpSessions({ dir, dataDir, sessionsRoot });
    if (adopted) console.log(`agent-office: moved ${adopted} earlier OMP session${adopted === 1 ? '' : 's'} of this project's workers into its own folder`);
    return { extension: writeOmpExtension(dataDir), overlay: writeOmpOverlay(dataDir), sessionDir: ompSessionDir(dir, sessionsRoot) };
  },
  /**
   * A run of this provider's worker in `cwd` is over. OMP keeps a headless browser per folder and only
   * sweeps a hard-killed session's tabs the next time somebody opens the browser there, so the folder's
   * daemon goes with the worker — unless a session is still driving it (see omp-browser.ts).
   */
  exited(_h, cwd) {
    void stopIdleOmpBrowser(cwd);
  },
  launch({ h, args, prompt, resumeSessionId, setup }) {
    const { info, state } = h;
    state.file = undefined;
    state.error = false;
    // --session-dir files this desk's conversation in the project's own OMP folder, so it reads as one
    // of that project's sessions and not, as one folder per worktree did, as another working
    // directory's; --resume carries on this desk's own by id, and --config keeps OMP from opening the
    // folder's last one instead, which would be whatever was talked about last there.
    return { args: ompArgs(args, { extension: setup.extension, overlay: setup.overlay, sessionDir: setup.sessionDir, sessionId: resumeSessionId, model: info.model, effort: info.effort, prompt }), rotateToken: true };
  },
  bootHint: 'Open the terminal: complete OMP login or project setup',
  // Resuming a conversation OMP no longer has ("Session ... not found") exits before it ever starts.
  freshIfResumeFails: true,
  hook: {
    strictJson: true,
    handle(h, _event, payload) {
      const report = normalizeOmpHook(payload);
      // OMP is up once its extension reports, so the desk isn't stuck at start any more. A session
      // starting (a new one, or one resumed) leaves it ready for a prompt.
      return !!report && reduceStatus(h, report, {
        onReport: () => {
          h.bootBlocked = false;
          h.scheduleScan();
        },
        idleOnStart: true,
      });
    },
  },
  usage: {
    // Its numbers are what it reported, and they come off a file OMP owns: kept in workers.json,
    // read again when its process ends, and read from scratch after a restart (the totals are
    // replaced, never added to, so nothing is counted twice).
    persisted: true,
    scanOnExit: true,
    locate(h, cwd, env) {
      h.state.sessions = ompAgentDir(cwd, env);
    },
    scan(h) {
      const { info, state } = h;
      if (!info.sessionId) return;
      const root = state.sessions ? path.join(state.sessions, 'sessions') : undefined;
      if (!root) return;
      // Its conversation is filed in the project's own folder, under the id it is saved by.
      if (state.file?.id !== info.sessionId) {
        const found = ompSessionFile(root, info.sessionId);
        state.file = found ? { id: info.sessionId, path: found } : undefined;
      }
      const target = state.file?.path;
      if (!target) return;
      const usage = state.usage.read(target, root);
      if (usage && JSON.stringify(usage) !== JSON.stringify(info.usage)) {
        info.usage = usage;
        h.emit();
        h.persist();
      }
    },
  },
};
