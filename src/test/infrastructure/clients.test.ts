/**
 * @file Tests for the Zenodo and GitHub clients against a real local server.
 */

import { strict as assert } from 'node:assert';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { GitHubClient, switchFromHooks } from '../../infrastructure/gitHubClient';
import type { Endpoint } from '../../infrastructure/http';
import { compareVersions, parseVersions, ZenodoClient } from '../../infrastructure/zenodoClient';

const RECORDS = {
  hits: {
    hits: [
      { doi: '10.5281/zenodo.9', conceptdoi: '10.5281/zenodo.8', metadata: { title: 'Jobwatch', creators: [{ name: 'Someone Else' }], version: '9.9.9', publication_date: '2026-10-01' } },
      { doi: '10.5281/zenodo.2', conceptdoi: '10.5281/zenodo.1', metadata: { title: 'Jobwatch', creators: [{ name: 'Organokov, Mukharbek' }], version: '0.1.2', publication_date: '2026-10-09' } },
      { doi: '10.5281/zenodo.3', conceptdoi: '10.5281/zenodo.1', metadata: { title: 'Jobwatch', creators: [{ name: 'Organokov, Mukharbek' }], version: '0.1.10', publication_date: '2026-10-09' } },
      { doi: '10.5281/zenodo.4', conceptdoi: '10.5281/zenodo.1', metadata: { title: 'Jobwatch', creators: [{ name: 'Organokov, Mukharbek' }], version: '0.1.1', publication_date: '2026-10-08' } },
    ],
  },
};

describe('clients', () => {
  let server: http.Server;
  let endpoint: Endpoint;
  const seen: Array<{ url: string; auth?: string }> = [];

  before(async () => {
    server = http.createServer((req, res) => {
      seen.push({ url: req.url ?? '', auth: req.headers.authorization });
      const url = req.url ?? '';
      const send = (status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (url === '/api/vocabularies/licenses/mit') return send(200, { id: 'mit' });
      if (url.startsWith('/api/vocabularies/licenses/')) return send(404, { status: 404 });
      if (url.startsWith('/api/records?')) {
        if (Number(/size=(\d+)/.exec(url)?.[1]) > 25) return send(400, { message: 'Page size cannot be greater than 25.' });
        const concept = /conceptrecid%3A(\d+)/.exec(url)?.[1];
        return send(200, concept ? { hits: { hits: RECORDS.hits.hits.filter((h) => h.conceptdoi === `10.5281/zenodo.${concept}`) } } : RECORDS);
      }
      if (url === '/repos/kabartay/jobwatch/hooks?per_page=100') return send(200, [{ active: true, events: ['release'], config: { url: 'https://zenodo.org/api/hooks/receivers/github/events/?access_token=x' } }]);
      if (url === '/repos/kabartay/citewatch/hooks?per_page=100') return send(200, []);
      return send(404, {});
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    endpoint = { hostname: '127.0.0.1', port: (server.address() as AddressInfo).port, request: http.request, timeoutMs: 2000 };
  });
  after(() => new Promise<void>((r) => server.close(() => r())));

  it('asks Zenodo whether a licence id exists', async () => {
    const z = new ZenodoClient(endpoint);
    assert.equal(await z.licenceKnown('mit'), true);
    assert.equal(await z.licenceKnown('Apache-2.0'), false);
  });

  it('lists versions newest first, numerically', async () => {
    const versions = await new ZenodoClient(endpoint).versions('1');
    assert.deepEqual(versions.map((v) => v.version), ['0.1.10', '0.1.2', '0.1.1']);
    assert.match(seen.at(-1)?.url ?? '', /q=conceptrecid%3A1&all_versions=true/);
  });

  it('finds a concept DOI by exact title and a shared creator only', async () => {
    const z = new ZenodoClient(endpoint);
    assert.equal(await z.conceptDoiByTitle('Jobwatch', ['organokov']), '10.5281/zenodo.1', 'skips the stranger listed first');
    assert.equal(await z.conceptDoiByTitle('Jobwatch', ['nobody']), undefined);
    assert.equal(await z.conceptDoiByTitle('Job', ['organokov']), undefined);
  });

  it('reads the Zenodo switch from webhooks, with the token, and is unknown without one', async () => {
    const gh = new GitHubClient(async () => 'gho_TOKEN', endpoint);
    assert.equal(await gh.zenodoSwitch('kabartay/jobwatch'), 'on');
    assert.equal(seen.at(-1)?.auth, 'Bearer gho_TOKEN');
    assert.equal(await gh.zenodoSwitch('kabartay/citewatch'), 'off');
    assert.equal(await gh.zenodoSwitch('someone/forbidden'), 'unknown', 'a 404 (no admin access) is not a no');
    assert.equal(await new GitHubClient(async () => undefined, endpoint).zenodoSwitch('kabartay/jobwatch'), 'unknown');
  });
});

describe('pure helpers', () => {
  it('ignores inactive or non-release Zenodo hooks', () => {
    const hook = (over: object) => [{ active: true, events: ['release'], config: { url: 'https://zenodo.org/x' }, ...over }];
    assert.equal(switchFromHooks(hook({ active: false })), 'off');
    assert.equal(switchFromHooks(hook({ events: ['push'] })), 'off');
    assert.equal(switchFromHooks(hook({ config: { url: 'https://evil.example/zenodo.org/' } })), 'off');
    assert.equal(switchFromHooks({ message: 'Not Found' }), 'unknown');
  });

  it('compares versions numerically and skips malformed records', () => {
    assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
    assert.ok(compareVersions('v1.0.0', '1.0.0') === 0);
    assert.deepEqual(parseVersions({ hits: { hits: [{ metadata: {} }, 'x'] } }), []);
  });
});
