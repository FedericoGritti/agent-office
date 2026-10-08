// The headless browser OMP keeps for a folder, and letting it go when the folder's workers are gone.
//
// OMP runs one project-shared Chromium per folder it is used in — a daemon of the person's OMP hub
// ("omp.browser.headless", started and stopped over that hub's broker socket). Every session's tabs
// live inside it. A session closes its own tabs as it goes, and OMP sweeps orphans whose owner died —
// but only the next time some session opens the browser in that folder, which may never come. A worker
// the office stops is torn down hard, so its tabs (and every earlier session's) can sit in the daemon
// holding GPU memory forever.
//
// So when one of the office's runs in a folder is over, the office stops that folder's browser daemon
// itself: the process and whatever tabs it still held go with it, and the next worker starts it again
// on demand. Only when nothing is driving it — a live DevTools connection means a session is using its
// tabs, and those are left alone.
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** Where OMP's hub keeps the daemons it starts, one folder of them per project directory. */
const DAEMONS = path.join(os.homedir(), '.omp', 'run', 'daemons');
/** How long the hub has to answer, and a daemon to stop once asked. */
const HUB_TIMEOUT_MS = 3000;
const STOP_TIMEOUT_MS = 5000;
/** The daemons OMP starts for a folder: one per browser mode (headless, or a visible window). */
const BROWSER_PREFIX = 'omp.browser.';

/** The slice of a hub daemon this needs: what it is, and how to reach the DevTools it announced. */
interface Daemon {
  name?: string;
  state?: string;
  readyMatch?: string;
}

/** What a hub request comes back with, read loosely: only `daemons` and `ok`/`error` are used. */
interface HubAnswer {
  daemons?: Daemon[];
}

/**
 * Stops the OMP browser daemon of `cwd`, when a DevTools client isn't driving it. Never throws:
 * a hub, a daemon or a `/proc` that isn't there is housekeeping that simply doesn't happen.
 */
export async function stopIdleOmpBrowser(cwd: string): Promise<void> {
  try {
    const dir = hubDir(cwd);
    if (!dir) return;
    const sock = path.join(dir, 'broker.sock');
    const token = path.join(dir, 'broker.token');
    if (!existsSync(sock) || !existsSync(token)) return;
    const hub = await connectHub(sock, readFileSync(token, 'utf8').trim());
    try {
      const { daemons } = await hub.request({ op: 'list' });
      for (const daemon of daemons ?? []) {
        if (daemon.name?.startsWith(BROWSER_PREFIX) !== true || daemon.state !== 'ready') continue;
        if (hasLiveClient(daemon.readyMatch)) continue;
        await hub.request({ op: 'stop', name: daemon.name, timeoutMs: STOP_TIMEOUT_MS });
      }
    } finally {
      hub.close();
    }
  } catch {
    // Housekeeping: the office works the same whether or not it happens.
  }
}

/** The hub's own folder for the project directory `cwd`, found by the scope the hub wrote there. */
function hubDir(cwd: string): string | undefined {
  let real: string;
  try {
    real = realpathSync(cwd);
  } catch {
    return undefined;
  }
  let entries: string[];
  try {
    entries = readdirSync(DAEMONS);
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    try {
      const scope = JSON.parse(readFileSync(path.join(DAEMONS, entry, 'scope.json'), 'utf8')) as { projectDir?: unknown };
      if (typeof scope.projectDir === 'string' && realpathSync(scope.projectDir) === real) return path.join(DAEMONS, entry);
    } catch {
      // No scope here: a global or worker broker, not this folder's hub.
    }
  }
  return undefined;
}

/**
 * Whether a session is driving the daemon: the DevTools port it announced has an established
 * connection. Kept conservative — where the socket tables can't be read (`/proc` is Linux only)
 * the daemon counts as in use, so it is left running rather than stopped out from under someone.
 */
function hasLiveClient(readyMatch: string | undefined): boolean {
  const port = readyMatch?.match(/ws:\/\/\S+:(\d+)\//)?.[1];
  if (!port) return false;
  const hex = Number(port).toString(16).toUpperCase().padStart(4, '0');
  let read = false;
  for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
    let text: string;
    try {
      text = readFileSync(table, 'utf8');
    } catch {
      continue; // not this platform's table
    }
    read = true;
    for (const line of text.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      // sl local_address rem_address st ...: st 01 is ESTABLISHED, and either end may be the daemon.
      if (cols.length < 4 || cols[3] !== '01') continue;
      if (cols[1].endsWith(`:${hex}`) || cols[2].endsWith(`:${hex}`)) return true;
    }
  }
  return read ? false : true;
}

interface Hub {
  request(operation: Record<string, unknown>): Promise<HubAnswer>;
  close(): void;
}

/** Speaks the hub's broker protocol: one line of JSON per request, one line back, matched by id. */
function connectHub(sockPath: string, token: string): Promise<Hub> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(sockPath);
    const pending = new Map<string, { resolve: (answer: HubAnswer) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
    let buffer = '';
    let nextId = 0;
    const drop = (error: Error) => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(error);
      }
      pending.clear();
    };
    sock.setEncoding('utf8');
    sock.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as { id?: string; ok?: boolean; error?: string; result?: HubAnswer };
          const p = msg.id ? pending.get(msg.id) : undefined;
          if (!p || !msg.id) continue;
          pending.delete(msg.id);
          clearTimeout(p.timer);
          if (msg.ok === false) p.reject(new Error(msg.error ?? 'hub refused'));
          else p.resolve(msg.result ?? {});
        } catch {
          // Not a line this understands: the hub also pushes daemon output.
        }
      }
    });
    sock.on('error', (error) => {
      drop(error);
      reject(error);
    });
    sock.on('close', () => drop(new Error('the hub closed the connection')));
    sock.on('connect', () =>
      resolve({
        request(operation) {
          const id = `office-${++nextId}`;
          return new Promise<HubAnswer>((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error('the hub took too long to answer'));
            }, HUB_TIMEOUT_MS);
            pending.set(id, { resolve: res, reject: rej, timer });
            sock.write(`${JSON.stringify({ id, token, operation })}\n`);
          });
        },
        close() {
          sock.end();
        },
      }),
    );
  });
}
