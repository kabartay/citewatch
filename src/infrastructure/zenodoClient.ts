/**
 * @file Zenodo's public API: the licence vocabulary, a concept record's versions, and a title
 * search. No token: everything here is public.
 */

import type { ZenodoApi } from '../application/ports';
import { familyOf } from '../domain/creators';
import type { ZenodoVersion } from '../domain/types';
import { getJson, ZENODO, type Endpoint } from './http';

/** The largest page Zenodo serves without a token; a larger one is refused with HTTP 400. */
const PAGE_SIZE = 25;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Compares dotted versions numerically where it can, so 0.10.0 sorts after 0.9.0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.-]/);
  const pb = b.replace(/^v/i, '').split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? '';
    const y = pb[i] ?? '';
    const nx = Number(x);
    const ny = Number(y);
    const c = !Number.isNaN(nx) && !Number.isNaN(ny) && x !== '' && y !== '' ? nx - ny : x.localeCompare(y);
    if (c !== 0) {
      return c;
    }
  }
  return 0;
}

/** Parses a records search response into versions, newest first. */
export function parseVersions(body: unknown): ZenodoVersion[] {
  const hits = isRecord(body) && isRecord(body.hits) && Array.isArray(body.hits.hits) ? body.hits.hits : [];
  const out: ZenodoVersion[] = [];
  for (const h of hits) {
    if (!isRecord(h) || typeof h.doi !== 'string' || !isRecord(h.metadata)) {
      continue;
    }
    const version = typeof h.metadata.version === 'string' ? h.metadata.version : '';
    const published = typeof h.metadata.publication_date === 'string' ? h.metadata.publication_date : '';
    out.push({ version, doi: h.doi, published });
  }
  return out.sort((a, b) => b.published.localeCompare(a.published) || compareVersions(b.version, a.version));
}

/** True when one of a record's creators has one of `familyNames`. */
function sharesCreator(metadata: Record<string, unknown>, familyNames: readonly string[]): boolean {
  const creators = Array.isArray(metadata.creators) ? metadata.creators : [];
  return creators.some((c) => isRecord(c) && typeof c.name === 'string' && familyNames.includes(familyOf(c.name)));
}

/** {@link ZenodoApi} over HTTPS. */
export class ZenodoClient implements ZenodoApi {
  constructor(private readonly endpoint: Endpoint = ZENODO) {}

  async licenceKnown(id: string): Promise<boolean | undefined> {
    const { status } = await getJson(this.endpoint, `/api/vocabularies/licenses/${encodeURIComponent(id)}`);
    return status === 200 ? true : status === 404 ? false : undefined;
  }

  async versions(conceptRecordId: string): Promise<ZenodoVersion[]> {
    // 25 is the most Zenodo returns to an anonymous request; newest first, that covers what is shown.
    const q = new URLSearchParams({ q: `conceptrecid:${conceptRecordId}`, all_versions: 'true', sort: 'newest', size: String(PAGE_SIZE) });
    const { status, body } = await getJson(this.endpoint, `/api/records?${q.toString()}`);
    if (status !== 200) {
      throw new Error(`Zenodo answered HTTP ${status} for record ${conceptRecordId}`);
    }
    return parseVersions(body);
  }

  async conceptDoiByTitle(title: string, familyNames: readonly string[]): Promise<string | undefined> {
    const q = new URLSearchParams({ q: `title:"${title.replace(/"/g, '')}"`, size: String(PAGE_SIZE) });
    const { status, body } = await getJson(this.endpoint, `/api/records?${q.toString()}`);
    if (status !== 200 || !isRecord(body) || !isRecord(body.hits) || !Array.isArray(body.hits.hits)) {
      return undefined;
    }
    for (const h of body.hits.hits) {
      if (isRecord(h) && isRecord(h.metadata) && h.metadata.title === title && typeof h.conceptdoi === 'string' && sharesCreator(h.metadata, familyNames)) {
        return h.conceptdoi;
      }
    }
    return undefined;
  }
}
