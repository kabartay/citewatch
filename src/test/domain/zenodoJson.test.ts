/**
 * @file Tests for `.zenodo.json` checks, built from mistakes that cost real DOIs.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { checkZenodoJson, lineOfKey, zenodoLicence } from '../../domain/zenodoJson';

const VALID = {
  upload_type: 'software',
  title: 'Jobwatch',
  description: '<p>A VS Code extension.</p>',
  creators: [{ name: 'Organokov, Mukharbek', orcid: '0000-0002-3093-3456' }],
  license: 'mit',
  access_right: 'open',
  version: '0.1.3',
  keywords: ['zenodo'],
};
const json = (over: Record<string, unknown> = {}) => JSON.stringify({ ...VALID, ...over }, null, 2);
const codes = (text: string) => checkZenodoJson(text).map((p) => p.code);

describe('checkZenodoJson', () => {
  it('passes a valid file', () => {
    assert.deepEqual(checkZenodoJson(json()), []);
  });

  it('catches the capitalised licence that cost FinTFM 0.5.2 its DOI, on its own line', () => {
    const text = json({ license: 'Apache-2.0' });
    const [p] = checkZenodoJson(text);
    assert.equal(p?.code, 'zenodo.license-case');
    assert.match(p?.message ?? '', /write "apache-2.0"/);
    assert.match(text.split('\n')[p?.line ?? 0] ?? '', /"license"/);
  });

  it('reports every missing required field', () => {
    const partial: Record<string, unknown> = { ...VALID };
    delete partial.description;
    delete partial.creators;
    assert.deepEqual(codes(JSON.stringify(partial)), ['zenodo.required', 'zenodo.required']);
  });

  it('warns about a version written with a v', () => {
    assert.deepEqual(codes(json({ version: 'v0.5.1' })), ['zenodo.version-prefix']);
  });

  it('rejects unknown upload types and access rights', () => {
    assert.deepEqual(codes(json({ upload_type: 'code', access_right: 'public' })), ['zenodo.upload-type', 'zenodo.access-right']);
  });

  it('checks each creator: name format and ORCID checksum', () => {
    const text = json({ creators: [{ name: 'Mukharbek Organokov', orcid: '0000-0002-3093-3457' }] });
    assert.deepEqual(codes(text), ['zenodo.creator-name-format', 'zenodo.orcid']);
  });

  it('reports invalid JSON with its line', () => {
    const [p] = checkZenodoJson('{\n  "title": "x",\n  oops\n}');
    assert.equal(p?.code, 'zenodo.json-syntax');
    assert.equal(p?.line, 2);
  });

  it('reads the licence as a string or an object', () => {
    assert.equal(zenodoLicence(json()), 'mit');
    assert.equal(zenodoLicence(json({ license: { id: 'cc-by-4.0' } })), 'cc-by-4.0');
  });

  it('finds the nth occurrence of a key', () => {
    assert.equal(lineOfKey('{\n"a": 1,\n"b": {"a": 2}\n}', 'a', 1), 2);
  });
});
