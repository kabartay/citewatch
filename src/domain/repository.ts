/**
 * @file Finds the GitHub repository and the DOI a folder already declares.
 */

import { bareDoi } from './identifiers';

/** `owner/repo` from a GitHub remote URL (https or ssh), or `undefined` for anything else. */
export function gitHubRepo(remote: string): string | undefined {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return m?.[1] && m[2] ? `${m[1]}/${m[2]}` : undefined;
}

/** The `origin` remote's URL from the text of `.git/config`. */
export function originUrl(gitConfig: string): string | undefined {
  let inOrigin = false;
  for (const raw of gitConfig.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(line);
      continue;
    }
    const m = /^url\s*=\s*(.+)$/.exec(line);
    if (inOrigin && m?.[1]) {
      return m[1].trim();
    }
  }
  return undefined;
}

/** The first Zenodo DOI in a README (a badge or a link), or `undefined`. */
export function readmeZenodoDoi(readme: string): string | undefined {
  const m = /10\.5281\/zenodo\.\d+/i.exec(decodeURIComponent(readme.replace(/%(?![0-9a-f]{2})/gi, '%25')));
  return m ? bareDoi(m[0]) : undefined;
}
