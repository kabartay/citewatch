/**
 * @file Ports: what the application layer needs from the outside world.
 *
 * `infrastructure/` implements them with HTTPS and the file system; tests pass fakes.
 */

import type { ZenodoSwitch, ZenodoVersion } from '../domain/types';

/** Zenodo's public API. Implemented by `ZenodoClient`. */
export interface ZenodoApi {
  /** @returns Whether Zenodo's licence vocabulary knows `id`, or `undefined` when it cannot say. */
  licenceKnown(id: string): Promise<boolean | undefined>;
  /** @returns Every archived version of a concept record, newest first. */
  versions(conceptRecordId: string): Promise<ZenodoVersion[]>;
  /**
   * @param familyNames - Lower-cased creator family names from the local metadata; a record counts
   * only if one of its creators has one of them, so another project's same-titled record is never
   * taken for this one.
   * @returns The concept DOI of the record with exactly this title and a shared creator, if any.
   */
  conceptDoiByTitle(title: string, familyNames: readonly string[]): Promise<string | undefined>;
}

/** Whether Zenodo's webhook is installed on a repository. Implemented by `GitHubClient`. */
export interface ZenodoSwitchSource {
  zenodoSwitch(repo: string): Promise<ZenodoSwitch>;
}

/** Files in one workspace folder, by name relative to its root. */
export interface FolderFiles {
  /** @returns The file's text, or `undefined` when it does not exist. */
  read(name: string): Promise<string | undefined>;
}

/** Where messages go. Implemented by VS Code's `LogOutputChannel`. */
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
}
