/**
 * @file Tests for `CITATION.cff` checks and the values Citewatch reads from it.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cffDoi, cffScalar, checkCitationCff } from '../../domain/citationCff';

const CFF = `cff-version: 1.2.0
title: "Jobwatch: a VS Code extension"
message: >-
  If you use this software, please cite it.
type: software
authors:
  - family-names: Organokov
    given-names: Mukharbek
    orcid: "https://orcid.org/0000-0002-3093-3456"
repository-code: "https://github.com/kabartay/jobwatch"
identifiers:
  - type: doi
    value: 10.5281/zenodo.23269419
    description: The concept DOI.
license: MIT
version: 0.1.3
date-released: "2026-10-09"
`;
const codes = (text: string, today = '2026-10-10') => checkCitationCff(text, today).map((p) => p.code);

describe('checkCitationCff', () => {
  it('passes a valid file', () => {
    assert.deepEqual(checkCitationCff(CFF, '2026-10-10'), []);
  });

  it('requires cff-version, title, message and authors', () => {
    assert.deepEqual(codes('license: MIT\n'), ['cff.version-field', 'cff.title', 'cff.message', 'cff.authors']);
  });

  it('catches a bad ORCID checksum and a bare ORCID', () => {
    assert.deepEqual(codes(CFF.replace('3093-3456"', '3093-3457"')), ['cff.orcid']);
    assert.deepEqual(codes(CFF.replace('"https://orcid.org/0000-0002-3093-3456"', '0000-0002-3093-3456')), ['cff.orcid-url']);
  });

  it('checks the release date, including one in the future', () => {
    assert.deepEqual(codes(CFF.replace('"2026-10-09"', '"9 Oct 2026"')), ['cff.date']);
    assert.deepEqual(codes(CFF, '2026-10-01'), ['cff.date-future']);
  });

  it('warns about a v in the version', () => {
    assert.deepEqual(codes(CFF.replace('version: 0.1.3', 'version: v0.1.3')), ['cff.version-prefix']);
  });
});

describe('cffScalar and cffDoi', () => {
  it('reads quoted and unquoted scalars with their line', () => {
    assert.deepEqual(cffScalar(CFF, 'version'), { value: '0.1.3', line: 15 });
    assert.equal(cffScalar(CFF, 'title')?.value, 'Jobwatch: a VS Code extension');
  });

  it('finds the DOI among identifiers, or at the top level', () => {
    assert.equal(cffDoi(CFF), '10.5281/zenodo.23269419');
    assert.equal(cffDoi('doi: https://doi.org/10.5281/zenodo.1\n'), '10.5281/zenodo.1');
    assert.equal(cffDoi('title: x\n'), undefined);
  });
});
