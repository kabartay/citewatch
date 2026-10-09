/**
 * @file Checks `.zenodo.json`, the file Zenodo's GitHub integration reads for each release.
 *
 * Zenodo fails quietly: a malformed deposit is accepted with HTTP 202, dropped while it is
 * processed, and listed as "received", so the release simply never gets a DOI. Every rule here
 * is one that has cost a DOI or would: a licence written `Apache-2.0` where Zenodo's vocabulary
 * wants `apache-2.0`, a missing required field, an ORCID with a typo.
 *
 * Zenodo's licence vocabulary is checked online by the application layer; this module checks
 * everything that needs no network.
 */

import { orcidProblem } from './identifiers';
import type { Problem } from './types';

/** Values Zenodo's deposit schema accepts. They change on a scale of years. */
export const UPLOAD_TYPES: ReadonlySet<string> = new Set([
  'publication', 'poster', 'presentation', 'dataset', 'image', 'video', 'software', 'lesson', 'physicalobject', 'other',
]);
export const ACCESS_RIGHTS: ReadonlySet<string> = new Set(['open', 'embargoed', 'restricted', 'closed']);

/** Fields without which Zenodo discards the deposit. */
export const REQUIRED = ['upload_type', 'title', 'description', 'creators', 'license', 'access_right'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The 0-based line of the `nth` occurrence of `"key":` in `text`, or 0.
 *
 * Deliberately simple: `.zenodo.json` is small and its keys are distinctive, so the textual
 * position is the right line in practice without a position-tracking JSON parser.
 */
export function lineOfKey(text: string, key: string, nth = 0): number {
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`, 'g');
  let match: RegExpExecArray | null;
  let seen = 0;
  while ((match = re.exec(text)) !== null) {
    if (seen++ === nth) {
      return text.slice(0, match.index).split('\n').length - 1;
    }
  }
  return 0;
}

/** Line of a JSON syntax error from Node's message (`… (line 5 column 3)` or `at position 120`). */
function syntaxErrorLine(text: string, message: string): number {
  const line = /line (\d+)/.exec(message);
  if (line?.[1]) {
    return Math.max(0, Number(line[1]) - 1);
  }
  const pos = /position (\d+)/.exec(message);
  return pos?.[1] ? text.slice(0, Number(pos[1])).split('\n').length - 1 : 0;
}

/** The licence id as written, for the online vocabulary check; `undefined` when absent. */
export function zenodoLicence(text: string): string | undefined {
  try {
    const data: unknown = JSON.parse(text);
    if (!isRecord(data)) {
      return undefined;
    }
    const licence = data.license;
    if (typeof licence === 'string') {
      return licence;
    }
    return isRecord(licence) && typeof licence.id === 'string' ? licence.id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every problem `.zenodo.json` has that can be found offline.
 *
 * @param text - The file's contents.
 */
export function checkZenodoJson(text: string): Problem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ severity: 'error', code: 'zenodo.json-syntax', line: syntaxErrorLine(text, message), message: `Not valid JSON: ${message}. Zenodo would discard the whole deposit.` }];
  }
  if (!isRecord(data)) {
    return [{ severity: 'error', code: 'zenodo.json-shape', line: 0, message: '.zenodo.json must be a JSON object.' }];
  }
  const out: Problem[] = [];
  const add = (severity: Problem['severity'], code: string, key: string, message: string, nth = 0) =>
    out.push({ severity, code, line: lineOfKey(text, key, nth), message });

  for (const key of REQUIRED) {
    if (data[key] === undefined || data[key] === '' || (Array.isArray(data[key]) && (data[key] as unknown[]).length === 0)) {
      out.push({ severity: 'error', code: 'zenodo.required', line: 0, message: `"${key}" is missing. Zenodo discards a deposit without it, and the release gets no DOI.` });
    }
  }
  if (typeof data.upload_type === 'string' && !UPLOAD_TYPES.has(data.upload_type)) {
    add('error', 'zenodo.upload-type', 'upload_type', `"${data.upload_type}" is not an upload type Zenodo accepts; for code use "software".`);
  }
  if (typeof data.access_right === 'string' && !ACCESS_RIGHTS.has(data.access_right)) {
    add('error', 'zenodo.access-right', 'access_right', `"${data.access_right}" is not an access right Zenodo accepts: open, embargoed, restricted or closed.`);
  }
  const licence = zenodoLicence(text);
  if (licence !== undefined && licence !== licence.toLowerCase()) {
    add('error', 'zenodo.license-case', 'license', `Zenodo's licence vocabulary is lowercase: write "${licence.toLowerCase()}", not "${licence}". A capitalised id is dropped silently and the release gets no DOI.`);
  }
  if (typeof data.version === 'string' && /^v\d/i.test(data.version)) {
    add('warning', 'zenodo.version-prefix', 'version', `Write the version as "${data.version.slice(1)}": the "v" belongs to the git tag, not the version, and Zenodo shows it as written.`);
  }
  if (data.creators !== undefined && !Array.isArray(data.creators)) {
    add('error', 'zenodo.creators-shape', 'creators', '"creators" must be a list of people.');
  }
  if (Array.isArray(data.creators)) {
    let orcids = 0;
    data.creators.forEach((creator, i) => {
      if (!isRecord(creator) || typeof creator.name !== 'string' || creator.name.trim() === '') {
        add('error', 'zenodo.creator-name', 'creators', `Creator ${i + 1} has no "name".`);
        return;
      }
      if (!creator.name.includes(',')) {
        add('warning', 'zenodo.creator-name-format', 'name', `Zenodo expects "Family, Given": "${creator.name}" will be read as one name.`, i);
      }
      if (typeof creator.orcid === 'string') {
        const why = orcidProblem(creator.orcid);
        if (why) {
          add('error', 'zenodo.orcid', 'orcid', why, orcids);
        }
        orcids++;
      }
    });
  }
  if (data.keywords !== undefined && !(Array.isArray(data.keywords) && data.keywords.every((k) => typeof k === 'string'))) {
    add('error', 'zenodo.keywords', 'keywords', '"keywords" must be a list of strings.');
  }
  return out;
}
