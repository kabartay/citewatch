/**
 * @file Tests for the badge, the status text, and finding a folder's repository and DOI.
 */

import { strict as assert } from 'node:assert';
import { creatorFamilyNames } from '../../domain/creators';
import { describe, it } from 'node:test';
import { doiBadge, needsAttention, statusText, tooltipMarkdown } from '../../domain/format';
import { gitHubRepo, originUrl, readmeZenodoDoi } from '../../domain/repository';
import type { CitationSummary } from '../../domain/types';

const SUMMARY: CitationSummary = {
  repo: 'kabartay/jobwatch',
  conceptDoi: '10.5281/zenodo.23269419',
  versions: [{ version: '0.1.3', doi: '10.5281/zenodo.23269578', published: '2026-10-09' }],
  localVersion: '0.1.3',
  zenodoSwitch: 'on',
  citable: true,
};

describe('doiBadge', () => {
  it('uses shields.io, which vsce accepts, and links the DOI', () => {
    assert.equal(
      doiBadge('10.5281/zenodo.23269419'),
      '[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.23269419-blue.svg)](https://doi.org/10.5281/zenodo.23269419)',
    );
  });
});

describe('statusText and tooltip', () => {
  it('shows the record and the latest archived version', () => {
    assert.equal(statusText(SUMMARY), '$(book) zenodo.23269419 · 0.1.3');
  });

  it('warns when Zenodo is off for a citable repository', () => {
    const off = { ...SUMMARY, zenodoSwitch: 'off' as const };
    assert.equal(statusText(off), '$(warning) zenodo.23269419 · 0.1.3');
    assert.equal(needsAttention(off), true);
    assert.match(tooltipMarkdown(off), /A release now gets no DOI/);
  });

  it('says when the files are ahead of the archive', () => {
    assert.match(tooltipMarkdown({ ...SUMMARY, localVersion: '0.1.4' }), /Files say \*\*0\.1\.4\*\*, not yet archived/);
  });

  it('prompts when there is no DOI yet', () => {
    assert.equal(statusText({ ...SUMMARY, conceptDoi: undefined, versions: [] }), '$(book) No DOI yet');
  });
});

describe('repository', () => {
  it('reads owner/repo from https and ssh remotes', () => {
    assert.equal(gitHubRepo('https://github.com/kabartay/jobwatch.git'), 'kabartay/jobwatch');
    assert.equal(gitHubRepo('git@github.com:finkelehq/finkele-axiom.git'), 'finkelehq/finkele-axiom');
    assert.equal(gitHubRepo('https://gitlab.com/a/b'), undefined);
  });

  it('finds the origin url in .git/config', () => {
    const cfg = '[core]\n\tbare = false\n[remote "upstream"]\n\turl = https://github.com/x/y\n[remote "origin"]\n\turl = https://github.com/kabartay/citewatch.git\n';
    assert.equal(originUrl(cfg), 'https://github.com/kabartay/citewatch.git');
  });

  it('finds a Zenodo DOI in a README badge, URL-encoded or not', () => {
    assert.equal(readmeZenodoDoi('<img src="https://img.shields.io/badge/DOI-10.5281%2Fzenodo.23267879-blue.svg">'), '10.5281/zenodo.23267879');
    assert.equal(readmeZenodoDoi('[DOI](https://doi.org/10.5281/zenodo.22949759)'), '10.5281/zenodo.22949759');
    assert.equal(readmeZenodoDoi('no doi here 100%'), undefined);
  });
});

describe('creatorFamilyNames', () => {
  it('reads family names from both files, lower-cased and deduplicated', () => {
    const zenodo = '{"creators":[{"name":"Organokov, Mukharbek"},{"name":"Ada Lovelace"}]}';
    const cff = 'authors:\n  - family-names: Organokov\n    given-names: Mukharbek\n  - family-names: "van Rossum"\n';
    assert.deepEqual(creatorFamilyNames(zenodo, cff).sort(), ['lovelace', 'organokov', 'van rossum']);
    assert.deepEqual(creatorFamilyNames('{bad', undefined), []);
  });
});
