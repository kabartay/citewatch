/**
 * @file Checks `CITATION.cff` beyond what its schema can say: identifier checksums, dates, and
 * the DOI that ties the file to Zenodo.
 *
 * Types and structure are checked by the bundled Citation File Format schema through the YAML
 * extension. This module reads only the few scalars it needs, line by line, rather than shipping
 * a YAML parser: the extension has no runtime dependencies.
 */

import { bareDoi, orcidProblem } from './identifiers';
import type { Problem } from './types';

/** A top-level `key: value` scalar and its 0-based line. */
export interface CffScalar {
  readonly value: string;
  readonly line: number;
}

const unquote = (v: string) => v.trim().replace(/^(['"])(.*)\1$/, '$2');

/** Reads a top-level scalar (`version: 1.0.3`), ignoring a trailing comment. */
export function cffScalar(text: string, key: string): CffScalar | undefined {
  const lines = text.split('\n');
  const re = new RegExp(`^${key.replace(/[-]/g, '\\-')}:\\s*(.*?)\\s*(#.*)?$`);
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i] ?? '');
    if (m?.[1] !== undefined && m[1] !== '' && !m[1].startsWith('>') && !m[1].startsWith('|')) {
      return { value: unquote(m[1]), line: i };
    }
  }
  return undefined;
}

/** Every `orcid:` value in the file, wherever it is nested, with its line. */
export function cffOrcids(text: string): CffScalar[] {
  const out: CffScalar[] = [];
  text.split('\n').forEach((line, i) => {
    const m = /^\s*-?\s*orcid:\s*(.*?)\s*(#.*)?$/.exec(line);
    if (m?.[1]) {
      out.push({ value: unquote(m[1]), line: i });
    }
  });
  return out;
}

/**
 * The concept DOI the file declares: a `doi:` at the top level, else the first `value:` of an
 * `identifiers` entry of type `doi`.
 */
export function cffDoi(text: string): string | undefined {
  const top = cffScalar(text, 'doi');
  if (top) {
    return bareDoi(top.value);
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*-\s*type:\s*['"]?doi['"]?\s*$/.test(lines[i] ?? '')) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const m = /^\s*value:\s*(.*?)\s*$/.exec(lines[j] ?? '');
        if (m?.[1]) {
          return bareDoi(unquote(m[1]));
        }
      }
    }
  }
  return undefined;
}

/**
 * Problems in `CITATION.cff` that its schema does not catch.
 *
 * @param text - The file's contents.
 * @param today - `YYYY-MM-DD`, to catch a release date in the future.
 */
export function checkCitationCff(text: string, today: string): Problem[] {
  const out: Problem[] = [];
  if (!cffScalar(text, 'cff-version')) {
    out.push({ severity: 'error', code: 'cff.version-field', line: 0, message: '"cff-version" is missing; GitHub and Zenodo ignore a CITATION.cff without it. Use 1.2.0.' });
  }
  for (const key of ['title', 'message']) {
    if (!cffScalar(text, key) && !new RegExp(`^${key}:`, 'm').test(text)) {
      out.push({ severity: 'error', code: `cff.${key}`, line: 0, message: `"${key}" is missing; the Citation File Format requires it.` });
    }
  }
  if (!/^authors:/m.test(text)) {
    out.push({ severity: 'error', code: 'cff.authors', line: 0, message: '"authors" is missing; the Citation File Format requires at least one.' });
  }
  const released = cffScalar(text, 'date-released');
  if (released) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(released.value) || Number.isNaN(Date.parse(released.value))) {
      out.push({ severity: 'error', code: 'cff.date', line: released.line, message: `"date-released" must be a date as YYYY-MM-DD, quoted; got ${released.value}.` });
    } else if (released.value > today) {
      out.push({ severity: 'warning', code: 'cff.date-future', line: released.line, message: `"date-released" ${released.value} is in the future.` });
    }
  }
  const version = cffScalar(text, 'version');
  if (version && /^v\d/i.test(version.value)) {
    out.push({ severity: 'warning', code: 'cff.version-prefix', line: version.line, message: `Write the version as "${version.value.slice(1)}": the "v" belongs to the git tag.` });
  }
  for (const orcid of cffOrcids(text)) {
    const why = orcidProblem(orcid.value);
    if (why) {
      out.push({ severity: 'error', code: 'cff.orcid', line: orcid.line, message: why });
    } else if (!orcid.value.startsWith('https://orcid.org/')) {
      out.push({ severity: 'warning', code: 'cff.orcid-url', line: orcid.line, message: `The Citation File Format expects the ORCID as a URL: "https://orcid.org/${orcid.value}".` });
    }
  }
  const doi = cffScalar(text, 'doi');
  if (doi && !bareDoi(doi.value)) {
    out.push({ severity: 'error', code: 'cff.doi', line: doi.line, message: `"${doi.value}" is not a DOI; expected 10.xxxx/… .` });
  }
  return out;
}
