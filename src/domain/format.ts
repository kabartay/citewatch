/**
 * @file Text the editor shows: the status bar, its tooltip, and the DOI badge.
 */

import { zenodoRecordId } from './identifiers';
import type { CitationSummary } from './types';

/**
 * A DOI badge in Markdown, from shields.io.
 *
 * Zenodo's own badge is an SVG on zenodo.org, which `vsce` refuses in a VS Code extension's
 * README and which therefore breaks packaging; shields.io works everywhere.
 */
export function doiBadge(doi: string): string {
  const label = encodeURIComponent(doi).replace(/-/g, '--');
  return `[![DOI](https://img.shields.io/badge/DOI-${label}-blue.svg)](https://doi.org/${doi})`;
}

/** The status bar text: `$(book) zenodo.23269419 · 0.1.3`, or a prompt when nothing is archived. */
export function statusText(s: CitationSummary): string {
  if (s.conceptDoi) {
    const id = zenodoRecordId(s.conceptDoi);
    const latest = s.versions[0]?.version;
    const icon = s.zenodoSwitch === 'off' ? '$(warning)' : '$(book)';
    return `${icon} ${id ? `zenodo.${id}` : s.conceptDoi}${latest ? ` · ${latest}` : ''}`;
  }
  return s.zenodoSwitch === 'off' ? '$(warning) No DOI · Zenodo off' : '$(book) No DOI yet';
}

/** True when the status bar should be amber: citable files but Zenodo is not listening. */
export function needsAttention(s: CitationSummary): boolean {
  return s.citable && s.zenodoSwitch === 'off';
}

/** The tooltip, in Markdown. */
export function tooltipMarkdown(s: CitationSummary): string {
  const lines = [`**Citewatch**${s.repo ? ` · ${s.repo}` : ''}`, ''];
  if (s.conceptDoi) {
    lines.push(`Concept DOI: [${s.conceptDoi}](https://doi.org/${s.conceptDoi}) · always the newest version; cite this one`);
  } else {
    lines.push('No DOI yet. Zenodo mints one when a GitHub release is published with the integration on.');
  }
  const latest = s.versions[0];
  if (latest) {
    lines.push(`Latest archived: **${latest.version}** · [${latest.doi}](https://doi.org/${latest.doi}) · ${latest.published}`);
    if (s.versions.length > 1) {
      lines.push(`${s.versions.length} versions archived`);
    }
  }
  if (s.localVersion && latest && s.localVersion.replace(/^v/i, '') !== latest.version.replace(/^v/i, '')) {
    lines.push(`Files say **${s.localVersion}**, not yet archived: it will be once released.`);
  }
  lines.push('');
  lines.push(
    s.zenodoSwitch === 'on'
      ? 'Zenodo integration: **on** for this repository.'
      : s.zenodoSwitch === 'off'
        ? '⚠ Zenodo integration: **off**. A release now gets no DOI; switch the repository on in Zenodo\'s GitHub settings first.'
        : 'Zenodo integration: unknown (sign in to GitHub to check).',
  );
  lines.push('', 'Click for DOI actions.');
  return lines.join('\n');
}
