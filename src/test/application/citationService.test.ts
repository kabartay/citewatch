/**
 * @file Tests for assembling a folder's citation summary from its files and the two services.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { CitationService, SUMMARY_TTL_MS } from '../../application/citationService';
import { LicenceChecker } from '../../application/licenceChecker';
import type { FolderFiles, Logger, ZenodoApi, ZenodoSwitchSource } from '../../application/ports';
import type { ZenodoSwitch, ZenodoVersion } from '../../domain/types';

const silent: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined };
const files = (map: Record<string, string>): FolderFiles => ({ read: async (n) => map[n] });

class FakeZenodo implements ZenodoApi {
  calls: string[] = [];
  constructor(private readonly found: Record<string, ZenodoVersion[]> = {}, private readonly titles: Record<string, string> = {}) {}
  async licenceKnown(id: string): Promise<boolean | undefined> {
    this.calls.push(`licence:${id}`);
    return id === 'mit';
  }
  async versions(id: string): Promise<ZenodoVersion[]> {
    this.calls.push(`versions:${id}`);
    return this.found[id] ?? [];
  }
  async conceptDoiByTitle(title: string, familyNames: readonly string[]): Promise<string | undefined> {
    this.calls.push(`title:${title}:${familyNames.join('|')}`);
    return this.titles[title];
  }
}
const switchOf = (s: ZenodoSwitch): ZenodoSwitchSource => ({ zenodoSwitch: async () => s });
const V: ZenodoVersion = { version: '0.1.3', doi: '10.5281/zenodo.23269578', published: '2026-10-09' };
const REPO = {
  '.git/config': '[remote "origin"]\n\turl = https://github.com/kabartay/jobwatch.git\n',
  'package.json': '{"version": "0.1.4"}',
  'CITATION.cff': 'cff-version: 1.2.0\nversion: 0.1.4\nidentifiers:\n  - type: doi\n    value: 10.5281/zenodo.23269419\n',
};

describe('CitationService.summary', () => {
  it('assembles repo, DOI, versions, local version and switch', async () => {
    const zenodo = new FakeZenodo({ '23269419': [V] });
    const s = await new CitationService(zenodo, switchOf('on'), silent).summary('k', files(REPO), { checkSwitch: true });
    assert.deepEqual(s, { repo: 'kabartay/jobwatch', conceptDoi: '10.5281/zenodo.23269419', versions: [V], localVersion: '0.1.4', zenodoSwitch: 'on', citable: true });
  });

  it('falls back to the README badge, then to a title search', async () => {
    const readme = files({ 'README.md': '[![DOI](https://img.shields.io/badge/DOI-10.5281%2Fzenodo.42-blue.svg)]', '.zenodo.json': '{"title":"T"}' });
    assert.equal((await new CitationService(new FakeZenodo(), switchOf('on'), silent).summary('a', readme, { checkSwitch: false })).conceptDoi, '10.5281/zenodo.42');
    const titled = files({ '.zenodo.json': '{"title":"Jobwatch","creators":[{"name":"Organokov, Mukharbek"}]}' });
    const zenodo = new FakeZenodo({}, { Jobwatch: '10.5281/zenodo.7' });
    assert.equal((await new CitationService(zenodo, switchOf('on'), silent).summary('b', titled, { checkSwitch: false })).conceptDoi, '10.5281/zenodo.7');
    assert.ok(zenodo.calls.includes('title:Jobwatch:organokov'));
  });

  it('never searches by title without creators to tell records apart', async () => {
    const zenodo = new FakeZenodo({}, { Jobwatch: '10.5281/zenodo.7' });
    const s = await new CitationService(zenodo, switchOf('on'), silent).summary('c', files({ '.zenodo.json': '{"title":"Jobwatch"}' }), { checkSwitch: false });
    assert.equal(s.conceptDoi, undefined);
    assert.deepEqual(zenodo.calls, []);
  });

  it('caches per folder for the TTL, and refetches when forced', async () => {
    const zenodo = new FakeZenodo({ '23269419': [V] });
    const service = new CitationService(zenodo, switchOf('on'), silent);
    await service.summary('k', files(REPO), { checkSwitch: true }, false, 0);
    await service.summary('k', files(REPO), { checkSwitch: true }, false, 1000);
    assert.equal(zenodo.calls.length, 1);
    await service.summary('k', files(REPO), { checkSwitch: true }, false, SUMMARY_TTL_MS + 1);
    await service.summary('k', files(REPO), { checkSwitch: true }, true, SUMMARY_TTL_MS + 2);
    assert.equal(zenodo.calls.length, 3);
  });

  it('survives a failing service, reporting what it can', async () => {
    const broken: ZenodoApi = { licenceKnown: async () => undefined, versions: async () => { throw new Error('down'); }, conceptDoiByTitle: async () => undefined };
    const s = await new CitationService(broken, switchOf('unknown'), silent).summary('k', files(REPO), { checkSwitch: true });
    assert.equal(s.conceptDoi, '10.5281/zenodo.23269419');
    assert.deepEqual(s.versions, []);
  });

  it('does not ask GitHub when the check is off', async () => {
    let asked = false;
    const spy: ZenodoSwitchSource = { zenodoSwitch: async () => { asked = true; return 'on'; } };
    await new CitationService(new FakeZenodo(), spy, silent).summary('k', files(REPO), { checkSwitch: false });
    assert.equal(asked, false);
  });
});

describe('LicenceChecker', () => {
  it('asks once per licence, and retries when Zenodo could not answer', async () => {
    const zenodo = new FakeZenodo();
    const checker = new LicenceChecker(zenodo);
    assert.equal(await checker.isKnown('mit'), true);
    assert.equal(await checker.isKnown('mit'), true);
    assert.equal(zenodo.calls.filter((c) => c === 'licence:mit').length, 1);
    const flaky: ZenodoApi = { licenceKnown: async () => undefined, versions: async () => [], conceptDoiByTitle: async () => undefined };
    assert.equal(await new LicenceChecker(flaky).isKnown('mit'), undefined);
  });
});
