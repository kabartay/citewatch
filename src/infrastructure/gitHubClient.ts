/**
 * @file Whether Zenodo's GitHub integration is on for a repository: switching it on installs a
 * webhook pointing at zenodo.org for `release` events, and switching it off removes it.
 *
 * Listing hooks needs admin access, so the answer is `unknown` without a token or without the
 * right, never a guess.
 */

import type { ZenodoSwitchSource } from '../application/ports';
import type { ZenodoSwitch } from '../domain/types';
import { getJson, GITHUB, type Endpoint } from './http';

/** Reads a hooks list: `on` when one points at Zenodo and fires on releases. */
export function switchFromHooks(body: unknown): ZenodoSwitch {
  if (!Array.isArray(body)) {
    return 'unknown';
  }
  const zenodo = body.some((hook: unknown) => {
    if (typeof hook !== 'object' || hook === null) {
      return false;
    }
    const h = hook as { config?: { url?: unknown }; events?: unknown; active?: unknown };
    const url = typeof h.config?.url === 'string' ? h.config.url : '';
    const events = Array.isArray(h.events) ? h.events : [];
    return /^https:\/\/zenodo\.org\//.test(url) && h.active !== false && (events.includes('release') || events.includes('*'));
  });
  return zenodo ? 'on' : 'off';
}

/** {@link ZenodoSwitchSource} over GitHub's REST API. */
export class GitHubClient implements ZenodoSwitchSource {
  /**
   * @param token - Gets a GitHub token, or `undefined` when the user has not signed in.
   */
  constructor(
    private readonly token: () => Promise<string | undefined>,
    private readonly endpoint: Endpoint = GITHUB,
  ) {}

  async zenodoSwitch(repo: string): Promise<ZenodoSwitch> {
    const token = await this.token();
    if (!token) {
      return 'unknown';
    }
    const { status, body } = await getJson(this.endpoint, `/repos/${repo}/hooks?per_page=100`, token);
    return status === 200 ? switchFromHooks(body) : 'unknown';
  }
}
