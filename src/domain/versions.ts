/**
 * @file Reads the version each file states and finds the ones that disagree.
 *
 * Every release bumps the version in up to four places. Missing one means the archived record
 * says one version and the package another, which nothing else notices.
 */

import { cffScalar } from './citationCff';
import { lineOfKey } from './zenodoJson';
import type { Problem, VersionFile, VersionSource } from './types';

/** The order of authority: the package manifest is what users install. */
export const VERSION_FILES: readonly VersionFile[] = ['package.json', 'pyproject.toml', 'CITATION.cff', '.zenodo.json'];

/** The version a file states, or `undefined` when it states none. */
export function readVersion(file: VersionFile, text: string): VersionSource | undefined {
  switch (file) {
    case 'package.json':
    case '.zenodo.json': {
      try {
        const data: unknown = JSON.parse(text);
        const version = typeof data === 'object' && data !== null ? (data as { version?: unknown }).version : undefined;
        return typeof version === 'string' ? { file, version, line: lineOfKey(text, 'version') } : undefined;
      } catch {
        return undefined;
      }
    }
    case 'CITATION.cff': {
      const v = cffScalar(text, 'version');
      return v ? { file, version: v.value, line: v.line } : undefined;
    }
    case 'pyproject.toml': {
      // `version = "1.2.3"` inside [project] (or [tool.poetry]); a dynamic version states none.
      const lines = text.split('\n');
      let section = '';
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] ?? '').trim();
        const header = /^\[([^\]]+)\]$/.exec(line);
        if (header?.[1]) {
          section = header[1];
          continue;
        }
        const m = /^version\s*=\s*["']([^"']+)["']/.exec(line);
        if (m?.[1] && (section === 'project' || section === 'tool.poetry')) {
          return { file, version: m[1], line: i };
        }
      }
      return undefined;
    }
  }
}

/** Compares versions loosely: a leading `v` is ignored, so `v1.0` and `1.0` agree. */
const normal = (v: string) => v.trim().replace(/^v/i, '');

/**
 * The version the files should all state: the first in {@link VERSION_FILES} order.
 */
export function referenceVersion(sources: readonly VersionSource[]): VersionSource | undefined {
  return VERSION_FILES.map((f) => sources.find((s) => s.file === f)).find((s) => s !== undefined);
}

/**
 * For each file, the problem of disagreeing with the reference version.
 *
 * @returns Problems keyed by file; files that agree, or the reference itself, have none.
 */
export function versionMismatches(sources: readonly VersionSource[]): Map<VersionFile, Problem> {
  const out = new Map<VersionFile, Problem>();
  const reference = referenceVersion(sources);
  if (!reference) {
    return out;
  }
  for (const s of sources) {
    if (s.file !== reference.file && normal(s.version) !== normal(reference.version)) {
      out.set(s.file, {
        severity: 'warning',
        code: 'version.mismatch',
        line: s.line,
        message: `Version ${s.version} here, but ${reference.file} says ${reference.version}. The archived record would carry the wrong version; run "Citewatch: Set Version Everywhere".`,
      });
    }
  }
  return out;
}

/**
 * The file's text with its version replaced, or `undefined` when it states none.
 * Only the version's own line changes, so formatting and comments survive.
 */
export function withVersion(file: VersionFile, text: string, version: string): string | undefined {
  const source = readVersion(file, text);
  if (!source) {
    return undefined;
  }
  const lines = text.split('\n');
  const line = lines[source.line] ?? '';
  const at = line.lastIndexOf(source.version);
  if (at < 0) {
    return undefined;
  }
  lines[source.line] = line.slice(0, at) + version + line.slice(at + source.version.length);
  return lines.join('\n');
}
