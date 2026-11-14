// Hard rule 1: wall and gym names are data. They may appear only in src/data/ and test fixtures.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import seed from './data/seed.json';

const SRC = join(import.meta.dirname, '.');
const ALLOWED_DIRS = ['data', '__fixtures__', 'fixtures'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return ALLOWED_DIRS.includes(name) ? [] : sourceFiles(full);
    return /\.(ts|tsx|js|jsx|css|html|json)$/.test(name) ? [full] : [];
  });
}

const names = [...new Set([...seed.gyms.map((g) => g.name), ...seed.walls.map((w) => w.name)])];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = names.map((n) => ({ n, re: new RegExp(`(?<![\\w])${escape(n).replace(/ /g, '\\s+')}(?![\\w])`, 'i') }));

describe('no hard-coded wall or gym names', () => {
  it('has names to check', () => {
    expect(names.length).toBeGreaterThan(10);
  });

  it('finds no seeded name in src/ outside src/data and fixtures', () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const { n, re } of patterns) {
        if (re.test(text)) hits.push(`${relative(SRC, file).split(sep).join('/')}: "${n}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('also catches a planted name (self-test)', () => {
    for (const { n, re } of patterns) {
      expect(re.test(`const x = '${n.toUpperCase()}';`)).toBe(true);
      expect(re.test(`x${n}y`)).toBe(false);
    }
  });
});
