/**
 * @file The extension's vocabulary: problems in citation files, versions, and Zenodo records.
 */

/** How serious a problem is. An `error` would stop Zenodo minting a DOI or break the file. */
export type Severity = 'error' | 'warning' | 'info';

/** One problem in a file, located for an editor. */
export interface Problem {
  readonly severity: Severity;
  readonly message: string;
  /** 0-based line; 0 when the whole file is concerned. */
  readonly line: number;
  /** A short, stable id, e.g. `zenodo.license-case`, shown as the diagnostic code. */
  readonly code: string;
}

/** The files whose versions must agree. */
export type VersionFile = 'package.json' | 'pyproject.toml' | 'CITATION.cff' | '.zenodo.json';

/** A version as one file states it. */
export interface VersionSource {
  readonly file: VersionFile;
  readonly version: string;
  /** 0-based line of the version, for the diagnostic. */
  readonly line: number;
}

/** One archived version of a Zenodo record. */
export interface ZenodoVersion {
  readonly version: string;
  /** This version's DOI, e.g. `10.5281/zenodo.23269578`. */
  readonly doi: string;
  /** `YYYY-MM-DD`. */
  readonly published: string;
}

/** Whether Zenodo's GitHub integration is switched on for the repository. */
export type ZenodoSwitch = 'on' | 'off' | 'unknown';

/** What the status bar shows for one repository. */
export interface CitationSummary {
  /** `owner/repo` on GitHub, when the folder has a GitHub remote. */
  readonly repo?: string;
  /** The DOI that always resolves to the newest version. */
  readonly conceptDoi?: string;
  /** Archived versions, newest first. */
  readonly versions: readonly ZenodoVersion[];
  /** The version the files state, when they agree. */
  readonly localVersion?: string;
  readonly zenodoSwitch: ZenodoSwitch;
  /** True when the folder has `.zenodo.json` or `CITATION.cff`, i.e. means to be citable. */
  readonly citable: boolean;
}
