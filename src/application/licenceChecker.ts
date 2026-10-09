/**
 * @file Checks a licence id against Zenodo's live vocabulary, once per id per session.
 */

import type { ZenodoApi } from './ports';

/** Caches vocabulary answers; an unreachable vocabulary is not cached, so it is retried. */
export class LicenceChecker {
  private readonly known = new Map<string, boolean>();

  constructor(private readonly zenodo: ZenodoApi) {}

  /** @returns `true` or `false` from Zenodo, or `undefined` when it could not be asked. */
  async isKnown(id: string): Promise<boolean | undefined> {
    const cached = this.known.get(id);
    if (cached !== undefined) {
      return cached;
    }
    let answer: boolean | undefined;
    try {
      answer = await this.zenodo.licenceKnown(id);
    } catch {
      answer = undefined;
    }
    if (answer !== undefined) {
      this.known.set(id, answer);
    }
    return answer;
  }
}
