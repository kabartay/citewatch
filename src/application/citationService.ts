/**
 * @file Assembles what the status bar shows for a folder: its DOI, archived versions, local
 * version and whether Zenodo is switched on.
 *
 * Zenodo allows about 30 requests a minute, so results are cached per folder and refetched only
 * when asked or after {@link SUMMARY_TTL_MS}.
 */

import { cffDoi, cffScalar } from '../domain/citationCff';
import { creatorFamilyNames } from '../domain/creators';
import { zenodoRecordId } from '../domain/identifiers';
import { gitHubRepo, originUrl, readmeZenodoDoi } from '../domain/repository';
import type { CitationSummary, VersionSource, ZenodoSwitch } from '../domain/types';
import { readVersion, referenceVersion, VERSION_FILES } from '../domain/versions';
import type { FolderFiles, Logger, ZenodoApi, ZenodoSwitchSource } from './ports';

/** How long a summary stays fresh. */
export const SUMMARY_TTL_MS = 10 * 60 * 1000;

/** Options read from settings on each call. */
export interface SummaryOptions {
  readonly checkSwitch: boolean;
}

/** Reads the version every relevant file states. */
export async function readVersions(files: FolderFiles): Promise<VersionSource[]> {
  const out: VersionSource[] = [];
  for (const file of VERSION_FILES) {
    const text = await files.read(file);
    const v = text === undefined ? undefined : readVersion(file, text);
    if (v) {
      out.push(v);
    }
  }
  return out;
}

/** Builds and caches folder summaries. */
export class CitationService {
  private readonly cache = new Map<string, { at: number; summary: CitationSummary }>();

  constructor(
    private readonly zenodo: ZenodoApi,
    private readonly switches: ZenodoSwitchSource,
    private readonly log: Logger,
  ) {}

  /**
   * @param key - Identifies the folder in the cache (its path).
   * @param force - Ignore the cache.
   */
  async summary(key: string, files: FolderFiles, options: SummaryOptions, force = false, now = Date.now()): Promise<CitationSummary> {
    const hit = this.cache.get(key);
    if (!force && hit && now - hit.at < SUMMARY_TTL_MS) {
      return hit.summary;
    }
    const summary = await this.build(files, options);
    this.cache.set(key, { at: now, summary });
    return summary;
  }

  private async build(files: FolderFiles, options: SummaryOptions): Promise<CitationSummary> {
    const [cff, zenodoJson, readme, gitConfig] = await Promise.all([
      files.read('CITATION.cff'),
      files.read('.zenodo.json'),
      files.read('README.md'),
      files.read('.git/config'),
    ]);
    const citable = cff !== undefined || zenodoJson !== undefined;
    const remote = gitConfig ? originUrl(gitConfig) : undefined;
    const repo = remote ? gitHubRepo(remote) : undefined;
    const localVersion = referenceVersion(await readVersions(files))?.version;

    let conceptDoi = (cff ? cffDoi(cff) : undefined) ?? (readme ? readmeZenodoDoi(readme) : undefined);
    if (!conceptDoi && citable) {
      const title = titleOf(zenodoJson, cff);
      const families = creatorFamilyNames(zenodoJson, cff);
      if (title && families.length > 0) {
        conceptDoi = await this.safely(() => this.zenodo.conceptDoiByTitle(title, families), undefined, 'title search');
      }
    }
    const recordId = conceptDoi ? zenodoRecordId(conceptDoi) : undefined;
    const versions = recordId ? await this.safely(() => this.zenodo.versions(recordId), [], 'versions') : [];
    const zenodoSwitch: ZenodoSwitch =
      options.checkSwitch && repo ? await this.safely(() => this.switches.zenodoSwitch(repo), 'unknown', 'switch') : 'unknown';
    this.log.info(
      `${repo ?? 'project without a GitHub remote'}: ${conceptDoi ?? 'no DOI'}, ${versions.length} archived, files say ${localVersion ?? 'no version'}, Zenodo ${zenodoSwitch}`,
    );
    return { repo, conceptDoi, versions, localVersion, zenodoSwitch, citable };
  }

  private async safely<T>(fn: () => Promise<T>, fallback: T, what: string): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.log.warn(`${what}: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  }
}

/** The record title from `.zenodo.json`, else `CITATION.cff`. */
function titleOf(zenodoJson: string | undefined, cff: string | undefined): string | undefined {
  if (zenodoJson) {
    try {
      const t = (JSON.parse(zenodoJson) as { title?: unknown }).title;
      if (typeof t === 'string' && t.trim()) {
        return t.trim();
      }
    } catch {
      // Malformed: the diagnostics report it; fall through to CITATION.cff.
    }
  }
  return cff ? cffScalar(cff, 'title')?.value : undefined;
}
