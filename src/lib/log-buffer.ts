/**
 * In-memory ring buffer for bug reports (docs/04 §9, docs/09 §6). Errors route
 * through here so a user-initiated report carries context. Never transmitted
 * automatically; redaction strips home paths / emails before any export.
 */

export interface LogEntry {
  t: number;
  level: 'error' | 'warn';
  code?: string;
  msg: string;
}

const RING_MAX = 200;
const ring: LogEntry[] = [];

export function pushLog(entry: Omit<LogEntry, 't'>): void {
  ring.push({ t: Date.now(), ...entry });
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
}

export function getLog(): readonly LogEntry[] {
  return ring;
}

export function clearLog(): void {
  ring.length = 0;
}

/** Strip home paths and emails (docs/09 §6). Applied before any export. */
export function redact(s: string): string {
  return s
    .replace(/[A-Za-z]:\\Users\\[^\\/]+/g, '~')
    .replace(/\/(?:home|Users)\/[^/]+/g, '~')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
}
