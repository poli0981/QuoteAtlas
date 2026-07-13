import { beforeEach, describe, expect, it } from 'vitest';
import { clearLog, getLog, pushLog, redact } from './log-buffer';

beforeEach(() => {
  clearLog();
});

describe('log ring', () => {
  it('records entries with a timestamp', () => {
    pushLog({ level: 'error', code: 'E_X', msg: 'boom' });
    const log = getLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ level: 'error', code: 'E_X', msg: 'boom' });
    expect(typeof log[0]?.t).toBe('number');
  });

  it('evicts oldest beyond 200 entries', () => {
    for (let i = 0; i < 205; i++) pushLog({ level: 'warn', msg: `m${i}` });
    const log = getLog();
    expect(log).toHaveLength(200);
    expect(log[0]?.msg).toBe('m5');
    expect(log.at(-1)?.msg).toBe('m204');
  });
});

describe('redact', () => {
  it('masks Windows and POSIX home paths', () => {
    expect(redact('at C:\\Users\\Anon\\app')).toBe('at ~\\app');
    expect(redact('at /home/anon/app')).toBe('at ~/app');
    expect(redact('at /Users/anon/app')).toBe('at ~/app');
  });

  it('masks email addresses', () => {
    expect(redact('from k30021424@gmail.com now')).toBe('from <email> now');
  });
});
